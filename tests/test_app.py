from fastapi.testclient import TestClient

import app as app_module


class MockResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class MockAsyncClient:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False

    async def post(self, *args, **kwargs):
        return self._response


def test_home_page_renders():
    client = TestClient(app_module.app)
    response = client.get("/")

    assert response.status_code == 200
    assert "RoPilot Studio" in response.text


def test_chat_success(monkeypatch):
    payload = {
        "content": [{"type": "text", "text": "Xin chào từ Claude"}],
    }
    mock_response = MockResponse(status_code=200, payload=payload)

    def mock_client_factory(*args, **kwargs):
        return MockAsyncClient(mock_response)

    monkeypatch.setattr(app_module.httpx, "AsyncClient", mock_client_factory)

    client = TestClient(app_module.app)
    response = client.post(
        "/api/chat",
        json={
            "api_key": "sk-ant-1234567890",
            "model": "claude-3-5-sonnet-20241022",
            "system_prompt": "Bạn là trợ lý hữu ích.",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 1000,
            "temperature": 0.7,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Xin chào từ Claude"


def test_chat_returns_upstream_error(monkeypatch):
    mock_response = MockResponse(status_code=401, text='{"error":"invalid x-api-key"}')

    def mock_client_factory(*args, **kwargs):
        return MockAsyncClient(mock_response)

    monkeypatch.setattr(app_module.httpx, "AsyncClient", mock_client_factory)

    client = TestClient(app_module.app)
    response = client.post(
        "/api/chat",
        json={
            "api_key": "sk-ant-1234567890",
            "messages": [{"role": "user", "content": "Hello"}],
        },
    )

    assert response.status_code == 401
    assert "invalid x-api-key" in response.text
