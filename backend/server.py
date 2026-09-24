"""
Class Up · El Castillo — Backend
Modular FastAPI backend organised by domain:
  auth, users, assessments, tasks, grades, sessions, resources, progress.
"""
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional
import logging
import os
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Mongo
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("classup")

# ---------------------------------------------------------------------------
# App / router
# ---------------------------------------------------------------------------
app = FastAPI(title="Class Up · El Castillo")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SUBJECTS = [
    "Lectura Crítica",
    "Matemáticas",
    "Sociales y Ciudadanas",
    "Ciencias Naturales",
    "Inglés",
]

ASSESSMENT_FORMS = {
    "Lectura Crítica": "https://docs.google.com/forms/d/e/1FAIpQLSexGYQmE6JBEBlElY6KKM1o4Q0h_d3q96Bv8M9TaB_8nz3iUg/viewform?pli=1",
    "Matemáticas": "https://docs.google.com/forms/d/e/1FAIpQLSfNHlslXao6BCRWby38muPa0aguaRvDmQW34iwHcdRbn845BQ/viewform",
    "Sociales y Ciudadanas": "https://docs.google.com/forms/d/e/1FAIpQLSdDnTWm_FN_QHKXWvbiFRQ6VaWRNrEhV5OaxnyF6JfX0i2Rxw/viewform",
    "Ciencias Naturales": "https://docs.google.com/forms/d/e/1FAIpQLSfYYd_tAdPuiqmOzuu8IhvSiMvkxARQcIvkPv2CY54mqM2aEQ/viewform",
    "Inglés": "https://docs.google.com/forms/d/e/1FAIpQLSe7Gah_r2LSScH5A6Cf4wino69scgdwVdtlt5gcMYO7ZovCiw/viewform",
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class User(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    grade: str = "9°"
    # Profile setup fields (mandatory onboarding)
    section: Optional[str] = None            # A, B, C, D...
    jornada: Optional[str] = None            # Mañana / Tarde / Única
    birth_date: Optional[str] = None         # ISO YYYY-MM-DD
    student_phone: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    profile_setup_completed: bool = False
    # Assessment fields
    initial_assessment_completed: bool = False
    assessments_opened: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=now_utc)


class ProfileSetup(BaseModel):
    name: str
    section: str
    jornada: str
    birth_date: str
    guardian_name: str
    guardian_phone: str
    student_phone: Optional[str] = ""


class SessionExchange(BaseModel):
    session_id: str


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    description: Optional[str] = ""
    subject: str
    due_date: Optional[str] = None  # ISO date
    due_time: Optional[str] = None  # HH:mm
    priority: str = "media"          # alta | media | baja
    completed: bool = False
    created_at: datetime = Field(default_factory=now_utc)


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    subject: str
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    priority: str = "media"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None


class Grade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject: str
    activity: str
    period: str = "P1"
    score: float
    weight: float = 100.0
    created_at: datetime = Field(default_factory=now_utc)


class GradeCreate(BaseModel):
    subject: str
    activity: str
    period: str = "P1"
    score: float
    weight: float = 100.0


class StudySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    duration_min: int
    subject: Optional[str] = None
    completed: bool = True
    created_at: datetime = Field(default_factory=now_utc)


class StudySessionCreate(BaseModel):
    duration_min: int
    subject: Optional[str] = None
    completed: bool = True


class Resource(BaseModel):
    id: str
    title: str
    area: str
    grade: int = 9
    topic: str
    subtopic: Optional[str] = ""
    type: str = "video"
    difficulty: str = "basico"  # basico | intermedio | avanzado
    url: str
    thumbnail: Optional[str] = None


class AssessmentOpen(BaseModel):
    subject: str


class InitialAssessmentComplete(BaseModel):
    completed: bool = True


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = ensure_aware(session.get("expires_at"))
    if expires_at and expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/session")
async def create_session(payload: SessionExchange):
    if not payload.session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
        except Exception as exc:
            logger.exception("Emergent auth call failed: %s", exc)
            raise HTTPException(status_code=401, detail="Auth provider unreachable")

    if r.status_code != 200:
        logger.warning("Emergent session-data returned %s: %s", r.status_code, r.text[:200])
        raise HTTPException(status_code=401, detail="Invalid or used session")

    data = r.json()
    email = data.get("email")
    name = data.get("name") or (email.split("@")[0] if email else "Estudiante")
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Malformed provider response")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
        user_doc = {**existing, "name": name, "picture": picture}
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = User(
            user_id=user_id, email=email, name=name, picture=picture
        ).model_dump()
        await db.users.insert_one({**user_doc})

    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(days=7),
        }
    )

    user_doc.pop("_id", None)
    return {"session_token": session_token, "user": user_doc}


