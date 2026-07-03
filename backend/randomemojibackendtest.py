




import random
import flask
from flask_sqlalchemy import SQLAlchemy
import datetime
from collections import Counter
import time
import jsonify

figured_out_sql = False
app = Flask(__name__) # I have not yet figured out a proper name

def load_emojis(path="emoji_list.txt"):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


emoji_list = load_emojis()

def random_emoji():
    return random.choice(emoji_list)


app = Flask(__name__)

@app.route("insert route here") #I dont know what the director should be, but this is the route for Hui Ying's tsx filex
random_emoji = random_emoji()
def main():
    return flask.jsonify({"message": random_emoji})