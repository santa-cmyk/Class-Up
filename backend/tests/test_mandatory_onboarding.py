"""
Iteration 2 — mandatory onboarding flow tests.

Verifies:
  * /api/auth/me exposes the new profile fields.
  * /api/assessments/complete is gated by profile_setup_completed=True.
  * /api/profile/setup validates each required field and uppercases the section.
  * /api/assessments/complete is also gated by all 5 subjects being opened.
  * Full happy path leaves both profile_setup_completed=True and
    initial_assessment_completed=True.

Uses a DEDICATED user (`user_mandatory_test` + `TEST_TOKEN_MANDATORY`) so it
does not race with the primary iteration-1 suite under pytest-xdist loadscope.
"""
import asyncio
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

MAND_USER_ID = "user_mandatory_test"
MAND_TOKEN = "TEST_TOKEN_MANDATORY"
MAND_EMAIL = "mandatory@classup.local"

SUBJECTS = [
    "Lectura Crítica",
    "Matemáticas",
    "Sociales",
    "Ciencias Naturales",
    "Inglés",
]

REQUIRED_FIELDS = ("name", "section", "jornada", "birth_date", "guardian_name", "guardian_phone")


def _contains_underscore_id(obj) -> bool:
    if isinstance(obj, dict):
        if "_id" in obj:
            return True
        return any(_contains_underscore_id(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_contains_underscore_id(v) for v in obj)
    return False


def _reset_user():
    """Recreate mandatory-flow user in a clean (unonboarded) state."""
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        await db.users.update_one(
            {"user_id": MAND_USER_ID},
            {"$set": {
                "user_id": MAND_USER_ID,
                "email": MAND_EMAIL,
                "name": "Mandatory Test",
                "picture": None,
                "grade": "9°",
                "section": None,
                "jornada": None,
                "birth_date": None,
                "student_phone": None,
                "guardian_name": None,
                "guardian_phone": None,
                "profile_setup_completed": False,
                "initial_assessment_completed": False,
                "assessments_opened": [],
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        await db.user_sessions.update_one(
            {"session_token": MAND_TOKEN},
            {"$set": {
                "session_token": MAND_TOKEN,
                "user_id": MAND_USER_ID,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            }},
            upsert=True,
        )
        c.close()
    asyncio.run(go())


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {MAND_TOKEN}",
    })
    return s


# NOTE: Every test resets the user first — this class is a linear scenario
# but each step is asserted independently.


class TestMandatoryOnboarding:
    """Full mandatory-onboarding scenario, one method per gate."""

    def test_00_me_exposes_new_profile_fields(self, client):
        _reset_user()
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, r.text
        me = r.json()
        assert not _contains_underscore_id(me)
        for f in ("section", "jornada", "birth_date", "student_phone",
                  "guardian_name", "guardian_phone", "profile_setup_completed"):
            assert f in me, f"Missing field {f} in /auth/me"
        assert me["profile_setup_completed"] is False
        assert me["initial_assessment_completed"] is False
        assert me["assessments_opened"] == []

    def test_01_complete_before_profile_returns_400_perfil_incompleto(self, client):
        _reset_user()
        r = client.post(f"{BASE_URL}/api/assessments/complete", json={"completed": True})
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert "Perfil incompleto" in detail, f"Expected 'Perfil incompleto', got: {detail}"

    @pytest.mark.parametrize("missing_field", REQUIRED_FIELDS)
    def test_02_profile_setup_missing_required_field_returns_400(self, client, missing_field):
        _reset_user()
        payload = {
            "name": "Ana López",
            "section": "b",
            "jornada": "Tarde",
            "birth_date": "2010-03-11",
            "guardian_name": "Padre Ana",
            "guardian_phone": "3005551234",
            "student_phone": "3009998877",
        }
        payload[missing_field] = "" if isinstance(payload[missing_field], str) else None
        r = client.post(f"{BASE_URL}/api/profile/setup", json=payload)
        assert r.status_code == 400, f"Expected 400 for empty {missing_field}, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "Campo obligatorio" in detail
        assert missing_field in detail, f"Expected field name '{missing_field}' in detail, got: {detail}"

    def test_03_profile_setup_missing_whitespace_only_field(self, client):
        _reset_user()
        payload = {
            "name": "   ",   # whitespace only counts as empty
            "section": "A",
            "jornada": "Mañana",
            "birth_date": "2010-01-01",
            "guardian_name": "Tutor",
            "guardian_phone": "3001112222",
        }
        r = client.post(f"{BASE_URL}/api/profile/setup", json=payload)
        assert r.status_code == 400
        assert "Campo obligatorio: name" in r.json().get("detail", "")

    def test_04_profile_setup_lowercase_section_is_uppercased(self, client):
        _reset_user()
        payload = {
            "name": "Ana López",
            "section": "a",           # lowercase → must be stored as 'A'
            "jornada": "Mañana",
            "birth_date": "2010-03-11",
            "guardian_name": "Padre Ana",
            "guardian_phone": "3005551234",
            "student_phone": "",     # optional
        }
        r = client.post(f"{BASE_URL}/api/profile/setup", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert not _contains_underscore_id(body)
        assert body["section"] == "A"
        assert body["profile_setup_completed"] is True
        assert body["name"] == "Ana López"
        assert body["jornada"] == "Mañana"
        assert body["birth_date"] == "2010-03-11"
        assert body["guardian_name"] == "Padre Ana"
        assert body["guardian_phone"] == "3005551234"
        assert body["student_phone"] == ""

        # Persisted → /auth/me reflects it
        me = client.get(f"{BASE_URL}/api/auth/me").json()
        assert me["profile_setup_completed"] is True
        assert me["section"] == "A"

    def test_05_complete_after_profile_but_no_subjects_lists_missing(self, client):
        _reset_user()
        # complete profile only
        r0 = client.post(f"{BASE_URL}/api/profile/setup", json={
            "name": "Ana", "section": "A", "jornada": "Mañana",
            "birth_date": "2010-01-01", "guardian_name": "G", "guardian_phone": "3001",
        })
        assert r0.status_code == 200
        # try to complete WITHOUT opening any assessment
        r = client.post(f"{BASE_URL}/api/assessments/complete", json={"completed": True})
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert "Faltan evaluaciones por abrir" in detail
        for s in SUBJECTS:
            assert s in detail, f"missing subject '{s}' in detail: {detail}"

    def test_06_complete_after_partial_opens_still_lists_only_missing(self, client):
        _reset_user()
        client.post(f"{BASE_URL}/api/profile/setup", json={
            "name": "Ana", "section": "A", "jornada": "Mañana",
            "birth_date": "2010-01-01", "guardian_name": "G", "guardian_phone": "3001",
        })
        # open only 2
        for s in ("Matemáticas", "Inglés"):
            client.post(f"{BASE_URL}/api/assessments/open", json={"subject": s})
        r = client.post(f"{BASE_URL}/api/assessments/complete", json={"completed": True})
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "Faltan evaluaciones por abrir" in detail
        for opened in ("Matemáticas", "Inglés"):
            assert opened not in detail, f"opened subject '{opened}' should not appear in missing list: {detail}"
        for missing in ("Lectura Crítica", "Sociales", "Ciencias Naturales"):
            assert missing in detail

    def test_07_happy_path_full_onboarding(self, client):
        _reset_user()
        # 1. profile setup
        prof = client.post(f"{BASE_URL}/api/profile/setup", json={
            "name": "Ana López",
            "section": "c",
            "jornada": "Única",
            "birth_date": "2010-06-30",
            "guardian_name": "Padre",
            "guardian_phone": "3005551234",
            "student_phone": "3009998877",
        })
        assert prof.status_code == 200, prof.text
        assert prof.json()["section"] == "C"
        assert prof.json()["profile_setup_completed"] is True

        # 2. open all 5 subjects
        for s in SUBJECTS:
            r = client.post(f"{BASE_URL}/api/assessments/open", json={"subject": s})
            assert r.status_code == 200, f"open {s} failed: {r.text}"

        # 3. complete → 200 {ok:true}
        done = client.post(f"{BASE_URL}/api/assessments/complete", json={"completed": True})
        assert done.status_code == 200, done.text
        assert done.json() == {"ok": True}

        # 4. /auth/me confirms both flags
        me = client.get(f"{BASE_URL}/api/auth/me").json()
        assert me["profile_setup_completed"] is True
        assert me["initial_assessment_completed"] is True
        assert set(me["assessments_opened"]) == set(SUBJECTS)
        assert not _contains_underscore_id(me)


class TestAuthGuardStatusCodes:
    """Iteration 2 also asserts 401 (never 403) on missing/invalid tokens."""

    def test_missing_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_invalid_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer completely-bogus-token"})
        assert r.status_code == 401

    def test_empty_bearer_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer "})
        assert r.status_code == 401

    def test_profile_setup_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/profile/setup", json={
            "name": "x", "section": "A", "jornada": "M",
            "birth_date": "2010-01-01", "guardian_name": "g", "guardian_phone": "1",
        })
        assert r.status_code == 401
