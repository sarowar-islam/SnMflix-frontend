# Deploying SnMflix Frontend to Vercel

This guide explains how to deploy the **SnMflix Frontend** (Vite + React) to [Vercel](https://vercel.com).

## Environment Variables to Configure on Vercel

In your Vercel project settings under **Environment Variables**, add:
- `VITE_API_BASE_URL`: `https://snmflix.onrender.com/api`
- `VITE_TMDB_API_KEY`: `dd09381517f08b551e2162a3826b2695`
- `VITE_EMBED_BASE_URL`: `https://multiembed.mov/`

## Deployment Steps

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your `SnMflix-frontend` repository from GitHub/GitLab/Bitbucket.
4. Configure the Project Settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add the Environment Variables listed above.
6. Click **Deploy**.
