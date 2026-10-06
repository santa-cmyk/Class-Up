import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]

    print("Colecciones:")
    print(await db.list_collection_names())

    client.close()

asyncio.run(main())