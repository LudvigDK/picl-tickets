import { test, expect } from "@playwright/test";

test("creator preview follows title and sold-out changes", async ({ page }) => {
  await page.goto("/#/create");
  await page
    .getByRole("textbox", { name: /Event title/ })
    .fill("Courtyard party");
  await expect(
    page.getByRole("heading", { name: "Courtyard party" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: /Ticket name/ }).fill("Entry");
  await page.getByRole("switch", { name: "Sold out" }).check();
  await expect(
    page.locator(".preview-ticket").getByText("Sold out"),
  ).toBeVisible();
});

test("creator custom fields and ticket types can be added and removed", async ({
  page,
}) => {
  await page.goto("/#/create");
  await page.getByRole("button", { name: "Add custom field" }).click();
  await page.getByLabel("Label for custom field 1 of ticket 1").fill("Name");
  await page.getByRole("button", { name: /Add ticket type/ }).click();
  await expect(
    page.getByRole("button", { name: "Remove ticket 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove ticket 2" }).click();
  await page
    .getByRole("button", { name: "Remove custom field 1 from ticket 1" })
    .click();
  await expect(
    page.getByLabel("Label for custom field 1 of ticket 1"),
  ).toHaveCount(0);
});

test("each ticket requires its own name and the message contains both", async ({
  page,
}) => {
  await page.goto("/#/demo");
  const add = page.getByRole("button", {
    name: "Add one General admission ticket",
  });
  await add.click();
  await add.click();
  const names = page.getByRole("textbox", { name: /Name/ });
  await expect(names).toHaveCount(2);
  await names.nth(0).fill("Anna");
  await page.getByRole("button", { name: "Preview payment" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await names.nth(1).fill("Bo");
  await page.getByRole("button", { name: "Preview payment" }).click();
  await expect(page.getByRole("dialog")).toContainText("1:Name=Anna;2:Name=Bo");
  await expect(page.getByRole("dialog")).toContainText("250");
  await expect(page.getByRole("link", { name: "Open MobilePay" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("quantity cap and sold-out tickets cannot be selected", async ({
  page,
}) => {
  await page.goto("/#/demo");
  const add = page.getByRole("button", {
    name: "Add one General admission ticket",
  });
  for (let i = 0; i < 4; i++) await add.click();
  await expect(add).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add one Early bird ticket" }),
  ).toHaveCount(0);
});

test("mobile and desktop do not overflow horizontally", async ({ page }) => {
  for (const route of ["/create", "/demo"]) {
    await page.goto(`/#${route}`);
    const size = await page.evaluate(() => ({
      viewport: window.innerWidth,
      width: document.documentElement.scrollWidth,
    }));
    expect(size.width).toBeLessThanOrEqual(size.viewport);
  }
});

test("invalid event addresses show a useful state", async ({ page }) => {
  await page.goto("/#/event/bad-id");
  await expect(
    page.getByRole("heading", { name: "This link took a wrong turn." }),
  ).toBeVisible();
});
