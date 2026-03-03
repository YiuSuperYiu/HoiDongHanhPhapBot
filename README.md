# HopeStar Studio Engine Core V1

Đây là bản studio chat chạy local để dùng Claude API key của bạn.

## Điểm chính

- Đổi tên hệ thống thành **HopeStar Studio Engine Core V1**.
- Bắt buộc kết nối API Claude trước khi gửi tin nhắn chat.
- Có nút mở nhanh trang tạo/lấy API key của Anthropic.

## Chạy ứng dụng

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Mở `http://localhost:8000`.

## Quy trình test thành công (đúng ý “bắt buộc kết nối API”)

1. Nhập Claude API key.
2. Bấm **Kết nối Claude API** để xác thực key.
3. Nếu chưa có key, bấm **Mở web lấy API key** để mở trang Anthropic keys.
4. Khi badge hiện **Đã kết nối Claude API**, mới gửi chat được.

## Test nhanh API

### Health check

```bash
curl http://localhost:8000/health
```

### Test kết nối key

```bash
curl -X POST http://localhost:8000/api/connect \
  -H "Content-Type: application/json" \
  -d '{"api_key":"sk-ant-..."}'
```

### Test chat

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
