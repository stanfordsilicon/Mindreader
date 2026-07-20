# Qmoji AWS Deployment Guide
# -- this part was entirely vibe coded

## Architecture Overview

```
Frontend (Vite/React)
  ↓
API Gateway (REST API)
  ↓
AWS Lambda (Flask via WSGI)
  ↓
AWS RDS (MySQL)
  ↓
AWS Secrets Manager (Credentials)
```

## Prerequisites

1. **AWS Account** with appropriate permissions (IAM, Lambda, RDS, Secrets Manager, API Gateway)
2. **AWS CLI** installed and configured
3. **SAM CLI** installed (`brew install aws-sam-cli` on macOS)
4. **Python 3.11+**
5. **Node.js** for frontend build

## Local Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your RDS details:
```bash
cp ../qmoji/.env.example .env
```

Run locally:
```bash
python app.py
```

Test API:
```bash
curl http://localhost:8000/api/index
```

### Frontend

```bash
cd qmoji
npm install
npm run dev
```