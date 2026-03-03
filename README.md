# HopeStar Studio Engine Core V1

Studio chat local để gọi Claude theo 2 cách:

1. **Liên kết Claude account trả phí qua OAuth token** (kiểu bạn gửi).
2. **Dùng API key** truyền thống.

## Điểm chính

- Bắt buộc kết nối trước khi gửi chat.
- Model mặc định: **Opus 4.6** (`claude-opus-4-6`).
- Có nút mở nhanh trang OAuth Claude account, API key và Billing.

## Chạy ứng dụng

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Mở `http://localhost:8000`.

## Liên kết Claude account trả phí kiểu OAuth

- Chọn **Kiểu kết nối = Claude account OAuth token**.
- Bấm **Mở trang OAuth Claude account** (app sẽ mở URL OAuth authorize).
- Đăng nhập/Authorize như ảnh bạn gửi.
- Lấy token rồi dán vào ô **OAuth Access Token**.
- **Quan trọng**: dán đúng **Access Token**. Nếu token có dạng `...#state` thì chỉ dùng phần trước dấu `#`.
- Không dán `code` callback thay cho access token.
- Bấm **Kết nối Claude** rồi chat.

> Có thể cấu hình URL OAuth bằng biến môi trường `CLAUDE_ACCOUNT_OAUTH_URL`.

## API test

### Health

```bash
curl http://localhost:8000/health
```

### OAuth URL

```bash
curl http://localhost:8000/api/oauth/url
```

### Kết nối (OAuth token)

```bash
curl -X POST http://localhost:8000/api/connect \
  -H "Content-Type: application/json" \
  -d '{"oauth_token":"your_oauth_access_token"}'
```

### Kết nối (API key)

```bash
curl -X POST http://localhost:8000/api/connect \
  -H "Content-Type: application/json" \
  -d '{"api_key":"sk-ant-..."}'
```

### Chat

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "oauth_token":"your_oauth_access_token",
    "model":"claude-opus-4-6",
    "system_prompt":"Bạn là trợ lý hữu ích",
    "messages":[{"role":"user","content":"Xin chào"}],
    "temperature":0.7,
    "max_tokens":200
  }'
```

## Biến môi trường

- `ANTHROPIC_BASE_URL` (mặc định `https://api.anthropic.com`).
- `CLAUDE_ACCOUNT_OAUTH_URL` (URL authorize OAuth account Claude).
