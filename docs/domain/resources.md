# Resource domain

Task 04 introduced the Resource domain's contracts and a Library Explorer
UI built against them, with no backend behind it — the frontend ran
entirely against a deterministic mock repository. Task 05B implemented the
real backend: a normalized Postgres schema, the full `/api/v1/resources`
CRUD surface, PostgreSQL full-text search, and object-level authorization
built on Task 05A's auth foundation. Task 05C.2 wired `apps/web`'s Library
Explorer to that real backend — `HttpResourceRepository` is now the active
implementation (see "Frontend integration" below); the mock repository
stays in the codebase, but exclusively for isolated tests and dev
scenarios, never as a production fallback.

This document now covers all three: the contracts (Task 04), the real
backend behind them (Task 05B), and the frontend integration that
connects the two (Task 05C.2). Task 05C.3 added the write side on top
of that: resource create/edit/delete UI, the `capabilities` contract
extension that makes per-resource authorization visible to the
frontend, and the `/courses`/`/groups` metadata endpoints the new forms
need — see "Resource management (writes)" near the end of this
document.

## Domain assumptions

- **A resource has exactly one `type`** (`BOOK` | `ARTICLE` | `VIDEO` |
  `EXERCISE` | `RECORDING` | `OTHER`), not a tag or category — it drives
  the icon, the `durationSeconds` requirement, and (eventually) how the
  resource is consumed.
- **`durationSeconds` is required for `VIDEO`/`RECORDING`, and absent
  for every other type** — not a loose optional number on every
  resource. Enforced structurally via a discriminated union
  (`ResourceDetailSchema`/`ResourceCreateInputSchema` in
  `packages/contracts/src/resource.ts`), not a runtime `if` check, so a
  malformed payload is rejected at the schema boundary.
- **`difficulty` is required on every resource**, including `OTHER` —
  the Library Explorer's difficulty filter needs every resource
  classified; there is no "unspecified" level.
