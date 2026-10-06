import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def main():
    print("Probando conexion...")
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    resultado = await client.admin.command("ping")
    print("CONEXION OK:", resultado)

asyncio.run(main())
