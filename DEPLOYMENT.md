# Elev8 Analyzer - Production Deployment Guide

## ✅ Vercel Deployment Status: READY

**Issue Fixed:** Consolidated serverless functions from 16 → 8 (under Vercel Hobby plan's 12 function limit)

---

## 📋 Pre-Deployment Checklist

- [x] Serverless functions consolidated (8/12 used)
- [x] Monitor-only mode implemented with FEATURE_USAGE_ENFORCEMENT flag
- [x] Bypass lists (BYPASS_IPS) and configurable caps (REPORT_CAP) added
- [x] Enhanced logging for usage tracking
- [x] Version endpoint for deployment verification
- [x] All usage tracking preserved for analytics

---

## 🚀 Deploy to Vercel (3 Steps)

### Step 1: Set Environment Variables in Vercel

Go to **Vercel Dashboard** → **Settings** → **Environment Variables** and add:

#### Required Variables:
```
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=your_postgres_connection_string
```

#### Monitor-Only Mode (Recommended for Launch):
```
FEATURE_USAGE_ENFORCEMENT=off
```

#### Optional Configuration:
```
REPORT_CAP=30
TOOL_NAME=elev8analyzer
PUBLIC_SITE_URL=https://analyzer.yourbizguru.com
BYPASS_IPS=your.ip.address.here
CORS_ALLOWED_ORIGINS=https://analyzer.yourbizguru.com
```

### Step 2: Push Code & Deploy

```bash
git add .
git commit -m "Fix Vercel deployment: consolidate serverless functions"
git push
```

Vercel will automatically deploy in 1-2 minutes.

### Step 3: Verify Deployment

#### ✅ Check Version Endpoint:
```
https://analyzer.yourbizguru.com/api/version
```

Should return:
```json
{
  "version": "1.1.0-monitor-mode",
  "usageLimiting": {
    "mode": "monitor-only",
    "enforcement": false,
    "reportCap": 30
  },
  "configuration": {
    "publicSiteUrl": "https://analyzer.yourbizguru.com"
  }
}
```

#### ✅ Test the App:
- Visit https://analyzer.yourbizguru.com
- Fill in business details
- Click "Generate Analysis"
- Should work without any "Report Limit Reached" errors

#### ✅ Check Vercel Logs:
Look for these messages in your Vercel function logs:
```
[Usage Check] Starting - IP: xxx.xxx.xxx.xxx, Tool: elev8analyzer, Enforcement: MONITOR-ONLY, Cap: 30
[Usage Check] ALLOWING (monitor-only mode)
[Usage Increment] IP xxx.xxx.xxx.xxx incremented to X/30 - Mode: MONITOR-ONLY
```

---

## 🔧 Serverless Functions (8/12 Used)

The following endpoints are deployed to Vercel:

1. **api/[...path].ts** - Main AI generation handler (Elev8 Analyzer + GrantGenie)
2. **api/version.ts** - Version and configuration status
3. **api/usage.ts** - Usage tracking (check & increment combined)
4. **api/auth/login.ts** - User authentication
5. **api/auth/register.ts** - User registration
6. **api/reports/[id].ts** - Get specific report by ID
7. **api/reports/list.ts** - List all saved reports
8. **api/reports/save.ts** - Save report to database

**What was removed to fit the limit:**
- ❌ `api/generate.ts` (redundant - handled by api/[...path].ts)
- ❌ `api/check-ip.ts` (debug only)
- ❌ `api/debug-usage.ts` (debug only)
- ❌ `api/usage/check.ts` + `api/usage/increment.ts` (merged into api/usage.ts)

---

## 📊 Environment Variable Reference

### Core Configuration

#### FEATURE_USAGE_ENFORCEMENT
- **Default:** `on`
- **Values:** `on` | `off`
- **Purpose:** Controls usage limit enforcement
  - `off` = Monitor-only mode (tracks but doesn't block)
  - `on` = Enforcing mode (blocks at cap)
- **Recommendation:** Start with `off` for soft launch

#### REPORT_CAP
- **Default:** `30`
- **Purpose:** Number of reports allowed per IP per tool
- **Note:** Works in both modes (monitored in off, enforced in on)

#### BYPASS_IPS
- **Format:** Comma-separated IP addresses
- **Example:** `192.168.1.1,10.0.0.5,207.213.21.10`
- **Purpose:** IPs in this list always bypass usage limits
- **Tip:** Add your own IP for unlimited testing

#### TOOL_NAME
- **Default:** `elev8analyzer`
- **Values:** `elev8analyzer` | `grantgenie` | `complipilot`
- **Purpose:** Identifies the tool for usage tracking

#### PUBLIC_SITE_URL
- **Example:** `https://analyzer.yourbizguru.com`
- **Purpose:** Your production URL for CORS and branding

#### CORS_ALLOWED_ORIGINS
- **Example:** `https://analyzer.yourbizguru.com`
- **Purpose:** CORS configuration for iframe embedding

---

## 📈 Monitor-Only Mode Explained

**What it does:**
- ✅ Tracks all usage in the database (full analytics)
- ✅ Usage counts continue incrementing beyond the cap
- ✅ Users **NEVER** see "Report Limit Reached" errors
- ✅ Detailed logs show usage patterns for debugging
- ✅ No disruption to user experience

**When to use:**
- During soft launch to gather usage data
- For testing without blocking real users
- When you want analytics but no restrictions
- To avoid false positives from bugs

**How to switch to enforcing mode later:**
1. Change `FEATURE_USAGE_ENFORCEMENT=on` in Vercel
2. Wait for next serverless function cold start (or redeploy)
3. Users will start seeing limit enforcement
4. All historical usage data is preserved

---

## 🔒 Optional: Enable Database-Level RLS

For **defense-in-depth security**, enable Row Level Security in Supabase:

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase-rls-setup.sql`
3. Paste and execute the script
4. Verify RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'compliance_reports';
   ```
   Should return `rowsecurity = true`

This adds database-level isolation on top of application-layer security.

---

## 🏗️ Build Process

The build process (`npm run build`) does:

1. **Frontend Build** (Vite):
   - Bundles React app
   - Optimizes assets
   - Outputs to `dist/client/`

2. **Backend Build** (esbuild):
   - Bundles Express server (TypeScript → JavaScript)
   - Bundles dependencies
   - Outputs to `dist/index.js`

3. **Production Start**:
   ```bash
   npm start
   # Runs: NODE_ENV=production node dist/index.js
   ```

---

## 📊 Architecture

### Production Stack
- **Frontend**: React + Vite (Static files in `dist/client/`)
- **Backend**: Express.js + TypeScript (Compiled to `dist/index.js`)
- **Database**: Supabase PostgreSQL (Neon)
- **Authentication**: Supabase JWT
- **AI**: OpenAI GPT-5
- **Hosting**: Vercel Serverless

### Security Layers
1. **Transport**: HTTPS (Vercel + Supabase)
2. **Authentication**: Supabase JWT validation
3. **Application**: Server-side ownership checks
4. **Database**: Row Level Security (optional, recommended)

---

## 🔧 Troubleshooting

### Build Fails
- **Issue**: Missing dependencies
- **Fix**: Ensure `package.json` is committed and all dependencies are listed
- **Verify**: Run `npm install` locally

### API Returns 500 Errors
- **Issue**: Missing environment variables
- **Fix**: Double-check all env vars are set in Vercel
- **Test**: Check Vercel logs for specific error messages

### Authentication Not Working
- **Issue**: SUPABASE_URL or SUPABASE_ANON_KEY incorrect
- **Fix**: Verify credentials in Supabase Dashboard → Settings → API
- **Test**: `curl https://your-app.vercel.app/api/auth/config`

### Database Connection Errors
- **Issue**: DATABASE_URL incorrect or Supabase IP allowlist
- **Fix**: 
  - Check connection string format
  - Ensure Supabase project is not paused
  - Verify connection pooling settings

---

## 📝 Post-Deployment

### Monitor Your Application
- **Vercel Dashboard**: View deployment logs, metrics, errors
- **Supabase Dashboard**: Monitor database queries, auth users
- **OpenAI Dashboard**: Track API usage and costs

### Custom Domain (Optional)
1. Go to Vercel Project → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL certificate auto-provisioned

### Scaling
- Vercel automatically scales serverless functions
- Supabase automatically manages database connections
- Monitor OpenAI API usage to stay within quotas

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ Production URL loads the CompliPilot interface  
✅ `/api/auth/config` returns valid Supabase configuration  
✅ Users can generate compliance reports  
✅ Authenticated users can save and retrieve reports  
✅ No cross-user data access (security verified)  

---

## 📞 Support

- **Replit**: [replit.com/support](https://replit.com/support)
- **Vercel**: [vercel.com/support](https://vercel.com/support)
- **Supabase**: [supabase.com/support](https://supabase.com/support)

---

**Built with ❤️ by YourBizGuru**  
**Secured with Supabase · Powered by OpenAI GPT-5**
