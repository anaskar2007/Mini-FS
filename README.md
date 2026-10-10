# MiniFS

MiniFS is a browser-based **Operating Systems semester project** that simulates a hierarchical filesystem with contiguous, linked, and indexed block allocation on a virtual disk. It demonstrates core OS concepts — free-space management, fragmentation, and block allocation — through an interactive UI backed by Supabase authentication and persistence.

---

## Project Objectives

- Simulate a virtual disk (1,024 blocks × 1 KiB) with realistic block allocation behaviour.
- Implement and compare contiguous, linked, and indexed file allocation strategies.
- Demonstrate external and internal fragmentation interactively.
- Persist each user's unique filesystem state across page reloads using Supabase.
- Provide an educational reference for OS allocation concepts suitable for an undergraduate demo.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Lucide React |
| Auth & DB | Supabase (email/password auth, PostgreSQL, RLS) |
| Testing | Vitest |
| Hosting | Vercel (or any Node.js host) |

The filesystem engine (`lib/fs/`) is pure TypeScript with no browser or framework dependencies; it runs in Vitest, the server-side API route, and the client-side React provider.

---

## Architecture

```
app/
  (dashboard)/
    page.tsx          ← Overview: storage summary, recent files
    explorer/         ← File Explorer: CRUD, move, rename, search
    disk/             ← Disk Blocks: block grid inspector
    allocation/       ← Allocation Methods: comparison, fragmentation demo
  api/filesystem/
    route.ts          ← GET (load or seed) / PUT (save snapshot)
  login/ signup/      ← Auth pages

lib/fs/
  types.ts            ← All types: FileSystemState, DiskBlock, FileEntry …
  engine.ts           ← CRUD operations, move, copy, preview, invariant checks
  allocator.ts        ← Block allocation, deallocation, linked-chain traversal
  disk.ts             ← Virtual disk helpers, getDiskStats, freeRunLayout
  education.ts        ← internalFragmentationBytes, createExternalFragmentationDemo
  persistence.ts      ← serialize / restore (validates invariants before write)
  persistence-commit.ts ← commitPersistedOperation (rollback on DB failure)
  supabase-persistence.ts ← load / save via Supabase client
  seed.ts             ← Sample filesystem for new users (runs once per account)

supabase/migrations/
  20261009_phase3_filesystem.sql ← Tables, RLS policies, save_filesystem_snapshot()

components/
  fs/                 ← FileSystemProvider (shared state), FeedbackBanner
  disk/               ← DiskMap
  allocation/         ← AllocationPanel
  explorer/           ← ExplorerWorkspace
  layout/             ← AppShell, AppSidebar, PageHeader
```

### Data flow

1. On mount, `FileSystemProvider` calls `GET /api/filesystem`.
2. The API loads the user's snapshot from Supabase (or seeds a sample for new accounts).
3. All operations (`createFile`, `deleteFile`, `moveEntry`, etc.) run in the pure engine.
4. `commitPersistedOperation` calls `PUT /api/filesystem` before updating React state.
5. On failure the previous valid state is restored; a red error banner is shown.
6. Pages read live state from `useFileSystem()` — no page-specific fetches.

---

## OS Concepts Covered

| Concept | Where demonstrated |
|---|---|
| Contiguous allocation | Allocation Methods page — committed view, compare preview |
| Linked allocation | Allocation Methods page — chain visualization with next-pointers |
| Indexed allocation | Allocation Methods page — index block pointing to data blocks |
| External fragmentation | Fragmentation sandbox (isolated 8-block demo disk) |
| Internal fragmentation | Fragmentation sandbox + committed allocation stats |
| Free-space management | Disk Blocks page — block grid, utilization bar |
| Block allocation/deallocation | File Explorer create/delete + Disk Blocks inspector |
| Persistence & recovery | Supabase-backed snapshot with atomic SQL transaction |

---

## Supabase Setup

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com), create a new project, and note the **Project URL** and **Publishable key** from **Connect → App Frameworks**.

### 2. Run the migration

In the Supabase **SQL Editor**, paste and run the entire contents of:

