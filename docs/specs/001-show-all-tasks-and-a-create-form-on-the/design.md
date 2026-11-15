# Design — 001 Show all tasks and a create form on the home page

## Decisions

- The browser never talks to the Task API. `app/page.tsx` (a Server Component, `dynamic = "force-dynamic"`) reads the list at request time (AC-001.1); a Server Action `createTaskAction` performs the create. No route handler, no CORS, no `NEXT_PUBLIC_` variable. This follows the spec's "Notes for this repo"; it is the system plan's decision, so no repo ADR.
- One server-only HTTP client `lib/task-api.ts` holds every call to the Task API, the 5 s timeout (`AbortSignal.timeout`, no retry) and the response-shape check, so the page and the action share one definition of "a valid answer" (AC-001.5, AC-001.6).
- Title validation lives in `lib/task-validation.ts`, pure and importable from client and server. The client checks before calling the action, so no request leaves the browser for an invalid title; the action checks again and never calls the API for an invalid title (AC-001.4).
- The form uses controlled inputs held in the client component's state. React 19 resets uncontrolled form fields after an action; controlled state keeps the entered values on errors (AC-001.4, AC-001.6) and is cleared explicitly on success (AC-001.3).
- The created task is appended to client state from the action's result (the API's 201 body), not by re-fetching the list: no reload, no second request (AC-001.3).
- `/api/ready` stays independent of the Task API: an unreachable API must show the load error (AC-001.5), not take the web UI out of the Service.
- The template's landing content (`feature-card.tsx`, `icons.tsx`, the hero sections, their tests) is removed: the spec replaces it (AC-001.1) and the coverage gate counts every file under `app/`.
- Acceptance tests are Vitest tests that stub `globalThis.fetch` (`vi.stubGlobal`) or mock `@/lib/task-api` / `@/app/actions`. No Task API stub server and no change to `playwright.config.ts` (a skeleton file): local e2e runs without `TASK_API_URL` and sees the load-error state; the deployed behaviour is covered by the smoke tests.

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `lib/task-api.ts` | `Task` type, `listTasks`, `createTask`, `TaskApiError`, timeout, shape check; reads `TASK_API_URL` per call | new |
| `lib/task-validation.ts` | `validateTitle`, the five UI message constants | new |
| `app/actions.ts` | `"use server"` `createTaskAction` | new |
| `app/_components/task-board.tsx` | `"use client"`: list, empty state, load error, create form | new |
| `app/page.tsx` | server-side load, renders `TaskBoard` | changed |
| `app/_components/feature-card.tsx`, `app/_components/icons.tsx` | template landing content | deleted |
| `docs/env-vars.md` | documents `TASK_API_URL` | changed |

## Contract

### Task API (consumed; binding from the system plan, restated in the spec)

`GET {TASK_API_URL}/tasks` and `POST {TASK_API_URL}/tasks` exactly as in the spec's Contract section. `TASK_API_URL` is read on every call (`process.env.TASK_API_URL`), a trailing `/` is stripped; unset or empty counts as unreachable.

### `lib/task-api.ts` (server only)

```ts
export type Task = { id: number; title: string; due_date: string | null; created_at: string };
export const TASK_API_TIMEOUT_MS = 5000;
export type TaskApiFailure = "unconfigured" | "network" | "timeout" | "status" | "body";
export class TaskApiError extends Error { readonly reason: TaskApiFailure; readonly status?: number }

export function isTask(value: unknown): value is Task;
export async function listTasks(): Promise<Task[]>;
export async function createTask(input: { title: string; due_date: string | null }): Promise<Task>;
```

- `isTask`: `id` a positive integer, `title` a string, `due_date` `null` or a string matching `^\d{4}-\d{2}-\d{2}$`, `created_at` a string.
- `listTasks`: `fetch(url + "/tasks", { method: "GET", cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) })`. Resolves with the array in the API's order (never re-sorted) when status is `200` and the body parses to an array whose every element passes `isTask`. Otherwise throws `TaskApiError`: no URL → `unconfigured`; `fetch` rejects with `TimeoutError`/`AbortError` → `timeout`; other rejection → `network`; status ≠ 200 → `status`; unparsable body or wrong shape → `body`.
- `createTask`: `fetch(url + "/tasks", { method: "POST", cache: "no-store", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ title, due_date }), signal: AbortSignal.timeout(5000) })`, exactly once (no retry). Both keys are always sent; `title` exactly as entered (not trimmed). Resolves with the parsed body when status is `201` and it passes `isTask`; otherwise throws `TaskApiError` with the reasons above (status ≠ 201 → `status`, including 422).
- Every failure is logged once via `logger.warn("task api request failed", { op: "list" | "create", reason, status })`; the title is never logged.