- **Course associations are denormalized on reads, but plain ids on
  writes.** `ResourceDetailSchema`/`ResourceSummarySchema` carry
  `courses: { id, title }[]` so the UI can render course names without a
  second lookup; `ResourceCreateInputSchema`/`ResourceUpdateInputSchema`
  carry `courseIds: string[]` instead, since a client creating or
  updating a resource knows which courses by id, not their display
  titles. There is still no separate `/courses` endpoint (see "Scope
  decisions" below) — `CourseRef` remains a minimal value object in the
  contracts — but `Course` is now a real, normalized table on the
  backend (Task 05B), not just a frontend fixture; `courseIds` on a
  write are validated against it.
- **Visibility (`PUBLIC`/`RESTRICTED`) is enforced for real as of Task
  05B, and the Library Explorer depends on that enforcement as of Task
  05C.2.** `restrictedToGroupIds` is required (non-empty) whenever
  `visibility` is `RESTRICTED`, validated via a shared
  `requireGroupsWhenRestricted` refinement — and the backend actually
  gates access by it against real `Group`/`GroupMembership` rows (see
  "Authorization rules" below). The **frontend mock**
  (`mockResourceRepository`) still doesn't enforce it — `list()`
  continues to return `RESTRICTED` resources exactly like `PUBLIC` ones,
  with no notion of a caller to check against at all — but this is no
  longer a product-facing gap: the mock is not the active repository
  (see "Frontend integration" below), so nothing a real user sees ever
  goes through it. It remains correct and useful for what it's actually
  used for now — a backend-free contract-shape check and the data MSW's
  test handlers serve.
- **Publication metadata (`publishedAt`, `publisher`) is genuinely
  optional** — an in-house exercise or dataset has neither; a book has
  both.
- **Physical copies and loans are a separate, later domain**, explicitly
  out of scope here (per the Task 04 brief) — `Resource` has no copy
  count, shelf location, or loan-status field.

## Contracts (`packages/contracts/src/resource.ts`)

| Contract                            | Shape                                                               | Used for                                                                              |
| ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ResourceDetailSchema`              | Discriminated union on `type`, strict (`.strict()` on every branch) | The canonical single-resource representation; `GET /api/v1/resources/:id`             |
| `ResourceSummarySchema`             | Flat object, not discriminated                                      | List-view payload; `GET /api/v1/resources` items                                      |
| `ResourceListQuerySchema`           | Flat object with `.coerce` on numeric fields                        | Parsing `?search=&type=&...` query strings                                            |
| `ResourceSummaryListResponseSchema` | `createPaginatedResponseSchema(ResourceSummarySchema)`              | The paginated list envelope (`items`, `page`, `pageSize`, `totalItems`, `totalPages`) |
| `ResourceCreateInputSchema`         | Discriminated union, strict                                         | A future `POST /api/v1/resources` body                                                |
| `ResourceUpdateInputSchema`         | Flat, fully partial, strict                                         | A future `PATCH /api/v1/resources/:id` body                                           |

`ResourceSummarySchema` is deliberately **not** a discriminated union —
unlike `ResourceDetailSchema`/`ResourceCreateInputSchema`, which enforce
`durationSeconds` per-type strictly, the summary just carries it as a
nullable number. A list endpoint's job is cheap, forward-compatible
rendering, not write-time strictness; discriminating it too would add
ceremony for a payload nothing validates input against.

`ResourceUpdateInputSchema` is a flat, independently-declared partial
object rather than `ResourceWritableFields.partial()` — see the comment
above it in `resource.ts`: several writable fields carry `.default([])`,
and a default fires for an _omitted_ key exactly like it would for one
explicitly sent as `undefined`, which is precisely the key a PATCH body
needs to leave alone. Re-declaring the fields without defaults keeps
"omitted" meaning "unchanged."

## Implemented `/api/v1/resources` REST contract (Task 05B)

Built exactly to what the frontend's `HttpResourceRepository` (see below)
already assumed — this was a contract-conformance exercise for the read
endpoints, not a design one. `POST`/`PATCH`/`DELETE` were new surface
the contracts anticipated but nothing called at the time this was
written; Task 05C.3 is the real consumer — see "Resource management
(writes)" below.

- `GET /api/v1/resources?search=&type=&difficulty=&courseId=&tags=a,b&visibility=&sort=&page=&pageSize=`
  → `ResourceSummaryListResponseSchema`. `tags` is a single
  comma-separated query param (not repeated `tags=a&tags=b`), matching
  what `HttpResourceRepository.list` sends — split back into an array in
  `resources.routes.ts` before the Zod schema ever sees it. `visibility`
  is new in Task 05B (see "Contract changes" below). Optional auth: an
  anonymous caller sees only `PUBLIC` resources; an authenticated one
  also sees resources they own and resources `RESTRICTED` to a group
  they belong to; an `ADMIN` sees everything. `totalItems`/`totalPages`
  are computed **after** that filtering — never inflated by a resource
  the caller cannot see.
- `GET /api/v1/resources/:id` → `ResourceDetailSchema`, or `404` with the
  existing `ApiErrorResponseSchema` envelope if it doesn't exist **or**
  isn't visible to the caller — the same response either way, so a
  `RESTRICTED` resource's existence is never confirmed to someone who
  cannot see it (see "Authorization rules").
- `POST /api/v1/resources` (`ResourceCreateInputSchema` body, `LECTURER`/
  `ADMIN` only) → `201` + `ResourceDetailSchema`. The creating user
  becomes the owner; there is no field for this in the request body —
  the contract has no `ownerId`, and nothing in the request can set one.
- `PATCH /api/v1/resources/:id` (`ResourceUpdateInputSchema` body, owner
  or `ADMIN`) → `200` + `ResourceDetailSchema`. Omitted fields are left
  unchanged; an explicit `null` on a nullable field clears it. Validated
  against the **merged** result of applying the patch on top of the
  existing row, not just the patch body in isolation (see "Authorization
  rules").
- `DELETE /api/v1/resources/:id` (owner or `ADMIN`) → `204`, no body.

All four write/404 paths reuse the one `isResourceVisibleTo` rule from
`resource.policy.ts`: a resource that is not visible to the caller at
all (not found, or `RESTRICTED` with no path to it) always 404s, even
for a write attempt — only once a resource is confirmed visible does a
missing write permission become a `403`, not a `404`.

## Database schema (Task 05B)

```text
users ──< resources >── resource_tags ──< tags
  │           │                            (folksonomy — upserted on write)
  │           ├──< resource_courses ──< courses
  │           └──< resource_groups  ──< groups >── group_memberships >── users
  └──< group_memberships
```

- **`Resource`** — the normalized row behind `ResourceDetailSchema`.
  `creator: { name, affiliation }` is flattened to `creatorName`/
  `creatorAffiliation` columns (no separate Creator entity — a creator
  isn't a reusable, identity-bearing row the way a Course or Group is).
  `ownerId` (FK → `User`, `onDelete: Restrict`) backs authorization and
  is **never** serialized into the public DTO. `durationSeconds` is
  nullable at the column level (the per-type requirement is a
  discriminated-union rule in the contracts, not a column type), backed
  by a hand-written `CHECK` constraint as a third, DB-level layer of
  defense — see the `Resource` model's doc comment in `schema.prisma`.
- **`Course`**, **`Tag`** — `Course.title` and `Tag.name` are each a real
  `@unique` column. `ResourceCourse`/`ResourceTag` are the join tables
  (composite primary key, no separate `id` — the pair is the identity).
- **`Group`**, **`GroupMembership`**, **`ResourceGroup`** — did not exist
  before Task 05B; introduced because `restrictedToGroupIds` needed
  somewhere real to point for visibility to be enforceable at all (see
  "Authorization rules"). `GroupMembership` is the many-to-many between
  `User` and `Group`; `ResourceGroup` is the many-to-many between
  `Resource` and `Group` backing `restrictedToGroupIds`. Both cascade on
  either side deleting — unlike `Resource.ownerId`, membership has no
  meaning once either side is gone. There is no Group CRUD API; groups
  are managed only by `prisma/seed.ts` and direct database
  administration.
- **Full-text search** — `Resource.searchVector` is a Postgres
  `GENERATED ALWAYS AS (...) STORED` `tsvector` column (weighted: title
  > creator > publisher > description), with a GIN index. Declared in
  > `schema.prisma` only as an `Unsupported("tsvector")` field — Prisma has
  > no syntax for a generated column — so the generation expression and
  > index live solely in the migration SQL. `pg_trgm` is enabled for a
  > trigram GIN index on `Tag.name` (see "Search implementation" below).
- **Sharp edge, same family as Task 05A's `users_email_lower_key`
  index**: the `CHECK` constraint, the generated `searchVector` column
  and its GIN index, the `pg_trgm` extension, and `tags_name_trgm_idx`
  are **not** expressible in `schema.prisma`. A future `prisma migrate
dev` diffs the _declared_ schema against the database and may propose
  dropping or altering any of them as unrecognized drift — check any
  such diff against the migration SQL and the `Resource` model's doc
  comment before accepting it.

## Authorization rules (Task 05B)

Built on Task 05A's `modules/auth/policy.ts` (`hasRole`/`ownedBy`/
`anyOf`/`allOf`/`authorize`), extended in `modules/resources/resource.policy.ts`:

- **Who can create**: `LECTURER` or `ADMIN`. `STUDENT` cannot — checked
  directly, not left as an emergent consequence of ownership.
- **Who can modify (update/delete) a given resource**: `ADMIN`, always;
  a `LECTURER`, only one they own. Written as `ADMIN OR (LECTURER AND
owner)` rather than `ADMIN OR owner` so it stays correct even if
  ownership ever became reachable some other way later.
- **Who can view a given resource** (`isResourceVisibleTo`): `ADMIN`,
  always; anyone, if it's `PUBLIC`; its owner, always, even if
  `RESTRICTED`; otherwise only a member of one of its restricted groups.
  An anonymous (unauthenticated) caller is treated as strictly less
  privileged than any real user — only `PUBLIC` resources are visible.
- **Existence disclosure**: visibility is the gate for whether a
  resource's existence is ever confirmed, for _both_ reads and writes.
  Not visible → `404`, full stop, even for a `PATCH`/`DELETE` attempt.
  Visible but not editable → `403` (you can already see it; you're just
  not allowed to change it).
- **No leakage through list/search/pagination**: the visibility rule is
  baked into the `WHERE` clause of the list/search SQL query itself (see
  "Search implementation"), not filtered out of an already-fetched page
  in application code — so `totalItems`/`totalPages` are correct after
  authorization, never inflated by a resource the caller can't see.
- **Maintenance note**: the visibility rule exists in two places —
  `isResourceVisibleTo` (a JS predicate, used by the single-resource GET
  and by PATCH/DELETE's existence check) and `buildVisibilityCondition`
  in `resource.repository.ts` (the equivalent SQL fragment, used by
  list/search, which must filter and paginate at the database layer and
  so cannot just call the JS function). Both encode the _same_ rule;
  keeping them in sync is a real, acknowledged cost — see each
  function's doc comment, and `resources.routes.test.ts`'s "list and
  detail agree on visibility" test, which exists specifically to catch
  the two drifting apart.
- **Update validation runs against the merged result**, not the patch
  body alone — `ResourceUpdateInputSchema` is flat and has no visibility
  into the existing row, so it can catch `{ visibility: 'RESTRICTED' }`
  with no groups in the _same_ payload, but not a payload that only
  clears `restrictedToGroupIds` on a resource that is _already_
  `RESTRICTED` while omitting `visibility` entirely. `resource.service.ts`
  computes the effective type/duration and effective visibility/groups
  (patch field if present, else the existing value) and validates that
  merged state before writing.

## Search implementation (Task 05B)

Genuine server-side PostgreSQL full-text search, not the mock's simple
heuristic (see "Mock data and its limitations" below — that heuristic
was never meant to be a stand-in for this):

- **Ranking**: `ts_rank_cd` against the generated, weighted
  `searchVector` column (title > creator > publisher > description) —
  parsed with **`websearch_to_tsquery`**, not `to_tsquery`, specifically
  because it never throws on punctuation or malformed boolean-operator
  syntax, which is what "handle punctuation and unusual search terms
  safely" requires.
- **Tag matching**: tag names live in a separate join table, so they
  cannot be folded into the same `GENERATED` column (which can only
  reference columns on its own row). A search term instead also matches
  via a join against `resource_tags`/`tags`, using `pg_trgm`'s `%`
  similarity operator (backed by a trigram GIN index on `tags.name`) plus
  an `ILIKE` fallback for short substrings under the similarity
  threshold. A tag match contributes a **fixed relevance boost**, not a
  weighted `ts_rank` component — documented, not an oversight.
- **Combining with filters**: type/difficulty/visibility/courseId/tags
  filters are additional `AND`ed SQL conditions in the same `WHERE`
  clause as the search condition and the authorization predicate — one
  query, not a filter-after-fetch.
- **Case-insensitivity**: `to_tsquery`/`to_tsvector` normalize case
  internally; `ILIKE` is case-insensitive by construction. No separate
  handling needed.
- **No N+1, no injection**: every value is bound through `Prisma.sql`
  tagged templates (parameterized, never string-concatenated). A list
  request is exactly two raw queries (a count, then a page of ids — see
  `findVisibleResourcePage`'s doc comment for why not the `COUNT(*)
OVER()` single-query trick) plus one Prisma `findMany` to hydrate the
  page's relations — fixed at three queries regardless of page size.
- **Known limitation**: no typo-tolerant/fuzzy ranking on title or
  description beyond `websearch_to_tsquery`'s own light stemming —
  `pg_trgm` is used only for the tag-matching fallback described above.
  Also English-only (`to_tsvector('english', ...)`); a multi-language
  catalog would need a per-row language column and a dynamic
  `regconfig`, not attempted here.

## Development seed (Task 05B)

`prisma/seed.ts` (same script as Task 05A's accounts, extended) now also
seeds: two `Group`s (`CS Department Staff`, `Honors Cohort`) with
memberships drawn from the three seed accounts; five `Course`s; and
twelve `Resource`s spanning all six types, all three difficulties, both
visibilities (including one resource restricted to two groups at once),
and both owning roles (`LECTURER`, `ADMIN`) — enough variety to manually
exercise every authorization and filtering path. Idempotent and
repeatable like the rest of the seed: groups/courses are looked up by
their real unique column (`name`/`title`) and `upsert`ed; resources have
no natural unique key (titles are intentionally not DB-unique — see the
`Resource` model's doc comment), so they're found by title and updated in
place via the same `resource.repository.ts` functions a real request
would use, rather than a separate, parallel write path. Never runs with
`NODE_ENV=production`, same guard as Task 05A.

**`prisma/seedPublicDemo.ts`** (Task 08) is the production-safe sibling
for a public deployment — explicitly the opposite of the guard above:
it's meant to run with `NODE_ENV=production`, reuses this file's
PUBLIC-visibility course/resource/collection fixtures only (exported
from `seed.ts` for exactly that reason), creates exactly one `ADMIN`
account with a randomly generated (never documented/default) password,
and is a one-time initializer, not merely idempotent — see its own doc
comment and docs/deployment/free-hosting.md.

## Scope decisions and contract changes (Task 05B)

- **No separate `/courses` or `/tags` metadata endpoints.** The task
  brief conditioned these on "if required by existing frontend
  contracts" — nothing in `packages/contracts` or the frontend mock
  calls for one (`COURSES` is a frontend-only fixture array; the mock's
  tag list is derived from fixture data in-process), and frontend
  integration is out of scope for this task. Added only if/when a real
  consumer needs them. (Task 05C.3 became that consumer for courses and
  groups, once the frontend's fixture course ids turned out not to
  match real rows — see "Resource management (writes)" below. Tags
  still have no listing endpoint; their find-or-create semantics never
  needed one.)
- **Tag vs. Course/Group association semantics.** Course ids and group
  ids are validated against existing rows and rejected if unknown — both
  are curated, admin/seed-managed entities. Tags are different: there is
  no Tag-creation endpoint and the contract's `tags: string[]` has no
  "doesn't exist yet" case to reject, so a resource create/update
  find-or-creates each (trimmed, lowercased) tag name rather than
  requiring it to pre-exist. This is the one place Task 05B resolved a
  genuine contract ambiguity rather than one the contracts already
  specified — documented here per the task's instruction to call out and
  justify, not silently decide, this kind of thing.
- **`ResourceListQuerySchema` gained an optional `visibility` field.**
  Additive and optional — every pre-existing caller keeps working
  unchanged — and narrowing-only: a result is still intersected with
  whatever the caller is actually authorized to see, so this can only
  ever narrow a response, never widen it past that. Added because the
  task explicitly asks for a "visibility where authorized and supported"
  filter, which the Task 04 contract (written before any authorization
  model existed) had no field for.
- **`coverImageUrl`/`sourceUrl` now reject unsafe URL schemes
  (`javascript:`, `data:`, etc.), not just malformed syntax.** The
  frontend's own `isSafeHttpUrl` (`apps/web/src/shared/data/resources/url.ts`)
  already documented this exact gap in `z.string().url()` as a
  render-time-only guard against a contract that didn't promise safety.
  Closed at the contract layer with a shared `SafeHttpUrlSchema` refinement
  — a backward-compatible narrowing (anything previously valid _and_
  safe still passes) applied everywhere those two fields appear. The
  frontend guard is unchanged and still runs — defense-in-depth, not
  redundant, against any data that predates this check.
- **Pagination on an out-of-range page returns an empty, correctly-shaped
  page, rather than clamping like the mock does.** The mock's
  `page = Math.min(query.page, totalPages)` exists for a nicer SPA
  fallback; the real API echoes back the _requested_ page with `items: []`
  and correct `totalItems`/`totalPages` — the more predictable contract
  for a real API consumer, and what "correct empty results" in the task
  brief calls for. Not a contract shape change — `ResourceSummaryListResponseSchema`
  never pinned down which behavior was required here.

## Known limitations (Task 05B)

- No Group CRUD API — groups only come from the seed script or direct
  database administration (see "Database schema").
- ~~No `/courses`/`/tags` listing endpoints~~ — a minimal, read-only
  `/courses` endpoint was added in Task 05C.3 once a real consumer
  (the resource create/edit form's course picker) needed one; `/tags`
  remains deliberately absent (see "Resource management (writes)"
  below) — tags keep their find-or-create semantics with no
  enumeration API.
- Search is English-only and not typo-tolerant beyond the tag-matching
  trigram fallback (see "Search implementation").
- `isResourceVisibleTo` and `buildVisibilityCondition` encode the same
  authorization rule twice (JS and SQL) — a real, acknowledged
  maintenance cost; any change to the visibility rule must update both.
- No audit log of who created/edited/deleted a resource beyond the
  structured request logs every endpoint already gets.
- ~~`apps/web` is not wired to this backend~~ — resolved in Task 05C.2;
  see "Frontend integration" below.

## Frontend repository boundary (`apps/web/src/shared/data/resources/`)

```text
shared/data/resources/
├── ResourceRepository.ts       the interface: list(query, signal?), getById(id, signal?) — read-only
├── httpResourceRepository.ts   the active implementation — real fetch calls via the shared httpClient
├── mockResourceRepository.ts   kept for isolated tests/dev scenarios only — never the production default
├── resourceFixtures.ts         40 hand-authored sample resources + ALL_RESOURCE_TAGS
├── courses.ts                  8 fixture course references
├── mapFixtureToContract.ts     fixture record → ResourceSummary / ResourceDetail
├── url.ts                      isSafeHttpUrl — guards against unsafe sourceUrl schemes
└── index.ts                    exports `resourceRepository` — the one thing callers import
```

`ResourceRepository` only has `list`/`getById` — no `create`/`update`/
`delete` — because this task doesn't implement writes anywhere, mock or
real, and a repository method nothing calls is a method that lies about
scope. TanStack Query hooks
(`features/library/api/useResourceListQuery.ts` /
`useResourceDetailQuery.ts`) are the only things that call
`resourceRepository`; no component imports `mockResourceRepository` or
`httpResourceRepository` directly, so none of them need to know which
implementation is active. `resourceRepository` (`index.ts`) always
resolves to `new HttpResourceRepository()` — if the real API is
unreachable, that surfaces as a genuine query error (see "Error handling
and retry policy" below), never a silent fallback to fixture data.

## Mock data and its limitations

As of Task 05C.2, `mockResourceRepository` is no longer the production
default — it backs `mockResourceRepository.test.ts` (a fast,
backend-free contract-shape check) and the MSW network-level fixtures
`apps/web/src/test/mswHandlers.ts` exports (`resourceListHandler`/
`resourceDetailHandler`), which delegate to it so component/hook tests
exercise the real `HttpResourceRepository` → `fetch` → MSW path rather
than bypassing the network boundary entirely. Everything below still
describes its actual behavior, now in that narrower role:

- **40 fixtures, hand-authored, not generated.** Deterministic tests
  need a fixed data set — no `Math.random()`/`Date.now()` anywhere in
  `resourceFixtures.ts`. Titles, authors, and dates are invented but
  plausible; `sourceUrl` values point at `example.edu` placeholders, not
  live links.
- **Nothing is persisted.** `list()`/`getById()` read the same frozen
  `RESOURCE_FIXTURES` array every call; there is no create/update path
  to even attempt persistence against, mock or otherwise.
- **No real images.** Every fixture omits `coverImageUrl` — the Library
  Explorer's cards and detail page render entirely via
  `ResourceCoverPlaceholder` (a CSS gradient + the type's icon), so the
  app's visual correctness never depends on an external image actually
  loading. `ResourceCover` still implements and tests the real-`<img>` +
  `onError`-fallback path; it's just never exercised by fixture data
  today.
- **Search/relevance ranking is a simple heuristic**
  (title match > tag match > description match, see
  `mockResourceRepository.ts`'s `relevanceScore`), not a real search
  index — good enough to rank 40 fixtures sensibly, not a stand-in for
  what a real search backend would do.
- **Tag filtering is OR-within-the-facet, AND-across-facets**: selecting
  multiple tags widens the match (any selected tag), while combining a
  tag filter with, say, a type filter narrows it (both must hold). This
  is a product decision baked into the mock, which the real backend
  should replicate — not something the contracts themselves encode.

## Frontend integration (Task 05C.2)

The one-line switch the previous section anticipated is done —
`shared/data/resources/index.ts` now exports `resourceRepository = new
HttpResourceRepository()`. `HttpResourceRepository` goes through the
same shared `apiRequest` (`shared/api/httpClient.ts`) every other API
call in the app uses — same CSRF/credential handling, same
`ApiErrorResponseSchema`-based error parsing — rather than calling
`fetch` directly. Two real incompatibilities surfaced while wiring this
up, both fixed in the adapter rather than the backend:

- **`visibility` was missing from the querystring.** `ResourceListQuery`
  has had an optional `visibility` field since Task 05B, but the
  adapter's `buildListQueryString` never serialized it — a real gap,
  not a backend mismatch, now fixed.
- **Pagination clamping.** `mockResourceRepository` used to clamp an
  out-of-range page to the last valid one; the real backend always
  echoes the requested page with `items: []` (see "Scope decisions and
  contract changes" above). Per this task's instruction to resolve the
  difference consistently, the mock was changed to match the backend —
  it's the authoritative one now that it exists. `LibraryPage` itself
  self-corrects an out-of-range page in the URL (via a stale/shared
  link) to the last real page rather than rendering a momentarily
  misleading empty state.

### Query key strategy and auth-aware caching

`useResourceListQuery`/`useResourceDetailQuery`
(`features/library/api/`) key every query as
`['resources', 'list'|'detail', user?.id ?? 'anonymous', ...]` — the
signed-in user's id is part of the cache key itself, not an
afterthought. This is the primary defense against one identity's
(possibly `RESTRICTED`) cached results ever being shown to the next:
logging in, logging out, or switching accounts is always a _different_
cache entry, never a stale one reused across identities. The existing
`queryClient.clear()` on logout (Task 05C.1) remains as a secondary,
cache-growth-focused defense, not the primary correctness guarantee.
Both hooks also gate on `enabled: !isAuthLoading` (plus `Boolean(resourceId)`
for the detail query) so a query never fires once anonymously and
immediately refires under the real identity a moment later.

### Error handling and retry policy

`shared/api/retryPolicy.ts`'s `shouldRetryTransientFailure` is the one
retry policy both resource hooks and `useCurrentUser` share: never retry
an `ApiError` with `status < 500` (a deterministic client problem), retry
up to twice for anything else (a genuine network blip or `5xx`). This
only works because each `queryFn` already converts an _expected_
non-error outcome into real data before the policy ever sees it —
`HttpResourceRepository.getById` turns a `404` into `null` (both "does
not exist" and "exists but you can't see it" — `getResourceById` throws
the identical `AppError.notFound()` for both, by design, so the
frontend never has a way to distinguish them even if it wanted to), and
`fetchCurrentUser` turns a `401` into `null`. Fixing `useCurrentUser`'s
retry policy (it was a blanket `retry: false` from Task 05C.1) was a
real bug found under this task's "distinguish auth failure from
temporary backend unavailability" requirement: a transient `5xx` on
`/auth/me` would previously flip `isError: true` immediately, and
`RequireAuth` treats that identically to "confirmed logged out" —
incorrectly bouncing a validly-authenticated user to `/login`.
`features/library/resourceErrors.ts` maps an `ApiError`'s `code` to
user-facing copy for the list/detail pages, falling back to a generic
"check your connection" message for anything that isn't an `ApiError`
at all (a genuine network failure, not a structured backend response).

### Known limitations and findings (Task 05C.2)

- **The Library Explorer sits behind `RequireAuth`.** `/library` and
  `/library/:resourceId` are nested inside this app's authenticated
  product shell (`app/router/routes.tsx`, a Task 05C.1 decision) — an
  anonymous visitor is redirected to `/login` before ever reaching
  either page, even though the backend's own `GET /resources`/`GET
/resources/:id` are intentionally open (`optionalAuth`). This is a
  real split between the frontend route guard and the backend's
  authorization model, not a bug introduced here, and not something
  this task's scope ("no rewriting the app shell or authentication")
  permits changing — noted for whoever next revisits the shell.
- **AbortSignal propagation is now threaded end-to-end** (TanStack
  Query → `ResourceRepository` → `apiRequest` → `fetch`), but this
  couldn't be exercised through a real `fetch` call in this repo's
  Vitest/jsdom unit tests — Node 24+'s native `fetch` rejects a
  `signal` created via jsdom's `AbortController` polyfill, a tracked
  upstream incompatibility
  ([vitest-dev/vitest#8374](https://github.com/vitest-dev/vitest/issues/8374),
  fixed in Vitest 4, which this project isn't on). `test/setup.ts`
  strips `signal` from every `fetch` call after MSW installs its
  interceptor, specifically so this environment-only bug doesn't block
  every query-hook test — a dedicated test
  (`shared/data/resources/httpResourceRepository.test.ts`, "AbortSignal
  propagation") instead spies directly on `fetch` to confirm the
  signal _reaches_ it; real cancellation behavior was confirmed in a
  live browser instead (see the Task 05C.2 completion report).
- **Running the Playwright E2E suite against a real backend needs
  `CORS_ORIGIN` to include the preview server's origin.** `apps/api`'s
  `validateOrigin` middleware rejects any unsafe-method request whose
  `Origin` isn't in `CORS_ORIGIN` (default `http://localhost:5173`,
  the Vite dev server) — `vite preview` (what `playwright.config.ts`
  targets) serves on `4173`, a different origin, so every login in the
  existing `tests-e2e/auth.spec.ts` would 403 unless the API is started
  with `CORS_ORIGIN` widened to include it, e.g.:
  `CORS_ORIGIN="http://localhost:5173,http://localhost:4173"`. Also
  start the API with `NODE_ENV=test` for a real E2E run — `authRateLimiter`
  (`apps/api/src/middleware/rateLimit.ts`) is skipped only in that
  mode, and a handful of parallel Playwright workers each logging in
  independently exhausts the default 20-requests/15-minutes limit
  quickly otherwise. Neither of these is new backend behavior; they're
  undocumented prerequisites for running the existing E2E setup that
  this task's own verification pass needed and is recording here.

