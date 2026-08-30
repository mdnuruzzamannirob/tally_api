# Tally API Backend - Complete Production Deployment Guide

Comprehensive guide for deploying and managing the Tally API backend in production environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Detailed Deployment Steps](#detailed-deployment-steps)
4. [Configuration Management](#configuration-management)
5. [Database Setup](#database-setup)
6. [Reverse Proxy Setup (Nginx)](#reverse-proxy-setup-nginx)
7. [SSL/TLS Certificates](#ssltls-certificates)
8. [Monitoring & Logging](#monitoring--logging)
9. [Scaling & Performance](#scaling--performance)
10. [Troubleshooting](#troubleshooting)
11. [Security Best Practices](#security-best-practices)
12. [Disaster Recovery](#disaster-recovery)

## Quick Start

### 30-Second Setup

```bash
# 1. Clone and navigate
cd /path/to/tally/tally_api

# 2. Verify production readiness
./scripts/check-production-ready.sh

# 3. Configure environment
cp .env.production.example .env.production
# Edit with your production values
nano .env.production

# 4. Deploy everything
./scripts/deploy.sh deploy

# 5. Verify deployment
curl https://api.yourdomain.com/api/v1/health
```

## Pre-Deployment Checklist

Run the production readiness checker:

```bash
./scripts/check-production-ready.sh
```

This verifies:

- ✅ Required tools (Node.js v20+, Docker, Docker Compose)
- ✅ Project files (Dockerfile, docker-compose.deploy.yml)
- ✅ Environment configuration (.env.production)
- ✅ Code quality (TypeScript, linting, tests)
- ✅ Security settings (COOKIE_SECURE=true, HTTPS URLs)
- ✅ Database configuration
- ✅ Email provider setup
- ✅ OAuth credentials

## Detailed Deployment Steps

### Step 1: Environment Setup

#### Create .env.production

```bash
cp .env.production.example .env.production
nano .env.production
```

Required configuration:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# API URLs (must be HTTPS)
API_BASE_URL=https://api.yourdomain.com
WEB_APP_URL=https://yourdomain.com

# Secrets (generate with: openssl rand -base64 32)
ACCESS_TOKEN_SECRET=your-secure-32-byte-secret

# OAuth
GOOGLE_CLIENT_ID=from-google-cloud-console
GOOGLE_CLIENT_SECRET=from-google-cloud-console
GITHUB_CLIENT_ID=from-github-settings
GITHUB_CLIENT_SECRET=from-github-settings

# Email (choose one provider)
EMAIL_PROVIDER=mailgun
EMAIL_API_KEY=your-mailgun-api-key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_MAILGUN_DOMAIN=yourdomain.com

# Security
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
LOG_LEVEL=info
```

### Step 2: Build Docker Image

```bash
# Load environment
export $(cat .env.production | xargs)

# Build image
docker build \
  --target runtime \
  -t tally-api:latest \
  -t tally-api:$(date +%Y%m%d-%H%M%S) \
  --build-arg PRISMA_GENERATE_DATABASE_URL="$DATABASE_URL" \
  .

# Verify image
docker images | grep tally-api
```

### Step 3: Database Setup

#### Option A: Using Docker Compose (Automatic)

```bash
# Run migrations
docker-compose -f docker-compose.deploy.yml \
  --profile migration run --rm migrate

# Seed database (optional)
docker-compose -f docker-compose.deploy.yml \
  run --rm api pnpm db:seed
```

#### Option B: Using Docker Run (Manual)

```bash
docker run --rm \
  --env-file .env.production \
  -e PRISMA_GENERATE_DATABASE_URL="$DATABASE_URL" \
  tally-api:latest \
  pnpm db:deploy
```

#### Verify Migrations

```bash
# Check migration status
docker run --rm \
  --env-file .env.production \
  tally-api:latest \
  pnpm prisma migrate status

# View migration history
docker run --rm \
  --env-file .env.production \
  tally-api:latest \
  pnpm prisma migrate list
```

### Step 4: Start Services

```bash
# Start API service
docker-compose -f docker-compose.deploy.yml up -d

# Monitor startup
docker-compose -f docker-compose.deploy.yml logs -f api

# Wait for healthy status
docker-compose -f docker-compose.deploy.yml ps
```

### Step 5: Verify Deployment

```bash
# Check container status
docker-compose -f docker-compose.deploy.yml ps

# Test health endpoint
curl http://localhost:5000/api/v1/health

# Test API responses
curl http://localhost:5000/api/v1/openapi.json | head -20

# View application logs
docker-compose -f docker-compose.deploy.yml logs -f api
```

## Configuration Management

### Environment Variables

Key variables by category:

**Database**

```env
DATABASE_URL=postgresql://user:pass@host/db
MIGRATION_DATABASE_URL=postgresql://user:pass@host/db
```

**Authentication**

```env
ACCESS_TOKEN_SECRET=min-32-bytes
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

**API URLs**

```env
API_BASE_URL=https://api.yourdomain.com
WEB_APP_URL=https://yourdomain.com
```

**Email**

```env
EMAIL_PROVIDER=mailgun
EMAIL_API_KEY=key
EMAIL_FROM=noreply@yourdomain.com
```

**OAuth**

```env
GOOGLE_CLIENT_ID=client-id
GOOGLE_CLIENT_SECRET=secret
GITHUB_CLIENT_ID=client-id
GITHUB_CLIENT_SECRET=secret
```

**Security**

```env
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
NODE_ENV=production
LOG_LEVEL=info
```

### Secrets Management

For production, use secret management services:

**AWS Secrets Manager**

```bash
# Store secrets
aws secretsmanager create-secret --name tally-api-prod \
  --secret-string file://.env.production

# Retrieve in deployment
aws secretsmanager get-secret-value --secret-id tally-api-prod \
  | jq -r '.SecretString' > .env.production
```

**HashiCorp Vault**

```bash
# Store secrets
vault kv put secret/tally-api-prod @.env.production

# Retrieve in deployment
vault kv get -field=data secret/tally-api-prod > .env.production
```

## Database Setup

### Managed Database Services

#### AWS RDS for PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier tally-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username tally \
  --master-user-password 'strong-password' \
  --allocated-storage 100 \
  --storage-type gp3 \
  --enable-automated-backups \
  --backup-retention-period 30 \
  --multi-az

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier tally-prod \
  | jq '.DBInstances[0].Endpoint.Address'
```

#### Azure Database for PostgreSQL

```bash
# Create Azure Database
az postgres server create \
  --resource-group myResourceGroup \
  --name tally-prod \
  --location eastus \
  --admin-user tally \
  --admin-password 'strong-password' \
  --sku-name B_Gen5_1 \
  --storage-size 51200

# Get connection string
az postgres server show \
  --resource-group myResourceGroup \
  --name tally-prod \
  | jq '.fullyQualifiedDomainName'
```

#### DigitalOcean Managed Database

```bash
# Create database cluster
doctl databases create \
  --engine pg \
  --version 16 \
  --region nyc3 \
  --num-nodes 1 \
  tally-prod

# Get connection details
doctl databases connection tally-prod
```

### Backup & Recovery

#### Automated Backups

```bash
# Enable automatic backups in RDS
aws rds modify-db-instance \
  --db-instance-identifier tally-prod \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00"

# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier tally-prod \
  --db-snapshot-identifier tally-prod-backup-$(date +%s)
```

#### Restore from Backup

```bash
# Restore from automated backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier tally-prod-restored \
  --db-snapshot-identifier tally-prod-backup-latest

# Restore to point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier tally-prod \
  --target-db-instance-identifier tally-prod-restored \
  --restore-time 2024-01-15T10:00:00Z
```

### Connection Pooling

For high-traffic deployments, use PgBouncer:

```bash
# Install PgBouncer
apt-get install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
tally = host=your-db-host port=5432 dbname=tally_production

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 10

# Start service
systemctl restart pgbouncer

# Connect via PgBouncer
DATABASE_URL=postgresql://tally:pass@localhost:6432/tally
```

## Reverse Proxy Setup (Nginx)

### Basic Configuration

Create `/etc/nginx/sites-available/tally-api`:

```nginx
upstream tally_api {
    least_conn;
    server 127.0.0.1:5000;
    # Add more backend servers for load balancing
    # server 127.0.0.1:5001;
    # server 127.0.0.1:5002;
    keepalive 32;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/api.yourdomain.com/chain.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;

    # Logging
    access_log /var/log/nginx/tally-api-access.log;
    error_log /var/log/nginx/tally-api-error.log;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # Proxy Configuration
    location / {
        proxy_pass http://tally_api;
        proxy_http_version 1.1;

        # Upgrade websockets
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Pass original request info
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Health check endpoint
    location ~ ^/api/v1/health$ {
        access_log off;
        proxy_pass http://tally_api;
    }
}
```

### Enable Configuration

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tally-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Monitor
sudo systemctl status nginx
```

## SSL/TLS Certificates

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
apt-get update && apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --nginx -d api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Using Self-Signed Certificate (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout /etc/letsencrypt/live/api.yourdomain.com/privkey.pem \
  -out /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem \
  -days 365

# This should ONLY be used for testing!
```

## Monitoring & Logging

### Container Health Checks

The Docker setup includes built-in health checks:

```bash
# Check health status
docker-compose -f docker-compose.deploy.yml ps

# Custom health check
curl -s http://localhost:5000/api/v1/health | jq .
```

### Centralized Logging

#### Using ELK Stack

```bash
# Install ELK
docker-compose -f docker-compose.deploy.yml -f docker-compose.elk.yml up -d

# Configure log forwarding
# See docker-compose.deploy.yml for logging configuration
```

#### Using Cloud Logging

**AWS CloudWatch**

```bash
# Enable container logging to CloudWatch
# In docker-compose.deploy.yml:
logging:
  driver: awslogs
  options:
    awslogs-group: /ecs/tally-api
    awslogs-region: us-east-1
    awslogs-stream-prefix: ecs
```

**Google Cloud Logging**

```bash
# Configure in docker-compose.deploy.yml
logging:
  driver: gcplogs
  options:
    gcp-project: your-gcp-project
    gcp-log-name: tally-api
```

### Performance Monitoring

#### Check Resource Usage

```bash
# Monitor container resources
docker stats tally_api

# Monitor system resources
top
htop
```

#### Database Performance

```bash
# Check active connections
docker-compose -f docker-compose.deploy.yml run --rm api \
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker-compose -f docker-compose.deploy.yml run --rm api \
  psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Scaling & Performance

### Horizontal Scaling

```bash
# Update docker-compose.deploy.yml to run multiple instances
docker-compose -f docker-compose.deploy.yml up -d --scale api=3

# Verify
docker-compose -f docker-compose.deploy.yml ps
```

### Performance Tuning

#### PostgreSQL Configuration

```sql
-- Optimize for production
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Reload configuration
SELECT pg_reload_conf();
```

#### Nginx Optimization

```nginx
# In nginx.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
keepalive_requests 100;
```

## Troubleshooting

### Container Issues

**Container won't start**

```bash
# Check logs
docker-compose -f docker-compose.deploy.yml logs api

# Common solutions:
# 1. Check environment variables
docker-compose -f docker-compose.deploy.yml run --rm api env

# 2. Check database connectivity
docker-compose -f docker-compose.deploy.yml run --rm api \
  psql $DATABASE_URL -c "SELECT 1"

# 3. Check port availability
sudo lsof -i :5000
```

**Health check failing**

```bash
# Test health endpoint directly
docker exec -it tally_api curl http://localhost:5000/api/v1/health

# Check error logs
docker-compose -f docker-compose.deploy.yml logs api --tail 100
```

### Database Issues

**Connection errors**

```bash
# Verify DATABASE_URL
grep DATABASE_URL .env.production

# Test connection
docker-compose -f docker-compose.deploy.yml run --rm api \
  psql $DATABASE_URL -c "SELECT version();"

# Check network connectivity
docker run --rm curlimages/curl \
  curl -v your-db-host:5432
```

**Migration failures**

```bash
# Check migration status
docker-compose -f docker-compose.deploy.yml run --rm api \
  pnpm prisma migrate status

# View pending migrations
ls -la prisma/migrations/

# Resolve migration conflicts
docker-compose -f docker-compose.deploy.yml run --rm api \
  pnpm prisma migrate resolve --rolled-back 20260809120000_initial
```

### Performance Issues

**Slow queries**

```bash
# Enable query logging
docker-compose -f docker-compose.deploy.yml run --rm api \
  psql $DATABASE_URL -c "SET log_min_duration_statement = 1000;"

# Analyze query performance
docker-compose -f docker-compose.deploy.yml run --rm api \
  psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT ..."
```

**High memory usage**

```bash
# Check container memory
docker stats tally_api

# Limit memory in docker-compose.deploy.yml
# deploy:
#   resources:
#     limits:
#       memory: 1G
#     reservations:
#       memory: 512M
```

## Security Best Practices

### Network Security

```bash
# Use VPC/private networks
# - AWS: Place RDS in private subnet
# - Azure: Configure firewall rules
# - DigitalOcean: Use VPC networking

# Restrict database access
# Only allow API servers to connect to database
```

### Secrets Management

```bash
# Never commit .env.production
echo ".env.production" >> .gitignore

# Use secrets management:
# - AWS Secrets Manager
# - Azure Key Vault
# - HashiCorp Vault
# - Kubernetes Secrets

# Rotate secrets regularly
# - Change ACCESS_TOKEN_SECRET quarterly
# - Update OAuth credentials annually
# - Refresh database passwords semi-annually
```

### Access Control

```bash
# Limit Nginx access
location /api/v1/admin {
    allow 203.0.113.0/24;  # Your IP range
    deny all;
}

# Use authentication
# - Bearer tokens for API access
# - OAuth for user sign-in
```

### Auditing

```bash
# Enable PostgreSQL audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;
ALTER SYSTEM SET pgaudit.log = 'ALL';

# Monitor access logs
tail -f /var/log/nginx/tally-api-access.log
```

## Disaster Recovery

### Backup Strategy

```bash
# Daily automated backups (configured in RDS)
# Weekly manual snapshots
aws rds create-db-snapshot \
  --db-instance-identifier tally-prod \
  --db-snapshot-identifier tally-prod-weekly-$(date +%Y%m%d)

# Test restore monthly
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier tally-prod-restore-test \
  --db-snapshot-identifier tally-prod-weekly-latest
```

### Failover Plan

```bash
# Multi-AZ deployment for RDS
aws rds modify-db-instance \
  --db-instance-identifier tally-prod \
  --multi-az

# Database failover (automatic in Multi-AZ)
# Recovery time: < 2 minutes

# Application failover:
# 1. Terminate unhealthy container
# 2. Docker Compose restarts it automatically
# 3. Health checks verify recovery
```

### Recovery Testing

```bash
# Monthly: Test database restore
./scripts/test-restore.sh

# Quarterly: Full application recovery test
./scripts/full-disaster-recovery-test.sh

# Document: RTO (Recovery Time Objective) = 15 minutes
#           RPO (Recovery Point Objective) = 1 hour
```

## Deployment Checklist

Production deployment should verify:

- [ ] Pre-deployment check passes: `./scripts/check-production-ready.sh`
- [ ] .env.production configured with all required values
- [ ] Database backed up before deployment
- [ ] Container image builds successfully
- [ ] Database migrations run without errors
- [ ] Health check passes: `curl https://api.yourdomain.com/api/v1/health`
- [ ] API endpoints respond correctly
- [ ] SSL/TLS certificate valid and auto-renewal configured
- [ ] Monitoring and alerts configured
- [ ] Nginx reverse proxy verified
- [ ] Logs centralized and accessible
- [ ] Backup and recovery procedures tested
- [ ] Team notified of deployment

## Support & References

- API Documentation: [docs/backend-spec.md](../docs/backend-spec.md)
- OpenAPI Schema: [contracts/openapi.json](../contracts/openapi.json)
- Database Schema: [docs/database-spec.md](../docs/database-spec.md)
- Deployment Scripts: [scripts/deploy.sh](../scripts/deploy.sh)
- Production Check: [scripts/check-production-ready.sh](../scripts/check-production-ready.sh)

---

**Last Updated**: 2026-08-30
**Version**: 2.0.0
**Audience**: DevOps Engineers, System Administrators
