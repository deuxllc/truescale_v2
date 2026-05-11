(() => {
function clonePoint(point) {
  return point ? { x: point.x, y: point.y } : null;
}

function segmentLength(segment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  return Math.hypot(dx, dy);
}

function segmentAngle(segment) {
  const radians = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x);
  const degrees = radians * 180 / Math.PI;
  return Math.round(degrees * 10) / 10;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function pointInsideRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function isGridAlignedSegment(segment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return false;

  const axisError = Math.min(Math.abs(dx), Math.abs(dy));
  const tolerance = Math.max(1, length * 0.015);
  return axisError <= tolerance;
}

function snapToOrthogonalAxis(point, anchor) {
  if (!anchor) {
    return { point, snapped: false, axis: null };
  }

  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx >= absDy) {
    return { point: { x: point.x, y: anchor.y }, snapped: true, axis: "horizontal" };
  }

  return { point: { x: anchor.x, y: point.y }, snapped: true, axis: "vertical" };
}

window.PlanScaleGeometry = {
  clonePoint,
  segmentLength,
  segmentAngle,
  distanceToSegment,
  pointInsideRect,
  isGridAlignedSegment,
  snapToOrthogonalAxis,
};
})();