## Resource management (writes) (Task 05C.3)

`POST`/`PATCH`/`DELETE /api/v1/resources` were implemented and tested
in Task 05B but had no caller until now. This task adds the frontend
create/edit/delete UI against them, plus the small backend contract
and endpoint additions that UI genuinely needed.

### Authorization and the `capabilities` contract extension

The backend never exposes `ownerId` in any Resource DTO, and the
frontend must never infer ownership from `creatorName`, email, or
`displayName`. `ResourceDetailSchema` (not `ResourceSummarySchema`) now
carries a required `capabilities: { canEdit: boolean; canDelete:
boolean }` field, computed server-side by `resourceCapabilities()`
(`apps/api/src/modules/resources/resource.policy.ts`) from the
authenticated actor and the resource's real `ownerId` — reusing the
existing `canModifyResource` policy (`ADMIN`, always; `LECTURER`, only
if they own it; `STUDENT`, never) rather than introducing a new rule.
Both fields are always equal in this codebase, since edit and delete
share one authorization rule here; they're modeled as two independent
booleans anyway, since the contract makes no promise they'll always
agree, and a future divergence (e.g. a soft-delete permission distinct
from edit) shouldn't require a breaking contract change.

**The frontend capability check is a UX nicety, never the real
enforcement.** `EditResourcePage` reads `data.capabilities.canEdit` to
decide whether to render the form or an inline "You don't have access
to edit this resource" message; `ResourceDetailsPage` reads both fields
to decide whether to render the Edit/Delete buttons at all. In every
case, the actual authorization decision is made again, independently,
by the backend's own `PATCH`/`DELETE` handlers against the real
database row — a forged or stale `capabilities` value in a client
response can only ever hide or show a button, never grant or deny a
write that the backend wouldn't otherwise allow or deny on its own.

