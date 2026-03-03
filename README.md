# RoPilot Studio (Claude API)

RoPilot Studio là một giao diện chat đơn giản để bạn dùng API Claude của riêng mình.

## Tính năng
- Chat giao diện web tiếng Việt.
- Lưu API key cục bộ trong trình duyệt (`localStorage`).
- Backend proxy để gọi Claude Messages API an toàn hơn (không expose key trong source code).

## Chạy nhanh

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Mở `http://localhost:8000`.

## Test như thế nào?

### 1) Test tự động (không cần API key thật)

Sau khi cài dependencies, chạy:

```bash
pytest -q
```

Các test hiện có:
- Render được trang `/`.
- Endpoint `/api/chat` trả lời đúng khi Claude API trả về thành công (mock).
- Endpoint `/api/chat` trả lỗi đúng khi upstream trả lỗi (mock).

### 2) Test manual end-to-end với API key của bạn

Chạy server:

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Mở `http://localhost:8000`, nhập:
- API Key Claude
- Model (ví dụ: `claude-3-5-sonnet-20241022`)
- Prompt rồi bấm **Gửi**

Nếu đúng, bạn sẽ thấy phản hồi của assistant trong khung chat.

## Biến môi trường (tuỳ chọn)
- `ANTHROPIC_BASE_URL` (mặc định: `https://api.anthropic.com`)

## Ghi chú bảo mật
- API key được nhập từ UI, gửi lên backend theo từng request.
- Không lưu key ở server; frontend lưu cục bộ trên máy bạn.
