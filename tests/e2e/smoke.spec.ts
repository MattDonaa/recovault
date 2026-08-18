import { expect, test } from "@playwright/test";

test("application loads and renders the foundation home page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /RecoVault/i }),
  ).toBeVisible();
});

test("health endpoint responds ok", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe("ok");
});
