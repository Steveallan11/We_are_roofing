# Setup Guide: GitHub + Notion + Netlify

## 1. Create GitHub Repo

1. Go to **github.com/new**
2. Repository name: `we-are-roofing`
3. Description: "Roofing business system - field app, website, Notion integration"
4. Public or Private (recommend Private)
5. Click **Create repository**

## 2. Connect GitHub to Netlify (Auto-Deploy)

### For Field App:
1. Go to **app.netlify.com** → **New site from Git**
2. Connect GitHub
3. Select repository: `we-are-roofing`
4. Build command: (leave blank)
5. Publish directory: `we-are-roofing-app`
6. Environment variables:
   - Add any API keys needed
7. Deploy

### For Website:
Repeat same process but:
- Publish directory: `we-are-roofing-website`

## 3. Set Up GitHub Secrets (for Deploy Workflow)

In your GitHub repo:
1. Settings → Secrets and variables → Actions
2. Create secrets:
   - `NETLIFY_AUTH_TOKEN` - Get from Netlify Account Settings
   - `NETLIFY_SITE_ID_APP` - Get from Field App site settings
   - `NETLIFY_SITE_ID_WEBSITE` - Get from Website site settings

Then GitHub Actions will auto-deploy on every push.

## 4. Set Up Notion GitHub Integration

### Option A: GitHub → Notion Automation (Zapier)
1. Go to **zapier.com**
2. Create Zap:
   - Trigger: GitHub → New Issue
   - Action: Notion → Create Page
   - Map GitHub fields to Notion properties

### Option B: Manual Notion Database for Issues
1. In your Notion workspace, create database:
   - Name: "🐛 GitHub Issues"
   - Properties: Issue #, Title, Status, Labels, URL
   - Type: Table

Then manually sync important issues.

## 5. Configure Supabase Edge Functions

### Deploy submit function:
```bash
cd edge-functions
supabase functions deploy submit \
  --project-ref mkttjtltxownxsfqhucr \
  --auth-token YOUR_SUPABASE_TOKEN
```

Set environment variables in Supabase:
- `NOTION_API_KEY` - Your Notion API token
- `CUSTOMERS_DB` - Database ID
- `JOBS_DB` - Database ID

## 6. Local Development

```bash
# Clone
git clone https://github.com/yourusername/we-are-roofing.git
cd we-are-roofing

# Edit app
nano we-are-roofing-app/index.html

# Test locally
python3 -m http.server 8000
# Visit http://localhost:8000/we-are-roofing-app/

# Push changes
git add .
git commit -m "Fix: [description]"
git push origin main
# → Netlify auto-deploys in 30 seconds
```

## 7. Notion Databases to Link

### Create in Notion:
- 📋 Issues & Bugs (for GitHub issues)
- 🚀 Releases (version tracking)
- 📝 Changelog (what changed)

### Link existing:
- 👤 Customers (when survey submitted)
- 🏗️ Jobs (when survey submitted)
- 📊 Quotes (manual for now)

## 8. Monthly Maintenance

- [ ] Check GitHub Issues
- [ ] Review Notion backlog
- [ ] Deploy any fixes
- [ ] Update Notion documentation
- [ ] Check Supabase logs for errors
- [ ] Backup Notion data

## Troubleshooting

**Deploy not working?**
- Check GitHub Actions tab for logs
- Verify NETLIFY_AUTH_TOKEN is set
- Check Netlify site ID matches

**App not syncing to Notion?**
- Check Supabase function logs
- Verify NOTION_API_KEY is set
- Check database IDs are correct
- Look for CORS errors in browser console

**Can't push to GitHub?**
- Add SSH key: `ssh-keygen -t ed25519`
- Add public key to GitHub SSH settings
- Or use personal access token

---

**Need help?** See README.md for support info.