```
supabase/migrations/20261009_phase3_filesystem.sql
supabase/migrations/20261009_phase6_binary_files.sql
supabase/migrations/20261010_phase7_account.sql
```

This creates three tables (`fs_directories`, `fs_files`, `fs_virtual_disks`), enables RLS on all three, creates the `save_filesystem_snapshot` stored function, and adds all policies.

### 3. Enable email/password authentication

In **Authentication → Providers → Email**, enable **Email/password**. For a college demo without an email server, disable **Confirm email** so sign-up works instantly.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

The publishable key is safe for browser use. **Never add a service-role key to this project.**

For password recovery, set `NEXT_PUBLIC_BASE_URL` to the deployed app origin. In Supabase Authentication URL settings, add `{your-origin}/auth/callback` (and `http://localhost:3000/auth/callback` for local development) to the allowed redirect URLs. The recovery email must use Supabase's standard confirmation URL so the callback can exchange its PKCE code and establish the reset session.

---

## Local Development

```bash
npm install
npm run dev      # starts Next.js with Turbopack on http://localhost:3000
```

Visit `/signup` to create your first account. The sample filesystem is seeded automatically on first login.

---

## Test Commands

```bash
npm run test     # Vitest — runs all unit tests (engine, allocator, disk helpers, education)
npm run lint     # ESLint
npm run build    # Production build + TypeScript type check
```

Run these commands against the current checkout before release; results depend on the checked out revision and configured environment.

---

## Deployment

### Vercel

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in **Project Settings → Environment Variables**.
4. Deploy. No additional build configuration is required.

### Other Node.js hosts

Run `npm run build` then `npm start`. The app requires a Node.js runtime (not edge-only) because the API routes use the Supabase server client with cookie handling.

---

## Five-Minute Mentor Demonstration

### Setup

- Two browser windows open to the running app, signed in as the same account.
- Allocation Methods page open in one tab, File Explorer in another.

### Steps

**1. Create a folder and a text file**

In File Explorer, click **Folder** → name it `Demo`. Open `Demo`, click **File** → name it `notes.txt`. In the editor panel, type several lines of text (enough for 2+ blocks — about 1 KiB) and click **Save**. A green banner confirms "File saved and blocks reallocated."

**2. Persist and reload**

Refresh the page. The `Demo` folder and `notes.txt` reappear exactly as left. This demonstrates Supabase-backed persistence: the `save_filesystem_snapshot` PostgreSQL function committed all tables in one transaction before the UI updated.

**3. Inspect disk blocks**

Open **Disk Blocks**. Click the block number corresponding to `notes.txt` (use the legend: sky-blue = data, violet = index). The detail panel shows owner, allocation method, position in file ("Data block 1 of 3"), and content preview. The utilization bar updates. Use the Highlight dropdown or click a block to light up all blocks belonging to the file.

**4. Compare allocation strategies**

Open **Allocation Methods**. Select `notes.txt` from the dropdown. The graphical view shows the committed allocation (chain arrows for linked, or index→data tree for indexed). Scroll to **Compare strategies**: the panel shows hypothetically how all three methods would allocate the same file size given current free space, with success/failure badges and exact block IDs.

**5. Demonstrate fragmentation**

Scroll to **Fragmentation sandbox**. The isolated 8-block demo disk has 4 free blocks in 2 separate runs of 2. A 3-block contiguous request fails; a linked request succeeds because linked allocation does not require a consecutive run. The internal fragmentation bar shows a 1-byte file in a 4-byte block with 3 bytes wasted.

**6. Delete a file and show released blocks**

Back in File Explorer, select `notes.txt` and click **Delete**. Return to Disk Blocks — the blocks that belonged to `notes.txt` are now grey (free). The utilization bar drops.

### Expected observations

| Action | Simulated | Persisted to Supabase |
|---|---|---|
| Block allocation | ✓ (engine) | ✓ (disk blocks column in fs_virtual_disks) |
| File content | ✓ (engine memory) | ✓ (content column in fs_files) |
| Fragmentation sandbox | ✓ (isolated demo state) | ✗ (never written to DB) |
| Preview comparison | ✓ (structuredClone of state) | ✗ (never written to DB) |

