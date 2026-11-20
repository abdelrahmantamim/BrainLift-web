# BrainLift Web Deployment Guide

## Domain: getbrainlift.app

## Prerequisites
- Domain registered and DNS access
- Server API deployed at api.getbrainlift.app
- Environment variables configured

## Deployment Options

### Option 1: Netlify (Recommended)

1. **Connect Repository**
   - Sign in to Netlify
   - Click "New site from Git"
   - Connect your GitHub repository
   - Select the `web` directory as base directory

2. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18

3. **Environment Variables**
   Add in Netlify dashboard:
   ```
   VITE_API_URL=https://api.getbrainlift.app/api
   VITE_APP_URL=https://getbrainlift.app
   VITE_APPLE_CLIENT_ID=com.brainlift.service
   VITE_APPLE_REDIRECT_URI=https://getbrainlift.app/auth/apple/callback
   ```

4. **Custom Domain**
   - Go to Domain settings
   - Add custom domain: getbrainlift.app
   - Add DNS records as instructed

5. **Deploy**
   - Push to main branch
   - Netlify auto-deploys

### Option 2: Vercel

1. **Import Project**
   - Sign in to Vercel
   - Import Git repository
   - Select `web` as root directory

2. **Configure Project**
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Environment Variables**
   Same as Netlify (add in Vercel dashboard)

4. **Domain**
   - Add getbrainlift.app in domains section
   - Update DNS records

### Option 3: Traditional Hosting

1. **Build Locally**
   ```bash
   cd web
   npm install
   npm run build
   ```

2. **Upload `dist` folder to:**
   - Apache/Nginx server
   - Configure for SPA routing

3. **Nginx Configuration Example**
   ```nginx
   server {
       listen 80;
       server_name getbrainlift.app;
       root /var/www/brainlift/dist;

       location / {
           try_files $uri /index.html;
       }

       location /api {
           proxy_pass https://api.getbrainlift.app;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## Post-Deployment Checklist

- [ ] Verify landing page loads at getbrainlift.app
- [ ] Test auth flow (login/register)
- [ ] Check Apple Sign-In redirect
- [ ] Test shareable links work
- [ ] Verify API calls succeed
- [ ] Check HTTPS is enabled
- [ ] Test on mobile devices
- [ ] Monitor error logs

## DNS Configuration

Add these records to your domain:
```
A     @      [Hosting IP]
CNAME www    getbrainlift.app
```

For Netlify/Vercel, they'll provide specific DNS settings.

## SSL Certificate

- Netlify/Vercel: Automatic SSL
- Traditional: Use Let's Encrypt with certbot

## Admin Dashboard

The admin dashboard will be accessible at:
- Development: http://localhost:3001/admin
- Production: https://api.getbrainlift.app/admin

Update server CORS to allow getbrainlift.app origin.

## Monitoring

Consider adding:
- Google Analytics
- PostHog for error tracking, session replay & analytics
- Uptime monitoring

## Updates

To deploy updates:
1. Push code to main branch (auto-deploy)
2. Or manually trigger deploy in hosting dashboard

## Troubleshooting

**White screen**: Check browser console for errors
**API errors**: Verify CORS and API URL
**Auth issues**: Check cookies and session configuration
**Apple Sign-In**: Verify redirect URL matches configuration