### `lib/task-validation.ts` (shared)

```ts
export const MSG_NO_TASKS = "No tasks yet";
export const MSG_NO_DUE_DATE = "No due date";
export const MSG_TITLE_INVALID = "Title must be 1 to 200 characters and not only spaces.";
export const MSG_LOAD_FAILED = "Tasks could not be loaded. Please try again later.";
export const MSG_SAVE_FAILED = "The task could not be saved. Please try again.";
export function validateTitle(title: string): string | null; // MSG_TITLE_INVALID or null
```

Invalid when `title.trim() === ""` or its length in code points (`[...title].length`, matching the Python API) is greater than 200.

### `app/actions.ts`

```ts
"use server";
export type CreateTaskResult = { ok: true; task: Task } | { ok: false; error: string };
export async function createTaskAction(input: { title: string; due_date: string | null }): Promise<CreateTaskResult>;
```

- `validateTitle(input.title)` fails → `{ ok: false, error: MSG_TITLE_INVALID }`, `createTask` not called.
- An empty-string `due_date` is normalised to `null`.
- `createTask` resolves → `{ ok: true, task }`; throws (any reason) → `{ ok: false, error: MSG_SAVE_FAILED }`. The action never throws.

### `app/_components/task-board.tsx` (UI surface the tests query)

`"use client"`; `export function TaskBoard(props: { initialTasks: Task[] | null })` (`null` = load failed).

- Heading: the page's single `h1` is "Tasks" (rendered by `page.tsx`).
- `initialTasks === null`: `<p role="alert">` with `MSG_LOAD_FAILED` in place of the list; no list, no "No tasks yet" (AC-001.5).
- Empty array: `<p>` "No tasks yet" (AC-001.2).
- Otherwise `<ul aria-label="Tasks">`, one `<li>` per task in array order, keyed by `id`; each shows the title and either `<time dateTime={due_date}>{due_date}</time>` (the string as received, never parsed into a `Date`) or "No due date" (AC-001.1).
- The form is always rendered (also in the load-error state), `noValidate`, `aria-label="Create task"`:
  - `<input type="text" name="title">` labelled "Title"; no `required`, no `maxLength` (the message must show instead).
  - `<input type="date" name="due_date">` labelled "Due date"; empty means `null`.
  - `<button type="submit">` "Add task", disabled while the action is pending.
  - Title error: directly after the title input, `<p id="title-error" role="alert">` with `MSG_TITLE_INVALID`; the input gets `aria-invalid="true"` and `aria-describedby="title-error"`.
  - Save error: `<p role="alert">` with `MSG_SAVE_FAILED` next to the submit button.
- Submit: `preventDefault`; `validateTitle` fails → show title error, keep values, do not call the action (AC-001.4). Otherwise call `createTaskAction({ title, due_date: dueDate || null })` inside `startTransition`; on `ok` append `result.task` to the end of the list, clear both inputs and both errors (AC-001.3); on `!ok` show `result.error` in its slot (title error when it is `MSG_TITLE_INVALID`, otherwise the save error), keep values, append nothing (AC-001.6). In the load-error state a successful create clears the form and leaves the load error in place (the full list is unknown).

### `app/page.tsx`

`export const dynamic = "force-dynamic"`; `async` default export: `listTasks()` → `<TaskBoard initialTasks={tasks} />`; `TaskApiError` (or any error) → `<TaskBoard initialTasks={null} />`. Renders `<h1>Tasks</h1>` above the board.

## Configuration

`TASK_API_URL` (no default; in the cluster `http://taskboard19-api`, wired by the system's gitops repo): base URL of the Task API, server-side only, read at runtime.
