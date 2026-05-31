import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer test for the ADVERTISED core action: an anonymous
 * team skill radar where each peer self-rates skills 1–4 and the team sees an
 * AGGREGATE radar (per-skill average polygon + mentor-share polygon) — never
 * any individual rating.
 *
 * The single falsifiable question: when peer A and peer B each self-rate the
 * SAME skill differently, does the aggregate the OTHER peer sees reflect BOTH
 * ratings (the mean), and does the mentor overlay reflect a 4-rating on the
 * opposite peer? If ratings went to local `useState`, peer B would render only
 * its own value and these assertions would fail.
 *
 * Anonymity invariant also checked: ratings are keyed in the `ratings` Y.Map by
 * an opaque peerId only; the radar exposes per-skill avg / mentor share, never
 * a per-peer breakdown. We assert no opaque device id leaks into the DOM.
 *
 * Subtlety: two Playwright pages share one browser context → one origin → one
 * localStorage. The app derives a device id via `ensurePeerId()` (a persisted
 * random UUID). Without distinct ids both peers would write the same `ratings`
 * Y.Map key and silently collapse to one respondent. We override
 * `crypto.randomUUID` per page before boot so each mints a distinct id,
 * modelling two real phones. A 2-respondent mean is only reachable if the two
 * ratings live under distinct keys AND replicate across the mesh.
 */
async function openTwoRaters(
  browser: Browser,
  url: string,
  roomId: string,
): Promise<{ a: Page; b: Page; cleanup: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL: url || undefined });

  await context.addInitScript(
    ({ prefix, room, sig }) => {
      try {
        localStorage.setItem(`${prefix}:room`, room);
        localStorage.setItem(`${prefix}:signalingUrl`, sig);
        localStorage.removeItem(`${prefix}:iceServers`);
        localStorage.removeItem(`${prefix}:peerId`);
      } catch {
        /* ignore */
      }
    },
    { prefix: storagePrefix, room: roomId, sig: "ws://localhost:1/never-connects" },
  );

  const pinDeviceId = (id: string) =>
    `(() => { crypto.randomUUID = () => ${JSON.stringify(id)}; })();`;

  const a = await context.newPage();
  await a.addInitScript(pinDeviceId("device-A"));
  const b = await context.newPage();
  await b.addInitScript(pinDeviceId("device-B"));

  await Promise.all([a.goto(url), b.goto(url)]);
  return { a, b, cleanup: () => context.close() };
}

async function connect(page: Page) {
  await page.getByRole("button", { name: /^connect$/i }).click();
  await expect(page.locator(".skill-stage")).toBeVisible();
}

/** Rate a skill by its visible name on the given page. */
async function rate(page: Page, skill: string, value: number) {
  const row = page.locator(".skill-row", { hasText: skill }).first();
  await row.getByRole("button", { name: `Rate ${skill} as ${value}` }).click();
}

/** First avg-polygon point = the index-0 ("frontend") axis, straight up. */
function expectedAvgPointAtTop(avg: number): string {
  const R = 80;
  const r = (avg / 4) * R;
  const x = Math.cos(-Math.PI / 2) * r; // 0
  const y = Math.sin(-Math.PI / 2) * r; // -r
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

test("aggregate radar mean reflects BOTH peers' self-ratings across the mesh", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoRaters(
    browser,
    baseURL ?? "",
    `e2e-skill-${Math.random().toString(36).slice(2, 8)}`,
  );
  try {
    await connect(a);
    await connect(b);

    // The default skill list seeds with "frontend" first (index 0 = top axis).
    // After the convergent de-dup pass both peers settle on exactly 10 skills
    // (no double-seed duplicates).
    await expect(a.locator(".skill-hud")).toContainText("10 skills");
    await expect(b.locator(".skill-hud")).toContainText("10 skills");
    await expect(a.locator(".skill-row", { hasText: "frontend" }).first()).toBeVisible();
    await expect(b.locator(".skill-row", { hasText: "frontend" }).first()).toBeVisible();

    // Peer A rates frontend = 4 (a mentor). Peer B rates frontend = 2.
    // Team mean = (4 + 2) / 2 = 3.
    await rate(a, "frontend", 4);
    await rate(b, "frontend", 2);

    // Both peers must observe 2 responses (proves both ratings replicated).
    await expect(a.locator(".skill-hud")).toContainText("2 responses");
    await expect(b.locator(".skill-hud")).toContainText("2 responses");

    // The aggregate AVERAGE polygon on peer B must encode mean=3 at the top
    // axis. If peer B only saw its own rating (2) it would encode 2; if it only
    // saw A's (4) it would encode 4. Only the cross-mesh mean gives 3.
    const avgPoint3 = expectedAvgPointAtTop(3);
    await expect(b.locator(".skill-radar-avg")).toHaveAttribute(
      "points",
      new RegExp("^" + avgPoint3.replace(/[.\\]/g, "\\$&") + "(\\s|$)"),
    );
    // And on peer A symmetrically.
    await expect(a.locator(".skill-radar-avg")).toHaveAttribute(
      "points",
      new RegExp("^" + avgPoint3.replace(/[.\\]/g, "\\$&") + "(\\s|$)"),
    );

    // Mentor overlay: exactly 1 of 2 respondents is a mentor on frontend, so
    // the mentor-share radius at the top axis = (1/2)*80 = 40 => point 0.00,-40.00.
    // This is non-zero ONLY because peer A's 4-rating crossed the mesh to B.
    await expect(b.locator(".skill-radar-mentor")).toHaveAttribute(
      "points",
      new RegExp("^0\\.00,-40\\.00(\\s|$)"),
    );

    // Anonymity invariant: the opaque per-peer ids must never leak to the DOM.
    const bodyA = await a.locator("body").innerText();
    const bodyB = await b.locator("body").innerText();
    expect(bodyA).not.toContain("device-A");
    expect(bodyA).not.toContain("device-B");
    expect(bodyB).not.toContain("device-A");
    expect(bodyB).not.toContain("device-B");
  } finally {
    await cleanup();
  }
});

test("a skill added on one peer appears on the other (shared skill list)", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoRaters(
    browser,
    baseURL ?? "",
    `e2e-addskill-${Math.random().toString(36).slice(2, 8)}`,
  );
  try {
    await connect(a);
    await connect(b);

    await a.getByLabel("Add a skill").fill("rust");
    await a.getByRole("button", { name: "Add", exact: true }).click();

    // The new skill must propagate to peer B's rating list via the shared
    // `skills` Y.Array — not just appear locally on A. 10 defaults + rust = 11.
    await expect(b.locator(".skill-row", { hasText: "rust" }).first()).toBeVisible();
    await expect(b.locator(".skill-hud")).toContainText("11 skills");
  } finally {
    await cleanup();
  }
});
