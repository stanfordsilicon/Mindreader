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

Open http://localhost:5173 in browser.

## AWS Deployment (SAM)

### Step 1: Build Layer with Dependencies

```bash
cd backend

# Create layer directory structure
mkdir -p python_layer/python/lib/python3.11/site-packages

# Install dependencies into layer
pip install -r requirements.txt -t python_layer/python/lib/python3.11/site-packages/
```

### Step 2: Deploy with SAM

```bash
sam build

sam deploy --guided \
  --parameter-overrides \
  Environment=dev \
  RDSEndpoint=your-rds-endpoint.rds.amazonaws.com \
  RDSPort=3306 \
  RDSDatabase=gamedb \
  RDSUsername=admin \
  RDSPassword=Yz781016
```

### Step 3: Configure API CORS (if needed)

```bash
# After deployment, update API Gateway CORS settings:
aws apigateway put-method-response \
  --rest-api-id <API_ID> \
  --resource-id <RESOURCE_ID> \
  --http-method GET \
  --status-code 200 \
  --response-models "application/json"=Empty
```

### Step 4: Deploy Frontend to S3 + CloudFront

```bash
cd qmoji

# Build frontend
npm run build

# Create S3 bucket for frontend
aws s3 mb s3://qmoji-frontend-$(date +%s)

# Upload build to S3
aws s3 sync dist/ s3://qmoji-frontend-xxx/ --acl public-read

# Note: Configure CloudFront distribution for HTTPS/CDN (manual setup recommended)
```

## Environment Variables

Set these in Lambda function or Secrets Manager:

| Variable | Value |
|----------|-------|
| `DB_SECRET_NAME` | `qmoji/rds` (default) |
| `AWS_REGION` | `us-east-1` |
| `FLASK_ENV` | `dev` / `staging` / `prod` |

## Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/qmoji-backend-dev --follow
```

### Secrets Manager

```bash
# Rotate RDS password
aws secretsmanager rotate-secret --secret-id qmoji/rds

# Update secret manually
aws secretsmanager update-secret --secret-id qmoji/rds \
  --secret-string '{"username":"admin","password":"NewPassword","host":"...","port":3306,"dbname":"gamedb"}'
```

## Cost Optimization

- **Lambda**: Free tier covers 1M requests/month
- **RDS**: Use `db.t3.micro` for development (free tier eligible)
- **API Gateway**: $3.50 per million requests
- **Data Transfer**: Minimize between services in same region

## Cleanup

```bash
# Delete CloudFormation stack (removes Lambda, API Gateway, etc.)
aws cloudformation delete-stack --stack-name sam-app

# Delete S3 bucket (frontend)
aws s3 rb s3://qmoji-frontend-xxx --force

# Delete RDS instance (optional)
aws rds delete-db-instance --db-instance-identifier qmoji --skip-final-snapshot
```

## Troubleshooting

### Lambda can't connect to RDS

- Check security group: RDS SG must allow inbound 3306 from Lambda
- Verify RDS is in same VPC as Lambda
- Test credentials in Secrets Manager

### API Gateway 403 Forbidden

- Check CORS headers in Lambda response
- Verify IAM role has API Gateway permissions

### Build fails with boto3 import error

- Ensure `requirements.txt` is in `backend/` directory
- Run SAM build again: `sam build --use-container`

## Next Steps

1. **CI/CD Pipeline**: Set up GitHub Actions to auto-deploy on push
2. **Monitoring**: Configure CloudWatch alarms for Lambda errors
3. **Database Backups**: Enable RDS automated backups (7+ days retention)
4. **Custom Domain**: Map API Gateway to Route 53 custom domain
5. **WAF**: Add AWS WAF rules to API Gateway for security
