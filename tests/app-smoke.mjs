import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const appPath = "/planscale-seo/app/";
const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true },
];
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

function createPlanImageBuffer() {
  const width = 800;
  const height = 520;
  const pixels = Buffer.alloc(width * height * 4, 255);

  function setPixel(x, y, value) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }

  function drawHorizontal(x1, x2, y, thickness = 10) {
    for (let yy = y - Math.floor(thickness / 2); yy <= y + Math.floor(thickness / 2); yy++) {
      for (let x = x1; x <= x2; x++) setPixel(x, yy, 16);
    }
  }

  function drawVertical(x, y1, y2, thickness = 10) {
    for (let xx = x - Math.floor(thickness / 2); xx <= x + Math.floor(thickness / 2); xx++) {
      for (let y = y1; y <= y2; y++) setPixel(xx, y, 16);
    }
  }

  drawHorizontal(110, 690, 90);
  drawHorizontal(110, 690, 430);
  drawVertical(110, 90, 430);
  drawVertical(690, 90, 430);
  drawVertical(360, 90, 430);
  drawHorizontal(110, 360, 250);
  drawHorizontal(360, 690, 260);
  drawVertical(510, 260, 430);

  return encodePng({ width, height, pixels });
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng({ width, height, pixels }) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    scanlines[y * (stride + 1)] = 0;
    pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND"),
  ]);
}

