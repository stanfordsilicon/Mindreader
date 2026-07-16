import random
import flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from collections import Counter
import time
import uuid
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = flask.Flask(__name__)
CORS(app, origins=["https://qmoji-webapp.vercel.app"])  

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 280,
    "pool_pre_ping": True,
}
db = SQLAlchemy(app)
migrate = Migrate(app, db)

SinglePlayerOnlyForNow = True #Switch for later, for now, we will only allow single player games, but later we will allow multiplayer games
#Thus, until we have implemented multiplayer, the room_id can be hardcoded to "1" for now, which will cause a lot less confusion for now
figured_out_sql = True
language = ""
seconds_per_round = 30

#-------#

def load_emojis(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "emoji_list.txt")
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip().strip("',\" ") for line in f if line.strip()]
#The above simply returns a list of emojis from the emoji_list.txt file, which is stored in the same directory as this file
emoji_list = load_emojis()


games = {}  #dict to store diffetent ongoing games, more useful for multiplayer games

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
#The above function returns a new game dict with all the information of a new game

# -- might be handy to implement per-player logs for inappropriate content removal and to check on messing with data
#there will be a privacy trade-off, so might not be worth it, plus it might get cancelled out by sheer numbers

@app.route('/') # starting page
def start_page():
    return flask.render_template('start.html') # create html file named start 
# -- merge the abovementioned start.html file with the start page that Hui Ying is working on, 
# -- and make sure to include the options to select the time selection the language, and merge it with the option to start

 
@app.route("/create_room", methods=["POST"])
def create_room():
    data = flask.request.get_json(silent=True) or {}
    language = data.get("language", "en")
    room_id = str(uuid.uuid4())[:4].upper() #changed to 4 characters because I remembered that jackbox room_id was also only 4 characters
    if SinglePlayerOnlyForNow:
        room_id = "1"
    games[room_id] = new_game(language)
    return flask.jsonify({"room_id": room_id, "emoji": games[room_id]["current_emoji"]})


@app.route('/poststart') 
def post_start():
    return flask.render_template('poststart.html') # create html file named poststart
# this is the page that will be redirected to after the start button is clicked, 
# -- merge with Hui Ying's page

def post_start_dataRetrieve():
    data = flask.request.get_json(silent=True)
    if not data or 'language' not in data or 'seconds_per_round' not in data:
        return flask.jsonify({'error': 'Invalid data'}), 400
    #here be the code to store that data, something along the line of:
    global language, seconds_per_round
    language = data['language']
    seconds_per_round = data['seconds_per_round']
#The above function is to retrieve the data from the poststart page, and store it in the global variables language and seconds_per_round

#according to GPT, you could implement a multiplayer timer function using a websocket, but I still need to learn how that works
#Here is what I have for now, but it is not working yet, and I will need to learn how to implement a websocket for this to work
"""class RoundTimer:
    def __init__(self):
        self.start_time = None
    def start(self):
        self.start_time = time.time()
    def get_remaining_time(self):
        if self.start_time is None:
            return seconds_per_round
        elapsed_time = time.time() - self.start_time
        return max(0, seconds_per_round - elapsed_time)"""

@app.route("/api/index") # -- I dont know what the director should be, but this is the route for Hui Ying's tsx filex
def sendEmoji():
    rand = random.choice(emoji_list)
    return flask.jsonify({"message": rand})
#The above and below functions send out the current emoji and the time per round respectively
# to the frontend, so that the frontend can display it to the user
def sendTimeController():
    return flask.jsonify({"seconds_per_round": seconds_per_round})


@app.route("/<room_id>/state", methods=["GET"])
def get_state(room_id):
    #retrieves the game state for the given room_id (all of the frontend information)
    # and stores it in the games dictionary, which is a global variable that stores all the ongoing games per every round
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404
 
    return flask.jsonify({
        "state": game["state"],
        "round": game["round"],
        "language": game["language"],
        "emoji": game["current_emoji"],
        "players": game["players"],
        "scores": game["scores"],
        "submitted_count": len(game["submissions"]),
        "total_players": len(game["players"]),
    })

