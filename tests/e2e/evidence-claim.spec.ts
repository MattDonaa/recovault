import { expect, test, type Page } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

/** Sign up, connect a scenario, analyze, accept a candidate, create + advance a case. */
async function caseAtEvidenceReady(page: Page): Promise<string> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail("ev"));
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Organization name").fill("Evidence Org");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);

  await page.getByLabel("Demo scenario").selectOption("payment-reversal");
  await page.getByRole("button", { name: /Connect demo marketplace \(MOCK\)/i }).click();
  await page.getByRole("button", { name: /Run analysis & find money/i }).click();
  await expect(page).toHaveURL(/\/money-finder$/);

  await page.getByTestId("candidates-table").getByRole("link").first().click();
  await page.getByRole("button", { name: "Start investigating" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByTestId("create-case").click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/);
  // draft → evidence_ready
  await page.getByTestId("case-transitions").getByRole("button", { name: "evidence ready" }).click();
  await expect(page.getByTestId("case-status")).toHaveText(/evidence ready/i);
  return page.url();
}

test("evidence PDF downloads and claim submission is tracked with separate deadlines", async ({ page }) => {
  const caseUrl = await caseAtEvidenceReady(page);

  // Evidence pack is a valid PDF served for this case.
  const pdfUrl = `${caseUrl}/evidence`;
  const res = await page.request.get(pdfUrl);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");

  // Submit the manual claim (reference + date required).
  await page.getByTestId("submit-claim-form").getByLabel("Marketplace ticket / reference").fill("TAK-55555");
  await page.getByLabel("Submission date").fill("2026-01-10");
  await page.getByRole("button", { name: "Mark claim submitted" }).click();

  await expect(page.getByTestId("case-status")).toHaveText(/submitted/i);
  await expect(page.getByTestId("claim-details")).toContainText("TAK-55555");
  // Two separate deadline clocks are shown.
  await expect(page.getByTestId("submission-deadline")).toBeVisible();
  await expect(page.getByTestId("sla-deadline")).toBeVisible();
  await expect(page.getByTestId("disclaimer")).toContainText(/not a guarantee/i);
});

test("evidence pack is denied to another tenant", async ({ page, browser }) => {
  const caseUrl = await caseAtEvidenceReady(page);
  const caseId = caseUrl.split("/cases/")[1]!;
  const orgId = caseUrl.split("/app/org/")[1]!.split("/")[0]!;

  // A different tenant cannot fetch the evidence PDF for org A's case.
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await other.goto("/signup");
  await other.getByLabel("Email").fill(uniqueEmail("intruder"));
  await other.getByLabel("Password").fill("password12345");
  await other.getByRole("button", { name: "Sign up" }).click();
  await expect(other).toHaveURL(/\/app$/);

  const res = await other.request.get(`/app/org/${orgId}/cases/${caseId}/evidence`);
  expect(res.status()).toBe(404);
  await ctx.close();
});
