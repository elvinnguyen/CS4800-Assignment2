"""Watchlist — Flask backend and REST API."""

import os
from datetime import datetime
from pathlib import Path

from bson import ObjectId
from flask import Flask, jsonify, request, send_from_directory
from pymongo.errors import PyMongoError

from config import get_items_collection

app = Flask(__name__, static_folder=None)

# Project root for serving frontend files
PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# Allowed fields for watchlist items
ITEM_FIELDS = {
    "title",
    "type",
    "status",
    "rating",
    "current_episode",
    "total_episodes",
    "notes",
    "date_added",
}
REQUIRED_FIELDS = {"title"}
VALID_TYPES = {"Movie", "TV Show"}
VALID_STATUSES = {"Planned", "Watching", "Completed", "Dropped"}
RATING_MIN, RATING_MAX = 1, 10


def serialize_item(doc):
    """Convert MongoDB document to JSON-serializable dict (ObjectId -> str)."""
    if not doc:
        return None
    out = dict(doc)
    out["id"] = str(doc["_id"])
    del out["_id"]
    if "date_added" in out and hasattr(out["date_added"], "isoformat"):
        out["date_added"] = out["date_added"].isoformat()
    return out


def validate_item(data, for_update=False):
    """Validate item payload. Returns (None, None) if valid, else (error_message, 400)."""
    if not isinstance(data, dict):
        return "Request body must be JSON object", 400

    # Required fields
    if not for_update:
        for field in REQUIRED_FIELDS:
            if field not in data or data[field] is None:
                return f"Missing required field: {field}", 400
    if "title" in data and (data["title"] is None or str(data["title"]).strip() == ""):
        return "title is required and cannot be empty", 400

    # Restrict to allowed fields
    for key in data:
        if key not in ITEM_FIELDS:
            return f"Unknown field: {key}", 400

    if "type" in data and data["type"] is not None and data["type"] not in VALID_TYPES:
        return f"type must be one of: {', '.join(VALID_TYPES)}", 400
    if (
        "status" in data
        and data["status"] is not None
        and data["status"] not in VALID_STATUSES
    ):
        return f"status must be one of: {', '.join(VALID_STATUSES)}", 400

    rating = data.get("rating")
    if rating is not None:
        try:
            r = int(rating)
            if r < RATING_MIN or r > RATING_MAX:
                return f"rating must be between {RATING_MIN} and {RATING_MAX}", 400
        except (TypeError, ValueError):
            return "rating must be an integer", 400

    for ep in ("current_episode", "total_episodes"):
        if ep in data and data[ep] is not None:
            try:
                if int(data[ep]) < 0:
                    return f"{ep} must be non-negative", 400
            except (TypeError, ValueError):
                return f"{ep} must be a number", 400

    return None, None


def build_item_from_body(data):
    """Build a document for insert/update from request body."""
    doc = {k: v for k, v in data.items() if k in ITEM_FIELDS and v is not None}
    if "title" in doc:
        doc["title"] = str(doc["title"]).strip()
    if "rating" in doc:
        doc["rating"] = int(doc["rating"])
    for ep in ("current_episode", "total_episodes"):
        if ep in doc:
            doc[ep] = int(doc[ep])
    if "notes" in doc:
        doc["notes"] = str(doc["notes"])
    return doc


# ——— REST API ———


@app.route("/api/items", methods=["GET"])
def list_items():
    """GET /api/items — list all watchlist items."""
    try:
        coll = get_items_collection()
        cursor = coll.find().sort("date_added", -1)
        items = [serialize_item(d) for d in cursor]
        return jsonify(items)
    except PyMongoError as e:
        return jsonify({"error": "Database error", "detail": str(e)}), 500


@app.route("/api/items", methods=["POST"])
def create_item():
    """POST /api/items — create a new watchlist item."""
    data = request.get_json(silent=True)
    err, status = validate_item(data or {}, for_update=False)
    if err:
        return jsonify({"error": err}), status

    doc = build_item_from_body(data)
    doc.setdefault("type", "Movie")
    doc.setdefault("status", "Planned")
    doc["date_added"] = datetime.utcnow()

    try:
        coll = get_items_collection()
        result = coll.insert_one(doc)
        created = coll.find_one({"_id": result.inserted_id})
        return jsonify(serialize_item(created)), 201
    except PyMongoError as e:
        return jsonify({"error": "Database error", "detail": str(e)}), 500


@app.route("/api/items/<item_id>", methods=["PUT"])
def update_item(item_id):
    """PUT /api/items/<id> — update an existing item."""
    if not ObjectId.is_valid(item_id):
        return jsonify({"error": "Invalid item id"}), 400

    data = request.get_json(silent=True)
    err, status = validate_item(data or {}, for_update=True)
    if err:
        return jsonify({"error": err}), status

    updates = build_item_from_body(data or {})
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    try:
        coll = get_items_collection()
        result = coll.find_one_and_update(
            {"_id": ObjectId(item_id)},
            {"$set": updates},
            return_document=True,
        )
        if not result:
            return jsonify({"error": "Item not found"}), 404
        return jsonify(serialize_item(result))
    except PyMongoError as e:
        return jsonify({"error": "Database error", "detail": str(e)}), 500


@app.route("/api/items/<item_id>", methods=["DELETE"])
def delete_item(item_id):
    """DELETE /api/items/<id> — delete an item."""
    if not ObjectId.is_valid(item_id):
        return jsonify({"error": "Invalid item id"}), 400

    try:
        coll = get_items_collection()
        result = coll.delete_one({"_id": ObjectId(item_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Item not found"}), 404
        return jsonify({"message": "Item deleted"}), 200
    except PyMongoError as e:
        return jsonify({"error": "Database error", "detail": str(e)}), 500


# ——— Serve frontend ———


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/dashboard.html")
def dashboard():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.route("/<path:path>")
def frontend_static(path):
    """Serve frontend static files (css/, js/)."""
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
