# We Are Roofing UK Ltd — Complete Business System

**Developer:** Andrew Bailey | **Status:** Production | **Last Updated:** May 2026

Complete roofing business management system with mobile field app, marketing website, and Notion integration.

## 📦 What's Included

### 🔧 We Are Roofing Field App
Mobile-first survey app for on-site data collection. Surveyors fill in detailed roof condition forms, measurements, and photos — then the app sends everything to Notion and generates AI quoting guides.

**Live:** https://zingy-kangaroo-18334a.netlify.app  
**Tech:** HTML5 + Vanilla JS + Supabase + Claude API  
**Deploy:** Automatic on push to `main`

### 🌐 We Are Roofing Website
Marketing website (luxury dark/gold design) with service listings, gallery, testimonials, quote calculator, and contact forms.

**Tech:** Single HTML file, self-contained  
**Live:** [To be deployed]

### 🧠 Notion Integration
6 databases for complete operations:
- **👤 Customers** — CRM with contact details
- **📋 Quotes** — Estimate tracking
- **🏗️ Jobs** — Active projects
- **🧱 Materials** — Inventory & pricing
- **👷 Team & Labour** — Staff management
- **💰 Invoices** — Billing

### ⚙️ Supabase Backend
Edge functions:
- `submit()` — Survey → Notion Job + Customer
- `search-customers()` — Customer autocomplete

---

## 🚀 Quick Start

**For Surveyors:**
1. Open app on iPhone
2. Select survey type
3. Fill property details + roof condition
4. Tap SAVE SURVEY → data to Notion
5. Tap AI QUOTE for instant quoting guide

**For Developers:**
```bash
git clone https://github.com/yourusername/we-are-roofing.git
cd we-are-roofing
# Edit we-are-roofing-app/index.html
git add .
git commit -m "Fix: Submit button"
git push origin main  # Auto-deploys to Netlify
```

---

## 🔧 Tech Stack

| Component | Technology |
|-----------|-----------|
| Field App | HTML5 + Vanilla JS |
| Backend | Supabase Edge Functions |
| CRM | Notion |
| Hosting | Netlify |
| AI | Claude API |

---

## 📋 Current Issues

- [ ] Submit button fails silently (edge function needs Notion token)
- [ ] Customer search needs testing
- [ ] Photo upload not yet implemented

---

## 📊 GitHub + Notion Integration

**Notion Database:** Issues & Bug Tracking  
**Connection:** Via GitHub API + Zapier/automation

Link GitHub issues directly to Notion for project tracking.

---

## 📞 Support

**App not submitting?**
1. Check F12 console for errors
2. Verify property address filled in
3. Check Supabase edge function logs

**Notion not getting data?**
1. Check NOTION_API_KEY env var
2. Verify token is valid
3. Check database IDs

---

**License:** Proprietary — We Are Roofing UK Ltd
