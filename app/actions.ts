"use server";

import { createTask } from "@/lib/task-api";
import type { Task } from "@/lib/task-api";
import { MSG_SAVE_FAILED, MSG_TITLE_INVALID, validateTitle } from "@/lib/task-validation";

export type CreateTaskResult = { ok: true; task: Task } | { ok: false; error: string };

export async function createTaskAction(input: {
  title: string;
  due_date: string | null;
}): Promise<CreateTaskResult> {
  if (validateTitle(input.title) !== null) {
    return { ok: false, error: MSG_TITLE_INVALID };
  }
  try {
    const task = await createTask({ title: input.title, due_date: input.due_date || null });
    return { ok: true, task };
  } catch {
    return { ok: false, error: MSG_SAVE_FAILED };
  }
}
