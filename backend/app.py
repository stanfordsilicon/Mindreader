from http.client import HTTPException
import random
import flask
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError
import certifi
from collections import Counter
import time
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

app = flask.Flask(__name__)
CORS(app, origins=[
    "https://qmoji-webapp.vercel.app",
    r"https://qmoji-webapp-.*-silicons-projects-9fd9ab07\.vercel\.app",
    "http://localhost:5173",
])

# --- MongoDB connection ---
mongo_client = MongoClient(os.environ["MONGODB_URI"], tlsCAFile=certifi.where())
db = mongo_client[os.environ.get("MONGODB_DB", "Project0")]

rooms_col = db["rooms"]
players_col = db["players"]
submissions_col = db["submissions"]
answer_counts_col = db["answer_counts"]
emoji_based_answer_counts_col = db["emoji_based_answer_counts"]  
room_based_emoji_based_answer_counts_col = db["room_based_emoji_based_answer_counts"]  

# Indexes (equivalent to the old SQL constraints)
answer_counts_col.create_index(
    [("language", ASCENDING), ("emoji", ASCENDING), ("word", ASCENDING)],
    unique=True,
    name="uq_answer",
)
emoji_based_answer_counts_col.create_index(
     [("_id", ASCENDING)], 
)
room_based_emoji_based_answer_counts_col.create_index(
     [("_id", ASCENDING)], 
)
submissions_col.create_index([("room_id", ASCENDING)])
players_col.create_index([("room_id", ASCENDING)])

SinglePlayerOnlyForNow = True  # Switch for later, for now, we will only allow single player games, but later we will allow multiplayer games
# Thus, until we have implemented multiplayer, the room_id can be hardcoded to "1" for now, which will cause a lot less confusion for now
language = "no_language" \
"" \
"-submitted"
seconds_per_round = 30
MAX_rounds = 16

# -------#


def load_emojis(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "emoji_list.txt")
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip().strip("',\" ") for line in f if line.strip()]
    # The above simply returns a list of emojis from the emoji_list.txt file, which is stored in the same directory as this file


emoji_list = load_emojis()

games = {}  # dict to store different ongoing games, more useful for multiplayer games. In-memory, since a round in progress doesn't need to survive a restart.


def new_game(language="en"):
    return {
        "state": "waiting",
        "round": 0,
        "language": language,
        "current_emoji": random.choice(emoji_list) if emoji_list else None,
        "players": [],
        "scores": {},
        "submissions": {},
        "answer_counts": {},
    }
    # The above function returns a new game dict with all the information of a new game

def save_submission(room_id, user_id, language, emoji, round_num, keywords):
    # Stores the raw submission exactly as received, tagged with who submitted it.
    submissions_col.insert_one({
        "room_id": room_id,
        "user_id": user_id,
        "language": language,
        "emoji": emoji,
        "round": round_num,
        "keywords": keywords,
        "submitted_at": time.time(),
    })


def update_answer_counts(language, emoji, input_stack):
    counts = Counter(input_stack)
    for word, n in counts.items():
        answer_counts_col.update_one(
            {"language": language, "emoji": emoji, "word": word.lower()},
            {"$inc": {"count": n}},
            upsert=True,
        )

def update_emoji_answer_counts(language, emoji, input_stack):
    counts = Counter(input_stack)
    language_field = f"language.{language}"
    for word, n in counts.items():
        result = emoji_based_answer_counts_col.update_one(
            {"_id": emoji, f"{language_field}.word": word.lower()},
            {"$inc": {f"{language_field}.$.count": n}},
        )
        if result.matched_count == 0:
            emoji_based_answer_counts_col.update_one(
                {"_id": emoji},
                {"$push": {language_field: {"word": word.lower(), "count": n}}},
                upsert=True,
            )

def update_room_based_emoji_answer_counts(room_id, language, emoji, input_stack):
    counts = Counter(input_stack)
    language_field = f"language.{language}"
    for word, n in counts.items():
        result = room_based_emoji_based_answer_counts_col.update_one(
            {"_id": room_id, f"{language_field}.emoji.{emoji}.word": word.lower()},
            {"$inc": {f"{language_field}.emoji.{emoji}.$.count": n}},
        )
        if result.matched_count == 0:
            room_based_emoji_based_answer_counts_col.update_one(
                {"_id": room_id},
                {"$push": {f"{language_field}.emoji.{emoji}": {"word": word.lower(), "count": n}}},
                upsert=True,
            )




