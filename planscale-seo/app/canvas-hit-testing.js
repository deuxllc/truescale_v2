(() => {
  function createCanvasHitTesting({
    state,
    view,
    helpers,
    touchEndpointHitRadius,
  }) {
    const {
      distanceToSegment,
      isCoarsePointer,
      lineSegmentsIntersect,
      normalizedRect,
      pointInsideRect,
    } = helpers;

    function findSegmentAt(clientX, clientY, tolerance) {
      const point = view.screenPointFromClient(clientX, clientY);
      const hitTolerance = tolerance ?? (isCoarsePointer() ? 30 : 18);
      let closest = null;
      let closestDistance = Infinity;

      for (const segment of state.segments) {
        const start = view.imageToScreen(segment.start);
        const end = view.imageToScreen(segment.end);
        const distance = distanceToSegment(point, start, end);

        if (distance < closestDistance) {
          closestDistance = distance;
          closest = segment;
        }
      }

      return closestDistance <= hitTolerance ? closest : null;
    }

    function findLabelAt(clientX, clientY) {
      const point = view.screenPointFromClient(clientX, clientY);

      for (const [id, rect] of state.labelBounds.entries()) {
        if (pointInsideRect(point, rect)) {
          return state.segments.find((segment) => segment.id === id) ?? null;
        }
      }

      return null;
    }

    function findPolygonLabelAt(clientX, clientY) {
      const point = view.screenPointFromClient(clientX, clientY);

      for (const [id, rect] of state.polygonLabelBounds.entries()) {
        if (pointInsideRect(point, rect)) {
          return state.polygons.find((polygon) => polygon.id === id) ?? null;
        }
      }

      return null;
    }

    function pointInsidePolygon(point, points) {
      if (!Array.isArray(points) || points.length < 3) return false;
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const current = points[i];
        const previous = points[j];
        const intersects = ((current.y > point.y) !== (previous.y > point.y))
          && (point.x < (previous.x - current.x) * (point.y - current.y) / ((previous.y - current.y) || 0.000001) + current.x);
        if (intersects) inside = !inside;
      }
      return inside;
    }

    function findPolygonAt(clientX, clientY) {
      const point = view.screenPointFromClient(clientX, clientY);

      for (let index = state.polygons.length - 1; index >= 0; index--) {
        const polygon = state.polygons[index];
        const points = polygon.points.map((item) => view.imageToScreen(item));
        if (pointInsidePolygon(point, points)) {
          return polygon;
        }
      }

      return null;
    }

    function findEndpointAt(clientX, clientY) {
      const point = view.screenPointFromClient(clientX, clientY);
      let closest = null;
      let closestDistance = Infinity;
      const hitRadius = isCoarsePointer() ? touchEndpointHitRadius : 16;

      for (const segment of state.segments) {
        if (!state.selectedSegmentIds.has(segment.id)) continue;

        for (const endpoint of ["start", "end"]) {
          const screen = view.imageToScreen(segment[endpoint]);
          const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = { segment, endpoint };
          }
        }
      }

      return closestDistance <= hitRadius ? closest : null;
    }

    function segmentIntersectsRect(segment, rect) {
      const start = view.imageToScreen(segment.start);
      const end = view.imageToScreen(segment.end);
      const midpoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };

      if (pointInsideRect(start, rect) || pointInsideRect(end, rect) || pointInsideRect(midpoint, rect)) {
        return true;
      }

      const topLeft = { x: rect.left, y: rect.top };
      const topRight = { x: rect.right, y: rect.top };
      const bottomRight = { x: rect.right, y: rect.bottom };
      const bottomLeft = { x: rect.left, y: rect.bottom };

      return (
        lineSegmentsIntersect(start, end, topLeft, topRight) ||
        lineSegmentsIntersect(start, end, topRight, bottomRight) ||
        lineSegmentsIntersect(start, end, bottomRight, bottomLeft) ||
        lineSegmentsIntersect(start, end, bottomLeft, topLeft)
      );
    }

    function segmentIdsInsideSelectionBox() {
      if (!state.selectionBox) return [];
      const rect = normalizedRect(state.selectionBox.start, state.selectionBox.end);
      return state.segments
        .filter((segment) => segmentIntersectsRect(segment, rect))
        .map((segment) => segment.id);
    }

    function polygonIntersectsRect(polygon, rect) {
      const points = polygon.points.map((item) => view.imageToScreen(item));
      if (points.some((point) => pointInsideRect(point, rect))) return true;

      const center = {
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2,
      };
      if (pointInsidePolygon(center, points)) return true;

      const topLeft = { x: rect.left, y: rect.top };
      const topRight = { x: rect.right, y: rect.top };
      const bottomRight = { x: rect.right, y: rect.bottom };
      const bottomLeft = { x: rect.left, y: rect.bottom };
      const rectEdges = [
        [topLeft, topRight],
        [topRight, bottomRight],
        [bottomRight, bottomLeft],
        [bottomLeft, topLeft],
      ];

      for (let index = 0; index < points.length; index++) {
        const start = points[index];
        const end = points[(index + 1) % points.length];
        if (rectEdges.some(([edgeStart, edgeEnd]) => lineSegmentsIntersect(start, end, edgeStart, edgeEnd))) {
          return true;
        }
      }

      return false;
    }

    function polygonIdsInsideSelectionBox() {
      if (!state.selectionBox) return [];
      const rect = normalizedRect(state.selectionBox.start, state.selectionBox.end);
      return state.polygons
        .filter((polygon) => polygonIntersectsRect(polygon, rect))
        .map((polygon) => polygon.id);
    }

    function resolveHit(clientX, clientY, { includeEndpoint = true } = {}) {
      const endpoint = includeEndpoint ? findEndpointAt(clientX, clientY) : null;
      const label = endpoint ? null : findLabelAt(clientX, clientY);
      const segment = endpoint || label ? null : findSegmentAt(clientX, clientY);
      const polygonLabel = endpoint || label || segment ? null : findPolygonLabelAt(clientX, clientY);
      const polygon = endpoint || label || segment || polygonLabel ? null : findPolygonAt(clientX, clientY);

      return {
        endpoint,
        label,
        segment,
        polygonLabel,
        polygon,
      };
    }

    return {
      findEndpointAt,
      findLabelAt,
      findPolygonAt,
      findPolygonLabelAt,
      findSegmentAt,
      polygonIdsInsideSelectionBox,
      resolveHit,
      segmentIdsInsideSelectionBox,
    };
  }

  window.PlanScaleCanvasHitTesting = {
    createCanvasHitTesting,
  };
})();
