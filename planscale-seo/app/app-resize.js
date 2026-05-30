(() => {
  function createResizeController({
    wrap,
    delay = 50,
    actions,
  }) {
    const {
      resizeCanvas,
      syncCalibrationPlacement,
      updateToolControls,
    } = actions;
    let resizeTimer = 0;

    function runResize() {
      syncCalibrationPlacement();
      updateToolControls();
      resizeCanvas();
    }

    function scheduleResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(runResize, delay);
    }

    window.addEventListener("resize", scheduleResize);
    window.visualViewport?.addEventListener("resize", scheduleResize);

    const canvasResizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => resizeCanvas())
      : null;
    canvasResizeObserver?.observe(wrap);

    return {
      destroy() {
        window.clearTimeout(resizeTimer);
        window.removeEventListener("resize", scheduleResize);
        window.visualViewport?.removeEventListener("resize", scheduleResize);
        canvasResizeObserver?.disconnect();
      },
    };
  }

  window.PlanScaleResize = {
    createResizeController,
  };
})();
