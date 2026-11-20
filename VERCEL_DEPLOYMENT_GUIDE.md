# Vercel Deployment Guide

## Prerequisites
1. Vercel account (free at vercel.com)
2. Your Railway backend URL (e.g., `https://your-server.up.railway.app`)

## Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

## Step 2: Deploy Admin Dashboard

```bash
cd admin-dashboard

# Deploy to Vercel
vercel

# When prompted:
# - Set up and deploy? Y
# - Which scope? (select your account)
# - Link to existing project? N
# - What's your project's name? brainlift-admin
# - In which directory is your code located? ./
# - Want to modify settings? N
```

### Set Environment Variable:
```bash
# Add your Railway backend URL
vercel env add NEXT_PUBLIC_API_URL production

# Enter value: https://your-server.up.railway.app/api
```

## Step 3: Deploy Web App

```bash
cd ../web

# Deploy to Vercel
vercel

# When prompted:
# - Set up and deploy? Y
# - Which scope? (select your account)
# - Link to existing project? N
# - What's your project's name? brainlift-web
# - In which directory is your code located? ./
# - Want to modify settings? N
```

### Set Environment Variable:
```bash
# Add your Railway backend URL
vercel env add VITE_API_URL production

# Enter value: https://your-server.up.railway.app/api
```

## Step 4: Get Production URLs

After deployment, you'll get URLs like:
- Admin: `https://brainlift-admin.vercel.app`
- Web: `https://brainlift-web.vercel.app`

## Step 5: Update CORS on Backend

Add these URLs to your backend's CORS configuration:
1. Go to Railway dashboard
2. Add environment variables:
```
FRONTEND_URL=https://brainlift-web.vercel.app
ADMIN_URL=https://brainlift-admin.vercel.app
```

## Step 6: Custom Domains (Optional)

### In Vercel Dashboard:
1. Go to Project Settings > Domains
2. Add your custom domain
3. Follow DNS configuration instructions

## Continuous Deployment

### GitHub Integration:
1. Go to Vercel dashboard
2. Import from Git
3. Connect your GitHub repository
4. Vercel will auto-deploy on every push

## Environment Variables Summary

### Admin Dashboard (Next.js):
- `NEXT_PUBLIC_API_URL`: Your Railway backend URL + /api

### Web App (Vite):
- `VITE_API_URL`: Your Railway backend URL + /api

### Backend (Railway) - Update CORS:
- `FRONTEND_URL`: Your Vercel web app URL
- `ADMIN_URL`: Your Vercel admin URL
- `BETTER_AUTH_TRUSTED_ORIGINS`: Add both Vercel URLs

## Monitoring

- Vercel Dashboard: View deployments, logs, analytics
- Functions Tab: Monitor API routes (if any)
- Analytics: Built-in Web Vitals monitoring

## Troubleshooting

### CORS Issues:
- Ensure backend has correct FRONTEND_URL and ADMIN_URL
- Check BETTER_AUTH_TRUSTED_ORIGINS includes Vercel URLs

### API Connection Issues:
- Verify environment variables are set correctly
- Check if Railway backend is running
- Look at browser console for errors

### Build Failures:
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Run `npm run build` locally to test