### `GET /api/v1/courses` and `GET /api/v1/groups`

Two new, minimal, read-only endpoints, both `requireAuth()` +
`requireRole('LECTURER', 'ADMIN')` (a `STUDENT` has no create/edit flow
that needs them), each returning an unpaginated array (`CourseRef[]` /
`GroupRef[]`, sorted by `title`/`name`) — these are small, curated,
seed/admin-managed sets, not something worth paginating. Added because
the frontend's pre-existing `COURSES` fixture
(`shared/data/resources/courses.ts`) used fake ids that don't exist in
the real database — confirmed by inspection, not assumed — so the new
course/group pickers needed a real source of truth. No Group or Course
CRUD was added; both remain seed/admin-managed only, per the brief's
"no overengineering backend metadata administration."

### `ResourceForm`: one shared component, its own intermediate schema

`apps/web/src/features/library/ResourceForm.tsx` is the single form
used by both `CreateResourcePage` (`/library/new`) and
`EditResourcePage` (`/library/:resourceId/edit`), mode-discriminated via
a `mode: 'create' | 'edit'` prop rather than being two separate
components. It does not bind directly to either `ResourceCreateInputSchema`
or `ResourceUpdateInputSchema` — those have incompatible shapes (a
strict discriminated union vs. a flat partial object) that fight React
Hook Form's `zodResolver` mid-edit, especially while the user is still
changing the resource type. Instead, `resourceFormSchema.ts` declares
an intermediate `ResourceFormValuesSchema` the form actually binds to,
with two explicit conversion functions at the submission boundary:

