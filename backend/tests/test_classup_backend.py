"""End-to-end backend tests for Class Up · El Castillo."""
import asyncio
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from conftest import TEST_TOKEN, TEST_USER_ID, contains_underscore_id

load_dotenv("/app/backend/.env")

SECOND_USER_ID = "user_test_secondary"
SECOND_TOKEN = "TEST_TOKEN_SECONDARY"


def _reseed_primary_session():
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        await db.user_sessions.update_one(
            {"session_token": TEST_TOKEN},
            {"$set": {
                "session_token": TEST_TOKEN,
                "user_id": TEST_USER_ID,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            }},
            upsert=True,
        )
        c.close()
    asyncio.run(go())


def _ensure_second_user():
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        await db.users.update_one(
            {"user_id": SECOND_USER_ID},
            {"$setOnInsert": {
                "user_id": SECOND_USER_ID,
                "email": "test_second@classup.local",
                "name": "Second Test",
                "picture": None,
                "grade": "9°",
                "initial_assessment_completed": False,
                "assessments_opened": [],
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        await db.user_sessions.update_one(
            {"session_token": SECOND_TOKEN},
            {"$set": {
                "session_token": SECOND_TOKEN,
                "user_id": SECOND_USER_ID,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            }},
            upsert=True,
        )
        c.close()
    asyncio.run(go())


@pytest.fixture(scope="module", autouse=True)
def _setup_module():
    _reseed_primary_session()
    _ensure_second_user()
    yield
    # final cleanup: recreate primary session so any subsequent runs / manual checks work
    _reseed_primary_session()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
class TestHealth:
    def test_root_health(self, base_url, anon_client):
        r = anon_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "Class Up" in data.get("app", "")
        assert not contains_underscore_id(data)


# ---------------------------------------------------------------------------
# Auth guards
# ---------------------------------------------------------------------------
class TestAuthGuards:
    def test_me_without_token_is_401(self, base_url, anon_client):
        r = anon_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401, f"expected 401 got {r.status_code} body={r.text[:200]}"

    def test_me_with_bad_token_is_401(self, base_url, anon_client):
        r = anon_client.get(f"{base_url}/api/auth/me", headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 401

    def test_session_empty_id_rejected(self, base_url, anon_client):
        r = anon_client.post(f"{base_url}/api/auth/session", json={"session_id": ""})
        assert r.status_code in (400, 401, 422), f"got {r.status_code}"

    def test_session_bogus_id_rejected(self, base_url, anon_client):
        r = anon_client.post(f"{base_url}/api/auth/session", json={"session_id": "not-a-real-id"})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Auth /me success
# ---------------------------------------------------------------------------
class TestAuthMe:
    def test_me_returns_seeded_user(self, base_url, auth_client):
        r = auth_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == TEST_USER_ID
        assert data["email"] == "test@classup.local"
        assert "name" in data and "grade" in data
        assert not contains_underscore_id(data)


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------
EXPECTED_SUBJECTS = {"Lectura Crítica", "Matemáticas", "Sociales y Ciudadanas", "Ciencias Naturales", "Inglés"}


class TestAssessments:
    def test_list_assessments(self, base_url, auth_client):
        r = auth_client.get(f"{base_url}/api/assessments")
        assert r.status_code == 200
        data = r.json()
        assert not contains_underscore_id(data)
        subjects = data.get("subjects", [])
        assert len(subjects) == 5
        names = {s["name"] for s in subjects}
        assert names == EXPECTED_SUBJECTS
        for s in subjects:
            assert s["url"].startswith("https://docs.google.com/forms/")
            assert "opened" in s
        assert "completed" in data

    def test_open_valid_subject_updates_user(self, base_url, auth_client):
        # Pick a subject that was not yet opened (seed only had Matemáticas)
        subject = "Inglés"
        r = auth_client.post(f"{base_url}/api/assessments/open", json={"subject": subject})
        assert r.status_code == 200
        me = auth_client.get(f"{base_url}/api/auth/me").json()
        assert subject in me.get("assessments_opened", [])

    def test_open_invalid_subject_rejected(self, base_url, auth_client):
        r = auth_client.post(f"{base_url}/api/assessments/open", json={"subject": "Astrofísica"})
        assert r.status_code == 400

    def test_complete_toggles_flag(self, base_url, auth_client):
        # Iteration 2: /assessments/complete is now gated by profile_setup_completed
        # AND all 5 subjects opened. Ensure prerequisites first.
        prof = auth_client.post(f"{base_url}/api/profile/setup", json={
            "name": "Juan Pérez",
            "section": "A",
            "jornada": "Mañana",
            "birth_date": "2010-05-15",
            "guardian_name": "Maria Perez",
            "guardian_phone": "3001234567",
            "student_phone": "3000000000",
        })
        assert prof.status_code == 200, prof.text
        for subj in EXPECTED_SUBJECTS:
            r = auth_client.post(f"{base_url}/api/assessments/open", json={"subject": subj})
            assert r.status_code == 200

        # Flip to False then True to prove the endpoint actually writes
        r1 = auth_client.post(f"{base_url}/api/assessments/complete", json={"completed": False})
        assert r1.status_code == 200, r1.text
        me1 = auth_client.get(f"{base_url}/api/auth/me").json()
        assert me1["initial_assessment_completed"] is False

        r2 = auth_client.post(f"{base_url}/api/assessments/complete", json={"completed": True})
        assert r2.status_code == 200
        me2 = auth_client.get(f"{base_url}/api/auth/me").json()
        assert me2["initial_assessment_completed"] is True


# ---------------------------------------------------------------------------
# Tasks CRUD + cross-user isolation
# ---------------------------------------------------------------------------
class TestTasks:
    created_id = None

    def test_create_task(self, base_url, auth_client):
        payload = {
            "title": "TEST_Estudiar factorización",
            "subject": "Matemáticas",
            "priority": "alta",
            "due_date": "2026-02-10",
            "description": "TEST task",
        }
        r = auth_client.post(f"{base_url}/api/tasks", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == payload["title"]
        assert data["subject"] == "Matemáticas"
        assert data["priority"] == "alta"
        assert data["completed"] is False
        assert not contains_underscore_id(data)
        TestTasks.created_id = data["id"]

    def test_list_contains_created(self, base_url, auth_client):
        r = auth_client.get(f"{base_url}/api/tasks")
        assert r.status_code == 200
        items = r.json()
        assert not contains_underscore_id(items)
        assert any(t["id"] == TestTasks.created_id for t in items)

    def test_patch_toggle_completed(self, base_url, auth_client):
        r = auth_client.patch(
            f"{base_url}/api/tasks/{TestTasks.created_id}",
            json={"completed": True},
        )
        assert r.status_code == 200
        assert r.json()["completed"] is True

    def test_cross_user_cannot_see_or_delete(self, base_url, auth_client):
        other = requests.Session()
        other.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {SECOND_TOKEN}"})
        listing = other.get(f"{base_url}/api/tasks").json()
        assert all(t["id"] != TestTasks.created_id for t in listing)
        d = other.delete(f"{base_url}/api/tasks/{TestTasks.created_id}")
        assert d.status_code == 404

    def test_delete_task(self, base_url, auth_client):
        r = auth_client.delete(f"{base_url}/api/tasks/{TestTasks.created_id}")
        assert r.status_code == 200
        # confirm gone
        r2 = auth_client.delete(f"{base_url}/api/tasks/{TestTasks.created_id}")
        assert r2.status_code == 404


# ---------------------------------------------------------------------------
# Grades
# ---------------------------------------------------------------------------
class TestGrades:
    grade_ids: list = []

    def test_create_grades(self, base_url, auth_client):
        for payload in [
            {"subject": "Matemáticas", "activity": "TEST Quiz 1", "score": 4.0, "weight": 20, "period": "P1"},
            {"subject": "Matemáticas", "activity": "TEST Quiz 2", "score": 5.0, "weight": 20, "period": "P1"},
            {"subject": "Inglés", "activity": "TEST Exam",  "score": 3.0, "weight": 40, "period": "P1"},
        ]:
            r = auth_client.post(f"{base_url}/api/grades", json=payload)
            assert r.status_code == 200, r.text
            d = r.json()
            assert not contains_underscore_id(d)
            assert d["subject"] == payload["subject"]
            assert d["score"] == payload["score"]
            TestGrades.grade_ids.append(d["id"])

    def test_summary(self, base_url, auth_client):
        r = auth_client.get(f"{base_url}/api/grades/summary")
        assert r.status_code == 200
        data = r.json()
        assert not contains_underscore_id(data)
        assert "overall" in data and "per_subject" in data
        subj_map = {p["subject"]: p for p in data["per_subject"]}
        assert "Matemáticas" in subj_map
        assert subj_map["Matemáticas"]["count"] >= 2
        # overall should be a number > 0
        assert isinstance(data["overall"], (int, float))
        assert data["overall"] > 0

    def test_delete_grades(self, base_url, auth_client):
        for gid in TestGrades.grade_ids:
            r = auth_client.delete(f"{base_url}/api/grades/{gid}")
            assert r.status_code == 200
        # deleting again -> 404
        if TestGrades.grade_ids:
            r = auth_client.delete(f"{base_url}/api/grades/{TestGrades.grade_ids[0]}")
            assert r.status_code == 404


# ---------------------------------------------------------------------------
# Sessions (Pomodoro)
# ---------------------------------------------------------------------------
class TestSessions:
    def test_create_and_summary(self, base_url, auth_client):
        before = auth_client.get(f"{base_url}/api/sessions/summary").json()
        r = auth_client.post(
            f"{base_url}/api/sessions",
            json={"duration_min": 25, "subject": "Matemáticas", "completed": True},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["duration_min"] == 25
        assert not contains_underscore_id(d)

        after = auth_client.get(f"{base_url}/api/sessions/summary").json()
        assert after["total_sessions"] == before["total_sessions"] + 1
        assert after["total_minutes"] == before["total_minutes"] + 25


# ---------------------------------------------------------------------------
# Resources (public)
# ---------------------------------------------------------------------------
class TestResources:
    def test_list_all(self, base_url, anon_client):
        r = anon_client.get(f"{base_url}/api/resources")
        assert r.status_code == 200
        items = r.json()
        assert not contains_underscore_id(items)
        assert len(items) >= 20, f"expected >=20 seeded resources, got {len(items)}"
        # sanity: all have url + area + title
        for it in items:
            assert it.get("url", "").startswith("http")
            assert it.get("area")
            assert it.get("title")

    def test_filter_matematicas(self, base_url, anon_client):
        r = anon_client.get(f"{base_url}/api/resources", params={"area": "Matemáticas"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert all(i["area"] == "Matemáticas" for i in items)


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------
class TestProgress:
    def test_progress_fields(self, base_url, auth_client):
        # ensure some data
        t = auth_client.post(f"{base_url}/api/tasks", json={
            "title": "TEST_progress_task", "subject": "Inglés", "priority": "media",
        }).json()
        task_id = t["id"]
        auth_client.patch(f"{base_url}/api/tasks/{task_id}", json={"completed": True})

        r = auth_client.get(f"{base_url}/api/progress")
        assert r.status_code == 200
        data = r.json()
        for key in ("tasks_total", "tasks_completed", "tasks_pending", "grades_avg", "study_minutes"):
            assert key in data, f"missing {key}"
        assert data["tasks_total"] >= 1
        assert data["tasks_completed"] >= 1
        assert data["tasks_pending"] == data["tasks_total"] - data["tasks_completed"]
        assert not contains_underscore_id(data)

        # cleanup
        auth_client.delete(f"{base_url}/api/tasks/{task_id}")


# ---------------------------------------------------------------------------
# Logout — uses a dedicated token so it does not clobber TEST_TOKEN_123 for
# other parallel test classes (pytest.ini runs `-n 2 --dist loadscope`).
# ---------------------------------------------------------------------------
LOGOUT_TOKEN = "TEST_TOKEN_LOGOUT"


def _seed_logout_token():
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        await db.user_sessions.update_one(
            {"session_token": LOGOUT_TOKEN},
            {"$set": {
                "session_token": LOGOUT_TOKEN,
                "user_id": TEST_USER_ID,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            }},
            upsert=True,
        )
        c.close()
    asyncio.run(go())


class TestZLogout:
    def test_logout_invalidates_token(self, base_url, anon_client):
        _seed_logout_token()
        # sanity: token is valid before logout
        pre = anon_client.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {LOGOUT_TOKEN}"})
        assert pre.status_code == 200

        r = anon_client.post(f"{base_url}/api/auth/logout", headers={"Authorization": f"Bearer {LOGOUT_TOKEN}"})
        assert r.status_code == 200

        # subsequent /me with the logged-out token must be 401
        r2 = anon_client.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {LOGOUT_TOKEN}"})
        assert r2.status_code == 401

        # Primary TEST_TOKEN_123 must still work (not clobbered)
        r3 = anon_client.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {TEST_TOKEN}"})
        assert r3.status_code == 200
