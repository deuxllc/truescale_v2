(() => {
  window.PlanScaleConfig = {
    CANVAS_COLORS: {
      selected: "#2563eb",
      reference: "#0f8f73",
      normal: "#4f6f8f",
      angle: "#7768c8",
      area: "#0f8f73",
      areaFill: "rgba(15, 143, 115, 0.13)",
      detected: "#6475d9",
      leader: "rgba(79, 97, 120, 0.44)",
    },
    DETECTION_SENSITIVITY_MIN: 15,
    DETECTION_SENSITIVITY_MAX: 100,
    DEFAULT_DETECTION_SENSITIVITY: 15,
    IMPERIAL_UNITS: new Set(["ft", "in"]),
    MAX_AUTO_SEGMENTS: 150,
    STORAGE_KEY: "planscale-state-v4",
    VIEW_SAVE_DELAY: 220,
    MIN_VIEW_SCALE: 0.05,
    MAX_VIEW_SCALE: 12,
    TOUCH_LONG_PRESS_MS: 560,
    TOUCH_ENDPOINT_HIT_RADIUS: 44,
    TOUCH_ENDPOINT_DRAG_OFFSET: 42,
  };
})();
