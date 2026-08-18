import { expect, test } from "@playwright/test";

import { SECRET_SENTINELS } from "../../playwright.config";

/**
 * AC-04: privileged server-only secrets must never reach the browser. The dev
 * server is started (see playwright.config) with sentinel values for
 * AUTH_SESSION_SECRET and SUPABASE_SERVICE_ROLE_KEY; this test proves neither
 * appears in any HTML or JavaScript served to the client, including the
 * authenticated app shell.
 */
async function collectClientPayloads(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
): Promise<string[]> {
  const payloads: string[] = [await page.content()];
  const srcs = await page.$$eval("script[src]", (els) =>
    els.map((e) => (e as HTMLScriptElement).src).filter(Boolean),
  );
  for (const src of srcs) {
    const res = await request.get(src);
    if (res.ok()) payloads.push(await res.text());
  }
  return payloads;
}

test("server secrets never appear in client HTML or JS", async ({
  page,
  request,
}) => {
  const email = `secret-${Date.now()}@example.test`;
  const collected: string[] = [];

  // Public pages.
  for (const path of ["/", "/login", "/signup"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    collected.push(...(await collectClientPayloads(page, request)));
  }

  // Authenticated app shell.
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.waitForLoadState("networkidle");
  collected.push(...(await collectClientPayloads(page, request)));

  expect(collected.length).toBeGreaterThan(0);
  for (const payload of collected) {
    for (const sentinel of SECRET_SENTINELS) {
      expect(payload).not.toContain(sentinel);
    }
  }
});
