# Nature Daily Frontpage Redesign

- Date: 2026-05-11
- Project: `nature-daily`
- Scope: `docs/index.html`, `docs/style.css`, `docs/app.js`

## Goal

Redesign the GitHub Pages frontend from a seven-card grid into a newspaper-inspired front page that borrows structural cues from outlets such as The New York Times and The Washington Post without copying either visual identity.

The redesign must preserve the current product model:

- one daily digest page
- seven fixed Nature-related sections
- one selected article per section
- per-section refresh via "换一篇"
- no backend or API contract changes

## Design Direction

The approved direction is a hybrid newspaper front page:

- keep the existing digest logic
- remove the current card-wall presentation
- promote `Nature main` to a fixed lead story position
- present the remaining six sections in newspaper-like columns
- avoid imagery entirely
- keep English content secondary to the Chinese reading flow

This should read like a compact science front page rather than a product landing page or a modern magazine grid.

## Information Architecture

The homepage will be reduced to two editorial layers.

### 1. Lead Story

`nature-main-rss` is always rendered as the lead story at the top of the page.

The lead story includes:

- section label
- Chinese headline
- Chinese summary
- English original title
- published date
- original article link
- refresh action

The lead story is the only area allowed to feel large and dominant. It should occupy the first meaningful reading position and establish the page hierarchy immediately.

### 2. Section Columns

The remaining six sections are rendered below the lead story as a column-based section deck.

These sections retain:

- section label
- Chinese headline
- shortened Chinese summary
- English title as secondary metadata
- original article link
- refresh action

They should read as newspaper columns, not independent cards. Their role is scanning and comparison, not immersion.

## Layout Rules

### Desktop

- top area: newspaper-style masthead with title and lightweight metadata
- below masthead: single lead story block
- below lead story: three-column section layout
- each column contains two section blocks

This preserves a clear top-to-bottom editorial flow while using the lower page for dense scanning.

### Tablet

- masthead remains full width
- lead story remains full width
- section layout drops to two columns

### Mobile

- all content becomes a single vertical flow
- lead story remains first and visually dominant
- section blocks stack one by one
- hierarchy must stay intact through type scale, rules, and spacing rather than card treatment

## Visual Language

The page should move away from product-hero and card-grid conventions.

Approved visual principles:

- warm off-white paper background
- dark neutral text
- thin rules and restrained separators
- little or no shadow
- minimal radius
- no image slots
- no gradient hero treatment
- no oversized CTA buttons

The hierarchy should come from:

- masthead scale
- lead headline scale
- serif or newspaper-leaning title treatment where appropriate
- section spacing
- column rhythm
- horizontal dividers

The page should feel more like a reading surface than an app dashboard.

## English Content Treatment

English text is secondary and should support attribution rather than compete with the Chinese editorial layer.

Rules:

- no broad use of drop caps
- no decorative drop caps in section columns
- English original titles should be visually reduced relative to Chinese headlines
- English titles may use a serif or small-caps-like treatment in the lead story if the implementation stays restrained

Optional refinement:

- a single, subtle drop-cap treatment may be applied to the first paragraph of the lead Chinese summary on desktop only
- this is optional, not required
- if implemented, it must be modest and aligned tightly to the text block

## Interaction Rules

### Original Link

- lead story may use a more explicit article action
- section columns should prefer lighter text-link treatment over large filled buttons

### Refresh

- every section keeps its own `换一篇` control
- refreshing one section must only update that section
- refreshing the lead story must only update the lead story

The behavioral model remains identical to the current experience even though the layout changes.

## Rendering Plan

The frontend rendering should move from a single repeated card template to role-based rendering.

Required rendering split:

1. normalize payload as today
2. extract `nature-main-rss` as the lead item
3. render the lead item with a dedicated lead template
4. render the remaining six items with a section-column template

No backend changes are required. The existing `/api/daily`, `/api/meta`, and `/api/daily/refresh` endpoints remain unchanged.

## Empty States

The redesign must preserve layout stability when content is missing.

- if the lead section has no article, the lead area remains visible with a clear empty-state message
- if any of the six section items are empty, their positions remain reserved in the column layout
- empty states should be quiet and typographic, not alert-like

## Accessibility And Robustness

- keep semantic headings and article structure
- preserve keyboard-accessible links and buttons
- ensure text remains readable at narrow widths
- avoid layout shifts from variable content length
- ensure refresh states remain obvious while a request is in flight

## Files Expected To Change

- `docs/index.html`
- `docs/style.css`
- `docs/app.js`

No worker, database, or API files are expected to change for this redesign.

## Verification Expectations

Implementation should be verified by:

- loading the static frontend locally
- checking desktop and mobile layouts
- confirming the lead story is always sourced from `nature-main-rss`
- confirming refresh still works per section
- confirming empty-state rendering still preserves the page structure

## Out Of Scope

- backend selection logic changes
- automatic prioritization beyond fixed lead placement
- article images or thumbnails
- new editorial categories
- changes to D1 schema or worker routes
