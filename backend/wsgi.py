"""
WSGI entry point for AWS Lambda.
This file allows Flask app to run on AWS Lambda via API Gateway.
"""
from app import app

# For AWS Lambda
application = app

if __name__ == "__main__":
    app.run(debug=True, port=8000)




"""
-- Use the following command to see what is in the backend storage

cd backend
../.venv/bin/python - <<'PY'
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(dotenv_path=Path('.env'))
engine = create_engine(os.environ['DATABASE_URL'])
with engine.connect() as conn:
    print(conn.execute(text("SELECT * FROM answer_counts LIMIT 10")).fetchall())
PY

"""
