(() => {
  function createCanvasPointerDownController({
    state,
    pointerTracker,
    hitTesting,
    actions,
  }) {
    const {
      beginDrag,
      clonePoint,
      clampPointToImage,
      currentLabelOffset,
      resolvePolygonPoint,
      resolveStartPoint,
      scheduleTouchContextMenu,
      screenToImage,
      selectOnlyPolygon,
      selectOnlySegment,
      setPointerCapture,
      startPinchGesture,
      toggleSegmentSelection,
      updateAll,
      updatePointerFromEvent,
    } = actions;

    function clearTransientGuides() {
      state.snapPoint = null;
      state.orthogonalGuide = null;
      state.alignmentGuide = null;
      state.selectionBox = null;
    }

    function handleDrawingPointerDown(event) {
      event.preventDefault();
      const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
      clearTransientGuides();

      if (state.isDrawingSegments && !state.pendingPoint) {
        state.snapPoint = resolveStartPoint(rawPoint).snap;
      }

      if (state.isDrawingArea) {
        const resolved = resolvePolygonPoint(rawPoint);
        state.polygonCloseTarget = resolved.close ? resolved.point : null;
        state.polygonPreviewPoint = resolved.point;
        state.snapPoint = resolved.snap;
        state.orthogonalGuide = resolved.guide;
        state.alignmentGuide = resolved.alignmentGuide;
      }

      state.interactionMode = state.isDrawingArea ? "draw-area" : "draw-line";
      beginDrag(event);
      updateAll();
    }

    function handlePointerDown(event) {
      if (!state.image) return false;

      updatePointerFromEvent(event);
      setPointerCapture(event.pointerId);

      if (event.pointerType === "touch" && pointerTracker.activeCount() >= 2) {
        event.preventDefault();
        startPinchGesture();
        updateAll();
        return true;
      }

      if (state.isDrawingSegments || state.isDrawingArea) {
        handleDrawingPointerDown(event);
        return true;
      }

      const hit = hitTesting.resolveHit(event.clientX, event.clientY);
      const {
        endpoint: hitEndpoint,
        label: hitLabel,
        segment: hitSegment,
        polygonLabel: hitPolygonLabel,
        polygon: hitPolygon,
      } = hit;
      const touchInput = event.pointerType === "touch";
      const touchBasePick = touchInput
        && state.isChoosingBase
        && !state.isDrawingSegments
        && !hitEndpoint
        && (hitLabel || hitSegment);
      const touchEmptyPan = touchInput
        && !state.isDrawingSegments
        && !hitEndpoint
        && !hitLabel
        && !hitSegment
        && !hitPolygonLabel
        && !hitPolygon;
      const wantsPan = event.button === 1 || state.isSpacePressed || touchEmptyPan;

      clearTransientGuides();

      if (wantsPan) {
        state.pendingPoint = null;
        state.interactionMode = "pan";
      } else if (touchBasePick) {
        const target = hitLabel || hitSegment;
        selectOnlySegment(target.id);
        state.pendingPoint = null;
        state.interactionMode = "base-pick";
      } else if (hitEndpoint) {
        selectOnlySegment(hitEndpoint.segment.id);
        state.pendingPoint = null;
        state.interactionMode = "endpoint";
      } else if (hitLabel) {
        if (event.shiftKey) {
          toggleSegmentSelection(hitLabel.id);
          state.interactionMode = "shift-select";
        } else {
          selectOnlySegment(hitLabel.id);
          state.interactionMode = "label";
        }
        state.pendingPoint = null;
      } else if (hitSegment) {
        if (event.shiftKey) {
          toggleSegmentSelection(hitSegment.id);
          state.interactionMode = "shift-select";
        } else {
          selectOnlySegment(hitSegment.id);
          state.interactionMode = "segment";
        }
        state.pendingPoint = null;
      } else if (hitPolygonLabel || hitPolygon) {
        const polygon = hitPolygonLabel || hitPolygon;
        selectOnlyPolygon(polygon.id);
        state.pendingPoint = null;
        state.interactionMode = "polygon";
      } else {
        state.interactionMode = "select";
      }

      const hitPolygonTarget = hitPolygonLabel || hitPolygon;
      beginDrag(event, {
        endpoint: hitEndpoint,
        labelSegment: hitLabel,
        hitSegment: hitLabel || hitSegment,
        polygon: hitPolygonTarget,
        polygonPoints: hitPolygonTarget
          ? hitPolygonTarget.points.map(clonePoint)
          : null,
        labelOffset: hitLabel ? currentLabelOffset(hitLabel) : { x: 0, y: -36 },
      });
      scheduleTouchContextMenu(hitLabel || hitSegment, event);
      updateAll();
      return true;
    }

    return {
      handlePointerDown,
    };
  }

  window.PlanScaleCanvasPointerDown = {
    createCanvasPointerDownController,
  };
})();
