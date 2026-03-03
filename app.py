import os
from typing import List, Literal

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    api_key: str = Field(min_length=10)
    model: str = Field(default="claude-3-5-sonnet-20241022")
    system_prompt: str = ""
    messages: List[Message]
    max_tokens: int = Field(default=1000, ge=64, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)


app = FastAPI(title="RoPilot Studio")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/chat")
async def chat(payload: ChatRequest):
    base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
    endpoint = f"{base_url.rstrip('/')}/v1/messages"

    anthropic_messages = [
        {"role": m.role, "content": [{"type": "text", "text": m.content}]}
        for m in payload.messages
    ]

    body = {
        "model": payload.model,
        "max_tokens": payload.max_tokens,
        "temperature": payload.temperature,
        "messages": anthropic_messages,
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
        raise HTTPException(status_code=502, detail=f"Lỗi kết nối đến Claude API: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text
        raise HTTPException(status_code=response.status_code, detail=detail)

    data = response.json()
    text_parts = [
        part.get("text", "")
        for part in data.get("content", [])
        if part.get("type") == "text"
    ]

    return {"reply": "\n".join(text_parts).strip(), "raw": data}