def scoringSystem(room_id, language, emoji, word):
    field_path = f"language.{language}.emoji.{emoji}"
    projection = {field_path: 1, "_id": 0}

    doc = room_based_emoji_based_answer_counts_col.find_one({"_id": room_id}, projection)
    if not doc:
        return 0

    arr = (
        doc.get("language", {})
           .get(language, {})
           .get("emoji", {})
           .get(emoji, [])
    )
    for item in arr:
        if item.get("word") == word.lower():
            count =  item.get("count", 0)
            return max(0, count - 1)
    return 0
  

@app.route("/create_room", methods=["POST"])
def create_room():
    data = flask.request.get_json(silent=True) or {}
    language = data.get("language", "en")
    SinglePlayerOnlyForNow = data.get("single_player_only", True)
    # requested_room_id arrives when QMoji 2.0 launched this game with a
    # party already formed — the arcade room's code becomes this game's
    # room id too (a substitution, not a second, parallel room-code system).
    requested_room_id = data.get("room_id")
    if SinglePlayerOnlyForNow:
        room_id = "1"

    elif requested_room_id:
        room_id = str(requested_room_id).strip().upper()
        if room_id in games:
            # Someone else from the same arcade party already seeded this
            # room — join the existing one instead of resetting its state.
            return flask.jsonify({"room_id": room_id, "emoji": games[room_id]["current_emoji"]})

    else:
        room_id = str(uuid.uuid4())[:4].upper()
        attempts = 0
        max_attempts = 20
        while room_id in games and attempts < max_attempts:
            room_id = str(uuid.uuid4())[:4].upper()
            attempts += 1
        if room_id in games:
            return flask.jsonify({"error": "Could not allocate a unique room ID, please try again."}), 503

    games[room_id] = new_game(language)
    if SinglePlayerOnlyForNow:
        games[room_id]["state"] = "playing"
        games[room_id]["round"] = 1

    rooms_col.update_one(
        {"_id": room_id},
        {"$set": {
            "state": games[room_id]["state"],
            "round": games[room_id]["round"],
            "language": games[room_id]["language"],
        }},
        upsert=True,
    )

    return flask.jsonify({"room_id": room_id, "emoji": games[room_id]["current_emoji"]})


"""# If I remember correctly, this function is not used anywhere, but it is a good idea to keep it here in case it is somehow relevant out of nowhere
    data = flask.request.get_json(silent=True)
    if not data or 'language' not in data or 'seconds_per_round' not in data:
        return flask.jsonify({'error': 'Invalid data'}), 400
    global language, seconds_per_round
    language = data['language']
    seconds_per_round = data['seconds_per_round']
    # The above function is to retrieve the data from the poststart page, and store it in the global variables language and seconds_per_round
"""

@app.route("/api/index")  # -- I dont know what the director should be, but this is the route for Hui Ying's tsx filex
def sendEmoji():
    rand = random.choice(emoji_list)
    return flask.jsonify({"message": rand})
# The above and below functions send out the current emoji and the time per round respectively
# to the frontend, so that the frontend can display it to the user


@app.route("/<room_id>/state", methods=["GET"])
def get_state(room_id):
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404
    
    submitted_user_ids = list(game["submissions"].keys())

    return flask.jsonify({
        "state": game["state"],
        "round": game["round"],
        "language": game["language"],
        "emoji": game["current_emoji"],
        "players": game["players"],
        "scores": game["scores"],
        "submitted_user_ids": submitted_user_ids,
        "submitted_count": len(submitted_user_ids),
        "total_players": len(game["players"]),
    })

@app.route("/<room_id>/join", methods=["POST"])
def join_room(room_id):
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404

    data = flask.request.get_json(silent=True) or {}
    username = data.get("username")
    user_id = data.get("user_id")

    if not username or not user_id:
        return flask.jsonify({"error": "user_id and username are required"}), 400

    player_exists = any(p["user_id"] == user_id for p in game["players"])
    if not player_exists:
        player_data = {"user_id": user_id, "name": username}
        game["players"].append(player_data)
        game["scores"][user_id] = game["scores"].get(user_id, 0)

        players_col.update_one(
            {"_id": f"{room_id}_{user_id}"},
            {"$set": {"room_id": room_id, "user_id": user_id, "name": username, "score": game["scores"][user_id]}},
            upsert=True
        )

    return flask.jsonify({"message": "Joined successfully", "players": game["players"]})

