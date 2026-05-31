(() => {
  function createCanvasGestureState({
    canvas,
    state,
    view,
    pointerTracker,
    touchLongPressMs,
    actions,
  }) {
    const {
      selectOnlySegment,
      showSegmentContextMenu,
      updateAll,
    } = actions;
    let longPressTimer = 0;
    let longPressSegment = null;
    let touchContextMenuOpened = false;

    function clearLongPressTimer() {
      window.clearTimeout(longPressTimer);
      longPressTimer = 0;
      longPressSegment = null;
    }

    function resetTransient(mode = null) {
      state.isDragging = false;
      state.dragStart = null;
      state.didDrag = false;
      state.interactionMode = mode;
      state.selectionBox = null;
      state.snapPoint = null;
      state.previewPoint = null;
      state.orthogonalGuide = null;
      state.alignmentGuide = null;
      state.polygonPreviewPoint = null;
      state.polygonCloseTarget = null;
      canvas.classList.remove("dragging");
    }

    function setPointerCapture(pointerId) {
      try {
        canvas.setPointerCapture(pointerId);
      } catch {
        // Some mobile WebViews can reject capture while still delivering pointer events.
      }
    }

    function releasePointerCapture(pointerId) {
      try {
        if (canvas.hasPointerCapture(pointerId)) {
          canvas.releasePointerCapture(pointerId);
        }
      } catch {
        // Pointer capture may already be gone after touch cancellation.
      }
    }

    function startPinchGesture() {
      const metrics = pointerTracker.pairMetrics();
      if (!metrics || metrics.distance < 1) return;
      pointerTracker.startPinch(metrics.distance);
      clearLongPressTimer();
      resetTransient("pinch");
    }

    function updatePointerFromEvent(event) {
      pointerTracker.updateFromEvent(event);
    }

    function removePointerFromEvent(event) {
      pointerTracker.removeFromEvent(event);
    }

    function beginDrag(event, dragStart = {}) {
      state.isDragging = true;
      state.didDrag = false;
      touchContextMenuOpened = false;
      state.dragStart = {
        x: event.clientX,
        y: event.clientY,
        screen: view.screenPointFromClient(event.clientX, event.clientY),
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        ...dragStart,
      };
      canvas.classList.add("dragging");
    }

    function markDragged() {
      state.didDrag = true;
    }

    function endDrag({ keepMode = false } = {}) {
      state.isDragging = false;
      state.dragStart = null;
      if (!keepMode) {
        state.interactionMode = null;
      }
      state.snapPoint = null;
      state.previewPoint = null;
      state.orthogonalGuide = null;
      state.alignmentGuide = null;
      canvas.classList.remove("dragging");
    }

    function scheduleTouchContextMenu(segment, event) {
      clearLongPressTimer();
      if (!segment || event.pointerType !== "touch" || state.isDrawingSegments || state.isChoosingBase) return;
      const { clientX, clientY } = event;
      longPressSegment = segment;
      longPressTimer = window.setTimeout(() => {
        if (!longPressSegment || pointerTracker.activeCount() > 1) return;
        selectOnlySegment(longPressSegment.id);
        resetTransient(null);
        touchContextMenuOpened = true;
        updateAll();
        showSegmentContextMenu(longPressSegment, clientX, clientY);
        longPressSegment = null;
      }, touchLongPressMs);
    }

    function consumeTouchContextMenuOpened() {
      const wasOpened = touchContextMenuOpened;
      touchContextMenuOpened = false;
      return wasOpened;
    }

    return {
      beginDrag,
      clearLongPressTimer,
      consumeTouchContextMenuOpened,
      endDrag,
      markDragged,
      releasePointerCapture,
      removePointerFromEvent,
      resetTransient,
      scheduleTouchContextMenu,
      setPointerCapture,
      startPinchGesture,
      updatePointerFromEvent,
    };
  }

  window.PlanScaleCanvasGestureState = {
    createCanvasGestureState,
  };
})();
