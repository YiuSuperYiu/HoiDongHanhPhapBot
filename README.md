# RoPilot Studio (làm lại từ đầu)

Dự án này là bản chat studio tối giản để gọi Claude API bằng key của bạn.

## Chạy ứng dụng

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Mở `http://localhost:8000`.

## Cách test nhanh

### 1) Health check backend

```bash
curl http://localhost:8000/health
```

Kỳ vọng: `{"ok":true}`.

### 2) Test giao diện

- Nhập API key Claude.
- Nhập prompt.
- Bấm **Gửi** (hoặc Ctrl+Enter).

### 3) Test endpoint chat bằng curl

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "api_key":"sk-ant-...",
    "model":"claude-3-5-sonnet-20241022",
    "system_prompt":"Bạn là trợ lý hữu ích",
    "messages":[{"role":"user","content":"Xin chào"}],
    "temperature":0.7,
    "max_tokens":200
  }'
```

## Biến môi trường

- `ANTHROPIC_BASE_URL` (mặc định `https://api.anthropic.com`).

## Bảo mật

- API key chỉ gửi theo từng request.
- Key được lưu localStorage trên máy local của bạn.
