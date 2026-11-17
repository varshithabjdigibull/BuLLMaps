# BuLLMaps - Marketing Agent UI

Three-pane marketing-agent interface (React + Vite + TypeScript + Refine), built from the
BuLLMaps master document: a Router / Concierge at the front and ten execution skills behind
it, each running the same four-phase loop with the shared 16 stages (four per phase).

Cloned from ParvithaCGowda29/RFQ_automation and reworked per the approved BuLLMaps wireframes.

- Look and feel kept from the original BAM_UI-style app (tokens, Inter type, flat surfaces)
- Left rail: the agent - a pinned Router / Concierge card on top, the ten marketing skills below
  (Audit & Strategy, Website, SEO, Content & Creatives, Paid Ads, Social Media, Brand, MQL, CRM,
  Reports & Publishing), each with its agency role
- Skill expansion is the four-phase accordion from the master doc: 1 Understand, 2 Decide &
  approve, 3 Produce & refine, 4 Deliver & learn - each phase lists its four stages
- The 16 stages are the owner's 4 Nov 2026 list, verbatim (see src/data.ts)
- Approval gates, per the doc: every skill pauses at Phase 2 (Review & Approve - the plan gate)
  and at Phase 4 (Release & Deliver - the go-live gate). The gates live in the Router chat;
  a rejected plan loops back to Phase 2 for revision. Bull glyph marks automated stages, person
  icon marks the owner's gates
- Centre pane: the Router / Concierge chat (mic dictation, suggested questions - same approach
  as the original assistant pane)
- Right pane: stage-by-stage output per phase; audit scorecard uses ag-grid and the draft-post
  card uses the TipTap editor (same libraries as the original build)
- Add files = the client's own material (documents, brand kit, templates): Uppy pickers, real
  file names, simulated intake scan - nothing is uploaded anywhere (no backend)
- Run history with an end-to-end trace per run, stored in the browser only

The Refine data provider is a local read-only mock (src/provider.ts); write
operations are rejected. Swap it for the real API provider when the backend lands.

## Run

```
npm install
npm run dev
```

Open the printed URL, sign in (demo), add the client material with Add files, then click
Start in the Output panel: the mock engagement walks all ten skills, pausing at each skill's
two approval gates - approve in the chat to continue. Nothing leaves the browser; every run
is mock data.

Demo states for screenshots: `?demo=running|plan|release|final`, `?uploaded`, `?mini`, `?theme=dark`.
