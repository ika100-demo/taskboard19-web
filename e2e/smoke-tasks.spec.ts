import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

test.skip(!process.env.SMOKE_BASE_URL, "SMOKE_BASE_URL not set");

test("the home page shows the task list or its load state @smoke", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("form", { name: "Create task" })).toBeVisible();
  await expect(main.getByRole("list", { name: "Tasks" }).or(main.getByText("No tasks yet")).first()).toBeVisible();
  await expect(main.getByRole("alert")).toHaveCount(0);
});

test("creating a task shows it in the list without a reload @smoke @writes", async ({ page }) => {
  const title = `smoke-${randomUUID()}`;
  await page.goto("/");
  const main = page.getByRole("main");
  await main.getByLabel("Title").fill(title);
  await main.getByRole("button", { name: "Add task" }).click();
  await expect(main.getByRole("list", { name: "Tasks" }).getByText(title)).toBeVisible();
});
