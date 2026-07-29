import { expect, test } from "@playwright/test";

function safeRunKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-20) || "local";
}

test("owner manages accounting periods and lock states", async ({ page, request }, testInfo) => {
  const runKey = safeRunKey(`${process.env.E2E_RUN_ID ?? Date.now()}-${testInfo.retry}`);
  const email = `period-owner-${runKey}@e2e.local`;
  const password = "Period-E2E-2026!";

  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Period Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/businesses\/new$/);

  await page.getByLabel("Account or group name").fill(`Period Group ${runKey}`);
  await page.getByLabel("Legal business name").fill(`Period Business ${runKey} LLC`);
  await page.getByRole("button", { name: "Create business and continue" }).click();
  await expect(page).toHaveURL(/\/business\/[^/]+\/dashboard$/);
  const businessId = new URL(page.url()).pathname.split("/")[2] ?? "";
  expect(businessId).not.toBe("");

  const anonymous = await request.get(`/api/businesses/${businessId}/accounting/periods`);
  expect(anonymous.status()).toBe(401);

  await page.goto(`/business/${businessId}/accounting`);
  await page.getByRole("link", { name: "Accounting periods" }).click();
  await expect(page).toHaveURL(new RegExp(`/business/${businessId}/accounting/periods$`));
  await expect(page.getByRole("heading", { name: "Accounting periods" })).toBeVisible();

  const createForm = page.getByRole("heading", { name: "Add accounting period" }).locator("xpath=ancestor::form");
  await createForm.getByLabel("Name").fill("January 2027");
  await createForm.getByLabel("Start date").fill("2027-01-01");
  await createForm.getByLabel("End date").fill("2027-01-31");
  await createForm.getByRole("button", { name: "Create period" }).click();
  await expect(page.getByRole("heading", { name: "January 2027" })).toBeVisible();
  await expect(page.getByText("2027-01-01 to 2027-01-31", { exact: true })).toBeVisible();

  const periodCard = page.getByRole("heading", { name: "January 2027" }).locator("xpath=ancestor::article[1]");
  const editSummary = periodCard.locator("summary", { hasText: "Edit open period" });

  await periodCard.getByLabel("New status").selectOption("SOFT_LOCKED");
  await periodCard.getByLabel("Reason").fill("Month-end review in progress");
  await periodCard.getByRole("button", { name: "Change status" }).click();
  await expect(periodCard.getByText("Soft Locked", { exact: true })).toBeVisible();
  await expect(periodCard.getByText(/Month-end review in progress/)).toBeVisible();
  await expect(editSummary).toHaveCount(0);

  await periodCard.getByLabel("New status").selectOption("CLOSED");
  await periodCard.getByLabel("Reason").fill("Month-end review completed");
  await periodCard.getByRole("button", { name: "Change status" }).click();
  await expect(periodCard.getByText("Closed", { exact: true })).toBeVisible();

  await periodCard.getByLabel("New status").selectOption("OPEN");
  await periodCard.getByLabel("Reason").fill("Approved correction required");
  await periodCard.getByRole("button", { name: "Change status" }).click();
  await expect(periodCard.getByText("Open", { exact: true })).toBeVisible();
  await expect(periodCard.getByText(/Approved correction required/)).toBeVisible();
  await expect(editSummary).toBeVisible();
});
