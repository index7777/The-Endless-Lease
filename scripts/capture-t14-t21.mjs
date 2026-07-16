import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH;
if (!playwrightPath) throw new Error("PLAYWRIGHT_PACKAGE_PATH is required");
const { chromium } = require(playwrightPath);

const baseUrl = process.env.VALIDATION_BASE_URL ?? "http://localhost:3000/";
const outputRoot = resolve("outputs/validation/ui-rework-2026-07-17");
const allViewports = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "mobile-landscape", width: 844, height: 390 },
];
const viewportFilter = process.env.VALIDATION_VIEWPORT;
const viewports = viewportFilter
  ? allViewports.filter(viewport => viewport.name === viewportFilter)
  : allViewports;
if (!viewports.length) throw new Error(`Unknown VALIDATION_VIEWPORT: ${viewportFilter}`);

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
}

const timingResults = [];
try {
  for (const viewport of viewports) {
    const directory = resolve(outputRoot, viewport.name);
    await mkdir(directory, { recursive: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.clear());
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator(".start-screen").waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: resolve(directory, "t14-title.png") });

    await page.getByRole("button", { name: "走進公寓，撿起租屋字條" }).click();
    await page.getByRole("heading", { name: "輪迴入住登記表" }).waitFor();
    await page.screenshot({ path: resolve(directory, "t17-registration.png") });

    await page.getByPlaceholder("請填寫姓名").fill("沈默");
    await page.getByRole("button", { name: "接受資格審查" }).click();
    await page.getByRole("heading", { name: "命運裁定", exact: true }).first().waitFor();
    if (viewport.name === "1920x1080") {
      const dieLayout = await page.locator(".physical-die-tray").evaluate(element => ({
        html: element.innerHTML,
        rect: element.getBoundingClientRect().toJSON(),
        display: getComputedStyle(element).display,
      }));
      console.log(JSON.stringify({ dieLayout }, null, 2));
    }
    await page.screenshot({ path: resolve(directory, "t18-fate-verdict.png") });

    await page.getByRole("button", { name: "擲出結果" }).click();
    await page.getByRole("heading", { name: "依骰子結果可建檔的項目" }).waitFor();
    await page.screenshot({ path: resolve(directory, "t19-archive-selection.png") });

    const voiceDuration = await page.evaluate(async () => {
      const audio = new Audio("/audio/voice/hongyi/demo01.mp3");
      await new Promise((resolvePromise, rejectPromise) => {
        audio.addEventListener("loadedmetadata", resolvePromise, { once: true });
        audio.addEventListener("error", rejectPromise, { once: true });
        audio.load();
      });
      return audio.duration * 1000;
    });
    const startedAt = Date.now();
    await page.getByRole("button", { name: /身份確認/ }).click();
    await page.getByRole("heading", { name: "確認你的最終建檔內容" }).waitFor({ timeout: 30000 });
    timingResults.push({ viewport: viewport.name, voiceDurationMs: Math.round(voiceDuration), transitionMs: Date.now() - startedAt });
    await page.screenshot({ path: resolve(directory, "t21-identity-confirmation.png") });
    await page.getByRole("button", { name: /確認建檔結果/ }).click();
    await page.locator(".filing-complete").waitFor();
    await page.screenshot({ path: resolve(directory, "t22-archive-complete.png") });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(timingResults, null, 2));
