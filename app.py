import json
import os
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import unquote

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, model_validator


DEFAULT_OAUTH_URL = (
    "https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e"
    "&response_type=code&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback"
    "&scope=org%3Acreate_api_key+user%3Aprofile+user%3Ainference+user%3Asessions%3Aclaude_code+"
    "user%3Amcp_servers&code_challenge=5qD-eOVeC9PnN4sU999eWuDNHvGojOVtxLzOJw146eY"
    "&code_challenge_method=S256&state=QD0kATtw7sz1-7-28TFW_kCV9Ue5VZD-HkBX-rLXJ38"
)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ConnectRequest(BaseModel):
    api_key: str | None = Field(default=None)
    oauth_token: str | None = Field(default=None)

    @model_validator(mode="after")
    def validate_auth(self):
        if not (self.api_key or self.oauth_token):
            raise ValueError("Cần api_key hoặc oauth_token.")
        return self


class ChatRequest(BaseModel):
    api_key: str | None = Field(default=None)
    oauth_token: str | None = Field(default=None)
    model: str = Field(default="claude-opus-4-6")
    system_prompt: str = ""
    messages: list[Message] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(default=1024, ge=64, le=4096)

    @model_validator(mode="after")
    def validate_auth(self):
        if not (self.api_key or self.oauth_token):
            raise ValueError("Cần api_key hoặc oauth_token.")
        return self


app = FastAPI(title="HopeStar Studio Engine Core V1")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def _now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_text(value: Any, fallback: str) -> str:
    if value is None:
        return fallback
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(value)


def _build_upstream_error(response: httpx.Response) -> dict[str, Any]:
    fallback = response.text or "Claude API lỗi."
    detail: dict[str, Any] = {"message": fallback, "opened_at": _now_iso_utc()}

    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error_data = payload.get("error", {}) if isinstance(payload.get("error"), dict) else {}
        raw_message = error_data.get("message") or payload.get("message") or fallback
        message = _ensure_text(raw_message, fallback)
        detail["message"] = message
        detail["upstream"] = payload

        normalized = message.lower()
        if "credit balance is too low" in normalized:
            detail["code"] = "insufficient_credit"
            detail["message_vi"] = (
                "Tài khoản Claude trả phí (subscription) không tự dùng được cho API. "
                "Bạn cần quyền/API credits từ luồng OAuth hoặc Billing để tiếp tục."
            )
            detail["billing_url"] = "https://console.anthropic.com/settings/plans"

        if any(term in normalized for term in ["expired", "expire", "revoked", "deactivated"]):
            detail["code"] = "expired_access"
            detail["message_vi"] = (
                "Claude account/token đã hết hạn hoặc bị thu hồi. Vui lòng liên kết lại OAuth."
            )
            detail["renew_url"] = "https://claude.ai/oauth/authorize"

    return detail


def _build_auth_headers(api_key: str | None, oauth_token: str | None) -> dict[str, str]:
    headers = {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    if oauth_token:
        headers["authorization"] = f"Bearer {oauth_token}"
    else:
        headers["x-api-key"] = api_key or ""
    return headers


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health():
    return {"ok": True, "service": "HopeStar Studio Engine Core V1"}


@app.get("/api/oauth/url")
async def oauth_url():
    raw = os.getenv("CLAUDE_ACCOUNT_OAUTH_URL", DEFAULT_OAUTH_URL)
    return {"oauth_url": unquote(raw)}


@app.post("/api/connect")
async def connect_claude(payload: ConnectRequest):
    endpoint = f"{os.getenv('ANTHROPIC_BASE_URL', 'https://api.anthropic.com').rstrip('/')}/v1/models"
    headers = _build_auth_headers(payload.api_key, payload.oauth_token)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(endpoint, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Không thể kết nối Claude API: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=_build_upstream_error(response))

    return {
        "connected": True,
        "auth_mode": "oauth_token" if payload.oauth_token else "api_key",
        "message": "Kết nối Claude API thành công.",
    }


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

    headers = _build_auth_headers(payload.api_key, payload.oauth_token)

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
