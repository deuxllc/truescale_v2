(() => {
  function createCanvasDragInteractions({
    state,
    view,
    actions,
  }) {
    const {
      adjustedEndpointDragPoint,
      clampPointToImage,
      clearLongPressTimer,
      draw,
      markDragged,
      polygonIdsInsideSelectionBox,
      resolveEndpointPoint,
      resolvePolygonPoint,
      screenToImage,
      segmentIdsInsideSelectionBox,
      selectPolygons,
      selectSegments,
    } = actions;

    function handlePointerMove(event) {
      if (!state.dragStart) {
        return false;
      }

      const dx = event.clientX - state.dragStart.x;
      const dy = event.clientY - state.dragStart.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= 4) {
        return false;
      }

      if (distance > 10) {
        clearLongPressTimer();
      }
      markDragged();

      if (state.interactionMode === "endpoint" && state.dragStart.endpoint) {
        const { segment, endpoint } = state.dragStart.endpoint;
        const fixedEndpoint = endpoint === "start" ? segment.end : segment.start;
        const dragPoint = adjustedEndpointDragPoint(event);
        const rawPoint = clampPointToImage(screenToImage(dragPoint.x, dragPoint.y));
        const resolved = resolveEndpointPoint(rawPoint, fixedEndpoint, segment.id);
        segment[endpoint] = resolved.point;
        state.snapPoint = resolved.snap;
        state.orthogonalGuide = resolved.guide;
        state.alignmentGuide = resolved.alignmentGuide;
      } else if (state.interactionMode === "label" && state.dragStart.labelSegment) {
        state.dragStart.labelSegment.labelOffset = {
          x: state.dragStart.labelOffset.x + dx,
          y: state.dragStart.labelOffset.y + dy,
        };
      } else if (state.interactionMode === "polygon" && state.dragStart.polygon && state.dragStart.polygonPoints) {
        const imageDx = dx / Math.max(state.scale, 0.001);
        const imageDy = dy / Math.max(state.scale, 0.001);
        state.dragStart.polygon.points = state.dragStart.polygonPoints.map((point) => ({
          x: point.x + imageDx,
          y: point.y + imageDy,
        }));
      } else if (state.interactionMode === "draw-line" && state.pendingPoint) {
        const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
        const resolved = resolveEndpointPoint(rawPoint, state.pendingPoint, null);
        state.previewPoint = resolved.point;
        state.snapPoint = resolved.snap;
        state.orthogonalGuide = resolved.guide;
        state.alignmentGuide = resolved.alignmentGuide;
      } else if (state.interactionMode === "draw-area") {
        const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
        const resolved = resolvePolygonPoint(rawPoint);
        state.polygonCloseTarget = resolved.close ? resolved.point : null;
        state.polygonPreviewPoint = resolved.point;
        state.snapPoint = resolved.snap;
        state.orthogonalGuide = resolved.guide;
        state.alignmentGuide = resolved.alignmentGuide;
      } else if (state.interactionMode === "base-pick") {
        state.offsetX = state.dragStart.offsetX + dx;
        state.offsetY = state.dragStart.offsetY + dy;
      } else if (state.interactionMode === "segment") {
        state.selectionBox = null;
      } else if (state.pendingPoint) {
        // Keep pending line drags from starting a selection box.
      } else if (state.interactionMode === "pan") {
        state.offsetX = state.dragStart.offsetX + dx;
        state.offsetY = state.dragStart.offsetY + dy;
      } else {
        state.selectionBox = {
          start: state.dragStart.screen,
          end: view.screenPointFromClient(event.clientX, event.clientY),
        };
        selectSegments(segmentIdsInsideSelectionBox());
        selectPolygons(polygonIdsInsideSelectionBox());
      }

      draw();
      return true;
    }

    return {
      handlePointerMove,
    };
  }

  window.PlanScaleCanvasDragInteractions = {
    createCanvasDragInteractions,
  };
})();
