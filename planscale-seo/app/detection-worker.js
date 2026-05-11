importScripts("app-config.js", "detection-core.js");

self.addEventListener("message", (event) => {
  if (event.data?.type !== "analyze") return;
  const { width, height, processScale, maxSegments, sensitivity, buffer } = event.data;
  const data = new Uint8ClampedArray(buffer);
  const segments = self.PlanScaleDetectionCore.analyzeImageData({
    data,
    width,
    height,
    processScale,
    sensitivity,
    maxSegments: maxSegments || 150,
  });
  self.postMessage({ type: "result", segments });
});
