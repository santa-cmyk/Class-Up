import asyncio
import os
from urllib.parse import urlparse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def main():
    url = os.getenv("MONGO_URL")
    parsed = urlparse(url)

    print("SERVIDOR:", parsed.hostname)
    print("BASE:", "test_database")

    client = AsyncIOMotorClient(url)
    db = client["test_database"]

    print("TAREAS:", await db.tasks.count_documents({}))
    print("CALIFICACIONES:", await db.grades.count_documents({}))
    print("EVENTOS:", await db.events.count_documents({}))
    print("RECURSOS:", await db.resources.count_documents({}))

asyncio.run(main())