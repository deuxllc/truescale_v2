(() => {
  function createCanvasWheelController({
    canvas,
    state,
    view,
    actions,
  }) {
    const {
      draw,
      scheduleViewSave,
    } = actions;

    function handleWheel(event) {
      if (!state.image) return;
      event.preventDefault();

      const deltaX = view.normalizedWheelDelta(event.deltaX, event.deltaMode);
      const deltaY = view.normalizedWheelDelta(event.deltaY, event.deltaMode);
      const shouldZoom = event.ctrlKey || event.metaKey || event.altKey;

      if (!shouldZoom) {
        view.panBy(deltaX, deltaY);
        draw();
        scheduleViewSave();
        return;
      }

      if (performance.now() - state.lastPointerUpAt < 240 || Math.abs(deltaY) < 1.5) {
        return;
      }

      const rawFactor = Math.exp(-deltaY * 0.0025);
      const factor = Math.min(Math.max(rawFactor, 0.75), 1.33);
      view.zoomAtClientPoint(event.clientX, event.clientY, factor);
      draw();
      scheduleViewSave();
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return {
      destroy() {
        canvas.removeEventListener("wheel", handleWheel);
      },
    };
  }

  window.PlanScaleCanvasWheel = {
    createCanvasWheelController,
  };
})();
