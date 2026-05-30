(() => {
  function createProjectPayload({
    state,
    cloneSegment,
    clonePolygon,
    parseDecimal,
    getReferenceLength,
    currentReferenceValueMeters,
  }) {
    if (!state.imageSrc && !state.segments.length && !state.polygons.length) return null;
    return {
      app: "TrueScale",
      format: "truescale-project",
      version: 1,
      createdAt: new Date().toISOString(),
      imageName: state.imageName,
      imageDataUrl: state.imageSrc || null,
      segments: state.segments.map(cloneSegment),
      polygons: state.polygons.map(clonePolygon),
      reference: {
        segmentId: state.referenceId,
        pixelLength: getReferenceLength() || state.referencePixelLength,
        displayValue: parseDecimal(state.referenceValue),
        displayUnit: state.unit,
        valueMeters: currentReferenceValueMeters(),
        unitSystem: state.unitSystem,
      },
      display: {
        backgroundVisible: state.backgroundVisible,
        backgroundOpacity: state.backgroundOpacity,
        previousBackgroundOpacity: state.previousBackgroundOpacity,
        footnotesVisible: state.footnotesVisible,
        measurementPrecision: state.measurementPrecision,
        footnoteSize: state.footnoteSize,
        showUnitsInFootnotes: state.showUnitsInFootnotes,
        smartGridEnabled: state.smartGridEnabled,
        detectionSensitivity: state.detectionSensitivity,
        workflowMode: state.workflowMode,
      },
      view: {
        scale: state.scale,
        homeScale: state.homeScale,
        offsetX: state.offsetX,
        offsetY: state.offsetY,
      },
    };
  }

  function snapshotFromProjectPayload(payload, {
    cloneSegment,
    clonePolygon,
    unitSystemForUnit,
    defaultDetectionSensitivity,
  }) {
    if (!payload || payload.format !== "truescale-project" || Number(payload.version) !== 1) {
      throw new Error("Unsupported TrueScale project format");
    }

    const reference = payload.reference || {};
    const display = payload.display || {};
    const view = payload.view || {};
    const segments = (payload.segments || []).map(cloneSegment);
    const polygons = (payload.polygons || []).map(clonePolygon);

    return {
      imageSrc: payload.imageDataUrl || "",
      imageName: payload.imageName || "",
      backgroundVisible: display.backgroundVisible ?? true,
      backgroundOpacity: display.backgroundOpacity ?? 1,
      previousBackgroundOpacity: display.previousBackgroundOpacity ?? 1,
      scale: view.scale || 1,
      homeScale: view.homeScale || view.scale || 1,
      offsetX: view.offsetX || 0,
      offsetY: view.offsetY || 0,
      segments,
      polygons,
      referenceId: reference.segmentId ?? null,
      referencePixelLength: reference.pixelLength ?? null,
      selectedSegmentIds: reference.segmentId ? [reference.segmentId] : [],
      selectedPolygonIds: [],
      referenceValue: reference.displayValue ? String(reference.displayValue).replace(".", ",") : "",
      referenceValueMeters: reference.valueMeters ?? null,
      unit: reference.displayUnit || "м",
      unitSystem: reference.unitSystem || unitSystemForUnit(reference.displayUnit || "м"),
      footnotesVisible: display.footnotesVisible ?? true,
      measurementPrecision: display.measurementPrecision ?? 3,
      footnoteSize: display.footnoteSize || "normal",
      showUnitsInFootnotes: display.showUnitsInFootnotes !== false,
      smartGridEnabled: display.smartGridEnabled !== false,
      detectionSensitivity: display.detectionSensitivity ?? defaultDetectionSensitivity,
      workflowMode: display.workflowMode || null,
      isDrawingSegments: false,
      isDrawingArea: false,
      isChoosingBase: false,
      nextSegmentId: Math.max(1, ...segments.map((segment) => segment.id + 1), 1),
      nextPolygonId: Math.max(1, ...polygons.map((polygon) => polygon.id + 1), 1),
    };
  }

  window.PlanScaleProjectFormat = {
    createProjectPayload,
    snapshotFromProjectPayload,
  };
})();
