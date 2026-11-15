import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { listTasks } from "@/lib/task-api";
import { MSG_LOAD_FAILED } from "@/lib/task-validation";

vi.mock("@/lib/task-api", () => ({ listTasks: vi.fn() }));
vi.mock("@/app/actions", () => ({ createTaskAction: vi.fn() }));

describe("HomePage", () => {
  beforeEach(() => {
    vi.mocked(listTasks).mockReset();
  });

  it("renders a single Tasks heading and the list on success", async () => {
    vi.mocked(listTasks).mockResolvedValue([{ id: 1, title: "Write docs", due_date: null, created_at: "2026-01-01T00:00:00Z" }]);
    render(await HomePage());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Write docs")).toBeInTheDocument();
  });

  it("shows the load failure message when the API call throws", async () => {
    vi.mocked(listTasks).mockRejectedValue(new Error("boom"));
    render(await HomePage());
    expect(screen.getByText(MSG_LOAD_FAILED)).toBeInTheDocument();
  });
});
