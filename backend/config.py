"""Configuration and MongoDB connection for Watchlist app."""
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database

# Load .env from project root (parent of backend/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "watchlist"
COLLECTION_NAME = "items"


def get_db() -> Database:
    """Return MongoDB database instance."""
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]


def get_items_collection():
    """Return the items collection."""
    return get_db()[COLLECTION_NAME]
