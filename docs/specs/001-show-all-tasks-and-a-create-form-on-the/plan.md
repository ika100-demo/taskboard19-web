---
spec_id: 001-show-all-tasks-and-a-create-form-on-the
shape: web-nextjs
spec_hash: 297c09abddde
summary: Home page lists all tasks from the Task API and creates tasks through a server action
tasks:
  - id: t1
    title: Add the server-side Task API client
    files: [lib/task-api.ts, docs/env-vars.md]
    covers: [AC-001.1, AC-001.3, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: []
    done: true
  - id: t2
    title: Add shared title validation and UI messages
    files: [lib/task-validation.ts]
    covers: [AC-001.4]
    parallel_safe: true
    depends_on: []
    done: true
  - id: t3
    title: Add the createTaskAction server action
    files: [app/actions.ts]
    covers: [AC-001.3, AC-001.4, AC-001.6]
    parallel_safe: true
    depends_on: [t1, t2]
    done: true
  - id: t4
    title: Add the TaskBoard client component (list, states, create form)
    files: [app/_components/task-board.tsx]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: [t1, t2, t3]
    done: true
  - id: t5
    title: Replace the landing page with the task board and add smoke checks
    files: [app/page.tsx, app/globals.css, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts]
    covers: [AC-001.1, AC-001.2, AC-001.5]
    parallel_safe: true
    depends_on: [t1, t4]
---

# Plan — 001 Show all tasks and a create form on the home page

Contract and module signatures: [design.md](design.md). Levels: t1, t2 → t3 → t4 → t5.

## t1 — Add the server-side Task API client

**Files:** lib/task-api.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.3, AC-001.5, AC-001.6
**Goal:** one module that performs `GET /tasks` and `POST /tasks` against `TASK_API_URL` with a 5 s timeout and no retry, and turns every answer that is not the contract's success into a `TaskApiError`.

**Implementation notes:**
- Exports exactly as in design.md: `Task`, `TASK_API_TIMEOUT_MS`, `TaskApiFailure`, `TaskApiError`, `isTask`, `listTasks`, `createTask`.
- Read `process.env.TASK_API_URL` inside each call (not at module load), strip a trailing `/`; unset/empty → `TaskApiError("unconfigured")` without calling `fetch`.
- `fetch` options per design.md (`cache: "no-store"`, `AbortSignal.timeout(TASK_API_TIMEOUT_MS)`); map `TimeoutError`/`AbortError` to `timeout`, other rejections to `network`.
- `listTasks`: only `200` + array of valid tasks resolves; order untouched. `createTask`: only `201` + valid task resolves; always send both `title` (unchanged) and `due_date`.
- `logger.warn("task api request failed", { op, reason, status })` on each failure; never log the title.
- Add `import "server-only"` only if the package is already available; otherwise rely on the module never being imported from a client component (do not add a dependency).
- `docs/env-vars.md`: new "Task API" section with `TASK_API_URL` (no default; server-side only; cluster value `http://taskboard19-api`; unset means the page shows the load error).

**Done when:** the acceptance tests for the client behaviour behind AC-001.5 and AC-001.6 (timeout, non-2xx, bad body, network error) that target `lib/task-api.ts` pass, and `devbox run quality` is clean.

## t2 — Add shared title validation and UI messages

**Files:** lib/task-validation.ts
**Covers:** AC-001.4
**Goal:** the pure title rule and the five UI message constants, importable from server and client code.

**Implementation notes:**
- `validateTitle(title)`: `MSG_TITLE_INVALID` when `title.trim() === ""` or `[...title].length > 200`, else `null`. 200 code points is valid, 201 is not.
- Export `MSG_NO_TASKS`, `MSG_NO_DUE_DATE`, `MSG_TITLE_INVALID`, `MSG_LOAD_FAILED`, `MSG_SAVE_FAILED` with the exact strings in design.md.
- No imports from `lib/task-api.ts` or Node APIs (it is bundled for the browser).

**Done when:** acceptance tests on `validateTitle` for AC-001.4 pass.

## t3 — Add the createTaskAction server action

**Files:** app/actions.ts
**Covers:** AC-001.3, AC-001.4, AC-001.6
**Goal:** the server-side entry for the create form, returning a result object and never throwing.

**Implementation notes:**
- File starts with `"use server"`; exports `CreateTaskResult` and `createTaskAction(input)` per design.md.
- Invalid title → `{ ok: false, error: MSG_TITLE_INVALID }` and `createTask` is not called.
- Normalise `due_date: ""` to `null`; call `createTask` once; success → `{ ok: true, task }`; any thrown error → `{ ok: false, error: MSG_SAVE_FAILED }`.

**Done when:** the acceptance tests for AC-001.3 (request body `{"title": "Buy milk", "due_date": ...}`), AC-001.4 (no request on an invalid title) and AC-001.6 (save error on non-201, timeout, network error) that target the action pass.

## t4 — Add the TaskBoard client component (list, states, create form)

**Files:** app/_components/task-board.tsx
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6
**Goal:** the interactive part of the home page: the list or its empty/error state, and the create form with its two error messages.

**Implementation notes:**
- `"use client"`; `export function TaskBoard({ initialTasks }: { initialTasks: Task[] | null })`; import `Task` as a type only from `@/lib/task-api`.
- Markup, roles, labels and texts exactly as in design.md ("Title", "Due date", "Add task", `aria-label="Tasks"` list, `role="alert"` messages, `<time dateTime>` for due dates shown as received).
- Controlled inputs (`useState`) for title and due date; `noValidate` form; no `required`/`maxLength`.
- Submit: `validateTitle` first; invalid → title error, values kept, no action call. Valid → `startTransition(async () => createTaskAction(...))`, button disabled while pending.
- `ok` → append `result.task`, clear inputs and errors; `!ok` → show the error in its slot, keep values, append nothing.
- Load-error state keeps the form usable; a successful create there clears the form and leaves the load error.

**Done when:** the component-level acceptance tests for AC-001.1 to AC-001.6 (rendering `TaskBoard` with `@/app/actions` mocked) pass.

## t5 — Replace the landing page with the task board and add smoke checks

**Files:** app/page.tsx, app/globals.css, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts
**Covers:** AC-001.1, AC-001.2, AC-001.5
**Goal:** the home page renders at request time from the Task API and the template's landing content is gone.

**Implementation notes:**
- `app/page.tsx`: `export const dynamic = "force-dynamic"`; async Server Component; `<h1>Tasks</h1>`, then `listTasks()` → `<TaskBoard initialTasks={tasks} />`, any error → `<TaskBoard initialTasks={null} />`.
- Delete `app/_components/feature-card.tsx` and `app/_components/icons.tsx` (only the landing page used them; dead files count against the `app/**` coverage gate).
- `app/globals.css`: drop the landing-only rules (`.hero`, `.eyebrow`, `.grid`, `.steps`, feature card styles) and add styles for the task list, form and messages using the existing design tokens; keep the 375 px no-horizontal-scroll behaviour.
- `tests/page.test.tsx` (template test of the removed landing page): rewrite to the new page with `@/lib/task-api` mocked (single `h1` "Tasks", list on success, `MSG_LOAD_FAILED` on throw), or delete it if the acceptance tests already cover the page; it must not assert the old landing content.
- `e2e/home.spec.ts`: the `h1` is now "Tasks"; the health check uses the header's "Health" link (the "Check health" button is gone); landmarks, 404 and phone-width tests stay. Locally `TASK_API_URL` is unset, so the page shows the load error and the form.
- `e2e/smoke.spec.ts`: keep the read-only "root page loads" test (asserts the "Tasks" `h1` and the "Create task" form); add `test("creating a task shows it in the list @smoke @writes", ...)` that fills title `smoke-<crypto.randomUUID()>`, submits, and expects a list item with that title and "No due date", without reloading.

**Done when:** the page-level acceptance tests for AC-001.1, AC-001.2 and AC-001.5 pass, and `devbox run ci` (quality, coverage gate, security) is green.
