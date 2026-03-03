import unittest
from unittest.mock import patch

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
        self.response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):
        return self.response


class AppTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app_module.app)

    def test_home(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("RoPilot Studio", response.text)

    def test_chat_success(self):
        mocked = MockResponse(200, {"content": [{"type": "text", "text": "ok"}]})
        with patch.object(app_module.httpx, "AsyncClient", return_value=MockAsyncClient(mocked)):
            response = self.client.post(
                "/api/chat",
                json={
                    "api_key": "sk-ant-1234567890",
                    "messages": [{"role": "user", "content": "hello"}],
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], "ok")


if __name__ == "__main__":
    unittest.main()
