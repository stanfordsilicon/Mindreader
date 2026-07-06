import random
import flask
from flask_sqlalchemy import SQLAlchemy
from collections import Counter
import time
import uuid

SinglePlayerOnlyForNow = True #Switch for later, for now, we will only allow single player games, but later we will allow multiplayer games
#Thus, until we have implemented multiplayer, the room_id can be hardcoded to "1" for now, which will cause a lot less confusion for now
figured_out_sql = False #'switch for later (retrieve_input_stack), for now, we will just store the data in a dictionary, but later we will store it in a SQL database
language = ""
seconds_per_round = 0

app = flask.Flask(__name__) # -- I have not yet figured out a proper name
#-------#

def load_emojis(path="emoji_list.txt"):
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
    return flask.jsonify({"room_id": room_id})


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

def retrieve_input_stack(room_id, input_stack, current_emoji=None):
    #for now, stores the amount of guesses per keyword and keywords in a dict
    # -- would probably be faster to delete this once uploadtodatatosql is implemented
    # -- Also, include scored for the word from scoringSystem()
    if figured_out_sql:
        return uploaddatatosql(input_stack)
    
    game = games.get(room_id)
    if not game:
        return None

    if not current_emoji:
        current_emoji = game["current_emoji"]

    counts = Counter(input_stack)

    existing = game["answer_counts"].get(current_emoji)
    if existing is None:
        game["answer_counts"][current_emoji] = counts
    else:
        existing.update(counts)

    return game["answer_counts"][current_emoji]


def uploaddatatosql(in_stack):
    #Here be the code to upload data to SQL database
    pass



if __name__ == "__main__":
    app.run(debug=True, port=8000)