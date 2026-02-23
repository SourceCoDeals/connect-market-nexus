# SourceCo AI Chatbot: Comprehensive Testing Guide

## Testing Both Question-Answering and Task Execution

### Welcome to AI Agent Testing

You're testing a conversational AI agent that does two things:
1. **Answer questions** about the platform (help mode)
2. **Execute tasks** by manipulating the platform (action mode)

This guide tests BOTH modes extensively, including edge cases where things break, misunderstand, or fail gracefully.

---

## PART 1: QUESTION-ANSWERING MODE (Help Mode)

The chatbot answers questions using RAG (Retrieval Augmented Generation) — it searches the knowledge base and answers using that context.

### 1.1 Simple "How-To" Questions

**What you're testing:** Can the bot answer basic questions about platform features?

**Main path:**
- Ask: "How do I create a new deal?"
- Bot searches knowledge base for "create deal"
- Bot returns step-by-step instructions
- Bot cites the knowledge article it used
- Bot offers follow-up options

**Edge cases to try:**
- Ask a question that has NO knowledge article ("How do I export deals as a CSV?")
- Ask a question that has MULTIPLE matching articles ("How do I message a buyer?")
- Ask a vague question ("How do I use the platform?")
- Ask a question about a feature that doesn't exist ("How do I integrate with Hubspot?")
- Ask same question twice in row
- Ask a follow-up question

### 1.2 "Why" and "Troubleshooting" Questions

**What you're testing:** Can the bot explain logic and solve problems?

**Main path:**
- Ask: "Why can't I message this buyer?"
- Bot suggests possible reasons
- Bot guides user to solution

**Edge cases to try:**
- Ask "Why" about something working as designed
- Ask "Why" without full context ("Why is this deal ranked #45?")
- Ask a "Why" question but you're actually wrong about the problem
- Bot doesn't know the answer

### 1.3 Questions About Current Context

**What you're testing:** Does the bot understand what page you're on?

**Main path:**
- You're on the "All Deals" page, filtered to "Top 10"
- Ask: "What deals am I looking at?"
- Bot knows your current context

**Edge cases to try:**
- Ask about something on current page
- Ask about context when no context exists
- Ask about context from page you LEFT
- Rapid context changes

### 1.4 Questions Requiring Multiple Knowledge Sources

**What you're testing:** Can the bot synthesize answers from multiple articles?

**Edge cases to try:**
- Question that requires contradicting articles
- Question that requires recent + old knowledge
- Ask for a complex multi-step workflow

### 1.5 Questions About System Logic

**What you're testing:** Can the bot explain system logic?

**Edge cases to try:**
- Technical question about undocumented internals
- Partially implemented feature
- Features we've removed
- Comparing two features

---

## PART 2: TASK EXECUTION MODE (Action Mode)

### Category A: Content Creation

#### 2.1 Create Content From Sources
- "Create a LinkedIn post about [topic] using [sources]"
- Test missing parameters, non-existent sources, no data matches, duplicates

#### 2.2 Create Content From Template
- "Create a LinkedIn post using the [template name]"
- Test non-existent templates, deprecated templates, missing variables

#### 2.3 Repurpose Existing Content
- "Turn [content] into a [format]"
- Test ambiguous references, information loss, draft content

### Category B: Search & Analysis

#### 2.4 Search Sources
- "Search [source] for [query]"
- Test zero results, too many results, typos, date ranges, boolean logic

#### 2.5 Extract Insights From Fireflies
- "What did we learn from recent calls about [topic]"
- Test no matches, weak insights, contradictory insights, long transcripts

#### 2.6 Analyze Performance
- "How is [content type] performing"
- Test no data, incomplete data, temporal analysis, comparisons

### Category C: Content Management

#### 2.7 Move Content to Queue
- "Move [content] to [queue]"
- Test ambiguous references, full queues, already in queue, bulk moves

#### 2.8 Schedule Content
- "Schedule [content] for [date]"
- Test ambiguous dates, past dates, full slots, timezone issues

#### 2.9 Bulk Operations
- "Move all [query] to [queue]"
- Test zero results, too many items, partial failures

### Category D: Administrative

#### 2.10 Knowledge Base Management
- "Add to knowledge base: [topic]"
- Test non-admin access, duplicates, deprecation

#### 2.11 Settings & Configuration
- "Change my default queue to [queue]"
- Test permission boundaries, invalid values, conflicting settings

---

## PART 3: CONVERSATION CONTEXT & MULTI-TURN WORKFLOWS

### 3.1 Maintaining Context
- Test long conversations (20+ messages)
- Ambiguous "it"/"that" references
- Topic switching
- Self-corrections

### 3.2 Multi-Step Workflows
- Test step failures partway through
- User modifications mid-workflow
- Implicit parameters
- Conflicting actions

---

## PART 4: PERMISSIONS & GOVERNANCE

### 4.1 Permission Checking
- Test partial permissions, cross-workspace access

### 4.2 Confirmation & Safety
- Test bulk deletes, confirmation timeouts, state changes during confirmation

### 4.3 Audit Logging
- Test failed action logging, bulk operation logs

---

## PART 5: ERROR HANDLING & RECOVERY

### 5.1 API/System Errors
- Test API down, rate limiting, data corruption, timeouts

### 5.2 Parsing Errors
- Test ambiguity, synonyms, typos, help vs action confusion

### 5.3 Hallucination & Fabrication
- Test feature existence, future features, stat fabrication

---

## PART 6: EDGE CASES & STRESS TESTING

### 6.1 Rapid Requests (10 messages in 5 seconds)
### 6.2 Large Data Operations (1000+ results)
### 6.3 Session & State Management (timeouts, multiple windows)

---

## BUG REPORT FORMAT

```
ISSUE TITLE: [Short description]
MODE: [ ] Help Question [ ] Task Execution
CONTEXT:
- User role: [User/Admin/Manager]
- Conversation length: [3 messages / 15 messages / etc]
USER MESSAGE: [Exact message]
EXPECTED BEHAVIOR: [What should have happened]
ACTUAL BEHAVIOR: [What actually happened]
SEVERITY: [ ] Critical [ ] High [ ] Medium [ ] Low
REPRODUCIBILITY: One-off or consistent?
```
