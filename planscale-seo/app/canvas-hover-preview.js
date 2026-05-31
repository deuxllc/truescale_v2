(() => {
  function createCanvasHoverPreview({
    canvas,
    state,
    actions,
  }) {
    const {
      clampPointToImage,
      draw,
      findLabelAt,
      findSegmentAt,
      resolveEndpointPoint,
      resolvePolygonPoint,
      resolveStartPoint,
      screenToImage,
      updateCursorCoordinates,
    } = actions;

    function handlePointerMove(event) {
      updateCursorCoordinates(event.clientX, event.clientY);

      if (state.isDragging && state.dragStart) {
        return false;
      }

      const hoverTarget = state.image && !state.isDrawingSegments && !state.isDrawingArea
        ? findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY)
        : null;
      const hoverId = hoverTarget?.id ?? null;
      if (hoverId !== state.hoveredSegmentId) {
        state.hoveredSegmentId = hoverId;
        canvas.classList.toggle("hovering-segment", Boolean(hoverId));
        draw();
      }

      if (state.pendingPoint && state.isDrawingSegments) {
        const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
        const resolved = resolveEndpointPoint(rawPoint, state.pendingPoint, null);
        state.previewPoint = resolved.point;
        state.snapPoint = resolved.snap;
        state.orthogonalGuide = resolved.guide;
        state.alignmentGuide = resolved.alignmentGuide;
        draw();
      } else if (state.isDrawingSegments && !state.pendingPoint) {
        const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
        state.snapPoint = resolveStartPoint(rawPoint).snap;
        draw();
      } else if (state.isDrawingArea) {
        const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
        const resolved = resolvePolygonPoint(rawPoint);
        state.polygonCloseTarget = resolved.close ? resolved.point : null;
        state.polygonPreviewPoint = resolved.point;
        state.snapPoint = resolved.snap;
        state.orthogonalGuide = resolved.guide;
        state.alignmentGuide = resolved.alignmentGuide;
        draw();
      }

      return true;
    }

    return {
      handlePointerMove,
    };
  }

  window.PlanScaleCanvasHoverPreview = {
    createCanvasHoverPreview,
  };
})();
