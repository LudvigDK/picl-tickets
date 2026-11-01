import { expect, test, type Page } from "@playwright/test";
import { demoEvent } from "../../src/demo";
import type { Ticket } from "../../src/domain";

async function showTickets(page: Page, tickets: Ticket[]) {
  // Keep guest UI checks independent of a database or published event.
  await page.route("**/src/demo.ts", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export const demoEvent = ${JSON.stringify({ ...demoEvent, tickets })};`,
    }),
  );
  await page.goto("/#/demo");
}

test("host preview shows custom color, text, availability and banner priority", async ({ page }) => {
  await page.goto("/#/create");
  await page.getByRole("switch", { name: "Few tickets left for ticket 1", exact: true }).check();
  const preview = page.locator(".preview-ticket");
  await expect(preview.getByText("Few tickets left", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Custom banner for ticket 1", exact: true }).check();
  const text = "Only available to the first lucky guests";
  await page.getByLabel("Banner text for ticket 1", { exact: true }).fill(text);
  await page.getByLabel("Banner color for ticket 1", { exact: true }).evaluate((input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "#123456");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const badge = preview.locator(".ticket-banner");
  await expect(badge).toHaveText(text);
  await expect(badge).toHaveCSS("background-color", "rgb(18, 52, 86)");
  await expect(badge).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByLabel("Disable ticket purchases for ticket 1", { exact: true }).check();
  await expect(preview.getByText("Currently unavailable")).toBeVisible();
  await page.getByRole("switch", { name: "Sold out", exact: true }).check();
  await expect(badge).toHaveText("Sold out");
  await page.getByRole("switch", { name: "Sold out", exact: true }).uncheck();
  await expect(badge).toHaveText(text);
  const width = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  expect(width.width).toBeLessThanOrEqual(width.viewport);
  await page.getByRole("switch", { name: "Custom banner for ticket 1", exact: true }).uncheck();
  await expect(badge).toHaveText("Few tickets left");
  await expect(preview.getByText("Currently unavailable")).toHaveCount(0);
});

test("guests can select few-left and informational tickets while custom disabled tickets stay blocked", async ({ page }) => {
  const base = { ...demoEvent.tickets[0], fields: [] };
  await showTickets(page, [
    { ...base, id: "FEW00001", name: "Limited entry", fewTicketsLeft: true },
    { ...base, id: "INFO0001", name: "Evening entry", customBanner: { text: "Welcome after 20:00", color: "#ffffff", disableTicket: false } },
    { ...base, id: "CLOSED01", name: "VIP entry", customBanner: { text: "Sales open Friday", color: "#123456", disableTicket: true } },
  ]);
  const tickets = page.locator(".guest-ticket");
  await expect(tickets.nth(0).getByText("Few tickets left", { exact: true })).toBeVisible();
  await expect(tickets.nth(1).getByText("Welcome after 20:00", { exact: true })).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(tickets.nth(2).getByText("Sales open Friday", { exact: true })).toBeVisible();
  await expect(tickets.nth(2).getByText("Ticket purchases are unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add one VIP entry ticket" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add one Limited entry ticket" }).click();
  await page.getByRole("button", { name: "Add one Evening entry ticket" }).click();
  await page.getByRole("button", { name: "Preview payment" }).click();
  await expect(page.getByRole("dialog")).toContainText("1/Limited entry | 1/Evening entry");
  await expect(page.getByRole("dialog")).toContainText("250");
  await page.getByRole("button", { name: "Close dialog" }).click();
  const width = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  expect(width.width).toBeLessThanOrEqual(width.viewport);
});

test("a custom disabled event uses unavailable copy and cannot check out", async ({ page }) => {
  await showTickets(page, [{
    ...demoEvent.tickets[0],
    customBanner: { text: "Booking paused", color: "#663399", disableTicket: true },
  }]);
  await expect(page.getByText("TICKETS UNAVAILABLE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tickets unavailable", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Add one/ })).toHaveCount(0);
  await expect(page.getByText("Booking paused", { exact: true })).toBeVisible();
});
