(() => {
  const UNIT_DEFINITIONS = {
    "мм": { meters: 0.001, system: "metric" },
    "см": { meters: 0.01, system: "metric" },
    "м": { meters: 1, system: "metric" },
    "км": { meters: 1000, system: "metric" },
    in: { meters: 0.0254, system: "imperial" },
    ft: { meters: 0.3048, system: "imperial" },
  };

  function normalizeUnit(unit) {
    return UNIT_DEFINITIONS[unit] ? unit : "м";
  }

  function unitSystemForUnit(unit) {
    return UNIT_DEFINITIONS[unit]?.system || "metric";
  }

  function unitMeters(unit) {
    return UNIT_DEFINITIONS[normalizeUnit(unit)].meters;
  }

  function parseDisplayValue(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0 ? value : null;
    }
    if (!String(value || "").trim()) return null;
    const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function displayValueToMeters(value, unit) {
    const parsed = parseDisplayValue(value);
    if (parsed === null) return null;
    return parsed * unitMeters(unit);
  }

  function metersToDisplayValue(valueMeters, unit) {
    const meters = Number(valueMeters);
    if (!Number.isFinite(meters) || meters <= 0) return null;
    return meters / unitMeters(unit);
  }

  function normalizePrecision(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 3;
    return Math.min(6, Math.max(0, Math.round(parsed)));
  }

  function formatDisplayInput(value, precision = 6) {
    if (!Number.isFinite(Number(value))) return "";
    const normalizedPrecision = normalizePrecision(precision);
    const fixed = Number(value).toFixed(normalizedPrecision);
    return fixed.replace(/\.?0+$/, "").replace(".", ",");
  }

  function referenceMetersFromState(state) {
    const stored = Number(state.referenceValueMeters);
    if (Number.isFinite(stored) && stored > 0) return stored;
    return displayValueToMeters(state.referenceValue, state.unit);
  }

  function segmentRatio(segment, referencePixelLength, segmentLength) {
    if (!referencePixelLength || referencePixelLength <= 0) return null;
    return segmentLength(segment) / referencePixelLength;
  }

  function segmentLengthMeters(segment, referencePixelLength, referenceValueMeters, segmentLength) {
    const ratio = segmentRatio(segment, referencePixelLength, segmentLength);
    const meters = Number(referenceValueMeters);
    if (ratio === null || !Number.isFinite(meters) || meters <= 0) return null;
    return ratio * meters;
  }

  function segmentLengthDisplay(segment, referencePixelLength, referenceValueMeters, unit, segmentLength) {
    const meters = segmentLengthMeters(segment, referencePixelLength, referenceValueMeters, segmentLength);
    return metersToDisplayValue(meters, unit);
  }

  function polygonAreaSquareMeters(points, referencePixelLength, referenceValueMeters, polygonAreaPx) {
    const meters = Number(referenceValueMeters);
    if (!referencePixelLength || referencePixelLength <= 0 || !Number.isFinite(meters) || meters <= 0) {
      return null;
    }
    const metersPerPixel = meters / referencePixelLength;
    return polygonAreaPx(points) * metersPerPixel * metersPerPixel;
  }

  function polygonAreaDisplay(points, referencePixelLength, referenceValueMeters, unit, polygonAreaPx) {
    const squareMeters = polygonAreaSquareMeters(points, referencePixelLength, referenceValueMeters, polygonAreaPx);
    if (squareMeters === null) return null;
    const unitSize = unitMeters(unit);
    return squareMeters / (unitSize * unitSize);
  }

  window.PlanScaleMeasurement = {
    UNIT_DEFINITIONS,
    normalizeUnit,
    unitSystemForUnit,
    unitMeters,
    parseDisplayValue,
    displayValueToMeters,
    metersToDisplayValue,
    formatDisplayInput,
    referenceMetersFromState,
    segmentLengthMeters,
    segmentLengthDisplay,
    polygonAreaSquareMeters,
    polygonAreaDisplay,
  };
})();
