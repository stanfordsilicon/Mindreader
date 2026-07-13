"""
WSGI entry point for AWS Lambda.
This file allows Flask app to run on AWS Lambda via API Gateway.
"""
from app import app

# For AWS Lambda
application = app

if __name__ == "__main__":
    app.run(debug=True, port=8000)
