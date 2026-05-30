(() => {
  function createCanvasView({
    state,
    canvas,
    wrap,
    ctx,
    minScale,
    maxScale,
    draw,
    beforeResize,
    syncOverlays,
  }) {
    function logicalSize() {
      const ratio = window.devicePixelRatio || 1;
      return {
        width: canvas.width / ratio,
        height: canvas.height / ratio,
      };
    }

    function screenPointFromClient(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const logical = logicalSize();
      const scaleX = rect.width ? logical.width / rect.width : 1;
      const scaleY = rect.height ? logical.height / rect.height : 1;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function screenToImage(clientX, clientY) {
      const point = screenPointFromClient(clientX, clientY);
      return {
        x: (point.x - state.offsetX) / state.scale,
        y: (point.y - state.offsetY) / state.scale,
      };
    }

    function imageToScreen(point) {
      return {
        x: point.x * state.scale + state.offsetX,
        y: point.y * state.scale + state.offsetY,
      };
    }

    function clampPointToImage(point) {
      return point;
    }

    function resizeCanvas() {
      if (beforeResize) {
        beforeResize();
      }
      const ratio = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function syncAfterLayout({ fit = false } = {}) {
      resizeCanvas();
      if (fit && state.image) {
        fitImage();
      }
    }

    function fitImage() {
      if (!state.image) {
        if (syncOverlays) {
          syncOverlays();
        }
        return;
      }

      const rect = wrap.getBoundingClientRect();
      const padding = 36;
      const usableWidth = Math.max(1, rect.width - padding * 2);
      const usableHeight = Math.max(1, rect.height - padding * 2);
      state.scale = Math.min(usableWidth / state.image.width, usableHeight / state.image.height);
      state.homeScale = state.scale || 1;
      state.offsetX = (rect.width - state.image.width * state.scale) / 2;
      state.offsetY = (rect.height - state.image.height * state.scale) / 2;
      draw();
    }

    function normalizedWheelDelta(value, deltaMode) {
      if (deltaMode === 1) return value * 16;
      if (deltaMode === 2) return value * wrap.getBoundingClientRect().height;
      return value;
    }

    function clampScale(scale) {
      return Math.min(Math.max(scale, minScale), maxScale);
    }

    function zoomAtClientPoint(clientX, clientY, factor) {
      const screen = screenPointFromClient(clientX, clientY);
      const before = screenToImage(clientX, clientY);
      state.scale = clampScale(state.scale * factor);
      state.offsetX = screen.x - before.x * state.scale;
      state.offsetY = screen.y - before.y * state.scale;
    }

    function panBy(deltaX, deltaY) {
      state.offsetX -= deltaX;
      state.offsetY -= deltaY;
    }

    return {
      logicalSize,
      screenPointFromClient,
      screenToImage,
      imageToScreen,
      clampPointToImage,
      resizeCanvas,
      syncAfterLayout,
      fitImage,
      normalizedWheelDelta,
      clampScale,
      zoomAtClientPoint,
      panBy,
    };
  }

  window.PlanScaleCanvasView = {
    createCanvasView,
  };
})();
