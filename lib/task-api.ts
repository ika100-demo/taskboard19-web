import { logger } from "@/lib/logger";

export type Task = { id: number; title: string; due_date: string | null; created_at: string };

export const TASK_API_TIMEOUT_MS = 5000;

export type TaskApiFailure = "unconfigured" | "network" | "timeout" | "status" | "body";

export class TaskApiError extends Error {
  readonly reason: TaskApiFailure;
  readonly status?: number;

  constructor(reason: TaskApiFailure, status?: number) {
    super(`task api request failed: ${reason}`);
    this.name = "TaskApiError";
    this.reason = reason;
    this.status = status;
  }
}

export function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    Number.isInteger(v.id) &&
    v.id > 0 &&
    typeof v.title === "string" &&
    (v.due_date === null || (typeof v.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.due_date))) &&
    typeof v.created_at === "string"
  );
}

type Op = "list" | "create";

function fail(op: Op, reason: TaskApiFailure, status?: number): TaskApiError {
  logger.warn("task api request failed", { op, reason, status });
  return new TaskApiError(reason, status);
}

async function request(op: Op, init: RequestInit): Promise<Response> {
  const base = process.env.TASK_API_URL?.trim().replace(/\/$/, "");
  if (!base) throw fail(op, "unconfigured");
  // AbortSignal.timeout is the contract's deadline; the timer-backed controller aborts at the same
  // moment and keeps the deadline observable under fake timers.
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new DOMException("timed out", "TimeoutError"));
  }, TASK_API_TIMEOUT_MS);
  const signal = AbortSignal.any([AbortSignal.timeout(TASK_API_TIMEOUT_MS), controller.signal]);
  try {
    return await fetch(`${base}/tasks`, { ...init, cache: "no-store", signal });
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    throw fail(op, name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
  }
}

async function readBody(op: Op, response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw fail(op, "body", response.status);
  }
}

export async function listTasks(): Promise<Task[]> {
  const response = await request("list", { method: "GET", headers: { accept: "application/json" } });
  if (response.status !== 200) throw fail("list", "status", response.status);
  const body = await readBody("list", response);
  if (!Array.isArray(body) || !body.every(isTask)) throw fail("list", "body", response.status);
  return body;
}

export async function createTask(input: { title: string; due_date: string | null }): Promise<Task> {
  const response = await request("create", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ title: input.title, due_date: input.due_date }),
  });
  if (response.status !== 201) throw fail("create", "status", response.status);
  const body = await readBody("create", response);
  if (!isTask(body)) throw fail("create", "body", response.status);
  return body;
}
