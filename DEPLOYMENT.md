# Tally API Backend Deployment Guide

Quick-start guide for deploying the Tally API backend to production.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (AWS RDS, Azure, DigitalOcean, or self-hosted)
- SSL/TLS certificate (for HTTPS)
- OAuth credentials (Google & GitHub)
- Email provider account (Mailgun, SendGrid, or SMTP)

## 30-Second Setup

```bash
# 1. Clone and navigate
cd tally_api

# 2. Configure environment
cp .env.production.example .env.production
# Edit .env.production with your production values

# 3. Build Docker image
docker build -t tally-api:latest \
  --build-arg PRISMA_GENERATE_DATABASE_URL="$DATABASE_URL" .

# 4. Run with Docker Compose
docker-compose -f docker-compose.deploy.yml up -d

# 5. Run migrations
docker-compose -f docker-compose.deploy.yml \
  --profile migration run migrate

# 6. Verify health
curl http://localhost:5000/api/v1/health
```

## Full Deployment Steps

### 1. Pre-Deployment Checklist

```bash
# Run verification script
./scripts/check-production-ready.sh
```

Verify:
- ✅ Node.js v20+ installed
- ✅ Docker & Docker Compose available
- ✅ PostgreSQL database ready
- ✅ Environment variables configured
- ✅ SSL certificates ready
- ✅ OAuth credentials configured

### 2. Configure Production Environment

```bash
# Copy example to production file
cp .env.example .env.production

# Edit with your production values
nano .env.production
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `API_BASE_URL` - Your API domain (e.g., https://api.yourdomain.com)
- `WEB_APP_URL` - Your frontend domain (e.g., https://yourdomain.com)
- `ACCESS_TOKEN_SECRET` - Generate with: `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`
- Email provider configuration (Mailgun/SMTP)

### 3. Build Docker Image

```bash
# Build for production
docker build \
  --target runtime \
  -t tally-api:latest \
  --build-arg PRISMA_GENERATE_DATABASE_URL="$DATABASE_URL" \
  .

# (Optional) Push to container registry
docker tag tally-api:latest your-registry/tally-api:latest
docker push your-registry/tally-api:latest
```

### 4. Run Database Migrations

```bash
# Option A: Using Docker Compose (automatic)
docker-compose -f docker-compose.deploy.yml \
  --profile migration run --rm migrate

# Option B: Manual with built image
docker run --rm \
  --env-file .env.production \
  -e PRISMA_GENERATE_DATABASE_URL="$DATABASE_URL" \
  tally-api:latest \
  pnpm db:deploy
```

### 5. Start the API Service

```bash
# Using Docker Compose
docker-compose -f docker-compose.deploy.yml up -d

# Or manually
docker run -d \
  --name tally-api \
  --env-file .env.production \
  -p 5000:5000 \
  tally-api:latest
```

### 6. Verify Deployment

```bash
# Check container status
docker-compose -f docker-compose.deploy.yml ps

# Check health endpoint
curl http://localhost:5000/api/v1/health

# View logs
docker-compose -f docker-compose.deploy.yml logs -f api

