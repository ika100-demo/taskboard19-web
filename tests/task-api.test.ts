import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TASK_API_TIMEOUT_MS, TaskApiError, createTask, isTask, listTasks } from "@/lib/task-api";

const task = (id: number, title: string, due_date: string | null = null) => ({
  id,
  title,
  due_date,
  created_at: "2026-11-15T10:00:00Z",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TASK_API_URL = "http://task-api.test/";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASK_API_URL;
});

async function reasonOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TaskApiError);
    return (error as TaskApiError).reason;
  }
  return undefined;
}

describe("AC-001.1 listTasks", () => {
  it("AC-001.1 returns the tasks in the order the API returned them", async () => {
    const body = [task(5, "b"), task(2, "a", "2026-12-01"), task(9, "c")];
    fetchMock.mockResolvedValue(json(body));
    expect((await listTasks()).map((t) => t.id)).toEqual([5, 2, 9]);
  });

  it("AC-001.1 reads TASK_API_URL per call, strips the trailing slash and never caches", async () => {
    fetchMock.mockResolvedValue(json([]));
    await listTasks();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://task-api.test/tasks");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
  });

  it("AC-001.1 isTask checks the task shape", () => {
    expect(isTask(task(1, "x"))).toBe(true);
    expect(isTask(task(1, "x", "2026-01-31"))).toBe(true);
    expect(isTask(task(0, "x"))).toBe(false);
    expect(isTask(task(1, "x", "31.01.2026"))).toBe(false);
    expect(isTask({ id: 1, title: "x" })).toBe(false);
    expect(isTask(null)).toBe(false);
  });
});

describe("AC-001.5 listTasks failures", () => {
  it("AC-001.5 has a 5 second timeout and passes a signal", async () => {
    expect(TASK_API_TIMEOUT_MS).toBe(5000);
    fetchMock.mockResolvedValue(json([]));
    await listTasks();
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("AC-001.5 listTasks uses AbortSignal.timeout(5000) and the signal aborts at 5000 ms, not before", async () => {
    vi.useFakeTimers();
    try {
      const spy = vi.spyOn(AbortSignal, "timeout");
      fetchMock.mockResolvedValue(json([]));
      await listTasks();
      expect(spy).toHaveBeenCalledWith(5000);
      const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(4999);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("AC-001.5 fails when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await reasonOf(listTasks())).toBe("network");
  });

  it("AC-001.5 fails with timeout when the request times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await reasonOf(listTasks())).toBe("timeout");
  });

  it("AC-001.5 fails on a 5xx status", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Task storage is unavailable" }, 503));
    expect(await reasonOf(listTasks())).toBe("status");
  });

  it("AC-001.5 fails on a body that is not a task list", async () => {
    fetchMock.mockResolvedValue(json({ tasks: [] }));
    expect(await reasonOf(listTasks())).toBe("body");
    fetchMock.mockResolvedValue(json([{ id: "x" }]));
    expect(await reasonOf(listTasks())).toBe("body");
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    expect(await reasonOf(listTasks())).toBe("body");
  });

  it("AC-001.5 fails when TASK_API_URL is not set", async () => {
    delete process.env.TASK_API_URL;
    expect(await reasonOf(listTasks())).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC-001.3 createTask", () => {
  it("AC-001.3 sends POST /tasks once with both keys and the title untrimmed", async () => {
    fetchMock.mockResolvedValue(json(task(3, " Buy milk ", "2026-12-24"), 201));
    const created = await createTask({ title: " Buy milk ", due_date: "2026-12-24" });
    expect(created.id).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://task-api.test/tasks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ title: " Buy milk ", due_date: "2026-12-24" });
  });

  it("AC-001.3 sends due_date null when there is none", async () => {
    fetchMock.mockResolvedValue(json(task(3, "Buy milk"), 201));
    await createTask({ title: "Buy milk", due_date: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "Buy milk", due_date: null });
  });
});

describe("AC-001.6 createTask failures", () => {
  it("AC-001.6 fails when unreachable, without retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await reasonOf(createTask({ title: "x", due_date: null }))).toBe("network");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("AC-001.6 createTask uses AbortSignal.timeout(5000) and the signal aborts at 5000 ms, not before", async () => {
    vi.useFakeTimers();
    try {
      const spy = vi.spyOn(AbortSignal, "timeout");
      fetchMock.mockResolvedValue(json(task(1, "x"), 201));
      await createTask({ title: "x", due_date: null });
      expect(spy).toHaveBeenCalledWith(5000);
      const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(4999);
      expect(signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("AC-001.6 fails on timeout", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await reasonOf(createTask({ title: "x", due_date: null }))).toBe("timeout");
  });

  it("AC-001.6 fails on any status other than 201", async () => {
    for (const status of [200, 422, 503]) {
      fetchMock.mockResolvedValue(json(task(1, "x"), status));
      expect(await reasonOf(createTask({ title: "x", due_date: null }))).toBe("status");
    }
  });

  it("AC-001.6 fails on a 201 whose body is not a task", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }, 201));
    expect(await reasonOf(createTask({ title: "x", due_date: null }))).toBe("body");
  });
});
