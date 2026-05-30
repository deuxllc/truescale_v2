(() => {
  const {
    clonePoint,
    pointInsideRect,
    segmentAngle,
  } = window.PlanScaleGeometry;

  function cloneSegment(segment) {
    return {
      id: segment.id,
      name: segment.name,
      start: clonePoint(segment.start),
      end: clonePoint(segment.end),
      labelOffset: segment.labelOffset ? { ...segment.labelOffset } : null,
      labelHidden: Boolean(segment.labelHidden),
    };
  }

  function clonePolygon(polygon) {
    return {
      id: polygon.id,
      name: polygon.name,
      points: (polygon.points || []).map(clonePoint),
      labelHidden: Boolean(polygon.labelHidden),
    };
  }

  function encodeBase64Json(value) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
  }

  function decodeBase64Json(value) {
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  }

  function normalizedRect(start, end) {
    return {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      right: Math.max(start.x, end.x),
      bottom: Math.max(start.y, end.y),
    };
  }

  function orientation(a, b, c) {
    return Math.sign((b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y));
  }

  function lineSegmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    return o1 !== o2 && o3 !== o4;
  }

  function parseDecimal(value) {
    if (!value.trim()) return null;
    const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  function formatDecimal(value) {
    if (value === null || Number.isNaN(value)) return "\u2014";
    return value.toFixed(3).replace(".", ",");
  }

  function rectsIntersect(a, b, padding = 0) {
    return !(
      a.right + padding < b.left ||
      a.left - padding > b.right ||
      a.bottom + padding < b.top ||
      a.top - padding > b.bottom
    );
  }

  function roundedRectPath(targetContext, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    targetContext.beginPath();
    targetContext.moveTo(x + r, y);
    targetContext.arcTo(x + width, y, x + width, y + height, r);
    targetContext.arcTo(x + width, y + height, x, y + height, r);
    targetContext.arcTo(x, y + height, x, y, r);
    targetContext.arcTo(x, y, x + width, y, r);
    targetContext.closePath();
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 8192;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  function textDataUrl(mime, text) {
    return `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.PlanScaleUtils = {
    clonePoint,
    cloneSegment,
    clonePolygon,
    encodeBase64Json,
    decodeBase64Json,
    normalizedRect,
    pointInsideRect,
    lineSegmentsIntersect,
    parseDecimal,
    formatDecimal,
    rectsIntersect,
    roundedRectPath,
    bytesToBase64,
    textDataUrl,
    escapeXml,
    segmentAngle,
  };
})();
