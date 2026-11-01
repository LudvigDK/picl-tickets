import { test, expect } from "@playwright/test";

test("host banners persist and live availability changes clear guest selections", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080",
    "Requires the local Firebase Auth and Firestore emulators.",
  );

  // A misconfigured dev server must never write this fixture to production.
  await context.route(
    /^https:\/\/(?:identitytoolkit|firestore)\.googleapis\.com\//,
    (route) => route.abort(),
  );
  await page.goto("/#/create");
  await page.getByRole("textbox", { name: /Event title/ }).fill("Banner test party");
  await page.getByRole("textbox", { name: /Description/ }).fill("Disposable emulator event.");
  await page.getByRole("textbox", { name: /Ticket name/ }).fill("Entry");
  await page.getByRole("switch", { name: "Few tickets left for ticket 1" }).check();
  await page.getByRole("switch", { name: "Custom banner for ticket 1" }).check();
  await page.getByRole("textbox", { name: "Banner text for ticket 1" }).fill("Join the party");
  await page.getByLabel("Banner color for ticket 1").evaluate((input) => {
    const color = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(color, "#123456");
    color.dispatchEvent(new Event("input", { bubbles: true }));
    color.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByLabel(/MobilePay Box share link/).fill(
    "https://qr.mobilepay.dk/box/12345678-abcd-1234-abcd-123456789012/pay-in",
  );
  await page.getByLabel(/Editing password/).fill("banner-emulator-password");
  await page.getByLabel(/Repeat password/).fill("banner-emulator-password");
  await page.getByRole("button", { name: "Publish event" }).click();
  await expect(page).toHaveURL(/#\/event\/[a-zA-Z0-9]{20}\/edit\?published=1$/);

  const guestUrl = await page.getByLabel("Public event link").inputValue();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Banner text for ticket 1" })).toHaveValue("Join the party");
  await expect(page.getByLabel("Banner color for ticket 1")).toHaveValue("#123456");
  await expect(page.getByRole("switch", { name: "Few tickets left for ticket 1" })).toBeChecked();

  const guest = await context.newPage();
  await guest.goto(guestUrl);
  const guestBanner = guest.locator(".guest-ticket .ticket-banner");
  await expect(guestBanner).toHaveText("Join the party");
  await expect(guestBanner).toHaveCSS("background-color", "rgb(18, 52, 86)");
  const add = guest.getByRole("button", { name: "Add one Entry ticket" });
  await add.click();
  await expect(guest.locator(".order-summary small")).toHaveText("1 ticket");
  await expect(guest.getByRole("button", { name: "Pay with MobilePay" })).toBeEnabled();

  await page.getByRole("checkbox", { name: "Disable ticket purchases for ticket 1" }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".success-message")).toContainText("Changes saved");
  await expect(guestBanner).toHaveText("Join the party");
  await expect(add).toHaveCount(0);
  await expect(guest.locator(".order-summary small")).toHaveText("0 tickets");
  await expect(guest.locator(".order-summary strong")).toHaveText(/^0\s+kr\.$/);
  await expect(guest.getByRole("button", { name: "Tickets unavailable" })).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Disable ticket purchases for ticket 1" })).toBeChecked();
  await page.getByRole("switch", { name: "Custom banner for ticket 1" }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".success-message")).toContainText("Changes saved");
  await expect(guestBanner).toHaveText("Few tickets left");
  await expect(add).toBeEnabled();
  await expect(guest.getByLabel("Entry quantity")).toHaveText("0");
  await add.click();
  await expect(guest.getByRole("button", { name: "Pay with MobilePay" })).toBeEnabled();

  await page.reload();
  await expect(page.getByRole("switch", { name: "Custom banner for ticket 1" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Few tickets left for ticket 1" })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Banner text for ticket 1" })).toHaveCount(0);
  await guest.reload();
  await expect(guestBanner).toHaveText("Few tickets left");
  await expect(add).toBeEnabled();
});
