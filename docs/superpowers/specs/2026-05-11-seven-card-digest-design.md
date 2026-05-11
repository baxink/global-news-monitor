# Seven-Card Daily Digest Design

## Goal

Change `nature-daily` from "pick one article out of six sources each day" to "pick one article per configured source each day", with one independently refreshable card per source. Add `Nature Reviews Bioengineering` as a seventh source.

## Current State

- Worker ingests all configured sources but only writes one row into `daily_digest`.
- `daily_digest.digest_date` is the primary key, so the database can only store one card per day.
- `/api/daily` returns a single article payload and the frontend renders one card.
- `/api/daily/refresh` replaces the whole day’s digest, not a single section.

## Chosen Approach

Introduce a new table, `daily_digest_cards`, keyed by `(digest_date, source_id)`. Each row represents one source card for that day and can either contain a selected article or an empty placeholder.

This keeps the behavior explicit:

- one day has N cards
- one source owns exactly one card per day
- empty cards are first-class rows
- refresh only touches one `(digest_date, source_id)` row

## Data Model

### `daily_digest_cards`

- `digest_date TEXT NOT NULL`
- `source_id TEXT NOT NULL`
- `section TEXT NOT NULL`
- `article_id TEXT`
- `title_en TEXT`
- `title_zh TEXT`
- `summary_en TEXT`
- `summary_zh TEXT`
- `url TEXT`
- `image_url TEXT`
- `published_at TEXT`
- `selected_at TEXT NOT NULL`
- `is_empty INTEGER NOT NULL DEFAULT 0`
- primary key: `(digest_date, source_id)`

`daily_digest` remains untouched in this change set only to avoid destructive migration pressure, but all new reads and writes move to `daily_digest_cards`.

## Worker Behavior

### Ingest

- Load enabled sources in priority order.
- Fetch and upsert articles for every source, including the new `Nature Reviews Bioengineering` RSS feed.
- For each source:
  - choose one candidate from that source only
  - avoid recently selected article IDs from the same source when possible
  - if no candidate exists, write an empty card row
- `/api/ingest` and cron both generate the full set of daily cards.

### Daily Read

- `/api/daily` returns an object with:
  - `digestDate`
  - `cards: [...]`
- Cards are always returned in configured source priority order.
- Missing rows are normalized to empty cards in the response so the frontend always receives seven cards.

### Single-Card Refresh

- `/api/daily/refresh` accepts `POST` JSON `{ "sourceId": "..." }`.
- It refreshes only that source’s card for today.
- If the source still has no selectable article, it preserves an empty card and returns it.

## Frontend

- Replace the single digest card with a grid/list of source cards.
- Each card shows:
  - section badge
  - source name
  - article content if available
  - or `今日暂无内容` if empty
- Each card gets its own `换一篇` button.
- The page-level meta text should still show configured source count and digest issue count.

## Error Handling

- Unknown `sourceId` on refresh returns `404`.
- Missing `sourceId` or invalid JSON returns `400`.
- Empty-card refresh failures return a stable empty card payload instead of deleting the slot.

## Testing

- Worker tests cover:
  - `/api/daily` returns ordered cards plus empty placeholders
  - `/api/daily/refresh` validates `sourceId`
  - `/api/daily/refresh` replaces only the targeted source card
  - existing CORS behavior remains intact
- Frontend behavior is verified through the rendered HTML structure and a full worker test run.
