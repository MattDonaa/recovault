import { expect, test } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

/**
 * Golden end-to-end scenario (mock-validated MVP): connect → sync/analyze →
 * candidate → accept → case → evidence → submit → advance → match recovery →
 * recovered → dashboard total. Proven entirely with mock data.
 */
test("golden loop: mock connection through to a verified recovery", async ({ page }) => {
  // 1. Sign up + org.
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail("golden"));
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Organization name").fill("Golden Org");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);

  // 2-3. Connect mock marketplace + run sync/analysis (persist + normalize + detect).
  // payment-reversal yields an MR-003 candidate with an exact monetary amount.
  await page.getByLabel("Demo scenario").selectOption("payment-reversal");
  await page.getByRole("button", { name: /Connect demo marketplace \(MOCK\)/i }).click();
  await page.getByRole("button", { name: /Run analysis & find money/i }).click();
  await expect(page).toHaveURL(/\/money-finder$/);
  await expect(page.getByTestId("mock-banner")).toBeVisible(); // AC-06: mock/demo status visible

  // 4-6. Candidate visible in Money Finder.
  await expect(page.getByTestId("total-candidates")).toHaveText("1");
  await page.getByTestId("candidates-table").getByRole("link").first().click();

  // 7. Accept the candidate.
  await page.getByRole("button", { name: "Start investigating" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText(/accepted/i);

  // 8. Create the case.
  await page.getByTestId("create-case").click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+$/);
  const caseUrl = page.url();

  // 9. Evidence pack (PDF) available.
  const pdf = await page.request.get(`${caseUrl}/evidence`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  // draft → evidence_ready.
  await page.getByTestId("case-transitions").getByRole("button", { name: "evidence ready" }).click();
  await expect(page.getByTestId("case-status")).toHaveText(/evidence ready/i);

  // 10. Mark manually submitted (reference + date).
  await page.getByLabel("Marketplace ticket / reference").fill("TAK-GOLDEN-1");
  await page.getByLabel("Submission date").fill("2026-01-10");
  await page.getByRole("button", { name: "Mark claim submitted" }).click();
  await expect(page.getByTestId("case-status")).toHaveText(/submitted/i);

  // Advance submitted → under_review → accepted → payment_expected.
  for (const label of ["under review", "accepted", "payment expected"]) {
    await page.getByTestId("case-transitions").getByRole("button", { name: label }).click();
  }
  await expect(page.getByTestId("case-status")).toHaveText(/payment expected/i);

  // 11-13. Ingest matching recovery + match → recovered.
  await page.getByTestId("record-recovery").click();
  await expect(page.getByTestId("case-status")).toHaveText(/recovered/i);
  await expect(page.getByTestId("recovered-note")).toBeVisible();

  // 14. Recovered dashboard total updates.
  await page.goto(caseUrl.split("/cases/")[0]! + "/money-finder");
  await expect(page.getByTestId("total-recovered")).not.toHaveText(/R\s?0[.,]00/);
});