@app.route("/<room_id>/leave", methods=["POST"])
def leave_room(room_id):
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404

    data = flask.request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return flask.jsonify({"error": "user_id is required"}), 400
    game["players"] = [p for p in game["players"] if p["user_id"] != user_id]
    
    # 2. Remove player scores & round submissions
    game["scores"].pop(user_id, None)
    game["submissions"].pop(user_id, None)

    # 3. Clean up database record
    players_col.delete_one({"_id": f"{room_id}_{user_id}"})

    # 4. If room is now empty, delete room from memory & DB
    if not game["players"]:
        games.pop(room_id, None)
        rooms_col.delete_one({"_id": room_id})

    return flask.jsonify({"success": True})



@app.route("/<room_id>/start_round", methods=["POST"])
def start_round(room_id):
    # updates the game state for the next round, and sends it to the frontend
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404

    if game["round"] >= MAX_rounds:
        game["state"] = "ended"
        return flask.jsonify({"error": "Max rounds reached", "round": game["round"], "state": "ended"}), 400

    game["current_emoji"] = random.choice(emoji_list)
    game["submissions"] = {}
    game["round"] += 1
    game["state"] = "playing"

    rooms_col.update_one(
        {"_id": room_id},
        {"$set": {
            "current_emoji": game["current_emoji"],
            "round": game["round"],
            "state": game["state"],
        }},
    )

    return flask.jsonify({"emoji": game["current_emoji"], "round": game["round"]})


@app.route("/<room_id>/submit", methods=["POST"])
def submit_keywords(room_id):
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404

    data = flask.request.get_json(silent=True) or {}
    keywords = data.get("keywords")
    user_id = data.get("user_id")

    if not user_id:
        return flask.jsonify({"error": "user_id is required"}), 400

    if not keywords or not isinstance(keywords, list):
        return flask.jsonify({"error": "keywords must be a non-empty list"}), 400
    input_stack = [kw.strip() for kw in keywords if isinstance(kw, str) and kw.strip()]
    if not input_stack:
        return flask.jsonify({"error": "No valid keywords submitted"}), 400

    normalized = [kw.lower() for kw in input_stack]
    if len(normalized) != len(set(normalized)):
        return flask.jsonify({"error": "Seems like an easy way to cheat the system, luckily the devs have already thought of that!"}), 400

    try:
        save_submission(
            room_id=room_id,
            user_id=user_id,
            language=game["language"],
            emoji=game["current_emoji"],
            round_num=game["round"],
            keywords=input_stack,
        )

        game["submissions"][user_id] = input_stack

        update_answer_counts(game["language"], game["current_emoji"], input_stack)

        update_emoji_answer_counts(game["language"], game["current_emoji"], input_stack)
        update_room_based_emoji_answer_counts(room_id, game["language"], game["current_emoji"], input_stack)
    except Exception as e:
        return flask.jsonify({"error": f"Failed to save keywords: {e}"}), 500

    return flask.jsonify({"message": "Keywords submitted"})


@app.route("/<room_id>/round_results", methods=["POST"])
def send_out_scores(room_id):
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404

    try:
        results = {}
        round_scores = {}

        for user_id, words in game["submissions"].items():
            word_counts = {
                word: scoringSystem(room_id, game["language"], game["current_emoji"], word.lower())
                for word in set(words)
            }
            results[user_id] = word_counts

            round_score = sum(word_counts.values())
            round_scores[user_id] = round_score

            game["scores"][user_id] = game["scores"].get(user_id, 0) + round_score

            players_col.update_one(
                {"_id": f"{room_id}_{user_id}"},
                {"$set": {"score": game["scores"][user_id]}},
                upsert=True,
            )

        return flask.jsonify({
            "round": game["round"],
            "emoji": game["current_emoji"],
            "results": results,
            "round_scores": round_scores,
            "total_scores": game["scores"],
        })
    except Exception as e:
        app.logger.exception("round_results failed")
        return flask.jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)


# -- for post-summer: implement a flagging system for inappropriate content or something like that