- `toCreateInput(values)` → `ResourceCreateInput`, for create.
- `buildUpdateInput(values, dirtyFields)` → `ResourceUpdateInput`, for
  edit — see "PATCH semantics" below.

Sections are rendered as separate cards — "Basic information" (type,
difficulty, title, description, and a conditional duration field),
"Creator & source" (creator name/affiliation, source URL, cover URL,
publisher, published date), "Organization" (course checkboxes, tag
input), "Visibility & access" (visibility radio group, conditional
restricted-group checkboxes) — and only ever render fields the
contracts actually support; no speculative fields were added. The form
adapts by `type`: the duration field appears only for `VIDEO`/`RECORDING`
(displayed and entered as whole minutes, converted to
`durationSeconds` at the submission boundary), and the restricted-group
picker appears only when `visibility` is `RESTRICTED`.

### PATCH semantics: dirty-field diffing, not a value diff

`ResourceUpdateInputSchema` distinguishes an **omitted** field ("leave
this alone") from an **explicit `null`** ("clear it") — a semantic Task
05B's own contract already specified.
`buildUpdateInput(values, dirtyFields)` reads React Hook Form's own
`dirtyFields` map (populated from real user interaction, not a
value-equality comparison against the initial values) to decide which
keys to include in the patch at all:

- Untouched field → omitted from the patch entirely.
- Touched, now empty/cleared optional field → sent as an explicit
  `null`.
- `type` or `durationMinutes` changing → `durationSeconds` is always
  resent as a pair with `type` (never one without the other), so the
  backend's own type/duration invariant check always sees a
  self-consistent patch.
- `visibility` changing → `restrictedToGroupIds` is always resent
  alongside it, for the same reason.

The edit form's submit button stays disabled until `isDirty` is true
(create mode has no such gate — there's nothing to be "unchanged"
relative to), which also prevents an accidental no-op submission.

### Resource deletion

`DeleteResourceDialog` (`features/library/components/`) is a focused
modal — built from the existing `Modal` + `Button variant="destructive"`
primitives, not a new dialog system — that names the resource by title,
states the action is permanent, and requires an explicit "Delete
resource" click; its own close handler is a no-op while a delete is
in flight, and the confirm button disables itself for the same reason,
so a slow network can't produce a second, duplicate `DELETE` request.
The cache only reflects the deletion after the server has confirmed it
(see "No optimistic updates" below) — there is no "looks deleted, then
silently reappears on refresh" failure mode, and an API failure leaves
the dialog open with an inline error rather than closing and pretending
success.

### TanStack Query mutation strategy

Three dedicated hooks (`features/library/api/`):
`useCreateResourceMutation`, `useUpdateResourceMutation`,
`useDeleteResourceMutation`. Each is intentionally thin — call the
repository, and on success call
`queryClient.invalidateQueries({ queryKey: ['resources'] })`. That
broad prefix invalidates every list and detail entry across every
cached identity (list/detail queries are already keyed per-user — see
"Query key strategy and auth-aware caching" above), which is simpler
and safer than hand-picking which specific entries a given write could
have affected, at the cost of some redundant refetching the UI never
notices. Toasts and server-side field-error mapping are the calling
page's responsibility (matching `useLoginMutation`/`useRegisterMutation`'s
existing convention), except `ResourceForm` itself, which reacts to a
`submitError` prop via a `useEffect` calling `applyServerFieldErrors`
(lifted from `features/auth/authErrors.ts`, since nothing about that
logic is auth-specific) — because only the form component holds the
`setError` from its own `useForm()` call.

