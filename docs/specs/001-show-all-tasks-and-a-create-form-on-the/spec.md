---
spec_id: 001-show-all-tasks-and-a-create-form-on-the
title: Show all tasks and a create form on the home page, backed by the Task API
status: approved
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard19-gitops:001-persistent-tasks-in-postgres-and-task-ui
---

# 001 — Show all tasks and a create form on the home page, backed by the Task API

## Problem

The Task API keeps tasks only in each running instance's memory: every restart or redeploy empties the list, and two instances would each show different tasks, so nobody can rely on a task still being there tomorrow. The web UI exists but shows only the template's landing page, so people can reach tasks only by calling the API by hand. This feature keeps tasks in a PostgreSQL database that belongs to the system, so they survive restarts and deploys, and lets people see and create tasks in the web UI.

## System context

Slice of the system plan `001-persistent-tasks-in-postgres-and-task-ui` in `ika100-demo/taskboard19-gitops` for `taskboard19-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.4** Given tasks exist, when a person opens the web UI's home page, then it lists every task in creation order (oldest first), each showing its title and its due date as `YYYY-MM-DD`, or "No due date" when it has none.
- **AC-001.5** Given no task exists, when a person opens the web UI's home page, then it shows "No tasks yet" and the create form.
- **AC-001.6** Given the home page is open, when a person enters the title "Buy milk", optionally picks a due date and submits the form, then the new task appears at the end of the list without the person reloading the page, the form is cleared, and `GET /tasks` on the Task API includes the task with that title and due date.
- **AC-001.7** Given the home page is open, when a person submits the form with a title that is empty, only spaces or longer than 200 characters, then the form shows "Title must be 1 to 200 characters and not only spaces." next to the title field, keeps the entered values, and no task is created.
- **AC-001.8** Given the Task API is unreachable or answers with a 5xx status, when a person opens the home page, then it shows "Tasks could not be loaded. Please try again later." instead of the list; and when a person submits the create form in that state, then it shows "The task could not be saved. Please try again." and keeps the entered values.

### Contract

Between `taskboard19-web` (caller, from its Next.js server side) and `taskboard19-api` (unchanged from Task API spec
001 except where tasks are kept). Base URL: `TASK_API_URL` (in the cluster `http://taskboard19-api`). All bodies are
`application/json`. No authentication (system A9).

**Task object**

| Field | Type | Rule |
|---|---|---|
| `id` | integer | positive, assigned by the API, never reused, increasing in creation order, may have gaps (system A3) |
| `title` | string | 1 to 200 characters, at least one non-whitespace character, stored exactly as sent |
| `due_date` | string or null | calendar date `YYYY-MM-DD`, or `null` when none |
| `created_at` | string | ISO 8601 / RFC 3339 UTC timestamp with `Z` suffix; fractional seconds may be present |

**`GET /tasks`**

- `200`: JSON array of every task in creation order (oldest first), each exactly as its `POST` returned it; `[]`
  when there is none. No query parameters, no pagination, no limit (system A10).
- `503`: `{"detail": "Task storage is unavailable"}` when the database is unreachable (AC-001.3).

**`POST /tasks`**

- Request: `{"title": <string>, "due_date": <"YYYY-MM-DD" | null>}`; `due_date` may be omitted (means `null`).
  The web UI always sends both fields, `due_date` from its date picker or `null`.
- `201`: the created task object.
- `422`: FastAPI's standard validation body `{"detail": [{"loc": ["body", "title" | "due_date"], ...}]}`; nothing
  stored. Only `loc` is contract; `type` and `msg` are not.
- `503`: `{"detail": "Task storage is unavailable"}`; nothing stored.

**Probes of the API** (used by the platform, not by the web UI): `GET /health` 200 while the process runs, regardless
of the database; `GET /ready` 200 when the database answers, 503 when it does not.

