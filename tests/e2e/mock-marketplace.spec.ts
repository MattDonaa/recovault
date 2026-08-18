import { expect, test, type Page } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndCreateOrg(page: Page, name: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail("mkt"));
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Organization name").fill(name);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);
}

test("connect a MOCK demo marketplace and view synthetic data, clearly labeled", async ({
  page,
}) => {
  await signupAndCreateOrg(page, "Marketplace Org");

  // The connections section is labeled MOCK.
  await expect(page.getByText("MOCK", { exact: true }).first()).toBeVisible();

  // Connect a specific synthetic scenario.
  await page
    .getByLabel("Demo scenario")
    .selectOption("shipment-discrepancy");
  await page
    .getByRole("button", { name: /Connect demo marketplace \(MOCK\)/i })
    .click();

  // Landed on the account view, visibly labeled MOCK/synthetic.
  await expect(page).toHaveURL(/\/marketplace\/[0-9a-f-]+$/);
  await expect(page.getByTestId("mock-badge")).toContainText(/mock/i);
  await expect(
    page.getByRole("heading", { name: /Shipment discrepancy/i }),
  ).toBeVisible();

  // Adapter-derived counts are rendered (1 shipment in this scenario).
  await expect(page.getByTestId("count-shipments")).toContainText("1");
  await expect(page.getByTestId("count-sales")).toContainText("0");
});

test("malformed scenario surfaces quarantined records (fail closed)", async ({
  page,
}) => {
  await signupAndCreateOrg(page, "Quarantine Org");

  await page.getByLabel("Demo scenario").selectOption("malformed-payload");
  await page
    .getByRole("button", { name: /Connect demo marketplace \(MOCK\)/i })
    .click();
  await expect(page).toHaveURL(/\/marketplace\/[0-9a-f-]+$/);
  await expect(page.getByTestId("quarantined-note")).toContainText(
    /quarantined/i,
  );
});
