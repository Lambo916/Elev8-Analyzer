# Vercel 404 Fix - Manual Steps Required

## Issue
The vite.config.ts file is protected from automated edits. You need to manually update it.

## Step 1: Update vite.config.ts

**Open `vite.config.ts` and replace its contents with:**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: false
  }
});
```

**Key changes:**
- Added `root: 'client'` to tell Vite where index.html lives
- Added proper path aliases for @/ and @shared/
- Changed build.outDir to '../dist/client' (relative to client directory)

## Step 2: Verify vercel.json

The `vercel.json` has been updated to:

```json
{
  "buildCommand": "cd client && npx vite build --outDir ../dist/client",
  "outputDirectory": "dist/client",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Step 3: Test the Build

Run this locally to verify:

```bash
npm run build
```

Should output to `dist/client/index.html`

## Step 4: Commit and Push

```bash
git add vite.config.ts vercel.json
git commit -m "fix: update Vercel static build path and SPA routing"
git push origin main
```

Vercel will auto-redeploy when it detects the push.

## Step 5: Verify Deployment

Once deployed, check:
- https://compli.yourbizguru.com (should load app)
- https://compli.yourbizguru.com/any-route (should load app via SPA routing)
