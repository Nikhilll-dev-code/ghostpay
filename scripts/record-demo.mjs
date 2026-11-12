import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.resolve(__dirname, "../docs/demo_screenshots");
const FRAMES_DIR = path.resolve(__dirname, "../docs/demo_frames");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let frameIndex = 0;
async function captureFrame(page, label = "") {
  frameIndex++;
  const padded = String(frameIndex).padStart(4, "0");
  const filename = path.join(FRAMES_DIR, `frame_${padded}.png`);
  await page.screenshot({ path: filename });
  if (label) {
    console.log(`[Frame ${padded}] ${label}`);
  }
}

async function run() {
  console.log("Starting Ghost 3.0 Automated Demo Recorder...");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 },
  });

  const page = await browser.newPage();

  // 1. Landing Page
  console.log("Scene 1: Public Landing Page");
  await page.goto("http://localhost:5173/#/", { waitUntil: "networkidle0" });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "01_landing_page.png") });
  for (let i = 0; i < 3; i++) await captureFrame(page, "Landing Page Hero");
  
  await page.evaluate(() => window.scrollBy({ top: 500, behavior: "smooth" }));
  await sleep(800);
  await captureFrame(page, "Landing Page Features");

  // 2. Sign In Screen
  console.log("Scene 2: Sign-in Screen");
  await page.goto("http://localhost:5173/#/signin", { waitUntil: "networkidle0" });
  await sleep(800);
  await page.screenshot({ path: path.join(OUT_DIR, "02_signin_screen.png") });
  for (let i = 0; i < 3; i++) await captureFrame(page, "Sign-in Screen");

  // Click Submit (Owner credentials already prefilled)
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click();
  await sleep(1500);

  // 3. Overview Dashboard
  console.log("Scene 3: Overview Dashboard");
  await page.goto("http://localhost:5173/#/app/overview", { waitUntil: "networkidle0" });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "03_overview_dashboard.png") });
  for (let i = 0; i < 4; i++) await captureFrame(page, "Overview Dashboard");

  // 4. Judge Fast-Track Guide Modal
  console.log("Scene 4: Judge Guide Modal");
  const judgeBtn = await page.$('button[title*="Judge Fast Track"]');
  if (judgeBtn) {
    await judgeBtn.click();
    await sleep(800);
    await page.screenshot({ path: path.join(OUT_DIR, "04_judge_fast_track_guide.png") });
    for (let i = 0; i < 4; i++) await captureFrame(page, "Judge Guide Open");
    // Close modal
    await page.keyboard.press("Escape");
    await sleep(500);
  }

  // 5. Ghost Brain - Bounded Purchase
  console.log("Scene 5: Ghost Brain (Authorized Purchase)");
  await page.goto("http://localhost:5173/#/app/brain", { waitUntil: "networkidle0" });
  await sleep(1500);

  // Click Preset 1
  const preset1 = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.find((b) => b.textContent?.includes("1. Eligible purchase"));
  });
  if (preset1) {
    await preset1.click();
    await sleep(1500);
    await captureFrame(page, "Formulated Proposal");

    // Click Ask the Trust Engine
    const evalBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.find((b) => b.textContent?.includes("Ask the Trust Engine"));
    });
    if (evalBtn && evalBtn.click) {
      await evalBtn.click();
      await sleep(1500);
      await captureFrame(page, "Trust Engine Evaluated");

      // Click Execute in PayPal Sandbox
      const execBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find((b) => b.textContent?.includes("Execute in PayPal Sandbox"));
      });
      if (execBtn && execBtn.click) {
        await execBtn.click();
        await sleep(2000);
      }
    }
  }
  await page.screenshot({ path: path.join(OUT_DIR, "05_ghost_brain_authorized_purchase.png") });
  for (let i = 0; i < 4; i++) await captureFrame(page, "Executed in PayPal Sandbox");

  // 6. Ghost Brain - Prompt Injection Defense
  console.log("Scene 6: Ghost Brain (Prompt Injection Intercepted)");
  const preset4 = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.find((b) => b.textContent?.includes("4. Social engineering"));
  });
  if (preset4) {
    await preset4.click();
    await sleep(1500);
    const evalBtn2 = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.find((b) => b.textContent?.includes("Ask the Trust Engine"));
    });
    if (evalBtn2 && evalBtn2.click) {
      await evalBtn2.click();
      await sleep(1500);
    }
  }
  await page.screenshot({ path: path.join(OUT_DIR, "06_ghost_brain_prompt_injection_blocked.png") });
  for (let i = 0; i < 4; i++) await captureFrame(page, "Prompt Injection Blocked");

  // 7. Approvals Queue
  console.log("Scene 7: Approvals Queue");
  await page.goto("http://localhost:5173/#/app/approvals", { waitUntil: "networkidle0" });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT_DIR, "07_human_approvals_queue.png") });
  for (let i = 0; i < 3; i++) await captureFrame(page, "Approvals Queue");

  // 8. Authority Passport
  console.log("Scene 8: Authority Passport");
  await page.goto("http://localhost:5173/#/app/authority", { waitUntil: "networkidle0" });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT_DIR, "08_authority_passport_policy.png") });
  for (let i = 0; i < 3; i++) await captureFrame(page, "Authority Passport Policy");

  // 9. What-If Simulation Lab
  console.log("Scene 9: What-If Simulation Lab");
  await page.goto("http://localhost:5173/#/app/whatif", { waitUntil: "networkidle0" });
  await sleep(1200);
  const runSimBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.find((b) => b.textContent?.includes("Run simulation"));
  });
  if (runSimBtn && runSimBtn.click) {
    await runSimBtn.click();
    await sleep(1500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "09_what_if_simulation_lab.png") });
  for (let i = 0; i < 3; i++) await captureFrame(page, "What-If Simulation Replay");

  // 10. Ghostbreaker Attack Suite
  console.log("Scene 10: Ghostbreaker Attack Suite");
  await page.goto("http://localhost:5173/#/app/ghostbreaker", { waitUntil: "networkidle0" });
  await sleep(1200);
  const runAttacksBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.find((b) => b.textContent?.includes("Run Ghostbreaker"));
  });
  if (runAttacksBtn && runAttacksBtn.click) {
    await runAttacksBtn.click();
    await sleep(2000);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "10_ghostbreaker_red_team_suite.png") });
  for (let i = 0; i < 4; i++) await captureFrame(page, "Ghostbreaker Attack Suite");

  // 11. Transactions & Ledger
  console.log("Scene 11: Transactions Ledger");
  await page.goto("http://localhost:5173/#/app/transactions", { waitUntil: "networkidle0" });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT_DIR, "11_transactions_paypal_ledger.png") });
  for (let i = 0; i < 3; i++) await captureFrame(page, "Transactions Ledger");

  // 12. Audit Trail
  console.log("Scene 12: Audit Trail");
  await page.goto("http://localhost:5173/#/app/audit", { waitUntil: "networkidle0" });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT_DIR, "12_audit_trail_evidence.png") });
  for (let i = 0; i < 3; i++) await captureFrame(page, "Audit Trail Evidence");

  // 13. Settings & PayPal Connectivity
  console.log("Scene 13: Settings & PayPal Diagnostic");
  await page.goto("http://localhost:5173/#/app/settings", { waitUntil: "networkidle0" });
  await sleep(1200);
  const testConnBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.find((b) => b.textContent?.includes("Test connectivity"));
  });
  if (testConnBtn && testConnBtn.click) {
    await testConnBtn.click();
    await sleep(1000);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "13_settings_paypal_diagnostic.png") });
  for (let i = 0; i < 4; i++) await captureFrame(page, "Settings PayPal Diagnostic");

  await browser.close();
  console.log(`Demo recording capture finished! Total frames captured: ${frameIndex}`);
}

run().catch((err) => {
  console.error("Recording error:", err);
  process.exit(1);
});
