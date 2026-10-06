import asyncio
import json
import uuid
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def main():
    print("SERVIDOR IMPORTADOR:", os.getenv("MONGO_URL").split("@")[-1].split("/")[0])
    db = AsyncIOMotorClient(os.getenv("MONGO_URL"))["test_database"]
    d = json.load(open("datos_ok.json", encoding="utf-16"))

    p = d["perfil_demo"]

    user = {
        "user_id": "demo_juan_david",
        "email": p["correo"],
        "name": p["nombre"],
        "grade": p["grado"],
        "section": p["grupo"],
        "jornada": p["jornada"],
        "guardian_name": p["acudiente_nombre"],
        "guardian_phone": p["acudiente_telefono"],
        "profile_setup_completed": True,
        "initial_assessment_completed": True
    }

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": user},
        upsert=True
    )

    for collection, key in [
        ("tasks", "tareas"),
        ("grades", "calificaciones"),
        ("events", "eventos_calendario"),
        ("resources", "recursos")
    ]:
        await db[collection].delete_many({})

        docs = d[key]

        if collection == "tasks":
            docs = [
                {
                    **x,
                    "title": x.get("title", x.get("titulo")),
                    "subject": x.get("subject", x.get("materia")),
                    "user_id": user["user_id"]
                }
                for x in docs
            ]

        elif collection == "grades":
            docs = [
                {
                    **x,
                    "subject": x.get("subject", x.get("materia")),
                    "activity": x.get("activity", x.get("actividad")),
                    "score": x.get("score", x.get("calificacion")),
                    "user_id": user["user_id"]
                }
                for x in docs
            ]

        elif collection == "events":
            docs = [
                {
                    **x,
                    "title": x.get("title", x.get("titulo")),
                    "date": x.get("date", x.get("fecha")),
                    "type": x.get("type", x.get("tipo")),
                    "user_id": user["user_id"]
                }
                for x in docs
            ]

        elif collection == "resources":
            docs = [
                {
                    **x,
                    "title": x.get("title", x.get("titulo")),
                    "area": x.get("area", x.get("materia")),
                    "topic": x.get("topic") or x.get("tema") or "Material de estudio",
                    "user_id": user["user_id"]
                }
                for x in docs
            ]

        if collection == "resources":
            docs = [
                {
                    **x,
                    "id": x.get("id", str(uuid.uuid4()))
                }
                for x in docs
            ]

        if docs:
            await db[collection].insert_many(docs)
    print("BASE:", db.name)
    print("TAREAS EN BD:", await db.tasks.count_documents({}))
    print("CALIFICACIONES EN BD:", await db.grades.count_documents({}))
    print("EVENTOS EN BD:", await db.events.count_documents({}))
    print("RECURSOS EN BD:", await db.resources.count_documents({}))
    print("IMPORTACION COMPLETA")
    print("20 tareas | 20 notas | 75 recursos | 20 eventos")


asyncio.run(main())