**No optimistic updates for the delete mutation**, per the brief's
explicit instruction for destructive operations: the mutation's
`onSuccess` is the only place the cache changes, never an
`onMutate`-based optimistic write. Create and update don't attempt
optimistic updates either — both navigate to the freshly
created/updated resource's detail page on success, which needs the
server's actual response (including its real `id`) regardless.

### Form validation behavior

`ResourceFormValuesSchema`'s `.superRefine` enforces two cross-field
rules beyond the usual required/type checks: `durationMinutes` is
required (and must be positive) exactly when `type` is `VIDEO` or
`RECORDING`; `restrictedToGroupIds` must be non-empty exactly when
`visibility` is `RESTRICTED` — both mirroring the equivalent backend
refinements so a user sees the same rule enforced immediately, not just
after a round-trip. Course/group selection and tag entry have no
separate validation beyond "valid id from what the backend returned" —
there's no client-side notion of an invalid course or group id, since
the picker only ever offers ids the metadata endpoints actually
returned. A server-side field error (e.g. an id that became invalid
between page load and submission) is mapped back onto the matching
form field via `applyServerFieldErrors`, so a race between two tabs
shows up as a normal inline field error, not a generic failure.

### Known limitations (Task 05C.3)

- `capabilities` exists only on `ResourceDetailSchema`; a list-view row
  has no equivalent per-row management affordance beyond the admin
  "Manage Resources" page (which is `ADMIN`-only via its route guard,
  so it doesn't need a per-row capability check at all).
- No `/tags` listing endpoint — tag entry remains free-text
  find-or-create with locally-seen-tag suggestions only, not a backend
  enumeration.
- No Group/Course CRUD UI — both remain seed/admin-managed only; the
  new metadata endpoints are read-only.
- ~~`apps/api`'s own vitest integration suite shares the same
  `academy_library_test` database as Playwright/manual verification and
  has no final `afterAll` cleanup, so the last test executed in a given
  `pnpm --filter api test` run can leave its own rows behind in that
  shared database~~ — fixed in Task 05D: every DB-touching test file
  now resets again in its own `afterAll`, and Playwright E2E runs
  against a separate, dedicated `academy_library_e2e` database rather
  than sharing this one at all. See `docs/development.md` ("Test
  database lifecycle and isolation strategy") and
  `docs/architecture/decisions.md` for the full writeup.
