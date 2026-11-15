"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { createTaskAction } from "@/app/actions";
import type { Task } from "@/lib/task-api";
import {
  MSG_LOAD_FAILED,
  MSG_NO_DUE_DATE,
  MSG_NO_TASKS,
  MSG_SAVE_FAILED,
  MSG_TITLE_INVALID,
  validateTitle,
} from "@/lib/task-validation";

export type TaskBoardProps = { initialTasks: Task[] | null };

export function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[] | null>(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTitleError(null);
    setSaveError(null);
    const invalid = validateTitle(title);
    if (invalid !== null) {
      setTitleError(invalid);
      return;
    }
    startTransition(async () => {
      const result = await createTaskAction({ title, due_date: dueDate || null });
      if (result.ok) {
        // In the load-error state the list stays unknown, so nothing is appended.
        setTasks((current) => (current === null ? null : [...current, result.task]));
        setTitle("");
        setDueDate("");
      } else if (result.error === MSG_TITLE_INVALID) {
        setTitleError(result.error);
      } else {
        setSaveError(result.error || MSG_SAVE_FAILED);
      }
    });
  }

  return (
    <div>
      {tasks === null ? (
        <p role="alert">{MSG_LOAD_FAILED}</p>
      ) : tasks.length === 0 ? (
        <p>{MSG_NO_TASKS}</p>
      ) : (
        <ul aria-label="Tasks">
          {tasks.map((t) => (
            <li key={t.id}>
              <span>{t.title}</span>{" "}
              {t.due_date ? <time dateTime={t.due_date}>{t.due_date}</time> : <span>{MSG_NO_DUE_DATE}</span>}
            </li>
          ))}
        </ul>
      )}
      <form aria-label="Create task" noValidate onSubmit={onSubmit}>
        <div>
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={titleError ? "true" : undefined}
            aria-describedby={titleError ? "title-error" : undefined}
          />
          {titleError ? (
            <p id="title-error" role="alert">
              {titleError}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="task-due-date">Due date</label>
          <input
            id="task-due-date"
            type="date"
            name="due_date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <button type="submit" disabled={pending}>
          Add task
        </button>
        {saveError ? <p role="alert">{saveError}</p> : null}
      </form>
    </div>
  );
}
