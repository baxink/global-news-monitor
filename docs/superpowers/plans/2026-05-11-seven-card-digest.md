# Seven-Card Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a seven-source daily digest where each configured Nature source gets one independently refreshable card, including empty placeholders and a new Nature Reviews Bioengineering source.

**Architecture:** Add a new `daily_digest_cards` table keyed by `digest_date + source_id`, move Worker selection and API responses to card-based payloads, and update the static frontend to render one card per source with per-card refresh. Keep the change centered in the current Worker entrypoint and existing docs frontend.

**Tech Stack:** Cloudflare Workers, D1 SQL, TypeScript, Node test runner, static HTML/CSS/JS

---

### Task 1: Add failing Worker tests for multi-card responses

**Files:**
- Modify: `worker/test/worker.test.mjs`
- Test: `worker/test/worker.test.mjs`

- [ ] Step 1: Write failing tests for ordered daily cards, refresh validation, and targeted refresh behavior.
- [ ] Step 2: Run `npm test` in `worker/` and confirm the new tests fail for the expected reasons.

### Task 2: Implement card-based digest storage and selection

**Files:**
- Modify: `db/schema.sql`
- Modify: `worker/src/index.ts`
- Modify: `shared/media-sources.json`
- Modify: `db/seed.sql`
- Test: `worker/test/worker.test.mjs`

- [ ] Step 1: Add the new source and the `daily_digest_cards` schema needed by the tests.
- [ ] Step 2: Replace single-digest selection/read/refresh logic with per-source card logic.
- [ ] Step 3: Re-run `npm test` in `worker/` and confirm all Worker tests pass.

### Task 3: Update frontend rendering for seven cards

**Files:**
- Modify: `docs/app.js`
- Modify: `docs/index.html`
- Modify: `docs/style.css`
- Modify: `README.md`

- [ ] Step 1: Update the frontend data handling to consume `cards[]` and send per-card refresh requests.
- [ ] Step 2: Adjust layout/copy/styles for seven cards and empty-card presentation.
- [ ] Step 3: Update README to describe seven-card daily generation and the new source.

### Task 4: Verify and integrate

**Files:**
- Verify only

- [ ] Step 1: Run `npm test` in `worker/`.
- [ ] Step 2: Review `git diff --stat` and spot-check changed files.
- [ ] Step 3: Commit the feature branch work.
- [ ] Step 4: Merge `feat/seven-card-digest` into `main`.
- [ ] Step 5: Push `main` to `origin`.
