# Indulge Help Desk - Deployment Guide

## Vercel Deployment Instructions

### Prerequisites

- Vercel account
- GitHub repository connected to Vercel

### Environment Variables (Required in Vercel)

Set these environment variables in your Vercel project settings:

```
NEXT_PUBLIC_API_URL=https://indulgeconcierge.com/api
NEXT_PUBLIC_SOCKET_URL=https://indulgeconcierge.com
```

### Steps to Deploy:

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Deploy help desk"
   git push origin main
   ```

2. **In Vercel Dashboard:**

   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add the two variables above
   - Save changes

3. **Redeploy:**
   - Go to "Deployments" tab
   - Click "Redeploy" on the latest deployment
   - OR push a new commit to trigger automatic deployment

### Build Configuration (Automatic)

- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Node Version: 20.x

### Troubleshooting

**Issue: localStorage errors during build**

- Fixed: Added `typeof window !== 'undefined'` checks
- The app now safely handles SSR

**Issue: Environment variables not found**

- Solution: Set them in Vercel dashboard under Environment Variables
- They're prefixed with `NEXT_PUBLIC_` to make them available client-side

**Issue: Outdated Next.js vulnerability**

- Fixed: Updated to Next.js 16.0.7 (latest secure version)
- Run `npm install` to get updates

### Local Testing

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test production build
npm run build
npm start
```

### Features

- ✅ Real-time chat with Socket.IO
- ✅ Admin authentication
- ✅ Live user sessions
- ✅ Chat history
- ✅ Responsive design
- ✅ Secure WebSocket connections

### Tech Stack

- Next.js 16.0.7
- React 19.2.0
- Socket.IO Client 4.8.1
- TypeScript
- Tailwind CSS

### Support

For issues, check:

1. Environment variables are set correctly
2. Backend server is running at configured URL
3. Socket.IO connection is successful (check browser console)