@api.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    user.pop("_id", None)
    return user


@api.post("/auth/logout")
async def auth_logout(request: Request):
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        token = header[7:].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Assessments (initial)
# ---------------------------------------------------------------------------
@api.get("/assessments")
async def list_assessments(user=Depends(get_current_user)):
    opened = user.get("assessments_opened", [])
    return {
        "subjects": [
            {"name": s, "url": ASSESSMENT_FORMS[s], "opened": s in opened}
            for s in SUBJECTS
        ],
        "completed": user.get("initial_assessment_completed", False),
    }


@api.post("/assessments/open")
async def mark_assessment_opened(payload: AssessmentOpen, user=Depends(get_current_user)):
    if payload.subject not in SUBJECTS:
        raise HTTPException(status_code=400, detail="Unknown subject")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$addToSet": {"assessments_opened": payload.subject}},
    )
    return {"ok": True}


@api.post("/assessments/complete")
async def complete_initial_assessment(
    payload: InitialAssessmentComplete, user=Depends(get_current_user)
):
    # Enforce mandatory onboarding: profile + all 5 assessments opened.
    if not user.get("profile_setup_completed"):
        raise HTTPException(status_code=400, detail="Perfil incompleto")
    opened = set(user.get("assessments_opened", []))
    missing = [s for s in SUBJECTS if s not in opened]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan evaluaciones por abrir: {', '.join(missing)}",
        )
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"initial_assessment_completed": payload.completed}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile setup (mandatory onboarding form)
# ---------------------------------------------------------------------------
REQUIRED_FIELDS = ("name", "section", "jornada", "birth_date", "guardian_name", "guardian_phone")


@api.post("/profile/setup")
async def profile_setup(payload: ProfileSetup, user=Depends(get_current_user)):
    data = payload.model_dump()
    for f in REQUIRED_FIELDS:
        val = (data.get(f) or "").strip() if isinstance(data.get(f), str) else data.get(f)
        if not val:
            raise HTTPException(status_code=400, detail=f"Campo obligatorio: {f}")
    updates = {
        "name": data["name"].strip(),
        "section": data["section"].strip().upper(),
        "jornada": data["jornada"].strip(),
        "birth_date": data["birth_date"].strip(),
        "student_phone": (data.get("student_phone") or "").strip(),
        "guardian_name": data["guardian_name"].strip(),
        "guardian_phone": data["guardian_phone"].strip(),
        "profile_setup_completed": True,
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return fresh


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------
@api.get("/tasks", response_model=List[Task])
async def list_tasks(user=Depends(get_current_user)):
    docs = await db.tasks.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Task(**d) for d in docs]


@api.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate, user=Depends(get_current_user)):
    task = Task(user_id=user["user_id"], **payload.model_dump())
    await db.tasks.insert_one(task.model_dump())
    return task


