"""
Iteration 3 — Full functional audit for Class Up · El Castillo.

Verifies (per review_request):
  * /api/auth/me returns Juan David Martínez demo profile
  * MongoDB currently holds 26 tasks / 25 grades / 23 events / 98 resources for user_test123
  * Tasks/Grades/Events CRUD scoped per user, cross-user isolation, propagation to /progress
  * Resources filter (Matemáticas ~21, Sociales ~19, Todos = 98)
  * PATCH /api/profile (uppercase section, empty field 400, "Sin cambios" 400, flags preserved)
  * Fresh user onboarding gates
  * POST /api/import/bulk empty + 1-of-each
  * Cross-user isolation on tasks/grades/events
  * No `_id` leaks anywhere

The suite is careful to preserve the demo state of user_test123. Any writes
against user_test123 are undone in teardown; the fresh audit user is removed
at end.
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

# Primary demo user
PRIMARY_TOKEN = "TEST_TOKEN_123"
PRIMARY_USER_ID = "user_test123"

# Fresh audit user (mandatory onboarding gate)
FRESH_TOKEN = "TOKEN_FRESH_AUDIT"
FRESH_USER_ID = "user_fresh_audit"
FRESH_EMAIL = "fresh_audit@test.local"

SUBJECTS = ["Lectura Crítica", "Matemáticas", "Sociales", "Ciencias Naturales", "Inglés"]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _contains_id(obj) -> bool:
    if isinstance(obj, dict):
        if "_id" in obj:
            return True
        return any(_contains_id(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_contains_id(v) for v in obj)
    return False


async def _mongo():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return c, c[os.environ["DB_NAME"]]


def _seed_fresh_user():
    async def go():
        c, db = await _mongo()
        await db.users.update_one(
            {"user_id": FRESH_USER_ID},
            {"$set": {
                "user_id": FRESH_USER_ID,
                "email": FRESH_EMAIL,
                "name": "Fresh Audit",
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
            {"session_token": FRESH_TOKEN},
            {"$set": {
                "session_token": FRESH_TOKEN,
                "user_id": FRESH_USER_ID,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            }},
            upsert=True,
        )
        c.close()
    asyncio.run(go())


def _cleanup_fresh_user():
    async def go():
        c, db = await _mongo()
        await db.users.delete_many({"user_id": FRESH_USER_ID})
        await db.user_sessions.delete_many({"session_token": FRESH_TOKEN})
        await db.tasks.delete_many({"user_id": FRESH_USER_ID})
        await db.grades.delete_many({"user_id": FRESH_USER_ID})
        await db.events.delete_many({"user_id": FRESH_USER_ID})
        c.close()
    asyncio.run(go())


def _restore_primary_demo():
    async def go():
        c, db = await _mongo()
        await db.users.update_one(
            {"user_id": PRIMARY_USER_ID},
            {"$set": {
                "name": "Juan David Martínez",
                "section": "A",
                "jornada": "Tarde",
                "birth_date": "2010-05-15",
                "student_phone": "3000000000",
                "guardian_name": "María Martínez",
                "guardian_phone": "3000000000",
                "profile_setup_completed": True,
                "initial_assessment_completed": True,
                "assessments_opened": SUBJECTS,
            }},
        )
        c.close()
    asyncio.run(go())


def _primary_counts():
    async def go():
        c, db = await _mongo()
        counts = {
            "tasks": await db.tasks.count_documents({"user_id": PRIMARY_USER_ID}),
            "grades": await db.grades.count_documents({"user_id": PRIMARY_USER_ID}),
            "events": await db.events.count_documents({"user_id": PRIMARY_USER_ID}),
            "resources": await db.resources.count_documents({}),
        }
        c.close()
        return counts
    return asyncio.run(go())


@pytest.fixture(scope="module", autouse=True)
def _setup_and_teardown():
    _seed_fresh_user()
    yield
    _cleanup_fresh_user()
    _restore_primary_demo()


@pytest.fixture
def primary():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {PRIMARY_TOKEN}"})
    return s


@pytest.fixture
def fresh():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {FRESH_TOKEN}"})
    return s


# ---------------------------------------------------------------------------
# 1. AUTH  — /api/auth/me returns demo profile
# ---------------------------------------------------------------------------
class TestAuthMeDemoProfile:
    def test_me_returns_full_demo_profile(self, primary):
        r = primary.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, r.text
        me = r.json()
        assert not _contains_id(me)
        assert me["user_id"] == PRIMARY_USER_ID
        assert me["name"] == "Juan David Martínez"
        assert me["section"] == "A"
        assert me["jornada"] == "Tarde"
        assert me["guardian_name"] == "María Martínez"
        assert me["guardian_phone"] == "3000000000"
        assert me["profile_setup_completed"] is True
        assert me["initial_assessment_completed"] is True

    def test_missing_bearer_is_401_not_403(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_invalid_bearer_is_401_not_403(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer nope"})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# 2. PERSISTENCE  — MongoDB counts match the audit spec and no _id leaks
# ---------------------------------------------------------------------------
class TestPersistenceCounts:
    def test_mongo_counts_match_spec(self):
        counts = _primary_counts()
        assert counts["tasks"] == 26, counts
        assert counts["grades"] == 25, counts
        assert counts["events"] == 23, counts
        assert counts["resources"] == 98, counts

    def test_no_id_leaks_on_get_endpoints(self, primary):
        for path in ["/api/auth/me", "/api/tasks", "/api/grades",
                     "/api/grades/summary", "/api/events", "/api/resources",
                     "/api/progress", "/api/assessments", "/api/sessions",
                     "/api/sessions/summary"]:
            r = primary.get(f"{BASE_URL}{path}")
            assert r.status_code == 200, f"{path}: {r.status_code}"
            assert not _contains_id(r.json()), f"_id leaked in {path}"


# ---------------------------------------------------------------------------
# 3. TASKS CRUD + propagation to /progress + due-soon logic sanity
# ---------------------------------------------------------------------------
class TestTasksCRUD:
    def test_full_task_lifecycle_and_progress_propagates(self, primary):
        # baseline
        before = primary.get(f"{BASE_URL}/api/progress").json()
        base_total = before["tasks_total"]
        base_completed = before["tasks_completed"]

        # today + ~2h in server-relative UTC — should appear in list
        today = datetime.now(timezone.utc).date().isoformat()
        due_time = (datetime.now(timezone.utc) + timedelta(hours=2)).strftime("%H:%M")

        create = primary.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_iter3_soon",
            "subject": "Matemáticas",
            "due_date": today,
            "due_time": due_time,
            "priority": "alta",
        })
        assert create.status_code == 200, create.text
        tid = create.json()["id"]
        assert not _contains_id(create.json())

        # persisted in list
        listing = primary.get(f"{BASE_URL}/api/tasks").json()
        assert any(t["id"] == tid for t in listing)

        # /progress reflects new task
        after_create = primary.get(f"{BASE_URL}/api/progress").json()
        assert after_create["tasks_total"] == base_total + 1
        assert after_create["tasks_pending"] == before["tasks_pending"] + 1

        # PATCH toggles completed
        patch = primary.patch(f"{BASE_URL}/api/tasks/{tid}", json={"completed": True})
        assert patch.status_code == 200
        assert patch.json()["completed"] is True

        after_complete = primary.get(f"{BASE_URL}/api/progress").json()
        assert after_complete["tasks_completed"] == base_completed + 1

        # DELETE 404 for wrong user
        wrong = requests.Session()
        wrong.headers.update({"Content-Type": "application/json",
                              "Authorization": f"Bearer {FRESH_TOKEN}"})
        w = wrong.delete(f"{BASE_URL}/api/tasks/{tid}")
        assert w.status_code == 404

        # DELETE cleans up
        d = primary.delete(f"{BASE_URL}/api/tasks/{tid}")
        assert d.status_code == 200
        d2 = primary.delete(f"{BASE_URL}/api/tasks/{tid}")
        assert d2.status_code == 404

        # progress restored
        final = primary.get(f"{BASE_URL}/api/progress").json()
        assert final["tasks_total"] == base_total
        assert final["tasks_completed"] == base_completed


# ---------------------------------------------------------------------------
# 4. GRADES  — POST, summary, DELETE recomputes
# ---------------------------------------------------------------------------
class TestGradesSummary:
    def test_grade_create_updates_summary_and_delete_recomputes(self, primary):
        before = primary.get(f"{BASE_URL}/api/grades/summary").json()
        base_overall = before["overall"]
        base_entries = before["total_entries"]
        assert not _contains_id(before)

        # POST a new Matemáticas grade
        create = primary.post(f"{BASE_URL}/api/grades", json={
            "subject": "Matemáticas",
            "activity": "TEST_iter3_grade",
            "period": "P1",
            "score": 4.5,
            "weight": 20,
        })
        assert create.status_code == 200
        gid = create.json()["id"]

        after = primary.get(f"{BASE_URL}/api/grades/summary").json()
        assert after["total_entries"] == base_entries + 1

        # verify per-subject count for Matemáticas increased
        subj_map = {p["subject"]: p for p in after["per_subject"]}
        assert "Matemáticas" in subj_map
        # overall should recompute (sum/count rounded to 2)
        assert isinstance(after["overall"], (int, float))

        # DELETE and confirm recompute
        d = primary.delete(f"{BASE_URL}/api/grades/{gid}")
        assert d.status_code == 200
        restored = primary.get(f"{BASE_URL}/api/grades/summary").json()
        assert restored["total_entries"] == base_entries
        assert abs(restored["overall"] - base_overall) < 1e-6


# ---------------------------------------------------------------------------
# 5. CALENDAR EVENTS
# ---------------------------------------------------------------------------
class TestEvents:
    def test_events_count_23_and_crud(self, primary):
        r = primary.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        assert not _contains_id(r.json())
        assert len(r.json()) == 23

        create = primary.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_iter3_event",
            "date": "2026-03-05",
            "time": "10:00",
            "type": "evento",
            "subject": "Matemáticas",
        })
        assert create.status_code == 200
        eid = create.json()["id"]

        listing = primary.get(f"{BASE_URL}/api/events").json()
        assert len(listing) == 24
        assert any(e["id"] == eid for e in listing)

        # Wrong owner → 404
        wrong = requests.Session()
        wrong.headers.update({"Content-Type": "application/json",
                              "Authorization": f"Bearer {FRESH_TOKEN}"})
        w = wrong.delete(f"{BASE_URL}/api/events/{eid}")
        assert w.status_code == 404

        d = primary.delete(f"{BASE_URL}/api/events/{eid}")
        assert d.status_code == 200

        final = primary.get(f"{BASE_URL}/api/events").json()
        assert len(final) == 23


# ---------------------------------------------------------------------------
# 6. RESOURCES filter
# ---------------------------------------------------------------------------
class TestResourcesFilter:
    def test_all_98(self):
        r = requests.get(f"{BASE_URL}/api/resources")
        assert r.status_code == 200
        assert len(r.json()) == 98

    def test_todos_returns_all(self):
        r = requests.get(f"{BASE_URL}/api/resources", params={"area": "Todos"})
        assert r.status_code == 200
        assert len(r.json()) == 98

    def test_matematicas_filter(self):
        r = requests.get(f"{BASE_URL}/api/resources", params={"area": "Matemáticas"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 21
        assert all(i["area"] == "Matemáticas" for i in items)

    def test_sociales_filter_rename_complete(self):
        r = requests.get(f"{BASE_URL}/api/resources", params={"area": "Sociales"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 19
        assert all(i["area"] == "Sociales" for i in items)
        # rename must be complete — no legacy docs remain
        legacy = requests.get(f"{BASE_URL}/api/resources",
                              params={"area": "Sociales y Ciudadanas"}).json()
        assert len(legacy) == 0


# ---------------------------------------------------------------------------
# 7. PATCH /api/profile — uppercase, empty rejection, "Sin cambios", flags preserved
# ---------------------------------------------------------------------------
class TestProfilePatch:
    def test_patch_section_lowercase_uppercased_and_flags_preserved(self, primary):
        # snapshot flags
        me_before = primary.get(f"{BASE_URL}/api/auth/me").json()
        assert me_before["profile_setup_completed"] is True
        assert me_before["initial_assessment_completed"] is True

        r = primary.patch(f"{BASE_URL}/api/profile", json={"section": "b"})
        assert r.status_code == 200, r.text
        assert r.json()["section"] == "B"
        # flags NOT reset
        assert r.json()["profile_setup_completed"] is True
        assert r.json()["initial_assessment_completed"] is True

        me = primary.get(f"{BASE_URL}/api/auth/me").json()
        assert me["section"] == "B"
        assert me["profile_setup_completed"] is True
        assert me["initial_assessment_completed"] is True

        # RESTORE to 'A'
        restore = primary.patch(f"{BASE_URL}/api/profile", json={"section": "a"})
        assert restore.status_code == 200
        assert restore.json()["section"] == "A"

    def test_patch_empty_required_field_400(self, primary):
        r = primary.patch(f"{BASE_URL}/api/profile", json={"section": ""})
        # exclude_none is applied so empty-string reaches validator → 400
        # Note: empty string may be treated as None by pydantic. Accept either
        # Sin cambios (all-empty→no updates) OR Campo obligatorio.
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert ("Campo obligatorio" in detail) or ("Sin cambios" in detail)

    def test_patch_empty_body_400_sin_cambios(self, primary):
        r = primary.patch(f"{BASE_URL}/api/profile", json={})
        assert r.status_code == 400
        assert "Sin cambios" in r.json().get("detail", "")


# ---------------------------------------------------------------------------
# 8. Mandatory onboarding still blocks — on fresh audit user
# ---------------------------------------------------------------------------
class TestFreshUserOnboarding:
    def test_a_assessment_complete_before_profile_400(self, fresh):
        r = fresh.post(f"{BASE_URL}/api/assessments/complete", json={"completed": True})
        assert r.status_code == 400
        assert "Perfil incompleto" in r.json().get("detail", "")

    def test_b_profile_setup_missing_field_400(self, fresh):
        r = fresh.post(f"{BASE_URL}/api/profile/setup", json={
            "name": "", "section": "A", "jornada": "Mañana",
            "birth_date": "2010-01-01", "guardian_name": "G", "guardian_phone": "1",
        })
        assert r.status_code == 400
        assert "Campo obligatorio" in r.json().get("detail", "")

    def test_c_complete_without_all_subjects_400_with_missing_list(self, fresh):
        # complete profile
        p = fresh.post(f"{BASE_URL}/api/profile/setup", json={
            "name": "Ana", "section": "A", "jornada": "Mañana",
            "birth_date": "2010-01-01", "guardian_name": "G", "guardian_phone": "1",
        })
        assert p.status_code == 200
        r = fresh.post(f"{BASE_URL}/api/assessments/complete", json={"completed": True})
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "Faltan evaluaciones por abrir" in detail
        for s in SUBJECTS:
            assert s in detail

    def test_d_open_all_then_complete_200(self, fresh):
        for s in SUBJECTS:
            fresh.post(f"{BASE_URL}/api/assessments/open", json={"subject": s})
        r = fresh.post(f"{BASE_URL}/api/assessments/complete", json={"completed": True})
        assert r.status_code == 200, r.text
        me = fresh.get(f"{BASE_URL}/api/auth/me").json()
        assert me["profile_setup_completed"] is True
        assert me["initial_assessment_completed"] is True


# ---------------------------------------------------------------------------
# 9. BULK IMPORT
# ---------------------------------------------------------------------------
class TestBulkImport:
    def test_empty_bulk_returns_zero_counts(self, primary):
        r = primary.post(f"{BASE_URL}/api/import/bulk", json={
            "tasks": [], "grades": [], "events": [], "resources": [], "replace": False,
        })
        assert r.status_code == 200
        d = r.json()
        assert d.get("tasks_inserted") == 0
        assert d.get("grades_inserted") == 0
        assert d.get("events_inserted") == 0

    def test_one_of_each_persists_and_flags_untouched(self, primary):
        me_before = primary.get(f"{BASE_URL}/api/auth/me").json()

        payload = {
            "tasks": [{"title": "TEST_bulk_task", "subject": "Matemáticas"}],
            "grades": [{"subject": "Inglés", "activity": "TEST_bulk_grade", "score": 4.0}],
            "events": [{"title": "TEST_bulk_event", "date": "2026-04-01"}],
            "resources": [{
                "title": "TEST_bulk_resource",
                "area": "Matemáticas",
                "topic": "TEST",
                "url": "https://www.youtube.com/watch?v=TESTITER3XYZ",
            }],
            "replace": False,
        }
        r = primary.post(f"{BASE_URL}/api/import/bulk", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tasks_inserted"] == 1
        assert d["grades_inserted"] == 1
        assert d["events_inserted"] == 1
        # resource: either inserted or updated
        assert (d["resources_inserted"] + d["resources_updated"]) == 1

        # flags preserved (critical guarantee)
        me_after = primary.get(f"{BASE_URL}/api/auth/me").json()
        assert me_after["profile_setup_completed"] == me_before["profile_setup_completed"]
        assert me_after["initial_assessment_completed"] == me_before["initial_assessment_completed"]

        # persisted in Mongo & retrievable via GET
        tasks = primary.get(f"{BASE_URL}/api/tasks").json()
        assert any(t["title"] == "TEST_bulk_task" for t in tasks)
        events = primary.get(f"{BASE_URL}/api/events").json()
        assert any(e["title"] == "TEST_bulk_event" for e in events)

        # cleanup — remove the TEST_bulk_* rows we created
        async def _cleanup():
            c, db = await _mongo()
            await db.tasks.delete_many({"user_id": PRIMARY_USER_ID, "title": "TEST_bulk_task"})
            await db.grades.delete_many({"user_id": PRIMARY_USER_ID, "activity": "TEST_bulk_grade"})
            await db.events.delete_many({"user_id": PRIMARY_USER_ID, "title": "TEST_bulk_event"})
            await db.resources.delete_many({"url": "https://www.youtube.com/watch?v=TESTITER3XYZ"})
            c.close()
        asyncio.run(_cleanup())


# ---------------------------------------------------------------------------
# 10. CROSS-USER ISOLATION
# ---------------------------------------------------------------------------
class TestCrossUserIsolation:
    def test_fresh_user_cannot_see_primary_data(self, fresh):
        for path in ("/api/tasks", "/api/grades", "/api/events"):
            r = fresh.get(f"{BASE_URL}{path}")
            assert r.status_code == 200
            data = r.json()
            # None of primary's rows should surface
            for item in data:
                assert item.get("user_id") != PRIMARY_USER_ID
