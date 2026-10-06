import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]

    for collection in ["tasks", "grades", "resources", "events", "study_sessions"]:
        count = await db[collection].count_documents({})
        print(f"{collection}: {count}")

    client.close()

asyncio.run(main())