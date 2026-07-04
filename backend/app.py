import random
import flask
from flask_sqlalchemy import SQLAlchemy
import datetime
from collections import Counter
import time
import uuid

figured_out_sql = False
app = Flask(__name__) # I have not yet figured out a proper name

def load_emojis(path="emoji_list.txt"):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


emoji_list = load_emojis()


games = {}  #dict to store diffetent ongoing games, more useful for multiplayer games

class StartRequest(BaseModel):
    players: int
    language: str

@app.route('/') # starting page
def start_page():
    return flask.render_template('start.html') # create html file named start 

 
@app.route("/create_room", methods=["POST"])
def create_room():
    data = request.get_json(silent=True) or {}
    language = data.get("language", "en")
    room_id = str(uuid.uuid4())[:6].upper()
    games[room_id] = new_game(language)
    return flask.jsonify({"room_id": room_id})
 
    #this html page should have options to select amount of players, the language, and option to start
    #this start button will redirect to the next page using the js functions
    #this start page will than also send the number of languages and players to the backend
    #this inbetween page we shall call '/poststart' and it will 


language = ""
seconds_per_round = 0

@app.route('/poststart') # this is the page that will be redirected to after the start button is clicked
def post_start():
    #some fancy flask code to retrieve the number of players and the language from the start page

    return flask.render_template('poststart.html') # create html file named poststart
def post_start_dataRetrieve():
    data = flask.request.get_json(silent=True)
    if not data or 'language' not in data or 'seconds_per_round' not in data:
        return flask.jsonify({'error': 'Invalid data'}), 400
    #here be the code to store that data, something along the line of:
    global language, seconds_per_round
    language = data['language']
    seconds_per_round = data['seconds_per_round']



@app.route("/index") #I dont know what the director should be, but this is the route for Hui Ying's tsx filex
random_emoji = random_emoji()
def sendEmoji():
    return flask.jsonify({"message": random_emoji})
def sendTimeController():
    return flask.jsonify({"seconds_per_round": seconds_per_round})


@app.route("/<room_id>/state", methods=["GET"])
def get_state(room_id):
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
    game = games.get(room_id)
    if not game:
        return jsonify({"error": "Room not found"}), 404

    game["current_emoji"] = random.choice(EMOJI_LIST)
    game["submissions"] = {}
    game["round"] += 1
    game["state"] = "playing"
    return jsonify({"emoji": game["current_emoji"], "round": game["round"]})

 
def scoringSystem(room_id):
    for ... in json #read json stuff
    for i in range(player_count):
        #some code to calculate the scores for each player based on the informationfromjsonfile
        #and store it in a dictionary or list

def send_out_scores():
    




@app.route('/whatevernamewewant') #come up with better url director
def index():
    return flask.render_template('somethingfunction.html') # create html file to do this shit






def retrieve_input_stack():
    if figured_out_sql:
        return uploaddatatosql(input_stack)
    else:
        return Counter(input_stack)



def uploaddatatosql(in_stack):
    #Here be the code to upload data to SQL database

