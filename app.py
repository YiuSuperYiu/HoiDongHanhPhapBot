import os
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ConnectRequest(BaseModel):
    api_key: str = Field(min_length=10)


class ChatRequest(BaseModel):
    api_key: str = Field(min_length=10)
    model: str = Field(default="claude-opus-4-6")
    system_prompt: str = ""
    messages: list[Message] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(default=1024, ge=64, le=4096)


app = FastAPI(title="HopeStar Studio Engine Core V1")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def _now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_upstream_error(response: httpx.Response) -> dict[str, Any]:
    fallback = response.text or "Claude API lỗi."
    detail: dict[str, Any] = {"message": fallback, "opened_at": _now_iso_utc()}

    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error_data = payload.get("error", {}) if isinstance(payload.get("error"), dict) else {}
        message = error_data.get("message") or payload.get("message") or fallback
        detail["message"] = message
        detail["upstream"] = payload

        normalized = message.lower()
        if "credit balance is too low" in normalized:
            detail["code"] = "insufficient_credit"
            detail["message_vi"] = (
                "Claude đã hết credit. Hãy nạp thêm credit hoặc nâng cấp gói để tiếp tục."
            )
            detail["billing_url"] = "https://console.anthropic.com/settings/plans"

        if any(term in normalized for term in ["expired", "expire", "revoked", "deactivated"]):
            detail["code"] = "expired_access"
            detail["message_vi"] = (
                "Claude/API key đã hết hạn hoặc bị thu hồi. Vui lòng tạo key mới rồi kết nối lại."
            )
            detail["renew_url"] = "https://console.anthropic.com/settings/keys"

    return detail


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health():
    return {"ok": True, "service": "HopeStar Studio Engine Core V1"}


@app.post("/api/connect")
async def connect_claude(payload: ConnectRequest):
    endpoint = f"{os.getenv('ANTHROPIC_BASE_URL', 'https://api.anthropic.com').rstrip('/')}/v1/models"
    headers = {
        "x-api-key": payload.api_key,
        "anthropic-version": "2023-06-01",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(endpoint, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Không thể kết nối Claude API: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=_build_upstream_error(response))

    return {"connected": True, "message": "Kết nối Claude API thành công."}


@app.post("/api/chat")
async def chat(payload: ChatRequest):
    endpoint = f"{os.getenv('ANTHROPIC_BASE_URL', 'https://api.anthropic.com').rstrip('/')}/v1/messages"

    body = {
        "model": payload.model,
        "messages": [
            {"role": msg.role, "content": [{"type": "text", "text": msg.content}]}
            for msg in payload.messages
        ],
        "max_tokens": payload.max_tokens,
        "temperature": payload.temperature,
    }

    if payload.system_prompt.strip():
        body["system"] = payload.system_prompt

    headers = {
        "x-api-key": payload.api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(endpoint, headers=headers, json=body)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Không thể kết nối Claude API: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=_build_upstream_error(response))

    data = response.json()
    reply = "\n".join(
        part.get("text", "") for part in data.get("content", []) if part.get("type") == "text"
    ).strip()

    return {"reply": reply, "raw": data}
