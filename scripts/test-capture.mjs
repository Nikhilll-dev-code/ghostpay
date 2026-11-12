import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.resolve(__dirname, "../docs/demo_screenshots");

fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log("Launching Chrome at:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  console.log("Navigating to http://localhost:5173/#/signin...");
  await page.goto("http://localhost:5173/#/signin", { waitUntil: "networkidle0" });

  const testFile = path.join(OUT_DIR, "00_test_signin.png");
  await page.screenshot({ path: testFile });
  console.log("Saved test screenshot to:", testFile);

  await browser.close();
  console.log("Test completed successfully!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

