# Deployment Guide

## Step-by-Step: Deploy to Production

### Option 1: Deploy to Heroku (Easiest - 5 minutes)

**Prerequisites:**
- Heroku account (free)
- Heroku CLI installed
- Git installed

**Steps:**

```bash
# 1. Login to Heroku
heroku login

# 2. Create a new app
heroku create token-scam-detector

# 3. Add the Procfile (tells Heroku how to run)
echo "web: node server.js" > Procfile

# 4. Add a .gitignore file
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore

# 5. Initialize git and push to Heroku
git init
git add .
git commit -m "Initial commit"
git push heroku main

# 6. Check logs
heroku logs --tail

# 7. Test it!
curl https://token-scam-detector.herokuapp.com/health
```

**Your API is now live!** Share the URL with agents.

---

### Option 2: Deploy to DigitalOcean (Cheapest - $5/month)

**Prerequisites:**
- DigitalOcean account
- SSH client

**Steps:**

```bash
# 1. Create a Droplet (Ubuntu 20.04, $5/month)
# - Use "Apps" > "Create App" in DigitalOcean
# - Connect your GitHub repo
# - Set run command: npm start
# - DigitalOcean will auto-deploy on every push

# OR manual deployment:

# 2. SSH into your droplet
ssh root@your_droplet_ip

# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Clone your repo
git clone https://github.com/yourusername/token-scam-detector.git
cd token-scam-detector

# 5. Install dependencies
npm install

# 6. Install PM2 (keeps your app running)
sudo npm install -g pm2

# 7. Start the app
pm2 start server.js --name "token-detector"
pm2 startup
pm2 save

# 8. Install Nginx (reverse proxy)
sudo apt-get install -y nginx

# 9. Configure Nginx
sudo nano /etc/nginx/sites-available/default
```

**Nginx config** (replace `default` file content):
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Then:**
```bash
# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Your API is live at your_droplet_ip
curl http://your_droplet_ip/health
```

---

### Option 3: Docker + Any Cloud (AWS, GCP, etc.)

**Create Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app files
COPY server.js .
COPY .env .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start
CMD ["node", "server.js"]
```

**Build and run:**
```bash
# Build
docker build -t token-scam-detector .

# Run locally first
docker run -p 3001:3001 token-scam-detector

# Test
curl http://localhost:3001/health
```

**Deploy to AWS ECS:**
```bash
# Push to ECR (Elastic Container Registry)
aws ecr create-repository --repository-name token-scam-detector
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker tag token-scam-detector YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/token-scam-detector
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/token-scam-detector

# Create ECS service (use AWS console or CLI)
# Set: 1 task, 0.5 GB memory, port 3001
```

---

### Option 4: AWS Lambda (Serverless)

**Install Serverless Framework:**
```bash
npm install -g serverless
serverless plugin install -n serverless-http
```

**serverless.yml:**
```yaml
service: token-scam-detector

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    NODE_ENV: production

functions:
  api:
    handler: handler.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
      - http:
          path: /
          method: ANY
          cors: true
```

**handler.js:**
```javascript
const serverless = require('serverless-http');
const express = require('express');
// ... import your app code ...
module.exports.handler = serverless(app);
```

**Deploy:**
```bash
serverless deploy
```

---

## Post-Deployment Checklist

- [ ] Test all endpoints work
- [ ] Set up monitoring/alerts
- [ ] Enable HTTPS/SSL certificate
- [ ] Add rate limiting
- [ ] Set up logging
- [ ] Configure CORS if needed
- [ ] Add API key authentication (optional)
- [ ] Test with real contract data
- [ ] Create monitoring dashboard
- [ ] Set up error notifications

---

## Monitoring & Logging

### Heroku Logs
```bash
heroku logs --tail
heroku logs --source app
heroku logs --source heroku
```

### DigitalOcean / PM2 Logs
```bash
pm2 logs token-detector
pm2 monit  # Real-time monitoring
```

### Add Sentry for Error Tracking
```bash
npm install @sentry/node
```

**server.js:**
```javascript
const Sentry = require("@sentry/node");

Sentry.init({ dsn: "your-sentry-dsn" });

app.use(Sentry.Handlers.errorHandler());
```

---

## Setting Up HTTPS/SSL

### Heroku (Automatic)
```bash
# Add ACM (Automated Certificate Management)
heroku certs:auto:enable
```

### DigitalOcean with Let's Encrypt
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo systemctl restart nginx
```

---

## Adding Authentication (Optional)

If you want to require API keys:

**server.js:**
```javascript
const API_KEY = process.env.API_KEY;

app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

**Usage:**
```bash
curl -H "x-api-key: your-secret-key" \
  https://your-api.com/analyze \
  -d '{...}'
```

---

## Cost Comparison

| Platform | Cost | Setup | Scalability |
|----------|------|-------|-------------|
| **Heroku** | $7+/month | 5 min | Good |
| **DigitalOcean** | $5+/month | 15 min | Good |
| **AWS Lambda** | $0.20/1M requests | 20 min | Excellent |
| **AWS EC2** | $5+/month | 20 min | Good |
| **Railway.app** | $5+/month | 5 min | Good |

**My recommendation:** Start with **Heroku** (easiest), scale to **DigitalOcean** or **AWS Lambda** as traffic grows.

---

## Next Steps

1. ✅ Deploy your API
2. ✅ Test all endpoints
3. ✅ Create Agentic Market account
4. ✅ List your API (pricing: $0.01 per check)
5. ✅ Agents discover and pay
6. ✅ Monitor your earnings in your wallet

---

## Troubleshooting

**App won't start on Heroku?**
```bash
heroku logs --tail
# Check for errors, usually missing dependencies
```

**Port already in use?**
```bash
# Change PORT in .env
lsof -i :3001
kill -9 <PID>
```

**"Cannot find module" errors?**
```bash
npm install
npm ci --omit=dev  # Production dependencies only
```

**CORS errors?**
Already enabled in server.js, but if needed:
```bash
npm install cors
# Already added in our code!
```