The **virtual disk is entirely simulated** — it does not map to any host disk or Supabase storage volume.

---

## Security Design

### Row-Level Security

All three tables have RLS enabled. Every policy uses `owner_id = auth.uid()`, so the Supabase Data API enforces user isolation without any application-level filtering.

`save_filesystem_snapshot` runs as `security definer` (bypasses RLS to write an atomic snapshot) but validates `auth.uid()` at the start and cross-checks every directory parent before inserting — no child may reference another user's directory.

### API routes

- `GET /api/filesystem` and `PUT /api/filesystem` call `supabase.auth.getClaims()` server-side; any unauthenticated request receives HTTP 401.
- The `PUT` route re-runs `restoreFileSystem(snapshot)` (validates invariants) before calling Supabase, so malformed payloads are rejected before they reach the database.
- The middleware (`proxy.ts`) refreshes the Supabase session on every request and redirects unauthenticated dashboard access to `/login`.

### Manual user-isolation test procedure

**Do not skip this before a live presentation.**

1. Open two separate browser sessions (e.g., normal window + private/incognito window).
2. In session A, sign up as `usera@test.local` and create a file named `secret.txt`.
3. In session B, sign up as `userb@test.local`.
4. In session B's browser, open DevTools → Network. Find the `GET /api/filesystem` response and note that only session B's files appear. `secret.txt` must not be visible.
5. In session B, use DevTools to craft a `PUT /api/filesystem` request with session A's snapshot JSON (copy it from session A's GET response). The server must respond with HTTP 400 or 401 — it will not overwrite session A's data because the JWT in session B's cookie belongs to user B.
6. In the Supabase Table Editor, filter `fs_files` by `owner_id` = user A's UUID. Only user A's rows should appear.

> **Claim**: RLS policies are correctly defined in the migration SQL. Live isolation against the actual Supabase project requires the manual test above; it has not been executed in this audit session.

---

## Persistence Failure Behaviour

`commitPersistedOperation` wraps every engine operation:

1. The engine runs and returns `{ ok: true, state: newState, value }`.
2. The adapter (`PUT /api/filesystem`) is called.
3. **On success**: React state is updated to `newState`. The UI reflects the committed change.
4. **On failure** (network error, Supabase RPC error, invariant violation): React state is rolled back to `previousState`. A red error banner appears with the error message. The UI shows the last valid persisted state — no silent data loss.

### Manual network-interruption test

1. Open DevTools → Network → check "Offline" (or throttle to "No internet").
2. In File Explorer, create a new file.
3. The green "File created" banner must **not** appear. A red error banner must appear instead (e.g., "Failed to fetch").
4. Refresh. The file must not exist — the state was correctly rolled back.

> **Claim**: `commitPersistedOperation` is structured to guarantee rollback. This specific manual test has not been executed in this audit session and requires a running Supabase environment.

---

## Known Limitations

- **Single index block per file.** Files requiring more data blocks than `⌊blockSizeBytes/4⌋ = 256` (at default block size) will fail with `INDEX_CAPACITY_EXCEEDED` under indexed allocation.
- **Virtual disk only.** The 1,024-block disk is simulated and persisted as filesystem state. It does not interact with any real storage volume.
- **No multi-user collaboration.** Each user's filesystem is fully isolated; there is no shared-namespace or file-sharing feature.
- **Binary file bytes live in Supabase Storage.** Filesystem metadata and simulated allocation are persisted separately; a file may remain stored even when its selected allocation method cannot fit it on the virtual disk.
- **Email confirmation.** If Supabase email confirmation is enabled and no email server is configured, sign-up will appear to succeed but login will fail. Disable confirmation for a college demo.
- **No pagination.** The Disk Blocks grid renders the configured 1,024 blocks simultaneously. Larger custom disks are not tested.
- **RLS live isolation not programmatically verified.** The manual test procedure above must be executed against the live Supabase project to confirm cross-user isolation.
