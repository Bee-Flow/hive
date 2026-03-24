# Product Page Feature Simulations — Implementation Plan

Each product page currently has only static info cards. We'll add a **visible, auto-playing animated UI simulation** at the top of each of the 4 target pages. Demos auto-play in a loop and look like the real product.

---

## 4 New Demo Components

### 1. `MeetingNotesDemo.jsx`
Animated 3-phase loop (~12s):
- **Phase 1 — Upload**: File drop zone, `Q3_Planning_Meeting.mp3`, 42 min
- **Phase 2 — Processing**: Waveform animation + `Transcribing with WhisperX... 68%`
- **Phase 3 — Results**: Split panel:
  - Left: labelled speaker transcript (`[00:01] Tom: Let's start with Q3 goals...`)
  - Right: AI Summary + 3 action items extracted

### 2. `NotebooksDemo.jsx`
Animated 3-panel loop (~12s):
- **Sources panel**: PDF, URL, Meeting Notes added one-by-one
- **Editor panel**: AI writes a report word-by-word, fills `{{company_name}}`
- **Studio panel**: generation checklist ticks off (Summary ✓, Podcast ✓, Flashcards...)

### 3. `ChatDemo.jsx`
Animated conversational chat loop (~14s):
- Agent header: "HR Assistant • connected to Employee Handbook"
- **User message** types in character-by-character
- Typing indicator → AI response streams word-by-word with source citation
- Second user turn → AI produces email draft

### 4. `WebSearchDemo.jsx`
Animated 5-step pipeline loop (~14s):
- User query types in
- Pipeline steps light up one-by-one with results:
  1. 🔍 Query expansion (3 variants)
  2. 🌐 Searching Bing (8 results)
  3. 📄 Fetching pages (3 URLs)
  4. 🤖 Qwen3.5-2B cleanup
  5. 🏆 Cross-encoder reranking (score bars)
- Answer streams in with 3 source citations

---

## Files to Modify

| File | Change |
|------|--------|
| `MeetingNotesSection.jsx` | Add `<MeetingNotesDemo />` at top |
| `NotebooksSection.jsx` | Add `<NotebooksDemo />` at top |
| `SearchEngineSection.jsx` | Add `<WebSearchDemo />` at top |
| `HomePage.jsx` | Add new `ChatPage` export with `<ChatDemo />`, import all demos |

---

## Visual Design
- White card, `rgba(0,0,0,0.07)` border, `14px` radius — matches existing design system
- Golden `#f59e0b` accent for streaming cursor, active steps
- Monospace font for transcripts / code
- Pure CSS `@keyframes` — zero new dependencies
- `max-width: 840px`, centered, stacks to 1 column on mobile
- "● Live Demo" pill in top-right corner

---

## Verification
1. `npm run dev` in `/home/tom/Documents/VS Projects/react_flow/agent-hub`
2. Nav > Products > **Meeting Notes** — animation plays and loops ✓
3. Nav > Products > **AI Notebooks** — animation plays and loops ✓
4. Nav > Products > **Search Engine** — animation plays and loops ✓
5. Nav > Products > **Chat** (new page) — animation plays and loops ✓
6. No console errors
7. Responsive at mobile width (< 640px)
