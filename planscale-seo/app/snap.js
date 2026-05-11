(() => {
const { clonePoint, snapToOrthogonalAxis } = window.PlanScaleGeometry;

function imageDistanceToScreen(distance, scale) {
  return Math.abs(distance) * Math.max(scale, 0.001);
}

function screenDistanceBetweenPoints(a, b, scale) {
  return Math.hypot(
    imageDistanceToScreen(a.x - b.x, scale),
    imageDistanceToScreen(a.y - b.y, scale),
  );
}

function buildLineGuide(from, to, axis) {
  return {
    from: clonePoint(from),
    to: clonePoint(to),
    axis,
  };
}

function findExactEndpointSnap(point, segments, segmentId, scale, tolerancePx = 11) {
  let closest = null;
  let closestDistance = Infinity;

  for (const segment of segments) {
    if (segment.id === segmentId) continue;

    for (const endpoint of [segment.start, segment.end]) {
      const distance = Math.hypot(
        imageDistanceToScreen(point.x - endpoint.x, scale),
        imageDistanceToScreen(point.y - endpoint.y, scale),
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closest = endpoint;
      }
    }
  }

  return closest && closestDistance <= tolerancePx
    ? { point: clonePoint(closest), distance: closestDistance }
    : null;
}

function findAxisAlignment(point, segments, segmentId, scale, { fieldCenter = point, fieldRadiusPx = 150, lockAxis = null, tolerancePx = 7 } = {}) {
  let bestX = null;
  let bestY = null;

  for (const segment of segments) {
    if (segment.id === segmentId) continue;

    for (const endpoint of [segment.start, segment.end]) {
      const fieldDistance = screenDistanceBetweenPoints(fieldCenter, endpoint, scale);
      if (fieldDistance > fieldRadiusPx) continue;

      const dx = imageDistanceToScreen(point.x - endpoint.x, scale);
      const dy = imageDistanceToScreen(point.y - endpoint.y, scale);

      if (lockAxis !== "vertical" && dx <= tolerancePx && (!bestX || dx < bestX.distance || (dx === bestX.distance && fieldDistance < bestX.fieldDistance))) {
        bestX = { endpoint, distance: dx, fieldDistance };
      }

      if (lockAxis !== "horizontal" && dy <= tolerancePx && (!bestY || dy < bestY.distance || (dy === bestY.distance && fieldDistance < bestY.fieldDistance))) {
        bestY = { endpoint, distance: dy, fieldDistance };
      }
    }
  }

  const snapped = { ...point };
  const lines = [];

  if (bestX) {
    snapped.x = bestX.endpoint.x;
    lines.push(buildLineGuide(bestX.endpoint, { x: bestX.endpoint.x, y: snapped.y }, "vertical"));
  }

  if (bestY) {
    snapped.y = bestY.endpoint.y;
    lines.push(buildLineGuide(bestY.endpoint, { x: snapped.x, y: bestY.endpoint.y }, "horizontal"));
  }

  if (!lines.length) return null;

  return {
    point: snapped,
    guide: {
      lines,
      target: clonePoint(snapped),
    },
  };
}

function nearOrthogonalAxis(point, anchor, toleranceDegrees = 3) {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;

  const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
  const normalized = angle > 180 ? angle - 180 : angle;
  const horizontalError = Math.min(normalized, Math.abs(180 - normalized));
  const verticalError = Math.abs(90 - normalized);
  if (horizontalError <= toleranceDegrees) return "horizontal";
  if (verticalError <= toleranceDegrees) return "vertical";
  return null;
}

function resolvePointWithSnaps({
  rawPoint,
  fixedEndpoint = null,
  segmentId = null,
  segments,
  scale,
  smartGridEnabled,
}) {
  if (!rawPoint) {
    return { point: rawPoint, snap: null, guide: null, alignmentGuide: null, axis: null };
  }

  const endpointSnap = findExactEndpointSnap(rawPoint, segments, segmentId, scale);
  if (endpointSnap && endpointSnap.distance <= 8) {
    return {
      point: endpointSnap.point,
      snap: { point: endpointSnap.point },
      guide: null,
      alignmentGuide: null,
      axis: null,
    };
  }

  if (smartGridEnabled && fixedEndpoint) {
    const axis = nearOrthogonalAxis(rawPoint, fixedEndpoint);
    if (axis) {
      const ortho = snapToOrthogonalAxis(rawPoint, fixedEndpoint);
      const lockAxis = axis === "horizontal" ? "horizontal" : "vertical";
      const axisSnap = findAxisAlignment(ortho.point, segments, segmentId, scale, { fieldCenter: rawPoint, lockAxis });
      const point = axisSnap ? axisSnap.point : ortho.point;

      return {
        point,
        snap: null,
        guide: {
          axis,
          anchor: clonePoint(fixedEndpoint),
          point: clonePoint(point),
        },
        alignmentGuide: axisSnap ? axisSnap.guide : null,
        axis,
      };
    }
  }

  if (endpointSnap) {
    return {
      point: endpointSnap.point,
      snap: { point: endpointSnap.point },
      guide: null,
      alignmentGuide: null,
      axis: null,
    };
  }

  const axisSnap = findAxisAlignment(rawPoint, segments, segmentId, scale, { fieldCenter: rawPoint });
  if (axisSnap) {
    return {
      point: axisSnap.point,
      snap: null,
      guide: null,
      alignmentGuide: axisSnap.guide,
      axis: null,
    };
  }

  return {
    point: rawPoint,
    snap: null,
    guide: null,
    alignmentGuide: null,
    axis: null,
  };
}

window.PlanScaleSnap = {
  resolvePointWithSnaps,
};
})();
