import os
from typing import Literal

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
    messages: list[Message] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(default=1024, ge=64, le=4096)


app = FastAPI(title="RoPilot Studio")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health():
    return {"ok": True}


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
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    reply = "\n".join(
        part.get("text", "") for part in data.get("content", []) if part.get("type") == "text"
    ).strip()

    return {"reply": reply, "raw": data}
