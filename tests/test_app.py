import json
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
    def __init__(self, get_response=None, post_response=None):
        self.get_response = get_response or MockResponse()
        self.post_response = post_response or MockResponse()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, *args, **kwargs):
        return self.get_response

    async def post(self, *args, **kwargs):
        return self.post_response


class AppTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app_module.app)

    def test_home(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("HopeStar Studio Engine Core V1", response.text)

    def test_connect_success(self):
        async_client = MockAsyncClient(get_response=MockResponse(200, {"data": []}))

        with patch.object(app_module.httpx, "AsyncClient", return_value=async_client):
            response = self.client.post(
                "/api/connect",
                json={"api_key": "sk-ant-1234567890"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["connected"])

    def test_connect_insufficient_credit(self):
        payload = {
            "type": "error",
            "error": {
                "type": "invalid_request_error",
                "message": "Your credit balance is too low to access the Anthropic API.",
            },
        }
        async_client = MockAsyncClient(
            get_response=MockResponse(400, payload=payload, text=json.dumps(payload))
        )

        with patch.object(app_module.httpx, "AsyncClient", return_value=async_client):
            response = self.client.post(
                "/api/connect",
                json={"api_key": "sk-ant-1234567890"},
            )

        self.assertEqual(response.status_code, 400)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "insufficient_credit")
        self.assertIn("billing_url", detail)

    def test_chat_success(self):
        post_response = MockResponse(200, {"content": [{"type": "text", "text": "ok"}]})
        async_client = MockAsyncClient(post_response=post_response)

        with patch.object(app_module.httpx, "AsyncClient", return_value=async_client):
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
