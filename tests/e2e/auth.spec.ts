import { expect, test } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

async function signup(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("unauthenticated user is redirected away from the protected app", async ({
  page,
}) => {
  const res = await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  // Redirected to login (never rendered the app shell).
  expect(res).toBeTruthy();
});

test("signup, create org, view it, then logout revokes access", async ({
  page,
}) => {
  const email = uniqueEmail("flow");
  await signup(page, email);

  // Shell shows the user identity.
  await expect(page.getByText(email)).toBeVisible();

  // Create an organization.
  await page.getByLabel("Organization name").fill("Acme Trading");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Acme Trading" }),
  ).toBeVisible();

  // Log out.
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Session is revoked: protected route redirects to login again.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("login works after signup", async ({ page }) => {
  const email = uniqueEmail("login");
  await signup(page, email);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("rejects wrong credentials with a non-sensitive error", async ({
  page,
}) => {
  // Fresh, unauthenticated context: an unknown account cannot log in.
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail("nobody"));
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a user cannot access another organization by URL (server-enforced)", async ({
  browser,
}) => {
  // User A creates an org and we capture its id from the URL.
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await signup(pageA, uniqueEmail("tenantA"));
  await pageA.getByLabel("Organization name").fill("Tenant A Org");
  await pageA.getByRole("button", { name: "Create organization" }).click();
  await expect(pageA).toHaveURL(/\/app\/org\/[0-9a-f-]+$/);
  const orgAId = pageA.url().split("/app/org/")[1]!;
  await ctxA.close();

  // User B (separate context/session) attempts to open A's org directly.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signup(pageB, uniqueEmail("tenantB"));
  const res = await pageB.goto(`/app/org/${orgAId}`);
  // Server authorization denies with 404 (existence not disclosed).
  expect(res?.status()).toBe(404);
  await expect(pageB.getByText("Tenant A Org")).toHaveCount(0);
  await ctxB.close();
});
