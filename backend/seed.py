"""Seed the watchlist database with sample items. Run from project root or backend/."""
from datetime import datetime

# Allow running as script from project root or from backend/
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import get_items_collection

SAMPLES = [
    {
        "title": "Inception",
        "type": "Movie",
        "status": "Completed",
        "rating": 9,
        "notes": "Mind-bending thriller.",
        "date_added": datetime.utcnow(),
    },
    {
        "title": "Breaking Bad",
        "type": "TV Show",
        "status": "Watching",
        "rating": 10,
        "current_episode": 3,
        "total_episodes": 62,
        "notes": "Season 1.",
        "date_added": datetime.utcnow(),
    },
    {
        "title": "The Shawshank Redemption",
        "type": "Movie",
        "status": "Planned",
        "notes": "Classic to watch.",
        "date_added": datetime.utcnow(),
    },
]


def main():
    coll = get_items_collection()
    result = coll.insert_many(SAMPLES)
    print(f"Inserted {len(result.inserted_ids)} sample items.")


if __name__ == "__main__":
    main()
