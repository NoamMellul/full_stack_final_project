import { expect, test } from "@playwright/test";

// MN1 fix 1 (06-UI-REVIEW.md Color pillar BLOCKER): --primary must carry
// real chroma in both the light :root block and the .dark block, and that
// chroma must actually reach the pixel a user clicks, not just the source
// CSS. Chromium's serialization of a computed color declared in oklch() is
// not stable across versions — sometimes it reports rgb()/rgba(), sometimes
// it preserves oklch() when the value is in-gamut — so this helper handles
// both forms explicitly and fails loudly (with the raw string) for anything
// else, rather than silently reporting a false green.
function isHued(color: string): boolean {
  const trimmed = color.trim();

  if (trimmed.startsWith("rgb")) {
    const channels = trimmed.match(/[\d.]+/g);
    if (!channels || channels.length < 3) {
      throw new Error(`Could not parse rgb/rgba channels from: "${trimmed}"`);
    }
    const [r, g, b] = channels.slice(0, 3).map(Number);
    return !(r === g && g === b);
  }

  if (trimmed.startsWith("oklch")) {
    const body = trimmed.replace(/^oklch\(/, "").replace(/\)\s*$/, "");
    const parts = body.trim().split(/\s+/);
    const chroma = Number(parts[1]);
    if (Number.isNaN(chroma)) {
      throw new Error(`Could not parse oklch chroma component from: "${trimmed}"`);
    }
    return chroma > 0;
  }

  // Discovered live during the RED run (not anticipated by the plan): this
  // Chromium build serializes a computed color declared in oklch() as
  // lab(L a b), not rgb()/rgba() or oklch(). A genuinely gray color still
  // carries floating-point noise from the oklch -> Lab conversion (observed
  // as low as -0.0000149), so an epsilon distinguishes real hue from
  // rounding noise rather than naively checking a !== 0 || b !== 0.
  if (trimmed.startsWith("lab")) {
    const body = trimmed.replace(/^lab\(/, "").replace(/\)\s*$/, "");
    const parts = body.trim().split(/\s+/);
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new Error(`Could not parse lab a/b channels from: "${trimmed}"`);
    }
    const EPSILON = 0.01;
    return Math.abs(a) > EPSILON || Math.abs(b) > EPSILON;
  }

  throw new Error(`Unrecognized computed color serialization: "${trimmed}"`);
}

async function readPrimaryToken(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
  );
}

test.describe("MN1: brand accent token paints hued in light and dark, end-to-end on /login", () => {
  test("light mode: --primary carries non-zero chroma", async ({ page }) => {
    await page.goto("/login");
    const value = await readPrimaryToken(page);
    expect(isHued(value), `--primary (light) was not hued: "${value}"`).toBe(true);
  });

  test("dark mode: --primary carries non-zero chroma and differs from light mode", async ({
    page,
  }) => {
    await page.goto("/login");
    const light = await readPrimaryToken(page);

    // The app ships no theme toggle — adding the .dark class by hand inside
    // page.evaluate is the only way to reach the dark block at all.
    const dark = await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      return getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    });

    expect(isHued(dark), `--primary (dark) was not hued: "${dark}"`).toBe(true);
    expect(dark, "dark --primary should differ from the light value").not.toBe(light);
  });

  test("end-to-end paint: the /login submit button's live background is hued", async ({
    page,
  }) => {
    await page.goto("/login");
    const button = page.getByRole("button", { name: "Log in" });
    const backgroundColor = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(
      isHued(backgroundColor),
      `submit button background-color was not hued: "${backgroundColor}"`,
    ).toBe(true);
  });

  test("accessible-name guard: the submit control is still reachable by its accessible name", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});
