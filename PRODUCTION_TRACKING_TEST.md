# Production Analytics Tracking Test Guide

## Test UTM Links for marketplace.sourcecodeals.com

Use these test links to verify that session tracking, UTM parameters, and referrer tracking work correctly on production:

### 1. LinkedIn Traffic Test
```
https://marketplace.sourcecodeals.com/?utm_source=linkedin&utm_medium=social&utm_campaign=q1_growth
```
**Expected Result:** Marketing channel should show as "LinkedIn" or "Social Media"

### 2. Email Campaign Test (Brevo)
```
https://marketplace.sourcecodeals.com/?utm_source=brevo&utm_medium=email&utm_campaign=weekly_newsletter
```
**Expected Result:** Marketing channel should show as "Brevo/Email" or "Email"

### 3. Google Ads Test
```
https://marketplace.sourcecodeals.com/?utm_source=google&utm_medium=cpc&utm_campaign=brand_search
```
**Expected Result:** Marketing channel should show as "Google Ads" or "Paid Search"

### 4. Direct Traffic Test
```
https://marketplace.sourcecodeals.com/
```
**Expected Result:** Marketing channel should show as "Direct"

### 5. Referrer Test (from external site)
```
https://marketplace.sourcecodeals.com/
```
Access this link from an external website (e.g., paste in a document, share via chat app)
**Expected Result:** Referrer should capture the referring domain

## Testing Procedure

### For New Users:
1. Open a private/incognito browser window
2. Click one of the test links above
3. Sign up for an account
4. Wait 10 seconds for session tracking to process
5. Log into admin panel at https://marketplace.sourcecodeals.com/admin
6. Check the Activity Feed - user should show correct source

### For Existing Users (Testing Going Forward):
1. Log out completely
2. Clear browser cookies and session storage
3. Click one of the test links
4. Log back in
5. The NEW session will be tracked with the correct UTM parameters
6. Admin panel should show updated referrer information

## Verification Checklist

After testing each link, verify in the admin panel:

- [ ] User appears in Activity Feed
- [ ] "Date First Seen" shows the correct signup date (not recent activity date)
- [ ] Session referrer shows correct source (LinkedIn/Brevo/Google/Direct)
- [ ] UTM parameters are captured in user_initial_session table
- [ ] Marketing channel is properly classified

## Database Verification

To verify data is being stored correctly, check the `user_initial_session` table:

```sql
SELECT 
  user_id,
  session_id,
  utm_source,
  utm_medium,
  utm_campaign,
  marketing_channel,
  referrer,
  landing_page,
  first_seen_at
FROM user_initial_session
ORDER BY first_seen_at DESC
LIMIT 10;
```

## Edge Function Logs

Monitor the `track-initial-session` edge function logs to see if tracking is working:
- Should see "Initial session tracked successfully" for new sessions
- Should see "Initial session already exists" for returning users (first session only)
- No authentication errors should appear

## Production Domain Verification

Confirm these URLs are correctly referenced in the codebase:
- ✅ Auth redirects: `https://marketplace.sourcecodeals.com`
- ✅ Email links: `https://marketplace.sourcecodeals.com`
- ✅ Session tracking: Domain-agnostic (works on any domain)
- ✅ Analytics tracking: Domain-agnostic (works on any domain)

## Common Issues & Solutions

### Issue: All users show "Direct"
**Solution:** Check that edge function `track-initial-session` is deployed and running without errors

### Issue: Date First Seen is wrong
**Solution:** Already fixed - now uses `profiles.created_at` instead of activity date

### Issue: UTM parameters not captured
**Solution:** Ensure URLs include proper UTM parameters and session tracking hook runs on page load

### Issue: Session tracking not working
**Solution:** Check browser console for errors, verify Supabase client is initialized, check edge function logs

## Success Criteria

✅ New signups capture full session data (UTMs, referrer, landing page)
✅ Existing users show correct signup date in "Date First Seen"
✅ Activity feed displays accurate marketing channels
✅ Edge function processes requests without errors
✅ All tracking works on marketplace.sourcecodeals.com production domain
