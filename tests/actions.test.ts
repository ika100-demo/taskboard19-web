import { beforeEach, describe, expect, it, vi } from "vitest";

const createTaskMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/task-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/task-api")>();
  return { ...actual, createTask: createTaskMock };
});

import { createTaskAction } from "@/app/actions";
import { MSG_SAVE_FAILED, MSG_TITLE_INVALID } from "@/lib/task-validation";

const created = { id: 7, title: "Buy milk", due_date: "2026-12-24", created_at: "2026-11-15T10:00:00Z" };

beforeEach(() => createTaskMock.mockReset());

describe("createTaskAction", () => {
  it("AC-001.3 creates the task and returns it", async () => {
    createTaskMock.mockResolvedValue(created);
    const result = await createTaskAction({ title: "Buy milk", due_date: "2026-12-24" });
    expect(createTaskMock).toHaveBeenCalledWith({ title: "Buy milk", due_date: "2026-12-24" });
    expect(result).toEqual({ ok: true, task: created });
  });

  it("AC-001.3 normalises an empty due date to null", async () => {
    createTaskMock.mockResolvedValue({ ...created, due_date: null });
    await createTaskAction({ title: "Buy milk", due_date: "" });
    expect(createTaskMock).toHaveBeenCalledWith({ title: "Buy milk", due_date: null });
  });

  it("AC-001.4 rejects an invalid title without calling the API", async () => {
    for (const title of ["", "   ", "a".repeat(201)]) {
      expect(await createTaskAction({ title, due_date: null })).toEqual({ ok: false, error: MSG_TITLE_INVALID });
    }
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it("AC-001.6 returns the save error when the create fails and never throws", async () => {
    createTaskMock.mockRejectedValue(new Error("boom"));
    expect(await createTaskAction({ title: "Buy milk", due_date: null })).toEqual({ ok: false, error: MSG_SAVE_FAILED });
  });
});
