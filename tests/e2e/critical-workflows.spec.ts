import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { applicationLink, clearMailbox, waitForMessage } from "./helpers/mailpit";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const fixturePath = fileURLToPath(new URL("./fixtures/e2e-evidence.csv", import.meta.url));

function safeRunKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-20) || "local";
}

async function createAccount(page: Page, input: { name: string; email: string; password: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(input.name);
  await page.getByLabel("Email address").fill(input.email);
  await page.getByLabel("Password", { exact: true }).fill(input.password);
  await page.getByLabel("Confirm").fill(input.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/businesses\/new$/);
}

test("critical owner, viewer, private-file, invitation, and recovery workflows", async ({ page, browser }, testInfo) => {
  const runKey = safeRunKey(`${process.env.E2E_RUN_ID ?? Date.now()}-${testInfo.retry}`);
  const ownerEmail = `owner-${runKey}@e2e.local`;
  const viewerEmail = `viewer-${runKey}@e2e.local`;
  const ownerPassword = "Owner-E2E-2026!";
  const viewerPassword = "Viewer-E2E-2026!";
  const viewerNewPassword = "Viewer-Reset-2026!";
  const tenantName = `E2E Group ${runKey}`;
  const businessName = `E2E Technical Services ${runKey}`;
  const businessTradingName = `E2E Trading ${runKey}`;
  const partyName = `E2E Customer ${runKey}`;
  const catalogName = `E2E Service ${runKey}`;
  const sku = `E2E-${runKey.toUpperCase().slice(-14)}`;
  const fixtureName = "e2e-evidence.csv";

  await clearMailbox();

  await test.step("protected account routes reject anonymous users", async () => {
    const context = await browser.newContext({ baseURL });
    const anonymous = await context.newPage();
    await anonymous.goto("/businesses");
    await expect(anonymous).toHaveURL(/\/sign-in/);
    await context.close();
  });

  let businessId = "";
  let tenantId = "";

  await test.step("owner signs up and onboards a tenant and business", async () => {
    await createAccount(page, { name: "E2E Owner", email: ownerEmail, password: ownerPassword });
    await page.getByLabel("Account or group name").fill(tenantName);
    await page.getByLabel("Legal business name").fill(businessName);
    await page.getByLabel("Trading name").fill(businessTradingName);
    await page.getByRole("button", { name: "Create business and continue" }).click();
    await expect(page).toHaveURL(/\/business\/[^/]+\/dashboard$/);
    businessId = new URL(page.url()).pathname.split("/")[2] ?? "";
    expect(businessId).not.toBe("");

    await page.goto("/businesses");
    const administrationLink = page.locator('a[href^="/tenants/"][href$="/users"]').first();
    await expect(administrationLink).toBeVisible();
    const href = await administrationLink.getAttribute("href");
    tenantId = href?.split("/")[2] ?? "";
    expect(tenantId).not.toBe("");
  });

  await test.step("owner creates shared party and catalog master data", async () => {
    await page.goto(`/business/${businessId}/parties`);
    const partyForm = page.getByRole("heading", { name: "Add customer or supplier" }).locator("xpath=ancestor::form");
    await partyForm.getByLabel("Organization name").fill(partyName);
    await partyForm.getByLabel("Email", { exact: true }).fill(`customer-${runKey}@example.com`);
    await partyForm.getByLabel("Phone", { exact: true }).fill("+971501234567");
    await partyForm.getByRole("button", { name: "Create party" }).click();
    await expect(page.getByRole("heading", { name: partyName })).toBeVisible();

    await page.goto(`/business/${businessId}/catalog`);
    const catalogForm = page.getByRole("heading", { name: "Add product or service" }).locator("xpath=ancestor::form");
    await catalogForm.getByLabel("Type").selectOption("SERVICE");
    await catalogForm.getByLabel("SKU").fill(sku);
    await catalogForm.getByLabel("Name", { exact: true }).fill(catalogName);
    await catalogForm.getByLabel("Sales price").fill("250.5000");
    await catalogForm.getByLabel("Purchase price").fill("100.2500");
    await catalogForm.getByLabel("Sales class").selectOption("SERVICE_REVENUE");
    await catalogForm.getByLabel("Purchase class").selectOption("DIRECT_EXPENSE");
    await catalogForm.getByRole("button", { name: "Create catalog record" }).click();
    await expect(page.getByRole("link", { name: catalogName })).toBeVisible();
  });

  await test.step("owner uploads and downloads a private file", async () => {
    await page.goto(`/business/${businessId}/files`);
    const uploadForm = page.getByRole("heading", { name: "Upload private file" }).locator("xpath=ancestor::form");
    await uploadForm.getByLabel("File").setInputFiles(fixturePath);
    await uploadForm.getByLabel("Label").fill("Browser verification evidence");
    await uploadForm.getByRole("button", { name: "Upload privately" }).click();
    await expect(page.getByRole("heading", { name: fixtureName })).toBeVisible();

    const fileCard = page.getByRole("heading", { name: fixtureName }).locator("xpath=ancestor::div[.//a[normalize-space()='Download']][1]");
    const downloadPromise = page.waitForEvent("download");
    await fileCard.getByRole("link", { name: "Download" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    expect(await readFile(downloadPath!, "utf8")).toContain("browser-workflow,verified");
  });

  let invitationUrl = "";
  await test.step("owner queues a viewer invitation and Mailpit receives it", async () => {
    await page.goto(`/tenants/${tenantId}/users`);
    const invitationForm = page.getByRole("heading", { name: "Grant business access" }).locator("xpath=ancestor::form");
    await invitationForm.getByLabel("Email").fill(viewerEmail);
    await invitationForm.getByLabel("Role").selectOption("business.viewer");
    await invitationForm.getByRole("button", { name: "Queue invitation" }).click();
    await expect(invitationForm.getByRole("status")).toContainText("queued for email delivery");

    const message = await waitForMessage(viewerEmail, "Invitation to");
    invitationUrl = applicationLink(message, "/invitations/", baseURL);
  });

  const viewerContext = await browser.newContext({ baseURL });
  const viewerPage = await viewerContext.newPage();

  await test.step("invited viewer creates an account and accepts only the granted role", async () => {
    await createAccount(viewerPage, { name: "E2E Viewer", email: viewerEmail, password: viewerPassword });
    await viewerPage.goto(invitationUrl);
    await viewerPage.getByRole("button", { name: "Accept invitation" }).click();
    await expect(viewerPage).toHaveURL(/\/businesses$/);
    await expect(viewerPage.getByRole("heading", { name: businessTradingName })).toBeVisible();
    await expect(viewerPage.getByText(businessName, { exact: true })).toBeVisible();
    await expect(viewerPage.getByText("viewer", { exact: true })).toBeVisible();
  });

  await test.step("viewer can read shared data and files but cannot write", async () => {
    await viewerPage.goto(`/business/${businessId}/parties`);
    await expect(viewerPage.getByRole("heading", { name: partyName })).toBeVisible();
    await expect(viewerPage.getByRole("heading", { name: "Add customer or supplier" })).toHaveCount(0);

    const denied = await viewerContext.request.post(`${baseURL}/api/businesses/${businessId}/parties`, {
      data: {
        type: "ORGANIZATION",
        roles: ["CUSTOMER"],
        legalName: `Denied ${runKey}`,
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        taxRegistrationNumber: "",
        notes: "",
      },
    });
    expect(denied.status()).toBe(403);

    await viewerPage.goto(`/business/${businessId}/catalog`);
    await expect(viewerPage.getByRole("link", { name: catalogName })).toBeVisible();
    await expect(viewerPage.getByRole("heading", { name: "Add product or service" })).toHaveCount(0);

    await viewerPage.goto(`/business/${businessId}/files`);
    await expect(viewerPage.getByRole("heading", { name: fixtureName })).toBeVisible();
    await expect(viewerPage.getByRole("heading", { name: "Upload private file" })).toHaveCount(0);
    const fileCard = viewerPage.getByRole("heading", { name: fixtureName }).locator("xpath=ancestor::div[.//a[normalize-space()='Download']][1]");
    const downloadPromise = viewerPage.waitForEvent("download");
    await fileCard.getByRole("link", { name: "Download" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    expect(await readFile(downloadPath!, "utf8")).toContain("private-download,verified");
  });

  await test.step("password reset is delivered, updates credentials, and revokes the old session", async () => {
    await clearMailbox();
    const resetContext = await browser.newContext({ baseURL });
    const resetPage = await resetContext.newPage();
    await resetPage.goto("/forgot-password");
    await resetPage.getByLabel("Email address").fill(viewerEmail);
    await resetPage.getByRole("button", { name: "Send reset link" }).click();
    await expect(resetPage.getByRole("status")).toContainText("password reset email has been sent");

    const message = await waitForMessage(viewerEmail, "Reset your ERP 2026 password");
    const resetUrl = applicationLink(message, "/reset-password", baseURL);
    await resetPage.goto(resetUrl);
    await resetPage.getByLabel("New password").fill(viewerNewPassword);
    await resetPage.getByLabel("Confirm password").fill(viewerNewPassword);
    await resetPage.getByRole("button", { name: "Set new password" }).click();
    await expect(resetPage.getByText("Password updated", { exact: true })).toBeVisible();

    await viewerPage.goto("/businesses");
    await expect(viewerPage).toHaveURL(/\/sign-in/);
    await viewerPage.getByLabel("Email address").fill(viewerEmail);
    await viewerPage.getByLabel("Password").fill(viewerNewPassword);
    await viewerPage.getByRole("button", { name: "Sign in" }).click();
    await expect(viewerPage).toHaveURL(/\/businesses$/);
    await expect(viewerPage.getByRole("heading", { name: businessTradingName })).toBeVisible();
    await expect(viewerPage.getByText(businessName, { exact: true })).toBeVisible();

    await resetContext.close();
  });

  await viewerContext.close();
});
