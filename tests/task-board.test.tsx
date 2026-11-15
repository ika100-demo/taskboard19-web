import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions", () => ({ createTaskAction: actionMock }));

import { TaskBoard } from "@/app/_components/task-board";
import type { Task } from "@/lib/task-api";

const task = (id: number, title: string, due_date: string | null = null): Task => ({
  id,
  title,
  due_date,
  created_at: "2026-11-15T10:00:00Z",
});

const TITLE_ERROR = "Title must be 1 to 200 characters and not only spaces.";
const SAVE_ERROR = "The task could not be saved. Please try again.";
const LOAD_ERROR = "Tasks could not be loaded. Please try again later.";

beforeEach(() => actionMock.mockReset());

function form() {
  return screen.getByRole("form", { name: "Create task" });
}
function titleInput() {
  return within(form()).getByLabelText("Title") as HTMLInputElement;
}
function dueInput() {
  return within(form()).getByLabelText("Due date") as HTMLInputElement;
}
function submit() {
  fireEvent.click(within(form()).getByRole("button", { name: "Add task" }));
}
function fill(title: string, due = "") {
  fireEvent.change(titleInput(), { target: { value: title } });
  if (due) fireEvent.change(dueInput(), { target: { value: due } });
}

describe("AC-001.1 list", () => {
  it("AC-001.1 shows every task in the given order with title and due date or No due date", () => {
    render(<TaskBoard initialTasks={[task(4, "Second id first", "2026-12-24"), task(2, "Later", null), task(9, "Last", "2027-01-05")]} />);
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Second id first");
    expect(items[0]).toHaveTextContent("2026-12-24");
    expect(items[0]).not.toHaveTextContent("No due date");
    expect(items[1]).toHaveTextContent("Later");
    expect(items[1]).toHaveTextContent("No due date");
    expect(items[2]).toHaveTextContent("Last");
    expect(items[2]).toHaveTextContent("2027-01-05");
  });
});

describe("AC-001.2 empty list", () => {
  it("AC-001.2 shows No tasks yet and the create form", () => {
    render(<TaskBoard initialTasks={[]} />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(form()).toBeInTheDocument();
    expect(titleInput()).toBeInTheDocument();
    expect(dueInput()).toBeInTheDocument();
    expect(within(form()).getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });
});

describe("AC-001.3 create", () => {
  it("AC-001.3 calls the action with the entered values, appends the task at the end and clears the form", async () => {
    actionMock.mockResolvedValue({ ok: true, task: task(3, "Buy milk", "2026-12-24") });
    render(<TaskBoard initialTasks={[task(1, "First")]} />);
    fill("Buy milk", "2026-12-24");
    submit();
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(actionMock).toHaveBeenCalledWith({ title: "Buy milk", due_date: "2026-12-24" });
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Buy milk");
    expect(items[1]).toHaveTextContent("2026-12-24");
    expect(titleInput().value).toBe("");
    expect(dueInput().value).toBe("");
  });

  it("AC-001.3 sends due_date null without a date and replaces the empty state", async () => {
    actionMock.mockResolvedValue({ ok: true, task: task(1, "Buy milk") });
    render(<TaskBoard initialTasks={[]} />);
    fill("Buy milk");
    submit();
    await waitFor(() => expect(screen.getByRole("list", { name: "Tasks" })).toBeInTheDocument());
    expect(actionMock).toHaveBeenCalledWith({ title: "Buy milk", due_date: null });
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
    expect(screen.getByText("No due date")).toBeInTheDocument();
  });
});

describe("AC-001.4 invalid title", () => {
  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["over 200 characters", "a".repeat(201)],
  ])("AC-001.4 shows the title error and sends nothing for a title that is %s", (_name, title) => {
    render(<TaskBoard initialTasks={[task(1, "First")]} />);
    fill(title, "2026-12-24");
    submit();
    const error = within(form()).getByText(TITLE_ERROR);
    expect(error).toBeInTheDocument();
    expect(titleInput()).toHaveAttribute("aria-invalid", "true");
    expect(titleInput().getAttribute("aria-describedby")).toBe(error.id);
    expect(actionMock).not.toHaveBeenCalled();
    expect(titleInput().value).toBe(title);
    expect(dueInput().value).toBe("2026-12-24");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("AC-001.5 load error", () => {
  it("AC-001.5 shows the load error instead of the list, and still the form", () => {
    render(<TaskBoard initialTasks={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(LOAD_ERROR);
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
    expect(form()).toBeInTheDocument();
  });
});

describe("AC-001.6 save error", () => {
  it("AC-001.6 shows the save error, keeps the values and appends nothing", async () => {
    actionMock.mockResolvedValue({ ok: false, error: SAVE_ERROR });
    render(<TaskBoard initialTasks={[task(1, "First")]} />);
    fill("Buy milk", "2026-12-24");
    submit();
    expect(await within(form()).findByText(SAVE_ERROR)).toBeInTheDocument();
    expect(titleInput().value).toBe("Buy milk");
    expect(dueInput().value).toBe("2026-12-24");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.6 shows the save error in the load-error state too", async () => {
    actionMock.mockResolvedValue({ ok: false, error: SAVE_ERROR });
    render(<TaskBoard initialTasks={null} />);
    fill("Buy milk");
    submit();
    expect(await within(form()).findByText(SAVE_ERROR)).toBeInTheDocument();
    expect(titleInput().value).toBe("Buy milk");
  });
});
