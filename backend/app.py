import random
import flask
from flask import request, jsonify
from flask_sqlalchemy import SQLAlchemy
import datetime
from collections import Counter
import time
import uuid

figured_out_sql = False
app = flask.Flask(__name__) # I have not yet figured out a proper name

def load_emojis(path="emoji_list.txt"):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

SingleplayerOnlyForNow = True
emoji_list = load_emojis()
EMOJI_LIST = emoji_list


games = {}  #dict to store diffetent ongoing games, more useful for multiplayer games


def new_game(language):
    return {
        "language": language,
        "round": 0,
        "state": "waiting",
        "current_emoji": None,
        "players": [],
        "scores": {},
        "submissions": {},
    }


@app.route('/') # starting page
def start_page():
    return flask.render_template('start.html') # create html file named start 

 
@app.route("/create_room", methods=["POST"])
def create_room():
    data = request.get_json(silent=True) or {}
    language = data.get("language", "en")
    room_id = str(uuid.uuid4())[:6].upper()
    if SingleplayerOnlyForNow:
        room_id = "1"
    games[room_id] = new_game(language)
    return jsonify({"room_id": room_id})
 
    #this html page should have options to select amount of players, the language, and option to start
    #this start button will redirect to the next page using the js functions
    #this start page will than also send the number of languages and players to the backend
    #this inbetween page we shall call '/poststart' and it will 


language = ""
seconds_per_round = 0

@app.route('/poststart') # this is the page that will be redirected to after the start button is clicked
def post_start():
    return flask.render_template('poststart.html') # create html file named poststart


@app.route('/poststart/data', methods=["POST"])
def post_start_dataRetrieve():
    data = request.get_json(silent=True)
    if not data or 'language' not in data or 'seconds_per_round' not in data:
        return jsonify({'error': 'Invalid data'}), 400
    #here be the code to store that data, something along the line of:
    global language, seconds_per_round
    language = data['language']
    seconds_per_round = data['seconds_per_round']
    return jsonify({'ok': True})


@app.route("/index") #I dont know what the director should be, but this is the route for Hui Ying's tsx filex
def sendEmoji():
    return jsonify({"message": random.choice(EMOJI_LIST)})


@app.route("/timer")
def sendTimeController():
    return jsonify({"seconds_per_round": seconds_per_round})


@app.route("/<room_id>/state", methods=["GET"])
def get_state(room_id):
    game = games.get(room_id)
    if not game:
        return jsonify({"error": "Room not found"}), 404
 
    return jsonify({
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
    game = games.get(room_id)
    if not game:
        return jsonify({"error": "Room not found"}), 404

    game["current_emoji"] = random.choice(EMOJI_LIST)
    game["submissions"] = {}
    game["round"] += 1
    game["state"] = "playing"
    return jsonify({"emoji": game["current_emoji"], "round": game["round"]})

 
def scoringSystem(room_id):
    #for ... in json #read json stuff
    game = games.get(room_id)
    if not game:
        return {}
    for player in game["players"]:
        pass
    return game["scores"]

#def send_out_scores():
    


@app.route('/whatevernamewewant') #come up with better url director
def index():
    return flask.render_template('somethingfunction.html') # create html file to do this shit






def retrieve_input_stack(input_stack):
    if figured_out_sql:
        return uploaddatatosql(input_stack)
    else:
        return Counter(input_stack)



def uploaddatatosql(in_stack):
    #Here be the code to upload data to SQL database
    pass


if __name__ == "__main__":
    app.run(debug=True, port=5000)