import random
import flask
from flask_sqlalchemy import SQLAlchemy
import datetime
from collections import Counter

figured_out_sql = False

def load_emojis(path="emoji_list.txt"):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


emoji_list = load_emojis()

def random_emoji():
    return random.choice(emoji_list)

random_emoji = random_emoji()


#some more fancy flask code under construction to tell front end to display the random emoji

#even more fancy flask code to tell front end to initiate processes and start the game round

#some fancy flask code be here to retrieve the data in a stack of input strings, which I have named 
#input_stack for now
def retrieve_input_stack():
    if figured_out_sql:
        return uploaddatatosql(input_stack)
    else:
        return Counter(input_stack)



def uploaddatatosql(in_stack):
    #Here be the code to upload data to SQL database

