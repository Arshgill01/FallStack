import { writeFile } from 'node:fs/promises';

export async function captureScreenshot(page, options) {
  const {
    locator = null,
    animations,
    clip = null,
    fullPage = false,
    path,
    ...rest
  } = options;
  if (!path) throw new Error('captureScreenshot requires a path');

  const browserName = page.context().browser()?.browserType().name();
  const hasGameCanvas = (await page.locator('#game-canvas canvas').count()) > 0;
  if (browserName !== 'chromium' || !hasGameCanvas) {
    if (locator) return locator.screenshot({ path, animations, ...rest });
    return page.screenshot({
      path,
      animations,
      fullPage,
      ...(clip ? { clip } : {}),
      ...rest,
    });
  }

  const animationStyle =
    animations === 'disabled'
      ? await page.addStyleTag({
          content:
            '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
        })
      : null;
  const session = await page.context().newCDPSession(page);
  try {
    const layout = await session.send('Page.getLayoutMetrics');
    const viewport = layout.cssVisualViewport ?? layout.visualViewport;
    const content = layout.cssContentSize ?? layout.contentSize;
    if (fullPage && content.height > viewport.clientHeight + 1) {
      throw new Error(
        `Stable Chromium capture cannot represent a scrolling full page (${content.height}px > ${viewport.clientHeight}px)`
      );
    }

    const box = locator ? await locator.boundingBox() : clip;
    if (locator && !box)
      throw new Error(
        'Cannot capture an element without a visible bounding box'
      );
    const result = await session.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: false,
      captureBeyondViewport: false,
      ...(box
        ? {
            clip: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              scale: 1,
            },
          }
        : {}),
    });
    const bytes = Buffer.from(result.data, 'base64');
    await writeFile(path, bytes);
    return bytes;
  } finally {
    await session.detach().catch(() => {});
    await animationStyle
      ?.evaluate((element) => element.remove())
      .catch(() => {});
  }
}
