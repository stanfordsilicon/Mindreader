import random
import flask
from flask_sqlalchemy import SQLAlchemy
import datetime
from collections import Counter
import time

figured_out_sql = False
app = Flask(__name__) # I have not yet figured out a proper name

def load_emojis(path="emoji_list.txt"):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


emoji_list = load_emojis()

def random_emoji():
    return random.choice(emoji_list)

random_emoji = random_emoji()

@app.route('/') # starting page
def start_page():
    return flask.render_template('start.html') # create html file named start 
    #this html page should have options to select amount of players, the language, and option to start
    #this start button will redirect to the next page using the js functions
    #this start page will than also send the number of languages and players to the backend
    #this inbetween page we shall call '/poststart' and it will 


language = ""
player_count = 0

@app.route('/poststart') # this is the page that will be redirected to after the start button is clicked
def post_start():
    #some fancy flask code to retrieve the number of players and the language from the start page

    return flask.render_template('poststart.html') # create html file named poststart
def post_start_data-retrieve():
    data = flask.request.get_json(silent=True)
    if not data or 'language' not in data or 'player_count' not in data:
        return flask.jsonify({'error': 'Invalid data'}), 400



#some more fancy flask code under construction to tell front end to display the random emoji

#even more fancy flask code to tell front end to initiate processes and start the game round

#some fancy flask code be here to retrieve the data in a stack of input strings, which I have named 
#input_stack for now

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

