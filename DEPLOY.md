# Deploy Bitcoin Whale Tracker to Render

This guide will help you deploy your Bitcoin Whale Tracker from GitHub to Render for free.

## Prerequisites
- Your code is already on GitHub at: https://github.com/MadSlugg/CryptoWhaleTracker
- You need a free Neon database account
- You need a free Render account

## Step 1: Create Free PostgreSQL Database (Neon)

1. Go to **https://neon.tech** and sign up (free, no credit card required)
2. Click **"Create a project"**
   - Project name: `whale-tracker`
   - Region: Choose closest to you
   - PostgreSQL version: 16 (default)
3. Click **"Create project"**
4. On the dashboard, find **"Connection string"** section
5. Click to reveal and **copy the connection string**
   - It looks like: `postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
6. **Save this string** - you'll need it in Step 3

## Step 2: Deploy to Render

1. Go to **https://render.com** and click **"Get Started"**
2. Sign up using your **GitHub account** (recommended)
3. After signing in, click **"New +"** in the top right
4. Select **"Web Service"**
5. Click **"Connect GitHub"** and authorize Render
6. Find and select your repository: **`CryptoWhaleTracker`**
7. Click **"Connect"**

## Step 3: Configure Your Deployment

Fill in these settings:

### Basic Settings:
- **Name**: `cryptowhaletracker` (or your preferred name)
  - Your URL will be: `https://cryptowhaletracker.onrender.com`
- **Region**: Choose closest to you
- **Branch**: `main`
- **Root Directory**: Leave blank
- **Runtime**: `Node`

### Build & Start Commands:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### Environment Variables:
Click **"Advanced"** → **"Add Environment Variable"**

Add these 3 variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Paste your Neon connection string from Step 1 |
| `SESSION_SECRET` | Create a random string, e.g., `whale_tracker_secret_2024_random` |
| `NODE_ENV` | `production` |

### Instance Type:
- Select **"Free"** plan

## Step 4: Deploy!

1. Click **"Create Web Service"**
2. Render will now:
   - Clone your GitHub repository
   - Install dependencies (`npm install`)
   - Build your app (`npm run build`)
   - Start the server (`npm start`)

This takes about 3-5 minutes.

## Step 5: Initialize Database Schema

After deployment completes, you need to push your database schema:

1. In Render dashboard, find your service
2. Click on it, then click **"Shell"** tab (on the left)
3. Run this command:
   ```bash
   npm run db:push
   ```
4. Type `yes` if prompted

Your database tables will be created!

## Step 6: Access Your Live App

Your Bitcoin Whale Tracker is now live at:
- **https://[your-service-name].onrender.com**

Example: `https://cryptowhaletracker.onrender.com`

## Important Notes

### Free Tier Limitations:
- ⚠️ **App sleeps after 15 minutes** of inactivity
- First request after sleep takes ~30 seconds to wake up
- After waking, it runs normally

### Auto-Deployments:
- ✅ Every time you push to GitHub, Render automatically redeploys
- You can disable this in Settings → Build & Deploy

### Upgrading:
If you need 24/7 uptime with no sleep:
- Upgrade to Render **Starter plan**: $7/month
- Or use a ping service to keep it awake (not recommended)

## Troubleshooting

### Build Failed?
Check the logs in Render dashboard → Logs tab

### Database Connection Issues?
1. Verify your `DATABASE_URL` is correct
2. Make sure you ran `npm run db:push` in the Render shell

### App Not Working?
1. Check logs for errors
2. Ensure all environment variables are set correctly
3. Verify your GitHub repo has the latest code

## Support

Need help? Check:
- Render docs: https://render.com/docs
- Neon docs: https://neon.tech/docs
- Your app logs in Render dashboard

---

**That's it! Your Bitcoin Whale Tracker is now live and free to use!** 🚀
