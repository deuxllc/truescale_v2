(() => {
  function createCanvasPinchZoom({
    pointerTracker,
    actions,
  }) {
    const {
      draw,
      scheduleViewSave,
      zoomAtClientPoint,
    } = actions;

    function handlePointerMove(event) {
      if (!pointerTracker.hasPinch() || event.pointerType !== "touch" || pointerTracker.activeCount() < 2) {
        return false;
      }

      event.preventDefault();
      const metrics = pointerTracker.pairMetrics();
      if (metrics && metrics.distance >= 1) {
        const factor = metrics.distance / Math.max(pointerTracker.currentPinchDistance(), 1);
        zoomAtClientPoint(metrics.center.x, metrics.center.y, factor);
        pointerTracker.updatePinchDistance(metrics.distance);
        draw();
        scheduleViewSave();
      }
      return true;
    }

    return {
      handlePointerMove,
    };
  }

  window.PlanScaleCanvasPinchZoom = {
    createCanvasPinchZoom,
  };
})();