**Web UI states** (the web UI's own surface, stated here so both specs use the same words): "No tasks yet",
"No due date", "Title must be 1 to 200 characters and not only spaces.", "Tasks could not be loaded. Please try again
later.", "The task could not be saved. Please try again." (system A8).

### Errors

- The API's error bodies are JSON with a `detail` field: a string for 503 (`"Task storage is unavailable"`), a list of
  `{loc, msg, type}` for 422. The web UI never shows API error text to a person; it shows its own wording.
- On `GET /tasks` the web UI treats anything other than a `200` with a JSON array of task objects (a 5xx, a 4xx, an
  unlisted status, a body that does not parse, a network error, a timeout) as "Tasks could not be loaded. Please try
  again later.".
- On `POST /tasks` the web UI treats anything other than `201` with a task object (including a `422` it should never
  provoke, a 5xx, an unlisted status, a network error, a timeout) as "The task could not be saved. Please try again.",
  keeps the entered values and appends nothing.
- The API answers an unexpected internal failure with 500 (FastAPI default); database unavailability is always 503,
  never 500.

### Timeouts

- Web UI to API, `GET /tasks`: 5 s total per request, no retry; past that the page shows the load error.
- Web UI to API, `POST /tasks`: 5 s total per request, **no retry** (a create is not idempotent; a retry could create
  the task twice). A timed-out create shows the save error; the task may still have been stored and appears on reload.
- API to database: connection attempt at most 3 s, each statement at most 5 s; on either the request answers 503.
  The API keeps no broken connection: the next request opens or validates a connection, so it recovers without a
  restart.
- API `/ready` database check: at most 500 ms, so it answers within the probe's 1 s timeout; a slow database makes the
  instance not ready, never restarts it (`/health` does not touch the database).

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `TASK_API_URL=http://taskboard19-api`

### Notes for this repo

The browser never calls the Task API directly: server components read the list and a server action
(or a route handler of this app) performs the create, so no CORS and no NEXT_PUBLIC_ variable is needed.
Read TASK_API_URL at runtime on the server (document it in docs/env-vars.md); tests stub the Task API.
Smoke: a read-only check that the home page loads, and an @writes check creating a `smoke-<uuid>` task.

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given the Task API at `TASK_API_URL` answers `GET /tasks` with tasks, when a person opens the home page, then it replaces the template's landing content with every task in the order the API returned them (oldest first), each showing its title and its `due_date` as `YYYY-MM-DD`, or "No due date" when `due_date` is null; the page is rendered at request time, so a reload shows tasks created elsewhere (system AC-001.4)
- **AC-001.2** Given the Task API answers `GET /tasks` with `[]`, when a person opens the home page, then it shows "No tasks yet" and the create form (system AC-001.5)
- **AC-001.3** Given the home page is open, when a person enters the title "Buy milk", optionally picks a due date in the date picker and submits, then the web server sends `POST /tasks` to the Task API with `{"title": "Buy milk", "due_date": "YYYY-MM-DD" or null}`, and on 201 the returned task appears at the end of the list without a page reload and the form is cleared (system AC-001.6)
- **AC-001.4** Given the home page is open, when a person submits the form with a title that is empty, only spaces or longer than 200 characters, then "Title must be 1 to 200 characters and not only spaces." is shown next to the title field, the entered values are kept and no request is sent to the Task API (system AC-001.7)
- **AC-001.5** Given the Task API is unreachable, does not answer `GET /tasks` within 5 seconds, or answers it with a 5xx status or a body that is not a task list, when a person opens the home page, then it shows "Tasks could not be loaded. Please try again later." instead of the list (system AC-001.8)
- **AC-001.6** Given the Task API is unreachable, does not answer `POST /tasks` within 5 seconds, or answers with any status other than 201, when a person submits a valid create form, then the form shows "The task could not be saved. Please try again.", keeps the entered values and appends nothing to the list (system AC-001.8)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

## Changelog

- 2026-11-15 created from the system plan, with its criteria (spec 147)
- 2026-11-15 approved
