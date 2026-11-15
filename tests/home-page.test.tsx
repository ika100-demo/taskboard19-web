import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage, { dynamic } from "@/app/page";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const t = (id: number, title: string, due_date: string | null) => ({ id, title, due_date, created_at: "2026-11-15T10:00:00Z" });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.TASK_API_URL = "http://task-api.test";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASK_API_URL;
});

async function renderPage() {
  render(await HomePage());
}

describe("home page (server side load)", () => {
  it("AC-001.1 is rendered at request time", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("AC-001.1 lists the API's tasks in API order and drops the template landing content", async () => {
    fetchMock.mockResolvedValue(json([t(3, "Alpha", "2026-12-24"), t(1, "Beta", null)]));
    await renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Get started" })).not.toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("Alpha"),
      expect.stringContaining("Beta"),
    ]);
    expect(items[0]).toHaveTextContent("2026-12-24");
    expect(items[1]).toHaveTextContent("No due date");
  });

  it("AC-001.2 shows No tasks yet and the create form for an empty list", async () => {
    fetchMock.mockResolvedValue(json([]));
    await renderPage();
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Create task" })).toBeInTheDocument();
  });

  it.each([
    ["unreachable", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    ["timing out", () => fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"))],
    ["answering 503", () => fetchMock.mockResolvedValue(json({ detail: "Task storage is unavailable" }, 503))],
    ["answering a non-list body", () => fetchMock.mockResolvedValue(json({ tasks: [] }))],
  ])("AC-001.5 shows the load error when the API is %s", async (_name, arrange) => {
    arrange();
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Tasks could not be loaded. Please try again later.");
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });
});
