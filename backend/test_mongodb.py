import os, certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

client = MongoClient(os.environ["MONGODB_URI"], tlsCAFile=certifi.where())
client.admin.command("ping")
print("Successfully connected to MongoDB Atlas")