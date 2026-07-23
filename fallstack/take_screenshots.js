import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseUrl = process.env.FALLSTACK_SCREENSHOT_URL ?? 'http://127.0.0.1:8080';

async function assertHeaderBounds(page) {
  await page.locator('.topbar').waitFor();
  const overflow = await page.locator('.topbar').evaluate(header => {
    const headerRect = header.getBoundingClientRect();
    const regions = [
      ['Brand', header.querySelector('.topbar-brand')],
      ['Community tally', header.querySelector('.community-tally')],
      ['Actions', header.querySelector('.topbar-actions')]
    ];
    const missing = regions
      .filter(([, region]) => !region)
      .map(([label]) => ({ label: `Missing ${label}` }));
    const regionOverflow = regions
      .filter(([, region]) => region)
      .map(([label, region]) => {
        const rect = region.getBoundingClientRect();
        return {
          label,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        };
      })
      .filter(
        region =>
          region.left < headerRect.left ||
          region.right > headerRect.right ||
          region.top < headerRect.top ||
          region.bottom > headerRect.bottom
      );
    const actionRects = [...header.querySelectorAll('.topbar-actions button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent?.trim() ?? 'Action', left: rect.left, right: rect.right };
    });
    const actionOverlap = actionRects.slice(1).flatMap((action, index) =>
      action.left < actionRects[index].right ? [action] : []
    );

    return [...missing, ...regionOverflow, ...actionOverlap];
  });

  if (overflow.length > 0) {
    throw new Error(`Header layout overflow: ${JSON.stringify(overflow)}`);
  }
}

async function run() {
  const browser = await chromium.launch();

  // 0. Inline splash viewport
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 500 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    console.log('Navigating to splash.html in Mobile mode...');
    await page.goto(`${baseUrl}/splash.html`);
    await page.waitForTimeout(1000);
    const screenshotPath = path.join(__dirname, 'docs', 'screenshots', 'test_splash.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved splash screenshot to ${screenshotPath}`);
    await context.close();
  }
  
  // 1. Mobile Viewport
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    console.log('Navigating to game.html in Mobile mode...');
    await page.goto(`${baseUrl}/game.html`);
    await page.waitForTimeout(4000); // Wait 4 seconds for Phaser
    await assertHeaderBounds(page);
    const screenshotPath = path.join(__dirname, 'docs', 'screenshots', 'test_mobile.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved mobile screenshot to ${screenshotPath}`);
    await context.close();
  }

  // 2. Desktop Viewport
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    console.log('Navigating to game.html in Desktop mode...');
    await page.goto(`${baseUrl}/game.html`);
    await page.waitForTimeout(4000); // Wait 4 seconds for Phaser
    await assertHeaderBounds(page);
    const screenshotPath = path.join(__dirname, 'docs', 'screenshots', 'test_desktop.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved desktop screenshot to ${screenshotPath}`);
    await context.close();
  }

  // 3. Fullscreen / Large Viewport
  {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    console.log('Navigating to game.html in Fullscreen mode...');
    await page.goto(`${baseUrl}/game.html`);
    await page.waitForTimeout(4000); // Wait 4 seconds for Phaser
    await assertHeaderBounds(page);
    const screenshotPath = path.join(__dirname, 'docs', 'screenshots', 'test_fullscreen.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved fullscreen screenshot to ${screenshotPath}`);
    await context.close();
  }

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
