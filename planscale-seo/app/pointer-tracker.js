(() => {
  function createPointerTracker() {
    const activePointers = new Map();
    let pinchDistance = null;

    function activeCount() {
      return activePointers.size;
    }

    function updateFromEvent(event) {
      if (event.pointerType !== "touch") return;
      activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    function removeFromEvent(event) {
      if (event.pointerType !== "touch") return;
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) {
        pinchDistance = null;
      }
    }

    function pairMetrics() {
      const pointers = Array.from(activePointers.values()).slice(0, 2);
      if (pointers.length < 2) return null;
      const [first, second] = pointers;
      const center = {
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
      };
      return {
        center,
        distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
      };
    }

    function startPinch(distance) {
      pinchDistance = distance;
    }

    function hasPinch() {
      return pinchDistance !== null;
    }

    function currentPinchDistance() {
      return pinchDistance;
    }

    function updatePinchDistance(distance) {
      pinchDistance = distance;
    }

    return {
      activeCount,
      currentPinchDistance,
      hasPinch,
      pairMetrics,
      removeFromEvent,
      startPinch,
      updateFromEvent,
      updatePinchDistance,
    };
  }

  window.PlanScalePointerTracker = {
    createPointerTracker,
  };
})();
