import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const browser = await chromium.launch();
  
  // 1. Mobile Viewport
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    console.log('Navigating to game.html in Mobile mode...');
    await page.goto('http://127.0.0.1:8080/game.html');
    await page.waitForTimeout(4000); // Wait 4 seconds for Phaser
    const screenshotPath = path.join(__dirname, 'docs', 'screenshots', 'test_mobile.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved mobile screenshot to ${screenshotPath}`);
  }

  // 2. Desktop Viewport
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    console.log('Navigating to game.html in Desktop mode...');
    await page.goto('http://127.0.0.1:8080/game.html');
    await page.waitForTimeout(4000); // Wait 4 seconds for Phaser
    const screenshotPath = path.join(__dirname, 'docs', 'screenshots', 'test_desktop.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved desktop screenshot to ${screenshotPath}`);
  }

  // 3. Fullscreen / Large Viewport
  {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    console.log('Navigating to game.html in Fullscreen mode...');
    await page.goto('http://127.0.0.1:8080/game.html');
    await page.waitForTimeout(4000); // Wait 4 seconds for Phaser
    const screenshotPath = path.join(__dirname, 'docs', 'screenshots', 'test_fullscreen.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved fullscreen screenshot to ${screenshotPath}`);
  }

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
