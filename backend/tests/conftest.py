import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not configured")

TEST_TOKEN = "TEST_TOKEN_123"
TEST_USER_ID = "user_test123"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def token():
    return TEST_TOKEN


@pytest.fixture
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def auth_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {TEST_TOKEN}"})
    return s


def contains_underscore_id(obj) -> bool:
    if isinstance(obj, dict):
        if "_id" in obj:
            return True
        return any(contains_underscore_id(v) for v in obj.values())
    if isinstance(obj, list):
        return any(contains_underscore_id(v) for v in obj)
    return False
