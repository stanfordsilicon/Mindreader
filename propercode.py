import random
import flask
from flask_sqlalchemy import SQLAlchemy
import datetime

def load_emojis(path="emoji_list.txt"):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


emoji_list = load_emojis()

def random_emoji():
    return random.choice(emoji_list)







random_emoji = random_emoji()
