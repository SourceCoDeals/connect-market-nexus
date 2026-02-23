# SourceCo Platform QA & Testing Plan

## Testing Guides Saved
- `docs/testing/ai-chatbot-testing-guide.md` — AI Command Center chatbot QA (help + action modes)
- `docs/testing/platform-testing-guide.md` — Full platform workflow QA (deals, messaging, enrichment, memos, remarketing, contacts, Fireflies, universes, permissions, errors)

## Active Testing Focus

### Phase 1: Browser Testing (In Progress)
Manual browser testing of core workflows:
- [ ] Login & navigation
- [ ] Deal ranking & scoring (All Deals page)
- [ ] Buyer messaging flow
- [ ] Enrichment status display
- [ ] AI Command Center chatbot (help + action queries)
- [ ] Message Center (By Deal sorting)
- [ ] Remarketing universe management
- [ ] Error handling edge cases

### Phase 2: Gap Audit
Compare testing guide requirements against current codebase:
- [ ] Identify missing features referenced in guides
- [ ] Document UI/UX gaps
- [ ] Log bugs found during browser testing

### Phase 3: Automated Tests (Future)
- [ ] Edge function integration tests
- [ ] Component unit tests for critical flows
