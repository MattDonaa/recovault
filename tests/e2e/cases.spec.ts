import { expect, test, type Page } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function acceptedCandidate(page: Page): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail("case"));
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Organization name").fill("Case Org");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);

  await page.getByLabel("Demo scenario").selectOption("return-mismatch");
  await page.getByRole("button", { name: /Connect demo marketplace \(MOCK\)/i }).click();
  await page.getByRole("button", { name: /Run analysis & find money/i }).click();
  await expect(page).toHaveURL(/\/money-finder$/);

  await page.getByTestId("candidates-table").getByRole("link").first().click();
  // detected → investigating → accepted
  await page.getByRole("button", { name: "Start investigating" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText(/accepted/i);
}

test("an accepted candidate creates a case, transitions, and audits", async ({ page }) => {
  await acceptedCandidate(page);

  // Create the case.
  await page.getByTestId("create-case").click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/);
  await expect(page.getByTestId("case-status")).toHaveText(/draft/i);
  // Audit trail has the creation event.
  await expect(page.getByTestId("audit-trail")).toContainText("created");
  // Evidence carried over.
  await expect(page.getByTestId("case-evidence")).not.toBeEmpty();

  // Advance the case; a transition is audited.
  await page.getByTestId("case-transitions").getByRole("button", { name: "evidence ready" }).click();
  await expect(page.getByTestId("case-status")).toHaveText(/evidence ready/i);
  await expect(page.getByTestId("audit-trail")).toContainText("transition");
});

test("re-opening the accepted candidate links to the existing case (idempotent)", async ({ page }) => {
  await acceptedCandidate(page);
  const candidateUrl = page.url();
  await page.getByTestId("create-case").click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/);
  const caseUrl = page.url();

  // Revisit the candidate → it now links to the existing case, not a create button.
  await page.goto(candidateUrl);
  await expect(page.getByTestId("view-case")).toBeVisible();
  await expect(page.getByTestId("create-case")).toHaveCount(0);
  await page.getByTestId("view-case").click();
  await expect(page).toHaveURL(caseUrl);
});