# Test API endpoints
curl -X GET http://localhost:5000/api/v1/health
curl -X GET http://localhost:5000/api/v1/openapi.json
```

## Nginx Configuration (Reverse Proxy)

Create `/etc/nginx/sites-available/tally-api`:

```nginx
upstream tally_api {
    server localhost:5000;
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

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://tally_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/tally-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Docker Compose Deployment Reference

### Start Services
```bash
# Start all services
docker-compose -f docker-compose.deploy.yml up -d

# Start with build
docker-compose -f docker-compose.deploy.yml up -d --build

# View logs
docker-compose -f docker-compose.deploy.yml logs -f
```

### Database Migrations
```bash
# Run migrations
docker-compose -f docker-compose.deploy.yml \
  --profile migration run --rm migrate

# Seed database
docker-compose -f docker-compose.deploy.yml \
  run --rm api pnpm db:seed
```

### Stop & Cleanup
```bash
# Stop services
docker-compose -f docker-compose.deploy.yml down

# Remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.deploy.yml down -v
```

## Production Best Practices

### Security
- ✅ Use HTTPS everywhere with valid SSL certificates
- ✅ Set `COOKIE_SECURE=true` in production
- ✅ Use strong, randomly-generated secrets (32+ bytes)
- ✅ Enable rate limiting on all endpoints
- ✅ Use CORS to restrict cross-origin requests
- ✅ Keep dependencies updated: `pnpm update`
- ✅ Use secrets management (AWS Secrets Manager, Vault)

### Performance
- ✅ Enable gzip compression in Nginx
- ✅ Set up CDN for static assets
- ✅ Use read replicas for database if needed
- ✅ Enable query caching at database level
- ✅ Monitor API response times

### Monitoring & Logging
- ✅ Set `LOG_LEVEL=info` for production (not debug)
- ✅ Centralize logs (ELK, Datadog, CloudWatch)
- ✅ Set up alerts for errors and downtime
- ✅ Monitor database connections and performance
- ✅ Track API usage and rate limiting

### Database
- ✅ Use managed PostgreSQL (AWS RDS recommended)
- ✅ Enable automated backups (daily minimum)
- ✅ Test restore procedures regularly
- ✅ Monitor connection pool settings
- ✅ Enable SSL for database connections

### Deployment
- ✅ Use CI/CD pipeline (GitHub Actions configured)
- ✅ Test all changes in staging first
- ✅ Keep deployment scripts version-controlled
- ✅ Document rollback procedures
- ✅ Plan for zero-downtime deployments

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose -f docker-compose.deploy.yml logs api

# Common issues:
# - Database unreachable: Check DATABASE_URL and network
# - Port already in use: Change port in docker-compose.deploy.yml
# - Permission denied: Run as sudo or fix file permissions
```

### Database migration fails
```bash
# Check database connectivity
docker-compose -f docker-compose.deploy.yml run \
  --rm api psql $DATABASE_URL -c "SELECT 1"

# View migration status
docker-compose -f docker-compose.deploy.yml run \
  --rm api pnpm prisma migrate status

# Review pending migrations
ls -la prisma/migrations/
```

### Health check fails
```bash
# Check API is responding
curl -v http://localhost:5000/api/v1/health

# Check logs for errors
docker-compose -f docker-compose.deploy.yml logs api

# Verify environment variables
docker-compose -f docker-compose.deploy.yml run \
  --rm api env | grep "^(NODE_|DATABASE_|PORT)"
```

### High memory usage
```bash
# Check container memory
docker stats tally_api

# Limit memory in docker-compose.deploy.yml
# services:
#   api:
#     deploy:
#       resources:
#         limits:
#           memory: 1G
```

## Scaling

### Horizontal Scaling (Multiple Instances)
```yaml
# In docker-compose.deploy.yml
services:
  api:
    deploy:
      replicas: 3
    environment:
      - INSTANCE_ID=${INSTANCE_ID}
```

### Load Balancing
Use Nginx upstream or container orchestration (Kubernetes) for load balancing.

### Database Connection Pooling
Prisma automatically manages connections. Monitor with:
```bash
docker-compose -f docker-compose.deploy.yml run \
  --rm api pnpm inspect
```

## Production Checklist

- [ ] Environment variables configured (.env.production)
- [ ] Database backups scheduled and tested
- [ ] SSL/TLS certificates installed and auto-renewal configured
- [ ] OAuth credentials registered with providers
- [ ] Email provider account active and configured
- [ ] Rate limiting configured
- [ ] Logging centralized
- [ ] Monitoring and alerts set up
- [ ] Backup and disaster recovery plan documented
- [ ] Health checks verified
- [ ] Security headers configured in Nginx
- [ ] CORS properly configured
- [ ] Database migrations run successfully
- [ ] Smoke tests passed
- [ ] CI/CD pipeline configured

## Support & Resources

- API Documentation: See `docs/backend-spec.md`
- OpenAPI Schema: `contracts/openapi.json`
- Database Schema: `docs/database-spec.md`
- GitHub Issues: Report problems in project repository
- Deployment Issues: Check logs and refer to Troubleshooting section

---

**Last Updated**: 2026-08-30
**Version**: 1.0.0
