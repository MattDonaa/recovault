import { expect, test, type Page } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signupAndCreateOrg(page: Page, name: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail("sec"));
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Organization name").fill(name);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);
}

test("mock connection verifies without a credential", async ({ page }) => {
  await signupAndCreateOrg(page, "Secure Mock Org");

  await page.getByLabel("Demo scenario").selectOption("healthy");
  await page.getByRole("button", { name: /Connect demo marketplace \(MOCK\)/i }).click();
  await expect(page).toHaveURL(/\/marketplace\/[0-9a-f-]+$/);

  // Not verified until an explicit check.
  await expect(page.getByTestId("connection-status")).toHaveText(/pending/i);
  await page.getByRole("button", { name: "Verify connection" }).click();
  await expect(page.getByTestId("connection-status")).toHaveText(/connected/i);
});

test("live credential is stored encrypted, never echoed, and stays unverified", async ({
  page,
}) => {
  const LIVE_KEY = "LIVE_TAKEALOT_KEY_SENTINEL_DO_NOT_LEAK";
  await signupAndCreateOrg(page, "Secure Live Org");

  await page.getByLabel("Connection name").fill("Takealot Live");
  await page.getByLabel("Takealot API key").fill(LIVE_KEY);
  await page.getByRole("button", { name: "Add live connection" }).click();

  await expect(page).toHaveURL(/\/marketplace\/[0-9a-f-]+$/);
  await expect(page.getByTestId("mode-badge")).toHaveText(/live/i);
  // Never faked as verified.
  await expect(page.getByTestId("connection-status")).toHaveText(/pending/i);
  await expect(page.getByTestId("credential-state")).toContainText(/encrypted/i);

  // The submitted key must not appear anywhere in the served page.
  expect(await page.content()).not.toContain(LIVE_KEY);
});