@api.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, payload: TaskUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.tasks.find_one_and_update(
        {"id": task_id, "user_id": user["user_id"]},
        {"$set": updates},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**res)


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user)):
    res = await db.tasks.delete_one({"id": task_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Grades
# ---------------------------------------------------------------------------
@api.get("/grades", response_model=List[Grade])
async def list_grades(user=Depends(get_current_user)):
    docs = await db.grades.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Grade(**d) for d in docs]


@api.post("/grades", response_model=Grade)
async def create_grade(payload: GradeCreate, user=Depends(get_current_user)):
    grade = Grade(user_id=user["user_id"], **payload.model_dump())
    await db.grades.insert_one(grade.model_dump())
    return grade


@api.delete("/grades/{grade_id}")
async def delete_grade(grade_id: str, user=Depends(get_current_user)):
    res = await db.grades.delete_one({"id": grade_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Grade not found")
    return {"ok": True}


@api.get("/grades/summary")
async def grades_summary(user=Depends(get_current_user)):
    docs = await db.grades.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    by_subject: dict = {}
    for g in docs:
        by_subject.setdefault(g["subject"], []).append(g["score"])
    per_subject = [
        {"subject": s, "average": round(sum(v) / len(v), 2), "count": len(v)}
        for s, v in by_subject.items()
    ]
    overall = round(sum(g["score"] for g in docs) / len(docs), 2) if docs else 0.0
    return {"overall": overall, "per_subject": per_subject, "total_entries": len(docs)}


# ---------------------------------------------------------------------------
# Study sessions (Pomodoro)
# ---------------------------------------------------------------------------
@api.get("/sessions", response_model=List[StudySession])
async def list_sessions(user=Depends(get_current_user)):
    docs = await db.study_sessions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [StudySession(**d) for d in docs]


@api.post("/sessions", response_model=StudySession)
async def create_session_entry(payload: StudySessionCreate, user=Depends(get_current_user)):
    s = StudySession(user_id=user["user_id"], **payload.model_dump())
    await db.study_sessions.insert_one(s.model_dump())
    return s


@api.get("/sessions/summary")
async def sessions_summary(user=Depends(get_current_user)):
    docs = await db.study_sessions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    total_min = sum(d["duration_min"] for d in docs)
    return {"total_sessions": len(docs), "total_minutes": total_min}


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------
@api.get("/resources", response_model=List[Resource])
async def list_resources(area: Optional[str] = None):
    query: dict = {}
    if area and area != "Todos":
        query["area"] = area
    docs = await db.resources.find(query, {"_id": 0}).to_list(500)
    return [Resource(**d) for d in docs]


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------
@api.get("/progress")
async def progress(user=Depends(get_current_user)):
    tasks = await db.tasks.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    grades = await db.grades.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    sessions = await db.study_sessions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("completed"))
    avg = round(sum(g["score"] for g in grades) / len(grades), 2) if grades else 0.0
    return {
        "tasks_total": total_tasks,
        "tasks_completed": completed_tasks,
        "tasks_pending": total_tasks - completed_tasks,
        "grades_avg": avg,
        "study_minutes": sum(s["duration_min"] for s in sessions),
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "Class Up · El Castillo", "status": "ok"}


app.include_router(api)


# ---------------------------------------------------------------------------
# Startup: indexes + seed resources
# ---------------------------------------------------------------------------
RESOURCE_SEED = [
    # Lectura Crítica
    ("Comprensión lectora – Nivel básico", "Lectura Crítica", "Comprensión lectora", "Ideas principales", "basico", "https://www.youtube.com/watch?v=Q9-9g4rQwFo"),
    ("Tipos de textos", "Lectura Crítica", "Tipología textual", "Narrativo, argumentativo, expositivo", "basico", "https://www.youtube.com/watch?v=1D-6vY_lQow"),
    ("Argumentación y falacias", "Lectura Crítica", "Argumentación", "Falacias comunes", "intermedio", "https://www.youtube.com/watch?v=1PZaFXAG_1s"),
    ("Análisis de textos ICFES", "Lectura Crítica", "Preparación ICFES", "Ejercicios resueltos", "avanzado", "https://www.youtube.com/watch?v=xgLzk4vN9dU"),
    # Matemáticas
    ("Factorización desde cero", "Matemáticas", "Álgebra", "Factor común", "basico", "https://www.youtube.com/watch?v=5F5lZ7c9Krg"),
    ("Ecuaciones lineales", "Matemáticas", "Álgebra", "Ecuaciones de primer grado", "basico", "https://www.youtube.com/watch?v=Ft2_QtXAqOE"),
    ("Ecuaciones cuadráticas", "Matemáticas", "Álgebra", "Fórmula general", "intermedio", "https://www.youtube.com/watch?v=SDe-1lGeS0U"),
    ("Trigonometría 9°", "Matemáticas", "Trigonometría", "Razones trigonométricas", "intermedio", "https://www.youtube.com/watch?v=F21S9Wpi0y8"),
    ("Estadística básica", "Matemáticas", "Estadística", "Media, mediana, moda", "basico", "https://www.youtube.com/watch?v=uhxtUt_-GyM"),
    # Sociales y Ciudadanas
    ("Constitución de Colombia 1991", "Sociales y Ciudadanas", "Cívica", "Estructura del Estado", "basico", "https://www.youtube.com/watch?v=hxs4Wc9BQPk"),
    ("Historia de Colombia siglo XX", "Sociales y Ciudadanas", "Historia", "Violencia y Frente Nacional", "intermedio", "https://www.youtube.com/watch?v=39G7pQ9ftbc"),
    ("Democracia y participación", "Sociales y Ciudadanas", "Cívica", "Mecanismos de participación", "basico", "https://www.youtube.com/watch?v=uUCP5AzS5Sk"),
    ("Geografía de Colombia", "Sociales y Ciudadanas", "Geografía", "Regiones naturales", "basico", "https://www.youtube.com/watch?v=Xh6bJXAPT4M"),
    # Ciencias Naturales
    ("Célula: estructura y función", "Ciencias Naturales", "Biología", "Organelos", "basico", "https://www.youtube.com/watch?v=URUJD5NEXC8"),
    ("Genética mendeliana", "Ciencias Naturales", "Biología", "Leyes de Mendel", "intermedio", "https://www.youtube.com/watch?v=CBezq1fFUEA"),
    ("Tabla periódica", "Ciencias Naturales", "Química", "Grupos y periodos", "basico", "https://www.youtube.com/watch?v=0RRVV4Diomg"),
    ("Enlace químico", "Ciencias Naturales", "Química", "Iónico y covalente", "intermedio", "https://www.youtube.com/watch?v=6BjqrjZY1eE"),
    ("Leyes de Newton", "Ciencias Naturales", "Física", "Mecánica clásica", "intermedio", "https://www.youtube.com/watch?v=kKKM8Y-u7ds"),
    # Inglés
    ("Present Simple vs Present Continuous", "Inglés", "Gramática", "Tiempos verbales", "basico", "https://www.youtube.com/watch?v=NlM_lKrOOiA"),
    ("Past Simple", "Inglés", "Gramática", "Verbos regulares e irregulares", "basico", "https://www.youtube.com/watch?v=hCihWkYRUsc"),
    ("Vocabulary: School", "Inglés", "Vocabulario", "Palabras del colegio", "basico", "https://www.youtube.com/watch?v=guvxHYAP5oA"),
    ("Reading comprehension B1", "Inglés", "Comprensión", "Ejercicios nivel B1", "intermedio", "https://www.youtube.com/watch?v=oCU8yv3sK9Y"),
]


@app.on_event("startup")
async def startup() -> None:
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.tasks.create_index([("user_id", 1), ("created_at", -1)])
        await db.grades.create_index([("user_id", 1), ("subject", 1)])
        await db.study_sessions.create_index([("user_id", 1), ("created_at", -1)])
        await db.resources.create_index("id", unique=True)
    except Exception as exc:
        logger.warning("Index creation warning: %s", exc)

    # Seed resources if empty
    existing = await db.resources.count_documents({})
    if existing == 0:
        docs = []
        for title, area, topic, subtopic, difficulty, url in RESOURCE_SEED:
            vid = url.split("v=")[-1].split("&")[0]
            docs.append(
                {
                    "id": str(uuid.uuid4()),
                    "title": title,
                    "area": area,
                    "grade": 9,
                    "topic": topic,
                    "subtopic": subtopic,
                    "type": "video",
                    "difficulty": difficulty,
                    "url": url,
                    "thumbnail": f"https://img.youtube.com/vi/{vid}/mqdefault.jpg",
                }
            )
        await db.resources.insert_many(docs)
        logger.info("Seeded %d resources", len(docs))


@app.on_event("shutdown")
async def shutdown() -> None:
    mongo_client.close()
