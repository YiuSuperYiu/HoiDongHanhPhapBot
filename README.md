# HopeStar Studio Engine Core V1

Đây là studio chat local để dùng Claude API key của bạn.

## Điểm chính

- Bắt buộc kết nối Claude API trước khi gửi chat.
- Model mặc định: **Opus 4.6** (`claude-opus-4-6`).
- Có nút mở nhanh trang API key và trang Billing.

## Chạy ứng dụng

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Mở `http://localhost:8000`.

## Quy trình test nhanh

1. Nhập Claude API key.
2. Bấm **Kết nối Claude API**.
3. Nếu thiếu credit, bấm **Mở trang Billing (nạp credit)**.
4. Nếu key hết hạn, app sẽ báo rõ là hết hạn và kèm thời điểm lỗi (`opened_at`).

## API test

### Health

```bash
curl http://localhost:8000/health
```

### Kết nối key

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
    "api_key":"sk-ant-...",
    "model":"claude-opus-4-6",
    "system_prompt":"Bạn là trợ lý hữu ích",
    "messages":[{"role":"user","content":"Xin chào"}],
    "temperature":0.7,
    "max_tokens":200
  }'
```

## Biến môi trường

- `ANTHROPIC_BASE_URL` (mặc định `https://api.anthropic.com`).
