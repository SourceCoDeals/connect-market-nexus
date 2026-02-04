# 🚀 Deploy Buyer Fit Criteria Edge Functions

Hey! We've just built an amazing buyer fit criteria extraction system. Time to deploy the edge functions to make it all work!

## 📋 What We're Deploying

We have 3 brand new edge functions that extract buyer criteria from different sources:

1. **extract-buyer-criteria** - Extracts criteria from AI-generated M&A guides (30,000+ words!)
2. **extract-deal-document** - Processes uploaded PDFs and documents
3. **extract-buyer-transcript** - Analyzes call transcripts (captures actual buyer statements)

Plus we're redeploying 2 fixed functions:
4. **generate-ma-guide** - Fixed context passing bug (critical!)
5. **import-reference-data** - Fixed schema alignment issues

## 🎯 Quick Deploy Command

Run this from your terminal (not from this chat):

```bash
# Navigate to project directory
cd /path/to/connect-market-nexus

# Deploy all 5 functions at once
supabase functions deploy extract-buyer-criteria --project-ref vhzipqarkmmfuqadefep && \
supabase functions deploy extract-deal-document --project-ref vhzipqarkmmfuqadefep && \
supabase functions deploy extract-buyer-transcript --project-ref vhzipqarkmmfuqadefep && \
supabase functions deploy generate-ma-guide --project-ref vhzipqarkmmfuqadefep && \
supabase functions deploy import-reference-data --project-ref vhzipqarkmmfuqadefep
```

## ✨ What Each Function Does

### extract-buyer-criteria
- **Input:** AI-generated M&A guide content (JSON body with `guide_content`, `universe_id`, `source_name`)
- **Output:** Structured criteria with 4 sections (size, service, geography, buyer types)
- **Magic:** Uses Claude Sonnet 4 to extract specific numbers, ranges, and profiles
- **Time:** ~30-40 seconds per extraction

### extract-deal-document
- **Input:** Document URL from Supabase Storage (JSON body with `document_url`, `universe_id`, `document_name`)
- **Output:** Partial criteria from document with confidence scores
- **Magic:** Downloads PDF, extracts text, analyzes with AI
- **Time:** ~20-30 seconds per document

### extract-buyer-transcript
- **Input:** Transcript text + participants (JSON body with `transcript_text`, `participants`, `universe_id`)
- **Output:** Buyer insights + key quotes + profile updates
- **Magic:** Captures verbatim quotes (highest value!), updates buyer records
- **Time:** ~15-25 seconds per transcript

### generate-ma-guide (FIXED!)
- **What's Fixed:** Phases now receive context from previous phases (no more repetitive content!)
- **Also Fixed:** Added diagnostic logging to track phase timing

### import-reference-data (FIXED!)
- **What's Fixed:** Changed `target_revenue_min/max` to `min_revenue/max_revenue` to match database schema
- **Impact:** CSV imports will work without schema cache errors

## 🔐 Environment Variables Needed

All functions use these (already configured in your project):
- `ANTHROPIC_API_KEY` - For Claude AI
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

## ✅ Verification Steps

After deployment, check the Supabase Dashboard:

1. **Go to Edge Functions tab**
2. **Look for these 5 functions:**
   - ✓ extract-buyer-criteria
   - ✓ extract-deal-document
   - ✓ extract-buyer-transcript
   - ✓ generate-ma-guide
   - ✓ import-reference-data

3. **Test extraction (optional):**
   - Use the CriteriaExtractionPanel in the UI
   - Try extracting from an AI guide first (easiest test)
   - Check logs in Supabase Functions → Logs

## 🎉 Success Indicators

You'll know it's working when:
- Functions appear in Supabase Dashboard
- No deployment errors in terminal
- UI CriteriaExtractionPanel shows "Extract Criteria from Guide" button
- First extraction completes with confidence score > 70%

## 🆘 Troubleshooting

**Error: "command not found: supabase"**
- Install Supabase CLI: `npm install -g supabase`

**Error: "Failed to deploy: authentication required"**
- Run: `supabase login`

**Error: "Project ref not found"**
- Double-check project ref: `vhzipqarkmmfuqadefep`

**Functions deploy but return 500 errors:**
- Check ANTHROPIC_API_KEY is set in Supabase Dashboard → Project Settings → Edge Functions → Secrets

## 🚀 You're All Set!

Once deployed, users can:
1. Generate M&A guides with better quality (context flows between phases!)
2. Extract criteria from guides, documents, and transcripts
3. Review and merge criteria from multiple sources
4. Apply synthesized criteria to buyer universes

The system will intelligently merge data from multiple sources, detect conflicts, and maintain an audit trail of all changes.

**Ready? Run that deploy command and watch the magic happen! ✨**
