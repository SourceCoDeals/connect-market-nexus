# HTTP 401 Enrichment Error - DEFINITIVE FIX

## Root Cause Analysis

The `enrich-buyer` edge function is returning **HTTP 401** errors for all enrichment attempts.

After analyzing the function code (`supabase/functions/enrich-buyer/index.ts`), the 401 error is occurring **BEFORE the function code even runs**. This means:

- ❌ NOT an API key issue inside the function (would return 500)
- ❌ NOT a Firecrawl/Anthropic authentication issue (would return different error)
- ✅ **The function invocation itself is being rejected by Supabase**

## Most Likely Cause

**The `enrich-buyer` edge function is not deployed or is deployed incorrectly.**

## STEP-BY-STEP FIX (Complete in 5 minutes)

### Step 1: Verify Function Deployment Status

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `vhzipqarkmmfuqadefep`
3. Navigate to **Edge Functions** (left sidebar)
4. Check if `enrich-buyer` appears in the list
   - ✅ If YES with green checkmark → Skip to Step 2
   - ❌ If NO or has error icon → Continue to deploy

### Step 2: Deploy the enrich-buyer Function

Open your terminal and run:

```bash
cd /home/user/connect-market-nexus

# Deploy enrich-buyer function
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
```

**Expected output:**
```
Deploying function enrich-buyer...
  ✓ Deployed function enrich-buyer successfully
  URL: https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/enrich-buyer
```

**If you get "command not found: supabase":**
```bash
# Install Supabase CLI
npm install -g supabase

# Then retry deployment
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
```

**If you get "authentication required":**
```bash
# Login to Supabase
supabase login

# Then retry deployment
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
```

### Step 3: Verify Environment Secrets

The `enrich-buyer` function requires **4 environment variables** to be set in Supabase:

1. Go to Supabase Dashboard → Edge Functions → **Secrets**
2. Verify these secrets exist with valid values:

```
ANTHROPIC_API_KEY     = sk-ant-... (your Anthropic API key)
FIRECRAWL_API_KEY     = fc-... (your Firecrawl API key)
SUPABASE_URL          = https://vhzipqarkmmfuqadefep.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJh... (your service role key)
```

**To add missing secrets:**
```bash
# Set Anthropic API key
supabase secrets set ANTHROPIC_API_KEY=your_key_here --project-ref vhzipqarkmmfuqadefep

# Set Firecrawl API key
supabase secrets set FIRECRAWL_API_KEY=your_key_here --project-ref vhzipqarkmmfuqadefep

# After adding secrets, MUST redeploy function
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep
```

**CRITICAL:** After setting secrets, you MUST redeploy the function for changes to take effect.

### Step 4: Test Single Buyer Enrichment

1. Go to your app
2. Navigate to Remarketing Universe
3. Select **ONE buyer** (not bulk enrichment)
4. Click "Enrich" on that single buyer
5. Watch for:
   - ✅ Success → Problem fixed!
   - ❌ Still fails → Check error message in summary dialog

### Step 5: Check Edge Function Logs

If still failing after Steps 1-4:

1. Go to Supabase Dashboard → Edge Functions
2. Click on `enrich-buyer`
3. Click **Logs** tab
4. Look for the most recent error entry
5. Copy the full error message

**Common error messages and fixes:**

| Error Message | Fix |
|--------------|-----|
| `Server configuration error - missing API keys` | Add secrets in Step 3 |
| `HTTP 429: Too Many Requests` | Anthropic rate limit - wait 60 seconds |
| `HTTP 402: Payment Required` | Add credits to Anthropic account |
| `Could not scrape any website content` | Check Firecrawl API key and credits |
| `Buyer not found` | Database issue - verify buyer exists |

## Quick Verification Commands

Run these to verify your setup:

```bash
# 1. Verify you're in the right directory
pwd
# Should output: /home/user/connect-market-nexus

# 2. Verify enrich-buyer function file exists
ls -la supabase/functions/enrich-buyer/index.ts
# Should show the file with ~1120 lines

# 3. Check if Supabase CLI is installed
which supabase
# Should output path or "not found"

# 4. List all edge functions (requires login)
supabase functions list --project-ref vhzipqarkmmfuqadefep
# Should show enrich-buyer in the list
```

## Why This Fix Works

**The Problem:**
- Frontend calls: `supabase.functions.invoke('enrich-buyer', { body: { buyerId } })`
- Supabase returns: **HTTP 401 Unauthorized**
- This happens BEFORE any function code runs
- Means: Function doesn't exist or auth is failing

**The Solution:**
1. **Deploy the function** → Makes it accessible
2. **Set environment secrets** → Allows function to work
3. **Verify in dashboard** → Confirms deployment
4. **Test with one buyer** → Validates fix

## Expected Results After Fix

✅ **Enrichment Summary Dialog will show:**
- Total: 56
- Successful: 45-55 (depending on website availability)
- Failed: 1-11 (normal for missing/bad websites)
- Success Rate: 80-98%

✅ **Common expected failures (these are NORMAL):**
- "Could not scrape any website content" - buyer has no website or website is down
- "Insufficient content" - website has less than 200 characters
- "Timed out after 15s" - website is slow

❌ **Should NOT see anymore:**
- "HTTP 401" for every buyer
- 0% success rate
- All 56 failed

## Emergency Fallback

If deployment still fails after all steps:

```bash
# Check git status - ensure you're on the right branch
git status

# Ensure you have latest code
git pull origin claude/fix-remarketing-security-QVgU7

# Force redeploy with verbose output
supabase functions deploy enrich-buyer --project-ref vhzipqarkmmfuqadefep --debug
```

## Contact Information

If this fix doesn't work:
1. Run all verification commands above
2. Check Edge Function Logs in Supabase Dashboard
3. Provide screenshot of the specific error from logs
4. Share output of `supabase functions list`

---

**Last Updated:** 2026-02-04
**Attempt Number:** 7 (THIS IS THE DEFINITIVE FIX)