function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const decodedPath = decodeURIComponent(url.pathname);
      const pathName = decodedPath.endsWith("/") ? `${decodedPath}index.html` : decodedPath;
      const filePath = normalize(join(rootDir, pathName));
      if (!filePath.startsWith(`${rootDir}${sep}`)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({
        server,
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function readDataUrlJson(dataUrl) {
  const encoded = dataUrl.split(",")[1] || "";
  return JSON.parse(decodeURIComponent(encoded));
}

async function runCase(browser, origin, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.isMobile,
    hasTouch: profile.isMobile,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const issues = [];
  async function exportJsonPayload() {
    await page.locator("#exportMenuButton").click();
    await page.locator("#exportJsonButton").click();
    await page.waitForFunction(() => {
      const status = document.querySelector("#exportStatus");
      return status && !status.hidden && status.textContent.includes("Экспорт готов");
    }, null, { timeout: 6000 });
    const exportHref = await page.locator('#exportStatus a[download$=".json"]').getAttribute("href");
    return readDataUrlJson(exportHref || "");
  }
  async function exportProjectPayload() {
    await page.locator("#exportMenuButton").click();
    await page.locator("#exportProjectButton").click();
    await page.waitForFunction(() => {
      const status = document.querySelector("#exportStatus");
      return status && !status.hidden && status.textContent.includes("Экспорт готов");
    }, null, { timeout: 6000 });
    const exportHref = await page.locator('#exportStatus a[download$=".truescale.json"]').getAttribute("href");
    return readDataUrlJson(exportHref || "");
  }

  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });

  await page.goto(`${origin}${appPath}`, { waitUntil: "domcontentloaded" });
  if (await page.locator("#welcomeStartButton").isVisible().catch(() => false)) {
    await page.locator("#welcomeStartButton").click();
  }

  await page.locator("#imageInput").setInputFiles({
    name: "smoke-plan.png",
    mimeType: "image/png",
    buffer: createPlanImageBuffer(),
  });
  await page.locator("#nextActionPanel").waitFor({ state: "visible", timeout: 6000 });

  const sensitivityHiddenInitially = await page.locator("#detectionSensitivityControl").evaluate((node) => node.hidden);
  const measurementsShortcutHidden = await page.locator("#sidebarToggleButton").evaluate((node) => getComputedStyle(node).display === "none");
  const resetLivesInSettings = await page.locator("#resetPlanButton").evaluate((node) => node.closest("#settingsMenu")?.id === "settingsMenu");
  const mobileTopbarAligned = profile.isMobile
    ? await page.evaluate(() => {
      const selectors = [
        ".plan-upload-button",
        "#reanalyzeButton",
        "#recalibrateButton",
        "#undoButton",
        "#redoButton",
        "#exportMenuButton",
        "#settingsButton",
      ];
      const rects = selectors.map((selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          y: Math.round(rect.y),
        };
      });
      const widths = new Set(rects.map((rect) => rect.width));
      const heights = new Set(rects.map((rect) => rect.height));
      const rows = new Set(rects.map((rect) => rect.y));
      return widths.size === 1
        && heights.size === 1
        && rows.size === 1
        && rects.every((rect) => rect.width >= 38 && rect.height >= 38);
    })
    : true;
  await page.locator("#detectModeButton").click();
  const sensitivityVisibleAuto = await page.locator("#detectionSensitivityControl").evaluate((node) => !node.hidden);
  const sliderValue = await page.locator("#detectionSensitivityInput").inputValue();
  const toolbarRecalibrateVisible = await page.locator("#recalibrateButton").isVisible();
  const toolbarBaseFieldVisible = await page.locator("#referenceLengthInput").isVisible();
  await page.locator("#manualModeButton").click();
  await page.waitForFunction(() => document.querySelector("#nextActionPanel")?.hidden === true, null, { timeout: 6000 });

  const canvasBox = await page.locator("#planCanvas").boundingBox();
  if (!canvasBox) throw new Error("Canvas wrapper was not rendered");
  const firstPoint = {
    x: canvasBox.x + canvasBox.width * 0.36,
    y: canvasBox.y + canvasBox.height * 0.42,
  };
  const secondPoint = {
    x: canvasBox.x + canvasBox.width * 0.66,
    y: canvasBox.y + canvasBox.height * 0.42,
  };
  await page.locator("#planCanvas").waitFor({ state: "visible", timeout: 6000 });
  await page.mouse.click(firstPoint.x, firstPoint.y);
  await page.mouse.click(secondPoint.x, secondPoint.y);
  await page.waitForFunction(() => document.querySelector("#panelSummary")?.textContent.includes("1 измерение"), null, { timeout: 6000 });
  await page.locator("#inlineCalibration").waitFor({ state: "visible", timeout: 6000 });
  const inlineText = await page.locator("#inlineCalibration").textContent();
  const inlineHasBaseLabel = inlineText?.includes("Базовый размер") || false;
  const inlineSubmitText = await page.locator("#inlineCalibration button[type='submit']").textContent();
  await page.locator("#inlineReferenceLengthInput").fill("5");
  await page.locator("#inlineCalibration button[type='submit']").click();
  await page.waitForFunction(() => document.querySelector("#inlineCalibration")?.hidden === true, null, { timeout: 6000 });
  const scaleRulerVisible = await page.locator("#scaleRuler").isVisible();
  const baseExportJson = await exportJsonPayload();
  const baseSegment = baseExportJson.segments?.[0];
  const activeCanvasBox = await page.locator("#planCanvas").boundingBox();
  if (!activeCanvasBox) throw new Error("Canvas wrapper disappeared after calibration");
  const fittedImageScale = Math.min(
    Math.max(1, activeCanvasBox.width - 72) / 800,
    Math.max(1, activeCanvasBox.height - 72) / 520,
  );
  const fittedOffset = {
    x: (activeCanvasBox.width - 800 * fittedImageScale) / 2,
    y: (activeCanvasBox.height - 520 * fittedImageScale) / 2,
  };
  const snapStartPoint = baseSegment
    ? {
      x: activeCanvasBox.x + fittedOffset.x + baseSegment.startX * fittedImageScale,
      y: activeCanvasBox.y + fittedOffset.y + baseSegment.startY * fittedImageScale,
    }
    : {
      x: activeCanvasBox.x + activeCanvasBox.width * 0.36,
      y: activeCanvasBox.y + activeCanvasBox.height * 0.42,
    };

  await page.mouse.click(snapStartPoint.x + 5, snapStartPoint.y + 4);
  await page.mouse.click(snapStartPoint.x, snapStartPoint.y + 150);

  await page.locator("#drawAreaButton").click();
  const polygonCanvasBox = await page.locator("#planCanvas").boundingBox();
  if (!polygonCanvasBox) throw new Error("Canvas wrapper disappeared before polygon test");
  const toScreenPoint = (point) => ({
    x: polygonCanvasBox.x + fittedOffset.x + point.x * fittedImageScale,
    y: polygonCanvasBox.y + fittedOffset.y + point.y * fittedImageScale,
  });
  const polygonPoints = [
    toScreenPoint({ x: 560, y: 320 }),
    toScreenPoint({ x: 650, y: 340 }),
    toScreenPoint({ x: 620, y: 410 }),
  ];
  for (const point of polygonPoints) {
    await page.mouse.click(point.x, point.y);
  }
  await page.locator("#finishPolygonButton").click();

  const exportJson = await exportJsonPayload();
  const firstSegment = exportJson.segments?.[0];
  const snappedSecondSegment = Boolean(firstSegment && exportJson.segments?.some((segment) => (
    segment.id !== firstSegment.id
    && Math.abs(segment.startX - firstSegment.startX) < 0.01
    && Math.abs(segment.startY - firstSegment.startY) < 0.01
  )));
  const polygonCreated = Boolean((exportJson.polygons || []).length === 1 && exportJson.polygons[0].area > 0);
  const undoShortcut = process.platform === "darwin" ? "Meta+Z" : "Control+Z";
  const redoShortcut = process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Shift+Z";
  await page.keyboard.press(undoShortcut);
  const afterKeyboardUndoJson = await exportJsonPayload();
  await page.keyboard.press(redoShortcut);
  const afterKeyboardRedoJson = await exportJsonPayload();
  const keyboardUndoRedo = Boolean(
    (afterKeyboardUndoJson.polygons || []).length === 0
    && (afterKeyboardRedoJson.polygons || []).length === 1,
  );
  let keyboardDeleteUndo = false;
  const keyboardDeleteTarget = (afterKeyboardRedoJson.segments || []).find((segment) => segment.id !== firstSegment?.id);
  if (keyboardDeleteTarget) {
    await page.locator("#selectModeButton").evaluate((node) => node.click());
    const targetMidpoint = {
      x: activeCanvasBox.x + fittedOffset.x + ((keyboardDeleteTarget.startX + keyboardDeleteTarget.endX) / 2) * fittedImageScale,
      y: activeCanvasBox.y + fittedOffset.y + ((keyboardDeleteTarget.startY + keyboardDeleteTarget.endY) / 2) * fittedImageScale,
    };
    await page.mouse.click(targetMidpoint.x, targetMidpoint.y);
    await page.keyboard.press("Delete");
    const afterKeyboardDeleteJson = await exportJsonPayload();
    await page.keyboard.press(undoShortcut);
    const afterKeyboardDeleteUndoJson = await exportJsonPayload();
    keyboardDeleteUndo = Boolean(
      (afterKeyboardDeleteJson.segments || []).length === (afterKeyboardRedoJson.segments || []).length - 1
      && (afterKeyboardDeleteUndoJson.segments || []).length === (afterKeyboardRedoJson.segments || []).length,
    );
  }
  let polygonMoved = false;
  if (polygonCreated) {
    const polygon = exportJson.polygons[0];
    const centroid = polygon.points.reduce((sum, point) => ({
      x: sum.x + point.x / polygon.points.length,
      y: sum.y + point.y / polygon.points.length,
    }), { x: 0, y: 0 });
    const polygonDragStart = {
      x: activeCanvasBox.x + fittedOffset.x + centroid.x * fittedImageScale,
      y: activeCanvasBox.y + fittedOffset.y + centroid.y * fittedImageScale,
    };
    await page.mouse.move(polygonDragStart.x, polygonDragStart.y);
    await page.mouse.down();
    await page.mouse.move(polygonDragStart.x + 44, polygonDragStart.y + 28, { steps: 6 });
    await page.mouse.up();
    const movedJson = await exportJsonPayload();
    const movedPolygon = movedJson.polygons?.[0];
    polygonMoved = Boolean(movedPolygon && Math.hypot(
      movedPolygon.points[0].x - polygon.points[0].x,
      movedPolygon.points[0].y - polygon.points[0].y,
    ) > 8);
  }
  const projectPayload = await exportProjectPayload();

  const baseMidpoint = baseSegment
    ? {
      x: activeCanvasBox.x + fittedOffset.x + (baseSegment.startX * 0.72 + baseSegment.endX * 0.28) * fittedImageScale,
      y: activeCanvasBox.y + fittedOffset.y + (baseSegment.startY * 0.72 + baseSegment.endY * 0.28) * fittedImageScale,
    }
    : null;
  let baseScalePreservedAfterDelete = false;
  if (baseMidpoint) {
    await page.locator("#segmentsList .delete-button").first().evaluate((node) => node.click());
    const afterDeleteJson = await exportJsonPayload();
    baseScalePreservedAfterDelete = Boolean(
      afterDeleteJson.baseValue === 5
      && afterDeleteJson.basePixelLength > 0
      && afterDeleteJson.baseSegmentId === null
      && afterDeleteJson.segments?.some((segment) => segment.calculatedLength !== null),
    );
  }
  await page.locator("#unitInput").evaluate((node) => {
    node.value = "см";
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const centimetersExportJson = await exportJsonPayload();
  const unitConvertedToCm = centimetersExportJson.unit === "см"
    && centimetersExportJson.baseValue === 500
    && centimetersExportJson.baseValueMeters === 5
    && centimetersExportJson.segments?.some((segment) => segment.calculatedLengthMeters !== null);
  await page.locator("#unitInput").evaluate((node) => {
    node.value = "м";
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const metersExportJson = await exportJsonPayload();
  const unitConvertedBackToM = metersExportJson.unit === "м"
    && metersExportJson.baseValue === 5
    && metersExportJson.baseValueMeters === 5;
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${origin}${appPath}`, { waitUntil: "domcontentloaded" });
  if (await page.locator("#welcomeStartButton").isVisible().catch(() => false)) {
    await page.locator("#welcomeStartButton").click();
  }
  await page.locator("#projectImportInput").setInputFiles({
    name: "restored-project.truescale.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(projectPayload)),
  });
  await page.waitForFunction(() => document.querySelector("#scaleRuler") && !document.querySelector("#scaleRuler").hidden, null, { timeout: 6000 });
  const restoredExportJson = await exportJsonPayload();
  const projectImportRestored = restoredExportJson.baseValue === 5
    && restoredExportJson.baseValueMeters === 5
    && restoredExportJson.segments?.length >= 2
    && restoredExportJson.polygons?.length === 1;

  const bodyText = await page.locator("body").textContent();
  const exportStatus = await page.locator("#exportStatus").textContent();
  const panelSummary = await page.locator("#panelSummary").textContent();
  const result = {
    profile: profile.name,
    issues,
    sensitivityHiddenInitially,
    sensitivityVisibleAuto,
    sliderValue,
    measurementsShortcutHidden,
    resetLivesInSettings,
    mobileTopbarAligned,
    toolbarRecalibrateVisible,
    toolbarBaseFieldVisible,
    inlineHasBaseLabel,
    inlineSubmitText,
    scaleRulerVisible,
    unitConvertedToCm,
    unitConvertedBackToM,
    projectImportRestored,
    segmentCreated: (exportJson.segments || []).length >= 2,
    secondSegmentStartsFromExistingPoint: snappedSecondSegment,
    polygonCreated,
    keyboardUndoRedo,
    keyboardDeleteUndo,
    polygonMoved,
    baseScalePreservedAfterDelete,
    exportReady: exportStatus?.includes("Экспорт готов") || false,
    hasTrueScale: bodyText.includes("TrueScale"),
    canvasSize: `${Math.round(canvasBox?.width || 0)}x${Math.round(canvasBox?.height || 0)}`,
  };

  await context.close();
  return result;
}

const { server, origin } = await createStaticServer();
const browser = await chromium.launch({ headless: true });

try {
  const results = [];
  for (const profile of viewports) {
    results.push(await runCase(browser, origin, profile));
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.some((result) => (
    result.issues.length > 0 ||
    !result.sensitivityHiddenInitially ||
    !result.sensitivityVisibleAuto ||
    result.sliderValue !== "15" ||
    !result.measurementsShortcutHidden ||
    !result.resetLivesInSettings ||
    !result.mobileTopbarAligned ||
    !result.toolbarRecalibrateVisible ||
    result.toolbarBaseFieldVisible ||
    result.inlineHasBaseLabel ||
    result.inlineSubmitText?.trim() !== "Готово" ||
    !result.scaleRulerVisible ||
    !result.unitConvertedToCm ||
    !result.unitConvertedBackToM ||
    !result.projectImportRestored ||
    !result.segmentCreated ||
    !result.secondSegmentStartsFromExistingPoint ||
    !result.polygonCreated ||
    !result.keyboardUndoRedo ||
    !result.keyboardDeleteUndo ||
    !result.polygonMoved ||
    !result.baseScalePreservedAfterDelete ||
    !result.exportReady ||
    !result.hasTrueScale
  ));

  if (failed) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