@app.route("/<room_id>/start_round", methods=["POST"])
def start_round(room_id):
    #updates the game state for the next round, and sends it to the frontend
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404

    game["current_emoji"] = random.choice(emoji_list)
    game["submissions"] = {}
    game["round"] += 1
    game["state"] = "playing"
    return flask.jsonify({"emoji": game["current_emoji"], "round": game["round"]})

@app.route("/<room_id>/submit", methods=["POST"])
def submit_keywords(room_id):
    game = games.get(room_id)
    if not game:
        return flask.jsonify({"error": "Room not found"}), 404

    data = flask.request.get_json(silent=True) or {}
    keywords = data.get("keywords")

    if not keywords or not isinstance(keywords, list):
        return flask.jsonify({"error": "keywords must be a non-empty list"}), 400

    input_stack = [kw.strip() for kw in keywords if isinstance(kw, str) and kw.strip()]
    if not input_stack:
        return flask.jsonify({"error": "No valid keywords submitted"}), 400

    try:
        uploaddatatosql(game["language"], game["current_emoji"], input_stack)
    except Exception as e:
        return flask.jsonify({"error": f"Failed to save keywords: {e}"}), 500

    return flask.jsonify({"message": "Keywords submitted"})

# -- Here be the code to calculate scores for each player, implement upon multiplayer
""" 
def scoringSystem(room_id):
    pass
    #some code to calculate the scores for each player based on the data from the games dict, create other 
    #dict which shall be stored by retrieve_input_stack() for internal score keeping

#def send_out_scores():
    pass
    #send out the jsonified files to the frontend, to display to user and create dopamine
"""
    # -- would probably be faster to delete this once uploadtodatatosql is implemented
    # -- Also, include scored for the word from scoringSystem()


class Room(db.Model):
    __tablename__ = "rooms"
    id = db.Column(db.String(4), primary_key=True)
    state = db.Column(db.String(20), default="waiting")
    round = db.Column(db.Integer, default=0)
    language = db.Column(db.String(10), default="English")
    current_emoji = db.Column(db.String(10, collation="utf8mb4_unicode_ci"))

    players = db.relationship("Player", backref="room", cascade="all, delete-orphan")
    submissions = db.relationship("Submission", backref="room", cascade="all, delete-orphan")


class Player(db.Model):
    __tablename__ = "players"
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.String(4), db.ForeignKey("rooms.id"))
    name = db.Column(db.String(50))
    score = db.Column(db.Integer, default=0)


class Submission(db.Model):
    __tablename__ = "submissions"
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.String(4), db.ForeignKey("rooms.id"))
    player_id = db.Column(db.Integer, db.ForeignKey("players.id"))
    emoji = db.Column(db.String(10, collation="utf8mb4_unicode_ci"))
    guess = db.Column(db.String(100))
    round = db.Column(db.Integer)


class AnswerCount(db.Model):
    __tablename__ = "answer_counts"
    id = db.Column(db.Integer, primary_key=True)
    language = db.Column(db.String(10))
    emoji = db.Column(db.String(10, collation="utf8mb4_unicode_ci"))
    word = db.Column(db.String(100))
    count = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.UniqueConstraint("language", "emoji", "word", name="uq_answer"),
        db.Index("idx_lang_emoji", "language", "emoji"),
    )



def uploaddatatosql(language, emoji, input_stack):
    counts = Counter(input_stack)
    for word, n in counts.items():
        row = AnswerCount.query.filter_by(
            language=language, emoji=emoji, word=word
        ).first()
        if row:
            row.count += n
        else:
            db.session.add(AnswerCount(language=language, emoji=emoji, word=word, count=n))
    db.session.commit()


if __name__ == "__main__":
    app.run(debug=True, port=8000)


# -- for post-summer: implement a flagging system for inappropriate content or something like that