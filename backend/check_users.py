import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]

    users = await db.users.find({}, {"_id": 0}).to_list(20)

    print("USUARIOS EN CLASS UP:")
    for user in users:
        print(user)

    client.close()

asyncio.run(main())