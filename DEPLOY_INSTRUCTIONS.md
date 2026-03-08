# Deployment Instructions

The updated `api/render.js` file has been modified but needs to be deployed to Vercel.

## Option 1: Drag & Drop (Easiest)

1. Open https://vercel.com/new in your browser
2. Log in to your Vercel account
3. Drag the entire `/Users/apple/Projects/arkai-backend` folder onto the page
4. Click "Deploy"
5. Wait for deployment to complete (30-60 seconds)

## Option 2: Vercel CLI

If you can install Vercel CLI:

```bash
# Install Vercel CLI globally
npm install -g vercel

# Navigate to backend directory
cd /Users/apple/Projects/arkai-backend

# Deploy to production
vercel --prod
```

## Option 3: Connect to Git

1. Initialize git repository:
```bash
cd /Users/apple/Projects/arkai-backend
git init
git add .
git commit -m "Fix Replicate API image upload"
```

2. Push to GitHub/GitLab
3. Connect the repository to Vercel for auto-deployments

## What was changed?

The `api/render.js` file now:
- Uploads images to Replicate's file storage first
- Uses the returned image URL instead of base64 data URL
- Fixes the "mean must have 1 elements" error from Replicate API
