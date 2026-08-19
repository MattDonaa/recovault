import { expect, test, type Page } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupCreateOrg(page: Page, name: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail("mf"));
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Organization name").fill(name);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);
}

async function connectAndAnalyze(page: Page, scenario: string): Promise<void> {
  await page.getByLabel("Demo scenario").selectOption(scenario);
  await page.getByRole("button", { name: /Connect demo marketplace \(MOCK\)/i }).click();
  await expect(page).toHaveURL(/\/marketplace\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: /Run analysis & find money/i }).click();
  await expect(page).toHaveURL(/\/money-finder$/);
}

test("mock sync surfaces a recovery candidate with exact total, evidence, and workflow", async ({
  page,
}) => {
  await signupCreateOrg(page, "MF Org");
  await connectAndAnalyze(page, "return-mismatch");

  // Mock label always visible on the financial screen.
  await expect(page.getByTestId("mock-banner")).toBeVisible();
  // Exact total (R199.00) and one candidate.
  await expect(page.getByTestId("total-potential")).toContainText(/199[.,]00/);
  await expect(page.getByTestId("total-candidates")).toHaveText("1");

  // Open the candidate detail.
  await page.getByTestId("candidates-table").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/money-finder\/[0-9a-f-]+$/);
  await expect(page.getByTestId("mock-banner")).toBeVisible();
  await expect(page.getByTestId("calculation")).toBeVisible();
  await expect(page.getByTestId("evidence-table")).toBeVisible();
  await expect(page.getByTestId("status-badge")).toHaveText(/detected/i);

  // Workflow: detected → investigating → accepted persists.
  await page.getByRole("button", { name: "Start investigating" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText(/investigating/i);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText(/accepted/i);
});

test("dismissing a candidate removes it from actionable totals but keeps it auditable", async ({
  page,
}) => {
  await signupCreateOrg(page, "MF Dismiss Org");
  await connectAndAnalyze(page, "return-mismatch");
  await expect(page.getByTestId("total-potential")).toContainText(/199[.,]00/);

  await page.getByTestId("candidates-table").getByRole("link").first().click();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText(/dismissed/i);

  // Actionable total drops to zero; the dismissed candidate is still listed.
  await page.goto(page.url().replace(/\/[0-9a-f-]+$/, ""));
  await expect(page.getByTestId("total-potential")).toContainText(/0[.,]00/);
  await expect(page.getByTestId("total-candidates")).toHaveText("1");
});

test("a user cannot open another organization's candidate", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await signupCreateOrg(pageA, "Tenant A MF");
  await connectAndAnalyze(pageA, "return-mismatch");
  await pageA.getByTestId("candidates-table").getByRole("link").first().click();
  const candidateUrl = pageA.url();
  await ctxA.close();

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signupCreateOrg(pageB, "Tenant B MF");
  const res = await pageB.goto(candidateUrl);
  expect(res?.status()).toBe(404);
  await ctxB.close();
});
