# We Are Roofing — Project Status & Roadmap

**Last Updated:** May 6, 2026  
**Owner:** Andrew Bailey  
**Team:** 1 (Solo)

---

## 📊 Current Status

### 🟢 Launched & Live
- ✅ Field app HTML/CSS/JS (fully functional UI)
- ✅ Marketing website (deployed to Netlify)
- ✅ Notion database structure (6 databases configured)
- ✅ Supabase backend (edge functions created)
- ✅ GitHub repo structure (ready to use)

### 🟡 Partially Working
- ⚠️ Submit function (receives data, but Notion integration incomplete)
- ⚠️ Customer search (API connection works, need testing)
- ⚠️ AI Quote helper (requires paid Claude API key)

### 🔴 Not Yet Implemented
- ❌ Photo upload to Supabase
- ❌ Job status sync between app and Notion
- ❌ Invoice generation
- ❌ Mobile notifications
- ❌ Offline mode

---

## 🚀 Roadmap

### **Phase 1: Core Functionality (May 2026)**
- [ ] Fix submit button (ensure Notion integration works)
- [ ] Test customer search end-to-end
- [ ] Verify all surveys appear in Notion 🏗️ Jobs board
- [ ] Document current API behavior
- **Target:** All surveys → Notion automatically

### **Phase 2: Photo Management (May-June)**
- [ ] Add photo upload to Supabase
- [ ] Store photos with job records
- [ ] Display photos in Notion pages
- [ ] Add before/after gallery
- **Target:** Surveyors can attach up to 6 photos per survey

### **Phase 3: Real-Time Sync (June)**
- [ ] Job status updates reflect in app
- [ ] Customer notifications when quote is ready
- [ ] Mobile alerts for new jobs assigned
- **Target:** Live project dashboard

### **Phase 4: Invoicing (July)**
- [ ] Generate invoices from Notion 💰 Invoices DB
- [ ] Email invoices to customers
- [ ] Payment tracking
- **Target:** Automated billing workflow

### **Phase 5: Team Features (Aug)**
- [ ] Multi-user access (surveyors, admin, office)
- [ ] Job assignment & scheduling
- [ ] Team performance metrics
- [ ] In-app messaging
- **Target:** Full team coordination

---

## 📈 Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Surveys saved to Notion | 100% | 0% (broken) |
| App response time | <1s | ~500ms |
| Customer search accuracy | 95% | ? (untested) |
| AI Quote quality | Good | Pending |
| Uptime | 99.9% | 100% |
| Notion sync lag | <5s | Unknown |

---

## 🔧 Known Technical Debt

1. **Edge Function Logging**
   - Need better error messages when submit fails
   - Missing request/response logging

2. **CORS Issues**
   - Some requests blocked by IP allowlist
   - Need CORS headers on all edge functions

3. **Error Handling**
   - App shows "saved" even if Notion creation fails
   - No retry logic for failed submissions

4. **Missing Validation**
   - Photo upload size limits not enforced
   - No character limits on text fields
   - Phone number validation missing

---

## 📚 Documentation

| Document | Status | Location |
|----------|--------|----------|
| README | ✅ Done | ./README.md |
| Setup Guide | ✅ Done | ./docs/SETUP.md |
| API Docs | 🟡 Partial | ./docs/API.md |
| Edge Functions | 🟡 Partial | ./edge-functions/ |
| Testing Guide | ❌ TODO | ./docs/TESTING.md |
| Deployment | 🟡 Partial | ./docs/DEPLOYMENT.md |

---

## 💰 Costs

| Service | Cost | Status |
|---------|------|--------|
| Netlify | Free | ✅ |
| Supabase | Free tier | ✅ |
| Notion | $8/month | ✅ |
| Claude API | ~$0.05 per quote | ✅ |
| Domain | $12/year | ✅ |
| **Monthly Total** | ~$8 | ✅ |

---

## 🎯 Next 48 Hours

1. **Diagnose submit issue**
   - [ ] Check edge function logs
   - [ ] Verify Notion token is valid
   - [ ] Test with curl/Postman

2. **Get one survey working end-to-end**
   - [ ] Submit from app
   - [ ] Appear in Notion
   - [ ] Link to customer

3. **Document what's broken**
   - [ ] Create GitHub issues
   - [ ] Add to Notion bug tracker

---

## Questions for Next Meeting

1. Do you want to fix submit first, or add photo upload?
2. Should we bill hourly or by feature delivered?
3. Can we get a Notion API token for the edge functions?
4. What's the priority: mobile responsiveness vs backend reliability?
5. Budget for Claude API calls? (AI Quote feature)

---

**Contact:** andrew@weareroofing.co.uk
