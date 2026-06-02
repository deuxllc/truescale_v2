(() => {
  function createCanvasPointerUpController({
    state,
    pointerTracker,
    hitTesting,
    actions,
  }) {
    const {
      addPoint,
      addPolygonPoint,
      clampPointToImage,
      clearLongPressTimer,
      commitHistory,
      consumeTouchContextMenuOpened,
      draw,
      endDrag,
      handleSegmentPick,
      now,
      releasePointerCapture,
      removePointerFromEvent,
      resetTransient,
      resolvePolygonPoint,
      resolveStartPoint,
      scheduleViewSave,
      screenToImage,
      selectOnlyPolygon,
      selectOnlySegment,
      showToast,
      toggleSegmentSelection,
      updateAll,
    } = actions;

    function touchWasConsumed(event) {
      if (!consumeTouchContextMenuOpened()) return false;
      resetTransient(null);
      state.lastPointerUpAt = now();
      draw();
      return true;
    }

    function pinchWasCompleted() {
      if (!pointerTracker.hasPinch() && state.interactionMode !== "pinch") return false;
      resetTransient(null);
      state.lastPointerUpAt = now();
      scheduleViewSave();
      draw();
      return true;
    }

    function handlePointerUp(event) {
      if (!state.image) return false;

      clearLongPressTimer();
      removePointerFromEvent(event);
      releasePointerCapture(event.pointerId);

      if (touchWasConsumed(event) || pinchWasCompleted()) {
        return true;
      }

      state.lastPointerUpAt = now();

      const wasClick = !state.didDrag;
      const hadSelectionBox = Boolean(state.selectionBox);
      const hit = wasClick
        ? hitTesting.resolveHit(event.clientX, event.clientY, { includeEndpoint: false })
        : {};
      const {
        label: hitLabel = null,
        segment: hitSegment = null,
        polygonLabel: hitPolygonLabel = null,
        polygon: hitPolygon = null,
      } = hit;
      const completedMode = state.interactionMode;
      const completedDragStart = state.dragStart;
      const shouldAddPoint = state.isDrawingSegments && wasClick && (
        completedMode === "draw-line" || (!hitLabel && !hitSegment && completedMode !== "endpoint")
      );
      const shouldAddPolygonPoint = state.isDrawingArea && wasClick && completedMode === "draw-area";

      endDrag();

      if (shouldAddPolygonPoint) {
        const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
        const resolved = resolvePolygonPoint(rawPoint);
        addPolygonPoint(resolved.point);
      } else if (shouldAddPoint) {
        const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
        const resolvedStart = state.pendingPoint ? null : resolveStartPoint(rawPoint);
        addPoint(resolvedStart ? resolvedStart.point : rawPoint);
      } else if (completedMode === "endpoint" || completedMode === "label") {
        updateAll();
        if (state.didDrag) {
          commitHistory();
        }
      } else if (completedMode === "polygon") {
        updateAll();
        if (state.didDrag) {
          commitHistory();
        }
      } else if (completedMode === "segment" && !wasClick) {
        state.selectionBox = null;
        state.pendingPoint = null;
        updateAll();
      } else if (completedMode === "base-pick" && wasClick && completedDragStart?.hitSegment) {
        if (handleSegmentPick(completedDragStart.hitSegment.id, { requireConfirmation: event.pointerType === "touch" })) {
          state.pendingPoint = null;
          return true;
        }
      } else if (completedMode === "pan" || completedMode === "base-pick") {
        scheduleViewSave();
      } else if (hadSelectionBox) {
        const selectedCount = state.selectedSegmentIds.size + state.selectedPolygonIds.size;
        state.selectionBox = null;
        state.pendingPoint = null;
        updateAll();
        if (selectedCount) {
          showToast(`Выбрано: ${selectedCount}`);
        }
      } else if (hitLabel || hitSegment) {
        const hitId = (hitLabel || hitSegment).id;
        if (handleSegmentPick(hitId, { requireConfirmation: event.pointerType === "touch" })) {
          state.pendingPoint = null;
          return true;
        }
        if (event.shiftKey || completedMode === "shift-select") {
          if (completedMode !== "shift-select") {
            toggleSegmentSelection(hitId);
          }
        } else {
          selectOnlySegment(hitId);
        }
        state.pendingPoint = null;
        updateAll();
      } else if (hitPolygonLabel || hitPolygon) {
        selectOnlyPolygon((hitPolygonLabel || hitPolygon).id);
        state.pendingPoint = null;
        updateAll();
      }

      return true;
    }

    return {
      handlePointerUp,
    };
  }

  window.PlanScaleCanvasPointerUp = {
    createCanvasPointerUpController,
  };
})();
