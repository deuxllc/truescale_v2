(() => {
  function createCanvasPointerCleanup({
    canvas,
    state,
    pointerTracker,
    gestureState,
    actions,
  }) {
    const {
      draw,
      hideCursorCoordinates,
    } = actions;

    function handlePointerLeave() {
      hideCursorCoordinates();
      if (state.isDragging) return;

      state.hoveredSegmentId = null;
      canvas.classList.remove("hovering-segment");
      state.polygonPreviewPoint = null;
      state.polygonCloseTarget = null;

      if (!state.previewPoint && !state.orthogonalGuide && !state.alignmentGuide) {
        draw();
        return;
      }

      state.previewPoint = null;
      state.orthogonalGuide = null;
      state.alignmentGuide = null;
      draw();
    }

    function handlePointerCancel(event) {
      gestureState.clearLongPressTimer();
      gestureState.removePointerFromEvent(event);
      if (state.interactionMode === "pinch" || pointerTracker.activeCount() === 0) {
        gestureState.resetTransient(null);
        draw();
      }
    }

    return {
      handlePointerCancel,
      handlePointerLeave,
    };
  }

  window.PlanScaleCanvasPointerCleanup = {
    createCanvasPointerCleanup,
  };
})();
