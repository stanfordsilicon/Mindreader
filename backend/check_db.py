import os
import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

client = MongoClient(os.environ["MONGODB_URI"], tlsCAFile=certifi.where())
db = client[os.environ.get("MONGODB_DB", "Project0")]

print("=== submissions (latest 5) ===")
for doc in db["submissions"].find().sort("submitted_at", -1).limit(5):
    print(doc)

print("\n=== answer_counts ===")
for doc in db["answer_counts"].find():
    print(doc)
