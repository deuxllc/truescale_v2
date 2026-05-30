const { resolvePointWithSnaps } = window.PlanScaleSnap;
const { renderSegmentsPanel } = window.PlanScaleSegmentsPanel;
const {
  analyzeImageData,
  normalizeDetectionSensitivity,
  detectionSensitivityProgress,
} = window.PlanScaleDetectionCore;
const {
  clonePoint,
  segmentLength,
  segmentAngle,
  distanceToSegment,
  pointInsideRect,
  isGridAlignedSegment,
} = window.PlanScaleGeometry;
const {
  cloneSegment,
  clonePolygon,
  decodeBase64Json,
  normalizedRect,
  lineSegmentsIntersect,
  parseDecimal,
  formatDecimal,
  rectsIntersect,
  roundedRectPath,
} = window.PlanScaleUtils;
const {
  unitSystemForUnit,
  displayValueToMeters,
  metersToDisplayValue,
  formatDisplayInput,
  referenceMetersFromState,
  segmentLengthMeters,
  segmentLengthDisplay,
  polygonAreaSquareMeters,
  polygonAreaDisplay,
} = window.PlanScaleMeasurement;
const {
  requestDialog,
  confirmAction,
} = window.PlanScaleDialogs;
const {
  createAppState,
} = window.PlanScaleState;
const {
  createHistoryController,
} = window.PlanScaleHistory;
const {
  createProjectPayload: buildProjectPayload,
  snapshotFromProjectPayload: buildSnapshotFromProjectPayload,
} = window.PlanScaleProjectFormat;
const {
  createCanvasView,
} = window.PlanScaleCanvasView;
const {
  createCanvasRenderer,
} = window.PlanScaleCanvasRenderer;
const {
  createKeyboardController,
} = window.PlanScaleKeyboard;
const {
  canvas,
  wrap,
  appShell,
  ctx,
  imageInput,
  removeUnderlayButton,
  resetPlanButton,
  selectModeButton,
  drawSegmentButton,
  drawAreaButton,
  finishPolygonButton,
  reanalyzeButton,
  sidebarToggleButton,
  sidebarCloseButton,
  topbar,
  measureGroup,
  historyGroup,
  baseSection,
  recalibrateButton,
  undoButton,
  redoButton,
  clearButton,
  toggleAllFootnotesButton,
  copyButton,
  toggleSegmentsButton,
  statusText,
  exportStatus,
  emptyState,
  segmentSection,
  segmentsList,
  noSegments,
  panelSummary,
  smartGridToggle,
  referenceLengthInput,
  unitInput,
  exportMenuButton,
  exportMenu,
  exportPngButton,
  exportPngBgButton,
  exportPdfButton,
  exportPdfBgButton,
  exportSvgButton,
  exportCsvButton,
  exportJsonButton,
  exportProjectButton,
  importProjectButton,
  projectImportInput,
  copyShareLinkButton,
  helpButton,
  helpPopover,
  helpCloseButton,
  settingsButton,
  settingsMenu,
  settingsUnitSystemInput,
  settingsUnitInput,
  settingsPrecisionInput,
  settingsFootnoteSizeInput,
  settingsShowUnitsInput,
  settingsOpacityInput,
  settingsOpacityValue,
  settingsFootnotesInput,
  welcomeOverlay,
  welcomeStartButton,
  emptyUploadButton,
  cursorCoordinates,
  analysisReview,
  analysisReviewText,
  acceptDetectedButton,
  addDetectedButton,
  cancelDetectedButton,
  calibrationHint,
  calibrationHintTitle,
  calibrationHintText,
  focusReferenceButton,
  baseConfirm,
  baseConfirmText,
  confirmBaseButton,
  cancelBaseButton,
  referenceField,
  segmentContextMenu,
  focusBaseInputButton,
  chooseBaseButton,
  baseSegmentName,
  baseSegmentMeta,
  segmentsSortSelect,
  backgroundOpacityInput,
  backgroundOpacityValue,
  toggleBackgroundOpacityButton,
  inlineCalibration,
  inlineReferenceLengthInput,
  inlineUnitInput,
  nextActionPanel,
  manualModeButton,
  detectModeButton,
  runDetectionButton,
  detectionSensitivityInput,
  detectionSensitivityControl,
  detectionSensitivityValue,
  metricUnitsButton,
  imperialUnitsButton,
  scaleRuler,
  scaleRulerValue,
  scaleRulerLine,
  scaleRulerZoom,
  scaleRulerResetButton,
} = window.PlanScaleDom;

const {
  CANVAS_COLORS,
  DEFAULT_DETECTION_SENSITIVITY,
  IMPERIAL_UNITS,
  MAX_AUTO_SEGMENTS,
  STORAGE_KEY,
  VIEW_SAVE_DELAY,
  MIN_VIEW_SCALE,
  MAX_VIEW_SCALE,
  TOUCH_LONG_PRESS_MS,
  TOUCH_ENDPOINT_HIT_RADIUS,
  TOUCH_ENDPOINT_DRAG_OFFSET,
} = window.PlanScaleConfig;

const initialUnit = unitInput.value || "м";
const state = createAppState({
  unit: initialUnit,
  unitSystem: IMPERIAL_UNITS.has(initialUnit) ? "imperial" : "metric",
  detectionSensitivity: Number(detectionSensitivityInput?.value) || DEFAULT_DETECTION_SENSITIVITY,
});

const POLYGON_SNAP_OPTIONS = {
  axisFieldRadiusPx: Number.POSITIVE_INFINITY,
  axisTolerancePx: 11,
  endpointTolerancePx: 18,
  strongEndpointTolerancePx: 10,
};

let nextSegmentId = 1;
let nextPolygonId = 1;
let analysisRunId = 0;
let activeContextSegmentId = null;
let resizeTimer = 0;
let viewSaveTimer = 0;
const activePointers = new Map();
let pinchGesture = null;
let longPressTimer = 0;
let longPressSegment = null;
let touchContextMenuOpened = false;
const history = createHistoryController({
  snapshotState,
  applySnapshot,
  saveSnapshotToStorage,
  updateHistoryButtons,
});
const canvasView = createCanvasView({
  state,
  canvas,
  wrap,
  ctx,
  minScale: MIN_VIEW_SCALE,
  maxScale: MAX_VIEW_SCALE,
  draw,
  beforeResize: syncCanvasHeightToViewport,
  syncOverlays: syncCanvasOverlays,
});
const canvasRenderer = createCanvasRenderer({
  state,
  canvas,
  ctx,
  view: canvasView,
  colors: CANVAS_COLORS,
  helpers: {
    areaLabelTextFor,
    computeRightAngleHints,
    getLabelOffset,
    isCoarsePointer,
    isGridAlignedSegment,
    isPolygonFootnoteVisible,
    isPolygonSelected,
    isSegmentFootnoteVisible,
    isSegmentSelected,
    labelTextFor,
    nearestPointOnRect,
    normalizedRect,
    polygonCentroid,
    roundedRectPath,
    syncCanvasOverlays,
  },
});
const {
  setExportMenuOpen,
  toggleExportMenu,
  exportPng,
  exportPdf,
  exportCsv,
  exportJson,
  exportProject,
  copyShareLink,
  exportSvg,
} = window.PlanScaleExport.createExportController({
  state,
  dom: {
    exportStatus,
    exportMenu,
    exportMenuButton,
  },
  colors: CANVAS_COLORS,
  helpers: {
    showToast,
    segmentLength,
    calculatedLengthFor,
    calculatedLengthMetersFor,
    labelTextFor,
    areaLabelTextFor,
    polygonAreaFor,
    polygonAreaSquareMetersFor,
    polygonCentroid,
    isSegmentFootnoteVisible,
    isPolygonFootnoteVisible,
    nearestPointOnRect,
    isGridAlignedSegment,
    createProjectPayload,
  },
});

createKeyboardController({
  state,
  dom: {
    exportMenu,
    helpPopover,
    segmentContextMenu,
    settingsMenu,
    welcomeOverlay,
  },
  actions: {
    cancelPendingLine,
    cancelPendingPolygon,
    clearSelection,
    deleteSelectedObjects,
    dismissWelcome,
    hideBaseConfirmation,
    hideSegmentContextMenu,
    redoHistory,
    saveSnapshotToStorage,
    setExportMenuOpen,
    setHelpOpen,
    setSettingsOpen,
    showToast,
    undoHistory,
    updateAll,
    updateToolControls,
  },
});

function setUnitInputValue(value) {
  const unit = value || "м";
  const hasUnitOption = unitInput instanceof HTMLSelectElement
    && Array.from(unitInput.options).some((option) => option.value === unit);
  if (unitInput instanceof HTMLSelectElement && !hasUnitOption) {
    unitInput.add(new Option(unit, unit));
  }
  unitInput.value = unit;
  if (inlineUnitInput instanceof HTMLSelectElement) {
    const hasInlineUnitOption = Array.from(inlineUnitInput.options).some((option) => option.value === unit);
    if (!hasInlineUnitOption) {
      inlineUnitInput.add(new Option(unit, unit));
    }
    inlineUnitInput.value = unit;
  }
  if (settingsUnitInput instanceof HTMLSelectElement) {
    const hasSettingsUnitOption = Array.from(settingsUnitInput.options).some((option) => option.value === unit);
    if (!hasSettingsUnitOption) {
      settingsUnitInput.add(new Option(unit, unit));
    }
    settingsUnitInput.value = unit;
  }
  return unitInput.value || unit;
}

function syncReferenceInputs() {
  referenceLengthInput.value = state.referenceValue;
  if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = state.referenceValue;
}

function syncReferenceValueMeters() {
  state.referenceValueMeters = displayValueToMeters(state.referenceValue, state.unit);
  return state.referenceValueMeters;
}

function currentReferenceValueMeters() {
  return referenceMetersFromState(state);
}

function setReferenceValue(value, { syncInputs = true } = {}) {
  state.referenceValue = value;
  syncReferenceValueMeters();
  if (syncInputs) syncReferenceInputs();
}

function setProjectUnit(unit, { commit = false, convertReference = true } = {}) {
  const nextUnit = unit || "м";
  const previousUnit = state.unit || "м";
  const meters = currentReferenceValueMeters();
  const shouldConvert = convertReference
    && previousUnit !== nextUnit
    && parseDecimal(state.referenceValue) !== null
    && meters !== null;

  state.unit = nextUnit;
  state.unitSystem = unitSystemForUnit(state.unit);

  if (shouldConvert) {
    const converted = metersToDisplayValue(meters, state.unit);
    if (converted !== null) {
      state.referenceValue = formatDisplayInput(converted);
    }
  }

  syncReferenceValueMeters();
  setUnitInputValue(state.unit);
  syncReferenceInputs();
  updateUnitSystemControls();

  if (commit) {
    updateAll();
    commitHistory();
  }
}

function updateUnitSystemControls() {
  metricUnitsButton?.setAttribute("aria-pressed", String(state.unitSystem !== "imperial"));
  imperialUnitsButton?.setAttribute("aria-pressed", String(state.unitSystem === "imperial"));
  if (settingsUnitSystemInput instanceof HTMLSelectElement) {
    settingsUnitSystemInput.value = state.unitSystem === "imperial" ? "imperial" : "metric";
  }
}

function setProjectUnitSystem(system, { commit = false } = {}) {
  const nextSystem = system === "imperial" ? "imperial" : "metric";
  setProjectUnit(nextSystem === "imperial" ? "ft" : "м", { commit });
}

function setBackgroundOpacity(value, { remember = true } = {}) {
  const opacity = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));
  if (remember && opacity > 0.02) {
    state.previousBackgroundOpacity = opacity;
  }
  state.backgroundOpacity = opacity;
  state.backgroundVisible = opacity > 0.02;
}

function updateBackgroundOpacityControls() {
  if (backgroundOpacityInput) {
    backgroundOpacityInput.value = String(Math.round(state.backgroundOpacity * 100));
    backgroundOpacityInput.disabled = !state.image;
  }
  if (backgroundOpacityValue) {
    backgroundOpacityValue.textContent = `${Math.round(state.backgroundOpacity * 100)}%`;
  }
  if (settingsOpacityInput) {
    settingsOpacityInput.value = String(Math.round(state.backgroundOpacity * 100));
    settingsOpacityInput.disabled = !state.image;
  }
  if (settingsOpacityValue) {
    settingsOpacityValue.textContent = `${Math.round(state.backgroundOpacity * 100)}%`;
  }
  if (settingsFootnotesInput) {
    settingsFootnotesInput.checked = state.footnotesVisible;
    settingsFootnotesInput.disabled = !state.segments.length && !state.polygons.length;
  }
  if (settingsPrecisionInput instanceof HTMLSelectElement) {
    settingsPrecisionInput.value = String(state.measurementPrecision);
  }
  if (settingsFootnoteSizeInput instanceof HTMLSelectElement) {
    settingsFootnoteSizeInput.value = state.footnoteSize;
  }
  if (settingsShowUnitsInput instanceof HTMLInputElement) {
    settingsShowUnitsInput.checked = state.showUnitsInFootnotes;
  }
  if (toggleBackgroundOpacityButton) {
    toggleBackgroundOpacityButton.disabled = !state.image;
    toggleBackgroundOpacityButton.title = state.backgroundVisible ? "Скрыть подложку" : "Показать подложку";
    toggleBackgroundOpacityButton.setAttribute("aria-label", toggleBackgroundOpacityButton.title);
    toggleBackgroundOpacityButton.setAttribute("aria-pressed", String(!state.backgroundVisible));
  }
}

function sensitivityLabel(value) {
  const progress = detectionSensitivityProgress(value);
  if (progress <= 0.28) return "Меньше лишних";
  if (progress >= 0.72) return "Больше деталей";
  return "Сбалансировано";
}

function updateDetectionSensitivityControls() {
  const value = normalizeDetectionSensitivity(state.detectionSensitivity);
  state.detectionSensitivity = value;
  if (detectionSensitivityInput) {
    detectionSensitivityInput.value = String(value);
    const progress = detectionSensitivityProgress(value) * 100;
    detectionSensitivityInput.style.setProperty("--sensitivity-progress", `${Math.max(0, Math.min(100, progress))}%`);
  }
  if (detectionSensitivityValue) {
    detectionSensitivityValue.textContent = sensitivityLabel(value);
  }
  const showSensitivity = state.nextActionPromptVisible && state.workflowMode === "auto";
  if (detectionSensitivityControl) detectionSensitivityControl.hidden = !showSensitivity;
  if (runDetectionButton) runDetectionButton.hidden = !showSensitivity;
  detectModeButton?.setAttribute("aria-pressed", String(state.workflowMode === "auto"));
  manualModeButton?.setAttribute("aria-pressed", String(state.workflowMode === "manual"));
}

function snapshotState() {
  return {
    imageSrc: state.imageSrc,
    imageName: state.imageName,
    backgroundVisible: state.backgroundVisible,
    backgroundOpacity: state.backgroundOpacity,
    previousBackgroundOpacity: state.previousBackgroundOpacity,
    scale: state.scale,
    homeScale: state.homeScale,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    segments: state.segments.map(cloneSegment),
    polygons: state.polygons.map(clonePolygon),
    referenceId: state.referenceId,
    referencePixelLength: state.referencePixelLength,
    selectedSegmentIds: getSelectedIds(),
    selectedPolygonIds: getSelectedPolygonIds(),
    referenceValue: state.referenceValue,
    referenceValueMeters: state.referenceValueMeters,
    unit: state.unit,
    unitSystem: state.unitSystem,
    footnotesVisible: state.footnotesVisible,
    measurementPrecision: state.measurementPrecision,
    footnoteSize: state.footnoteSize,
    showUnitsInFootnotes: state.showUnitsInFootnotes,
    smartGridEnabled: state.smartGridEnabled,
    detectionSensitivity: state.detectionSensitivity,
    workflowMode: state.workflowMode,
    isDrawingSegments: state.isDrawingSegments,
    isDrawingArea: state.isDrawingArea,
    isChoosingBase: state.isChoosingBase,
    nextSegmentId,
    nextPolygonId,
  };
}

function createProjectPayload() {
  return buildProjectPayload({
    state,
    cloneSegment,
    clonePolygon,
    parseDecimal,
    getReferenceLength,
    currentReferenceValueMeters,
  });
}

function snapshotFromProjectPayload(payload) {
  return buildSnapshotFromProjectPayload(payload, {
    cloneSegment,
    clonePolygon,
    unitSystemForUnit,
    defaultDetectionSensitivity: DEFAULT_DETECTION_SENSITIVITY,
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = src;
  });
}

async function applySnapshot(snapshot) {
  return history.runRestoring(async () => {
    const imageChanged = snapshot.imageSrc !== state.imageSrc;
    state.imageSrc = snapshot.imageSrc || "";
    state.imageName = snapshot.imageName || "";
    state.backgroundVisible = snapshot.backgroundVisible ?? true;
    state.backgroundOpacity = typeof snapshot.backgroundOpacity === "number"
      ? Math.min(1, Math.max(0, snapshot.backgroundOpacity))
      : (state.backgroundVisible ? 1 : 0);
    state.previousBackgroundOpacity = typeof snapshot.previousBackgroundOpacity === "number"
      ? Math.min(1, Math.max(0.05, snapshot.previousBackgroundOpacity))
      : 1;
    state.backgroundVisible = state.backgroundOpacity > 0;
    state.image = imageChanged ? await loadImage(state.imageSrc) : state.image;
    if (!state.imageSrc) {
      state.image = null;
    }
    state.scale = snapshot.scale || 1;
    state.homeScale = snapshot.homeScale || state.scale || 1;
    state.offsetX = snapshot.offsetX || 0;
    state.offsetY = snapshot.offsetY || 0;
    state.segments = (snapshot.segments || []).map((segment) => ({
      ...cloneSegment(segment),
      labelOffset: segment.labelOffset ? { ...segment.labelOffset } : null,
    }));
    state.polygons = (snapshot.polygons || []).map(clonePolygon);
    state.referenceId = snapshot.referenceId ?? null;
    state.referencePixelLength = typeof snapshot.referencePixelLength === "number"
      ? snapshot.referencePixelLength
      : null;
    state.selectedSegmentIds = new Set(snapshot.selectedSegmentIds || []);
    state.selectedPolygonIds = new Set(snapshot.selectedPolygonIds || []);
    state.referenceValue = snapshot.referenceValue || "";
    state.referenceValueMeters = typeof snapshot.referenceValueMeters === "number"
      ? snapshot.referenceValueMeters
      : null;
    state.unit = snapshot.unit || "м";
    state.unitSystem = snapshot.unitSystem || unitSystemForUnit(state.unit);
    syncReferenceValueMeters();
    state.footnotesVisible = typeof snapshot.footnotesVisible === "boolean"
      ? snapshot.footnotesVisible
      : (state.segments.length + state.polygons.length) === 0
        || state.segments.some((segment) => segment.labelHidden !== true)
        || state.polygons.some((polygon) => polygon.labelHidden !== true);
    state.measurementPrecision = normalizePrecision(snapshot.measurementPrecision);
    state.footnoteSize = normalizeFootnoteSize(snapshot.footnoteSize);
    state.showUnitsInFootnotes = snapshot.showUnitsInFootnotes !== false;
    state.pendingPoint = null;
    state.polygonPoints = [];
    state.polygonPreviewPoint = null;
    state.polygonCloseTarget = null;
    state.selectionBox = null;
    state.snapPoint = null;
    state.previewPoint = null;
    state.orthogonalGuide = null;
    state.alignmentGuide = null;
    state.rightAngleHints = [];
    state.rightAngleIds = new Set();
    state.detectedSegments = [];
    state.smartGridEnabled = true;
    state.detectionSensitivity = normalizeDetectionSensitivity(snapshot.detectionSensitivity);
    state.workflowMode = snapshot.workflowMode || null;
    state.nextActionPromptVisible = false;
    state.isEditingReferenceLength = false;
    state.isDrawingSegments = Boolean(snapshot.isDrawingSegments);
    state.isDrawingArea = Boolean(snapshot.isDrawingArea);
    state.isChoosingBase = Boolean(snapshot.isChoosingBase);
    state.isSpacePressed = false;
    state.isAnalyzing = false;
    state.hoveredSegmentId = null;
    state.pendingReferenceId = null;
    nextSegmentId = snapshot.nextSegmentId || Math.max(1, ...state.segments.map((segment) => segment.id + 1), 1);
    nextPolygonId = snapshot.nextPolygonId || Math.max(1, ...state.polygons.map((polygon) => polygon.id + 1), 1);

    setUnitInputValue(state.unit);
    syncReferenceInputs();
    updateUnitSystemControls();
    updateDetectionSensitivityControls();
    smartGridToggle.checked = state.smartGridEnabled;
    updateToolControls();
    emptyState.hidden = Boolean(state.image);
    updateAll();
  });
}

function saveSnapshotToStorage(snapshot = snapshotState()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Large uploaded plans can exceed localStorage. The editor still works without persistence.
  }
}

function restoreSharedStateFromHash() {
  const match = window.location.hash.slice(1).match(/(?:^|&)state=([^&]+)/);
  if (!match) return false;

  try {
    const payload = decodeBase64Json(match[1]);
    state.segments = (payload.segments || []).map((item, index) => ({
      id: Number(item.id) || index + 1,
      name: String(item.name || `Отрезок ${index + 1}`),
      start: { x: Number(item.startX), y: Number(item.startY) },
      end: { x: Number(item.endX), y: Number(item.endY) },
      labelHidden: item.labelHidden === true || item.footnoteVisible === false,
    })).filter((segment) => (
      Number.isFinite(segment.start.x) &&
      Number.isFinite(segment.start.y) &&
      Number.isFinite(segment.end.x) &&
      Number.isFinite(segment.end.y)
    ));
    state.polygons = (payload.polygons || []).map((item, index) => ({
      id: Number(item.id) || index + 1,
      name: String(item.name || `Площадь ${index + 1}`),
      points: (item.points || []).map((point) => ({
        x: Number(point.x),
        y: Number(point.y),
      })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
      labelHidden: item.labelHidden === true || item.footnoteVisible === false,
    })).filter((polygon) => polygon.points.length >= 3);
    state.referenceId = payload.baseSegmentId ?? state.segments[0]?.id ?? null;
    state.referencePixelLength = typeof payload.basePixelLength === "number"
      ? payload.basePixelLength
      : getReferenceLengthFromSegments(state.referenceId);
    state.referenceValue = payload.baseValue ? String(payload.baseValue).replace(".", ",") : "";
    state.referenceValueMeters = typeof payload.baseValueMeters === "number"
      ? payload.baseValueMeters
      : null;
    state.unit = payload.unit || state.unit || "м";
    state.unitSystem = payload.unitSystem || unitSystemForUnit(state.unit);
    syncReferenceValueMeters();
    state.footnotesVisible = typeof payload.footnotesVisible === "boolean"
      ? payload.footnotesVisible
      : (state.segments.length + state.polygons.length) === 0
        || state.segments.some((segment) => segment.labelHidden !== true)
        || state.polygons.some((polygon) => polygon.labelHidden !== true);
    state.measurementPrecision = normalizePrecision(payload.measurementPrecision);
    state.footnoteSize = normalizeFootnoteSize(payload.footnoteSize);
    state.showUnitsInFootnotes = payload.showUnitsInFootnotes !== false;
    state.selectedSegmentIds = new Set(state.referenceId ? [state.referenceId] : []);
    state.selectedPolygonIds = new Set();
    state.isChoosingBase = !getReferenceLength() && state.segments.length > 0;
    nextSegmentId = Math.max(1, ...state.segments.map((segment) => segment.id + 1), 1);
    nextPolygonId = Math.max(1, ...state.polygons.map((polygon) => polygon.id + 1), 1);
    setUnitInputValue(state.unit);
    syncReferenceInputs();
    return true;
  } catch {
    return false;
  }
}

function scheduleViewSave() {
  window.clearTimeout(viewSaveTimer);
  viewSaveTimer = window.setTimeout(() => {
    saveSnapshotToStorage();
  }, VIEW_SAVE_DELAY);
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function normalizePrecision(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(3, Math.max(0, Math.round(parsed)));
}

function normalizeFootnoteSize(value) {
  return ["compact", "normal", "large"].includes(value) ? value : "normal";
}

function hasCompleteBaseLength() {
  return Boolean(getReferenceLength() && parseDecimal(state.referenceValue) !== null);
}

function syncCalibrationPlacement() {
  if (!measureGroup || !topbar || !baseSection) return;

  const isInPanel = measureGroup.parentElement === baseSection;
  if (isInPanel) {
    topbar.insertBefore(measureGroup, historyGroup);
  }
  document.body.classList.toggle("base-length-complete", hasCompleteBaseLength());
}

function updateHistoryButtons() {
  const hasImage = Boolean(state.image);
  const hasSegments = state.segments.length > 0;
  const hasObjects = hasSegments || state.polygons.length > 0;
  const hasDetected = state.detectedSegments.length > 0;
  const hasSelection = state.selectedSegmentIds.size > 0 || state.selectedPolygonIds.size > 0;
  undoButton.disabled = history.undoLength <= 1;
  redoButton.disabled = history.redoLength === 0;
  removeUnderlayButton.disabled = !hasImage;
  resetPlanButton.disabled = !hasImage && !hasObjects && !hasDetected;
  if (selectModeButton) selectModeButton.disabled = !hasImage;
  drawSegmentButton.disabled = !hasImage;
  if (drawAreaButton) drawAreaButton.disabled = !hasImage;
  reanalyzeButton.disabled = !hasImage || state.isAnalyzing;
  exportMenuButton.disabled = !hasImage;
  clearButton.disabled = !hasSelection;
  clearButton.title = hasSelection
    ? "Удалить выбранное"
    : "Сначала выберите объект";
  clearButton.setAttribute("aria-label", clearButton.title);
  if (toggleAllFootnotesButton) {
    toggleAllFootnotesButton.disabled = !hasObjects;
  }
  copyButton.disabled = !hasObjects;
  if (!hasImage) {
    setExportMenuOpen(false);
  }
}

function updateToolControls() {
  if (!state.image && (state.isDrawingSegments || state.isDrawingArea)) {
    state.isDrawingSegments = false;
    state.isDrawingArea = false;
    cancelPendingPolygon();
  }
  selectModeButton?.setAttribute("aria-pressed", String(Boolean(state.image && !state.isDrawingSegments && !state.isDrawingArea)));
  drawSegmentButton.setAttribute("aria-pressed", String(state.isDrawingSegments));
  drawAreaButton?.setAttribute("aria-pressed", String(state.isDrawingArea));
  reanalyzeButton.classList.toggle("is-loading", state.isAnalyzing);
  reanalyzeButton.setAttribute("aria-busy", String(state.isAnalyzing));
  canvas.classList.toggle("drawing-mode", state.isDrawingSegments);
  canvas.classList.toggle("area-mode", state.isDrawingArea);
  canvas.classList.toggle("choosing-base", state.isChoosingBase);
  canvas.classList.toggle("panning-ready", state.isSpacePressed && Boolean(state.image));
  wrap.classList.toggle("analyzing", state.isAnalyzing);
  wrap.classList.toggle("drawing-active", state.isDrawingSegments && Boolean(state.image));
  document.body.classList.toggle("empty-mode", !state.image && welcomeOverlay.hidden);
  document.body.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  if (!state.image) {
    hideCursorCoordinates();
  }

  updateBackgroundOpacityControls();
  updateUnitSystemControls();
  updateDetectionSensitivityControls();
  const underlayLabel = removeUnderlayButton.querySelector("span");
  if (underlayLabel) {
    underlayLabel.textContent = !state.image
      ? "Подложка"
      : state.backgroundVisible
        ? "Скрыть"
        : "Показать";
  }
  removeUnderlayButton.setAttribute("aria-pressed", String(Boolean(state.image && !state.backgroundVisible)));
  removeUnderlayButton.title = !state.image
    ? "Сначала загрузите изображение"
    : state.backgroundVisible
      ? "Быстро скрыть подложку"
      : "Вернуть прозрачность подложки";
  removeUnderlayButton.setAttribute(
    "aria-label",
    !state.image
      ? "Сначала загрузите изображение"
      : state.backgroundVisible
        ? "Скрыть подложку"
        : "Показать подложку",
  );

  smartGridToggle.checked = state.smartGridEnabled;
  smartGridToggle.closest(".toolbar-toggle")?.classList.toggle("active", state.smartGridEnabled);

  updateAllFootnotesButtonState();

  const hasBase = Boolean(getReferenceLength());
  const hasSegments = state.segments.length > 0;
  referenceLengthInput.disabled = !hasBase;
  focusReferenceButton.hidden = !hasBase;
  focusBaseInputButton.disabled = !hasBase;
  chooseBaseButton.disabled = !hasSegments;
  chooseBaseButton.textContent = hasBase ? "Перекалибровать" : "Выбрать отрезок";
  if (recalibrateButton) {
    recalibrateButton.disabled = !hasSegments;
    recalibrateButton.title = !hasSegments
      ? "Сначала добавьте или примите отрезки"
      : hasBase
        ? "Изменить масштаб проекта"
        : "Выбрать базовый отрезок";
    recalibrateButton.setAttribute("aria-label", recalibrateButton.title);
  }
  if (finishPolygonButton) {
    finishPolygonButton.hidden = !(state.isDrawingArea && state.polygonPoints.length >= 3);
  }
  sidebarToggleButton.disabled = false;
  sidebarToggleButton.title = state.sidebarCollapsed
      ? "Показать измерения"
      : "Скрыть измерения";
  sidebarToggleButton.setAttribute("aria-label", sidebarToggleButton.title);
  syncCalibrationPlacement();
}

function updateGuidanceControls() {
  const detectedCount = state.detectedSegments.length;
  analysisReview.hidden = detectedCount === 0;
  if (detectedCount) {
    const hasCurrentMarkup = state.segments.length > 0 || state.polygons.length > 0;
    analysisReviewText.textContent = hasCurrentMarkup
      ? `Найдено ${detectedCount} ${plural(detectedCount, "кандидат", "кандидата", "кандидатов")}. Пунктирные линии еще не сохранены: примите их, добавьте к текущей разметке или отмените.`
      : `Найдено ${detectedCount} ${plural(detectedCount, "кандидат", "кандидата", "кандидатов")}. Пунктирные линии еще не сохранены: примите их или отмените.`;
    addDetectedButton.hidden = !hasCurrentMarkup;
  }

  const needsBase = Boolean(state.image && !getReferenceLength() && !state.nextActionPromptVisible && (state.isDrawingSegments || state.segments.length));
  const needsLength = Boolean(state.image && state.segments.length && state.referenceId && parseDecimal(state.referenceValue) === null);
  calibrationHint.hidden = !needsBase && !needsLength;
  if (needsBase) {
    if (state.segments.length && !state.pendingPoint) {
      calibrationHintTitle.textContent = "Выберите линию с известным размером";
      calibrationHintText.textContent = "";
    } else {
      calibrationHintTitle.textContent = state.pendingPoint
        ? "Поставьте вторую точку известного размера"
        : "Проведите известный размер";
      calibrationHintText.textContent = state.pendingPoint
        ? ""
        : "";
    }
  } else if (needsLength) {
    calibrationHintTitle.textContent = "Введите реальную длину выбранной линии";
    calibrationHintText.textContent = "";
  }
  referenceField?.classList.toggle("needs-attention", needsBase || needsLength);
  recalibrateButton?.classList.remove("needs-attention");
  referenceLengthInput.setAttribute("aria-invalid", String(needsLength && state.referenceValue.trim().length > 0));
  if (baseConfirm) {
    baseConfirm.hidden = !state.pendingReferenceId;
  }
}

function syncCanvasOverlays() {
  syncInlineCalibration();
  syncNextActionPanel();
  syncScaleRuler();
}

function syncInlineCalibration() {
  if (!inlineCalibration) return;

  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  const needsLength = Boolean(state.image && reference && (state.isEditingReferenceLength || parseDecimal(state.referenceValue) === null));
  inlineCalibration.hidden = !needsLength;
  if (!needsLength) return;

  const start = imageToScreen(reference.start);
  const end = imageToScreen(reference.end);
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const rect = wrap.getBoundingClientRect();
  const ownRect = inlineCalibration.getBoundingClientRect();
  const width = ownRect.width || 230;
  const height = ownRect.height || 88;
  const x = Math.min(Math.max(12, midpoint.x - width / 2), Math.max(12, rect.width - width - 12));
  const y = Math.min(Math.max(12, midpoint.y + 22), Math.max(12, rect.height - height - 12));
  inlineCalibration.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function syncNextActionPanel() {
  if (!nextActionPanel) return;
  const shouldShow = Boolean(
    state.image
    && state.nextActionPromptVisible
    && !state.detectedSegments.length
    && !state.isAnalyzing,
  );
  nextActionPanel.hidden = !shouldShow;
}

function realValueCandidates() {
  return [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
}

function syncScaleRuler() {
  if (!scaleRuler || !scaleRulerLine || !scaleRulerValue || !scaleRulerZoom) return;

  const referenceValue = metersToDisplayValue(currentReferenceValueMeters(), state.unit);
  const referenceLength = getReferenceLength();
  if (!state.image || !referenceLength || referenceValue === null || referenceValue <= 0) {
    scaleRuler.hidden = true;
    return;
  }

  const pixelsPerUnit = referenceLength * state.scale / referenceValue;
  if (!Number.isFinite(pixelsPerUnit) || pixelsPerUnit <= 0) {
    scaleRuler.hidden = true;
    return;
  }

  const candidates = realValueCandidates().map((value) => ({
    value,
    width: value * pixelsPerUnit,
  }));
  const visible = candidates
    .filter((item) => item.width >= 56 && item.width <= 180)
    .sort((a, b) => Math.abs(a.width - 116) - Math.abs(b.width - 116))[0]
    || candidates.sort((a, b) => Math.abs(a.width - 116) - Math.abs(b.width - 116))[0];

  scaleRuler.hidden = false;
  scaleRulerLine.style.width = `${Math.round(Math.min(180, Math.max(48, visible.width)))}px`;
  scaleRulerValue.textContent = formatScaleRulerLength(visible.value, state.unit.trim() || "ед.");
  const homeScale = state.homeScale || state.scale || 1;
  scaleRulerZoom.textContent = `${Math.round((state.scale / homeScale) * 100)}%`;
}

function commitHistory() {
  history.commit();
}

async function undoHistory() {
  await history.undo();
}

async function redoHistory() {
  await history.redo();
}

async function restoreSavedState() {
  if (restoreSharedStateFromHash()) {
    updateAll();
    commitHistory();
    showToast("Разметка из ссылки загружена. Теперь добавьте то же изображение.");
    return;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    updateAll();
    commitHistory();
    return;
  }

  try {
    const snapshot = JSON.parse(raw);
    await applySnapshot(snapshot);
    history.replace({ undo: [snapshotState()], redo: [] });
    updateHistoryButtons();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    updateAll();
    commitHistory();
  }
}

function syncCanvasHeightToViewport() {
  if (!appShell || !wrap) return;

  const shellStyle = window.getComputedStyle(appShell);
  const paddingBottom = Number.parseFloat(shellStyle.paddingBottom) || 0;
  const rect = wrap.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const isCompact = window.matchMedia("(max-width: 760px)").matches;
  const minHeight = isCompact ? 140 : 280;
  const availableHeight = viewportHeight - rect.top - paddingBottom;
  wrap.style.height = `${Math.max(minHeight, Math.floor(availableHeight))}px`;
}

function resizeCanvas() {
  canvasView.resizeCanvas();
}

function syncCanvasAfterLayout({ fit = false } = {}) {
  canvasView.syncAfterLayout({ fit });
}

function fitImage() {
  canvasView.fitImage();
}

function normalizedWheelDelta(value, deltaMode) {
  return canvasView.normalizedWheelDelta(value, deltaMode);
}

function clampViewScale(scale) {
  return canvasView.clampScale(scale);
}

function zoomAtClientPoint(clientX, clientY, factor) {
  canvasView.zoomAtClientPoint(clientX, clientY, factor);
}

function pointerPairMetrics() {
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

function clearLongPressTimer() {
  window.clearTimeout(longPressTimer);
  longPressTimer = 0;
  longPressSegment = null;
}

function resetTransientGestureState(mode = null) {
  state.isDragging = false;
  state.dragStart = null;
  state.didDrag = false;
  state.interactionMode = mode;
  state.selectionBox = null;
  state.snapPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  state.polygonPreviewPoint = null;
  state.polygonCloseTarget = null;
  canvas.classList.remove("dragging");
}

function safeSetPointerCapture(pointerId) {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Some mobile WebViews can reject capture while still delivering pointer events.
  }
}

function safeReleasePointerCapture(pointerId) {
  try {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  } catch {
    // Pointer capture may already be gone after touch cancellation.
  }
}

function startPinchGesture() {
  const metrics = pointerPairMetrics();
  if (!metrics || metrics.distance < 1) return;
  pinchGesture = {
    distance: metrics.distance,
  };
  clearLongPressTimer();
  resetTransientGestureState("pinch");
}

function updatePointerFromEvent(event) {
  if (event.pointerType !== "touch") return;
  activePointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  });
}

function removePointerFromEvent(event) {
  if (event.pointerType !== "touch") return;
  activePointers.delete(event.pointerId);
  if (activePointers.size < 2) {
    pinchGesture = null;
  }
}

function scheduleTouchContextMenu(segment, event) {
  clearLongPressTimer();
  if (!segment || event.pointerType !== "touch" || state.isDrawingSegments || state.isChoosingBase) return;
  const { clientX, clientY } = event;
  longPressSegment = segment;
  longPressTimer = window.setTimeout(() => {
    if (!longPressSegment || activePointers.size > 1) return;
    selectOnlySegment(longPressSegment.id);
    resetTransientGestureState(null);
    touchContextMenuOpened = true;
    updateAll();
    showSegmentContextMenu(longPressSegment, clientX, clientY);
    longPressSegment = null;
  }, TOUCH_LONG_PRESS_MS);
}

function canvasLogicalSize() {
  return canvasView.logicalSize();
}

function screenPointFromClient(clientX, clientY) {
  return canvasView.screenPointFromClient(clientX, clientY);
}

function screenToImage(clientX, clientY) {
  return canvasView.screenToImage(clientX, clientY);
}

function updateCursorCoordinates(clientX, clientY) {
  if (!cursorCoordinates || !state.image || !welcomeOverlay.hidden) {
    hideCursorCoordinates();
    return;
  }

  const point = screenToImage(clientX, clientY);
  const isInsideImage = point.x >= 0 && point.x <= state.image.width && point.y >= 0 && point.y <= state.image.height;
  cursorCoordinates.hidden = !isInsideImage;
  if (isInsideImage) {
    cursorCoordinates.textContent = `x ${formatDecimal(point.x)} · y ${formatDecimal(point.y)}`;
  }
}

function hideCursorCoordinates() {
  if (cursorCoordinates) {
    cursorCoordinates.hidden = true;
  }
}

function imageToScreen(point) {
  return canvasView.imageToScreen(point);
}

function clampPointToImage(point) {
  return canvasView.clampPointToImage(point);
}

function findSegmentAt(clientX, clientY, tolerance = isCoarsePointer() ? 30 : 18) {
  const point = screenPointFromClient(clientX, clientY);
  let closest = null;
  let closestDistance = Infinity;

  for (const segment of state.segments) {
    const start = imageToScreen(segment.start);
    const end = imageToScreen(segment.end);
    const distance = distanceToSegment(point, start, end);

    if (distance < closestDistance) {
      closestDistance = distance;
      closest = segment;
    }
  }

  return closestDistance <= tolerance ? closest : null;
}

function findLabelAt(clientX, clientY) {
  const point = screenPointFromClient(clientX, clientY);

  for (const [id, rect] of state.labelBounds.entries()) {
    if (pointInsideRect(point, rect)) {
      return state.segments.find((segment) => segment.id === id) ?? null;
    }
  }

  return null;
}

function findPolygonLabelAt(clientX, clientY) {
  const point = screenPointFromClient(clientX, clientY);

  for (const [id, rect] of state.polygonLabelBounds.entries()) {
    if (pointInsideRect(point, rect)) {
      return state.polygons.find((polygon) => polygon.id === id) ?? null;
    }
  }

  return null;
}

function findPolygonAt(clientX, clientY) {
  const point = screenPointFromClient(clientX, clientY);

  for (let index = state.polygons.length - 1; index >= 0; index--) {
    const polygon = state.polygons[index];
    const points = polygon.points.map(imageToScreen);
    if (pointInsidePolygon(point, points)) {
      return polygon;
    }
  }

  return null;
}

function findEndpointAt(clientX, clientY) {
  const point = screenPointFromClient(clientX, clientY);
  let closest = null;
  let closestDistance = Infinity;
  const hitRadius = isCoarsePointer() ? TOUCH_ENDPOINT_HIT_RADIUS : 16;

  for (const segment of state.segments) {
    if (!isSegmentSelected(segment)) continue;

    for (const endpoint of ["start", "end"]) {
      const screen = imageToScreen(segment[endpoint]);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = { segment, endpoint };
      }
    }
  }

  return closestDistance <= hitRadius ? closest : null;
}

function findSnapPoint(imagePoint, segmentId) {
  const screen = imageToScreen(imagePoint);
  let closest = null;
  let closestDistance = Infinity;

  for (const segment of state.segments) {
    if (segment.id === segmentId) continue;

    for (const endpoint of ["start", "end"]) {
      const endpointScreen = imageToScreen(segment[endpoint]);
      const distance = Math.hypot(screen.x - endpointScreen.x, screen.y - endpointScreen.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = {
          point: { ...segment[endpoint] },
          screen: endpointScreen,
        };
      }
    }
  }

  return closestDistance <= 16 ? closest : null;
}

function findStartEndpointSnap(imagePoint) {
  const screen = imageToScreen(imagePoint);
  let closest = null;
  let closestDistance = Infinity;
  const tolerance = isCoarsePointer() ? 34 : 16;

  for (const segment of state.segments) {
    for (const endpoint of ["start", "end"]) {
      const endpointScreen = imageToScreen(segment[endpoint]);
      const distance = Math.hypot(screen.x - endpointScreen.x, screen.y - endpointScreen.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = {
          point: clonePoint(segment[endpoint]),
          screen: endpointScreen,
          segmentId: segment.id,
          endpoint,
        };
      }
    }
  }

  return closestDistance <= tolerance ? closest : null;
}

function resolveStartPoint(point) {
  const snap = findStartEndpointSnap(point);
  return snap ? { point: clonePoint(snap.point), snap } : { point, snap: null };
}

function findOrthogonalSnapPoint(point, anchor, axis, segmentId) {
  if (!state.smartGridEnabled || !axis || !anchor) return null;

  const screen = imageToScreen(point);
  const snapTolerance = 15;
  const lineTolerance = 7;
  let closest = null;
  let closestDistance = Infinity;

  for (const segment of state.segments) {
    if (segment.id === segmentId) continue;

    for (const endpointName of ["start", "end"]) {
      const candidate = segment[endpointName];
      const candidateScreen = imageToScreen(candidate);
      const projected = axis === "horizontal"
        ? { x: candidate.x, y: anchor.y }
        : { x: anchor.x, y: candidate.y };
      const projectedScreen = imageToScreen(projected);
      const distance = axis === "horizontal"
        ? Math.abs(screen.x - projectedScreen.x)
        : Math.abs(screen.y - projectedScreen.y);
      const lineDistance = axis === "horizontal"
        ? Math.abs(candidateScreen.y - imageToScreen(anchor).y)
        : Math.abs(candidateScreen.x - imageToScreen(anchor).x);

      if (distance < closestDistance && distance <= snapTolerance) {
        closestDistance = distance;
        closest = {
          point: projected,
          screen: projectedScreen,
          guide: {
            from: { ...candidate },
            to: projected,
            axis: axis === "horizontal" ? "vertical" : "horizontal",
            exactEndpoint: lineDistance <= lineTolerance,
          },
        };
      }
    }
  }

  return closest;
}

function resolveEndpointPoint(rawPoint, fixedEndpoint, segmentId, options = {}) {
  const resolved = resolvePointWithSnaps({
    rawPoint,
    fixedEndpoint,
    segmentId,
    segments: state.segments,
    scale: state.scale,
    smartGridEnabled: state.smartGridEnabled,
    ...options,
  });

  if (resolved.snap?.point && !resolved.snap.screen) {
    resolved.snap.screen = imageToScreen(resolved.snap.point);
  }

  return resolved;
}

function polygonSnapOptions() {
  const coarseMultiplier = isCoarsePointer() ? 1.45 : 1;
  return {
    ...POLYGON_SNAP_OPTIONS,
    axisFieldRadiusPx: POLYGON_SNAP_OPTIONS.axisFieldRadiusPx * coarseMultiplier,
    axisTolerancePx: POLYGON_SNAP_OPTIONS.axisTolerancePx * coarseMultiplier,
    endpointTolerancePx: POLYGON_SNAP_OPTIONS.endpointTolerancePx * coarseMultiplier,
    strongEndpointTolerancePx: POLYGON_SNAP_OPTIONS.strongEndpointTolerancePx * coarseMultiplier,
    extraPoints: state.polygonPoints,
  };
}

function resolvePolygonPoint(rawPoint) {
  const closePoint = polygonCloseSnapFor(rawPoint);
  if (closePoint) {
    return {
      point: closePoint,
      snap: { point: closePoint, screen: imageToScreen(closePoint) },
      guide: null,
      alignmentGuide: null,
      close: true,
    };
  }

  const anchor = state.polygonPoints.at(-1);
  if (!anchor) {
    const resolvedStart = resolveStartPoint(rawPoint);
    return {
      point: resolvedStart.point,
      snap: resolvedStart.snap,
      guide: null,
      alignmentGuide: null,
      close: false,
    };
  }

  return {
    ...resolveEndpointPoint(rawPoint, anchor, null, polygonSnapOptions()),
    close: false,
  };
}

function smartGridPoint(point, anchor) {
  if (!state.smartGridEnabled || !anchor) {
    return { point, snapped: false, axis: null };
  }

  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const dominant = Math.max(absDx, absDy);
  const pixelTolerance = 10 / Math.max(state.scale, 0.001);

  if (dominant < pixelTolerance) {
    return { point, snapped: false, axis: null };
  }

  if (absDx >= absDy) {
    return { point: { x: point.x, y: anchor.y }, snapped: true, axis: "horizontal" };
  }

  return { point: { x: anchor.x, y: point.y }, snapped: true, axis: "vertical" };
}

function buildOrthogonalGuide(anchor, point, axis) {
  if (!axis) return null;
  return {
    axis,
    anchor: clonePoint(anchor),
    point: clonePoint(point),
  };
}

function sharedEndpoint(a, b, tolerance = 4) {
  const endpointsA = [a.start, a.end];
  const endpointsB = [b.start, b.end];
  const threshold = tolerance / Math.max(state.scale, 0.001);

  for (const pointA of endpointsA) {
    for (const pointB of endpointsB) {
      if (Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y) <= threshold) {
        return {
          x: (pointA.x + pointB.x) / 2,
          y: (pointA.y + pointB.y) / 2,
        };
      }
    }
  }

  return null;
}

function vectorAwayFromJoint(segment, joint) {
  const distanceToStart = Math.hypot(segment.start.x - joint.x, segment.start.y - joint.y);
  const distanceToEnd = Math.hypot(segment.end.x - joint.x, segment.end.y - joint.y);
  const far = distanceToStart > distanceToEnd ? segment.start : segment.end;
  return {
    x: far.x - joint.x,
    y: far.y - joint.y,
  };
}

function isRightAngle(vectorA, vectorB) {
  const lengthA = Math.hypot(vectorA.x, vectorA.y);
  const lengthB = Math.hypot(vectorB.x, vectorB.y);
  if (!lengthA || !lengthB) return false;
  const cosine = Math.abs((vectorA.x * vectorB.x + vectorA.y * vectorB.y) / (lengthA * lengthB));
  return cosine < 0.08;
}

function computeRightAngleHints() {
  const hints = [];
  const ids = new Set();

  for (let i = 0; i < state.segments.length; i++) {
    for (let j = i + 1; j < state.segments.length; j++) {
      const first = state.segments[i];
      const second = state.segments[j];
      const joint = sharedEndpoint(first, second);
      if (!joint) continue;

      const vectorA = vectorAwayFromJoint(first, joint);
      const vectorB = vectorAwayFromJoint(second, joint);
      if (!isRightAngle(vectorA, vectorB)) continue;

      ids.add(first.id);
      ids.add(second.id);
      hints.push({ joint, vectorA, vectorB, ids: [first.id, second.id] });
    }
  }

  return { hints, ids };
}

function isSegmentSelected(segment) {
  return state.selectedSegmentIds.has(segment.id);
}

function isPolygonSelected(polygon) {
  return state.selectedPolygonIds.has(polygon.id);
}

function isCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function selectOnlySegment(id) {
  state.selectedSegmentIds = id === null ? new Set() : new Set([id]);
  state.selectedPolygonIds = new Set();
}

function selectSegments(ids) {
  state.selectedSegmentIds = new Set(ids);
}

function selectPolygons(ids) {
  state.selectedPolygonIds = new Set(ids);
}

function selectOnlyPolygon(id) {
  state.selectedSegmentIds = new Set();
  state.selectedPolygonIds = id === null ? new Set() : new Set([id]);
}

function toggleSegmentSelection(id) {
  const selected = new Set(state.selectedSegmentIds);
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }
  state.selectedSegmentIds = selected;
  state.selectedPolygonIds = new Set();
}

function clearSelection() {
  state.selectedSegmentIds = new Set();
  state.selectedPolygonIds = new Set();
}

function adjustedEndpointDragPoint(event) {
  if (event.pointerType !== "touch") {
    return { x: event.clientX, y: event.clientY };
  }
  return {
    x: event.clientX,
    y: event.clientY - TOUCH_ENDPOINT_DRAG_OFFSET,
  };
}

function startChoosingBase() {
  if (!state.segments.length) {
    showToast("Сначала добавьте или примите отрезки");
    return;
  }
  state.isChoosingBase = true;
  state.isEditingReferenceLength = Boolean(state.referenceId);
  state.isDrawingArea = false;
  cancelPendingPolygon();
  state.pendingReferenceId = null;
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  if (state.referenceId) {
    selectOnlySegment(state.referenceId);
  } else {
    clearSelection();
  }
  updateAll();
  showToast(state.referenceId ? "Выберите новый отрезок или измените длину" : "Кликните по базовому отрезку");
  if (state.referenceId) {
    window.setTimeout(() => {
      inlineReferenceLengthInput?.focus();
      inlineReferenceLengthInput?.select();
    }, 40);
  }
}

function cancelPendingLine() {
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  state.snapPoint = null;
}

function cancelPendingPolygon() {
  state.polygonPoints = [];
  state.polygonPreviewPoint = null;
  state.polygonCloseTarget = null;
}

function setToolMode(mode) {
  cancelPendingLine();
  cancelPendingPolygon();
  state.isDrawingSegments = mode === "line";
  state.isDrawingArea = mode === "area";
  if (state.isDrawingSegments || state.isDrawingArea) {
    state.nextActionPromptVisible = false;
    state.workflowMode = "manual";
    state.detectedSegments = [];
    clearSelection();
  }
  updateAll();
  saveSnapshotToStorage();
}

function setReferenceSegment(id, { focusLength = true } = {}) {
  const previousReferenceId = state.referenceId;
  const changedReference = previousReferenceId !== id;
  state.referenceId = id;
  state.referencePixelLength = getReferenceLengthFromSegments(id) || state.referencePixelLength;
  state.isChoosingBase = false;
  state.isEditingReferenceLength = true;
  if (changedReference) {
    setReferenceValue("");
  } else if (inlineReferenceLengthInput) {
    inlineReferenceLengthInput.value = state.referenceValue;
  }
  state.pendingReferenceId = null;
  selectOnlySegment(id);
  state.pendingPoint = null;
  hideBaseConfirmation();
  updateAll();
  commitHistory();
  if (focusLength) {
    window.setTimeout(() => {
      const target = inlineReferenceLengthInput || referenceLengthInput;
      target?.focus();
      target?.select();
    }, 40);
  }
}

function hideBaseConfirmation() {
  state.pendingReferenceId = null;
  if (baseConfirm) {
    baseConfirm.hidden = true;
  }
}

function requestReferenceConfirmation(id) {
  const segment = state.segments.find((item) => item.id === id);
  if (!segment || !baseConfirm) return false;

  state.pendingReferenceId = id;
  selectOnlySegment(id);
  baseConfirmText.textContent = `${segment.name}: подтвердите выбор базового отрезка.`;
  baseConfirm.hidden = false;
  updateAll();
  return true;
}

function handleSegmentPick(id, { requireConfirmation = false } = {}) {
  if (state.isChoosingBase || !getReferenceLength()) {
    if (requireConfirmation && requestReferenceConfirmation(id)) {
      showToast("Подтвердите базовый отрезок");
      return true;
    }
    setReferenceSegment(id, { focusLength: !isCoarsePointer() });
    showToast("Теперь введите базовый размер");
    return true;
  }
  return false;
}

function confirmPendingReference() {
  const id = state.pendingReferenceId;
  if (!id) return;
  setReferenceSegment(id, { focusLength: !isCoarsePointer() });
  showToast("Теперь введите базовый размер");
}

function getSelectedIds() {
  return [...state.selectedSegmentIds];
}

function getSelectedPolygonIds() {
  return [...state.selectedPolygonIds];
}

function segmentIntersectsRect(segment, rect) {
  const start = imageToScreen(segment.start);
  const end = imageToScreen(segment.end);
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  if (pointInsideRect(start, rect) || pointInsideRect(end, rect) || pointInsideRect(midpoint, rect)) {
    return true;
  }

  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomRight = { x: rect.right, y: rect.bottom };
  const bottomLeft = { x: rect.left, y: rect.bottom };

  return (
    lineSegmentsIntersect(start, end, topLeft, topRight) ||
    lineSegmentsIntersect(start, end, topRight, bottomRight) ||
    lineSegmentsIntersect(start, end, bottomRight, bottomLeft) ||
    lineSegmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

function segmentIdsInsideSelectionBox() {
  if (!state.selectionBox) return [];
  const rect = normalizedRect(state.selectionBox.start, state.selectionBox.end);
  return state.segments
    .filter((segment) => segmentIntersectsRect(segment, rect))
    .map((segment) => segment.id);
}

function pointInsidePolygon(point, points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const current = points[i];
    const previous = points[j];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && (point.x < (previous.x - current.x) * (point.y - current.y) / ((previous.y - current.y) || 0.000001) + current.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonIntersectsRect(polygon, rect) {
  const points = polygon.points.map(imageToScreen);
  if (points.some((point) => pointInsideRect(point, rect))) return true;

  const center = {
    x: (rect.left + rect.right) / 2,
    y: (rect.top + rect.bottom) / 2,
  };
  if (pointInsidePolygon(center, points)) return true;

  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomRight = { x: rect.right, y: rect.bottom };
  const bottomLeft = { x: rect.left, y: rect.bottom };
  const rectEdges = [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ];

  for (let index = 0; index < points.length; index++) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (rectEdges.some(([edgeStart, edgeEnd]) => lineSegmentsIntersect(start, end, edgeStart, edgeEnd))) {
      return true;
    }
  }

  return false;
}

function polygonIdsInsideSelectionBox() {
  if (!state.selectionBox) return [];
  const rect = normalizedRect(state.selectionBox.start, state.selectionBox.end);
  return state.polygons
    .filter((polygon) => polygonIntersectsRect(polygon, rect))
    .map((polygon) => polygon.id);
}

function getReferenceLengthFromSegments(referenceId) {
  const reference = state.segments.find((segment) => segment.id === referenceId);
  return reference ? segmentLength(reference) : 0;
}

function getReferenceLength() {
  const referenceLength = getReferenceLengthFromSegments(state.referenceId);
  if (referenceLength) return referenceLength;
  return typeof state.referencePixelLength === "number" && state.referencePixelLength > 0
    ? state.referencePixelLength
    : 0;
}

function ratioFor(segment) {
  const referenceLength = getReferenceLength();
  if (!referenceLength) return null;
  return segmentLength(segment) / referenceLength;
}

function calculatedLengthMetersFor(segment) {
  return segmentLengthMeters(segment, getReferenceLength(), currentReferenceValueMeters(), segmentLength);
}

function calculatedLengthFor(segment) {
  return segmentLengthDisplay(segment, getReferenceLength(), currentReferenceValueMeters(), state.unit, segmentLength);
}

function cloneDetectedSegment(segment) {
  return {
    start: clonePoint(segment.start),
    end: clonePoint(segment.end),
  };
}

function clearDetectedSegments() {
  state.detectedSegments = [];
  cancelAnalysis();
  updateAll();
}

function materializeDetectedSegments(append = false) {
  if (!state.detectedSegments.length) return;

  const detected = state.detectedSegments.map(cloneDetectedSegment);
  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  const referenceValue = state.referenceValue;
  const referencePixelLength = getReferenceLength();
  if (!append) {
    state.segments = reference ? [cloneSegment(reference)] : [];
    state.referenceId = reference ? reference.id : null;
    state.referencePixelLength = reference
      ? segmentLength(reference)
      : (referencePixelLength || state.referencePixelLength);
    setReferenceValue(reference || state.referencePixelLength ? referenceValue : "");
    nextSegmentId = Math.max(1, ...state.segments.map((segment) => segment.id + 1), 1);
    clearSelection();
  }

  const created = detected.map((segment) => {
    const id = nextSegmentId++;
    return {
      id,
      name: `Отрезок ${id}`,
      start: segment.start,
      end: segment.end,
      labelHidden: !state.footnotesVisible,
    };
  });

  state.segments.push(...created);
  if (!getReferenceLength()) {
    state.isChoosingBase = true;
    clearSelection();
  } else if (state.referenceId) {
    selectOnlySegment(state.referenceId);
  } else {
    clearSelection();
  }
  state.detectedSegments = [];
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  updateAll();
  commitHistory();
  showToast(append ? `Добавлено: ${created.length}` : `Принято: ${created.length}`);
  if (created.length && state.isChoosingBase) {
    showToast("Выберите базовый отрезок");
  }
}

function detectImageSegmentsFromImage(sensitivity = state.detectionSensitivity) {
  const maxSide = 1400;
  const processScale = Math.min(1, maxSide / Math.max(state.image.width, state.image.height));
  const width = Math.max(1, Math.round(state.image.width * processScale));
  const height = Math.max(1, Math.round(state.image.height * processScale));
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
  offscreenContext.drawImage(state.image, 0, 0, width, height);
  const { data } = offscreenContext.getImageData(0, 0, width, height);
  return analyzeImageData({
    data,
    width,
    height,
    processScale,
    sensitivity,
    maxSegments: MAX_AUTO_SEGMENTS,
  });
}

function detectImageSegmentsWithWorker(sensitivity = state.detectionSensitivity) {
  return new Promise((resolve, reject) => {
    const maxSide = 1400;
    const processScale = Math.min(1, maxSide / Math.max(state.image.width, state.image.height));
    const width = Math.max(1, Math.round(state.image.width * processScale));
    const height = Math.max(1, Math.round(state.image.height * processScale));
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
    offscreenContext.drawImage(state.image, 0, 0, width, height);
    const imageData = offscreenContext.getImageData(0, 0, width, height);
    const worker = new Worker("detection-worker.js");

    function cleanup() {
      worker.terminate();
    }

    worker.addEventListener("message", (event) => {
      if (event.data?.type === "result") {
        cleanup();
        resolve(event.data.segments || []);
      }
    });
    worker.addEventListener("error", (event) => {
      cleanup();
      reject(event.error || new Error(event.message));
    });
    worker.postMessage({
      type: "analyze",
      width,
      height,
      processScale,
      maxSegments: MAX_AUTO_SEGMENTS,
      sensitivity,
      buffer: imageData.data.buffer,
    }, [imageData.data.buffer]);
  });
}

function analyzeImageSegments({ automatic = false, sensitivity = state.detectionSensitivity } = {}) {
  if (!state.image) {
    showToast("Сначала загрузите изображение");
    return;
  }

  state.detectionSensitivity = normalizeDetectionSensitivity(sensitivity);
  updateDetectionSensitivityControls();
  const runId = ++analysisRunId;
  state.isAnalyzing = true;
  state.detectedSegments = [];
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.isDrawingSegments = false;
  updateAll();

  window.setTimeout(async () => {
    if (runId !== analysisRunId || !state.image) {
      return;
    }

    let foundSegments = [];
    let analysisFailed = false;
    const canUseWorker = typeof Worker !== "undefined" && window.location.protocol !== "file:";
    try {
      foundSegments = canUseWorker
        ? await detectImageSegmentsWithWorker(sensitivity)
        : detectImageSegmentsFromImage(sensitivity);
    } catch {
      if (canUseWorker) {
        try {
          foundSegments = detectImageSegmentsFromImage(sensitivity);
        } catch {
          analysisFailed = true;
        }
      } else {
        analysisFailed = true;
      }
    }

    if (runId !== analysisRunId || !state.image) {
      return;
    }

    state.isAnalyzing = false;
    if (analysisFailed) {
      updateAll();
      showToast("Не удалось выполнить анализ");
      return;
    }

    if (!foundSegments.length) {
      updateAll();
      if (!automatic) {
        showToast("Автоотрезки не найдены");
      }
      return;
    }

    state.detectedSegments = foundSegments.map(cloneDetectedSegment);
    state.pendingPoint = null;
    state.previewPoint = null;
    state.orthogonalGuide = null;
    state.isDrawingSegments = false;
    updateAll();
    showToast(`Найдено: ${state.detectedSegments.length}`);
  }, automatic ? 220 : 60);
}

function cancelAnalysis() {
  if (!state.isAnalyzing) {
    return;
  }
  analysisRunId++;
  state.isAnalyzing = false;
  updateAll();
}

function formatLength(value, includeUnit = true) {
  const formatted = formatMeasurementValue(value);
  if (formatted === "—" || !includeUnit || !state.unit.trim()) return formatted;
  return `${formatted} ${state.unit.trim()}`;
}

function formatMeasurementValue(value) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  const precision = normalizePrecision(state.measurementPrecision);
  return Number(value).toFixed(precision).replace(".", ",");
}

function formatScaleRulerLength(value, unit) {
  if (value === null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value);
  const formatted = Math.abs(value - rounded) < 0.001
    ? String(rounded)
    : value.toFixed(value < 10 ? 1 : 0).replace(".", ",");
  return `${formatted} ${unit || "ед."}`;
}

function areaUnitLabel() {
  const unit = state.unit.trim() || "ед.";
  return `${unit}²`;
}

function polygonAreaPx(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

function polygonCentroid(polygon) {
  const points = polygon.points || polygon;
  if (!points.length) return { x: 0, y: 0 };
  let areaTwice = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    areaTwice += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }
  if (Math.abs(areaTwice) < 0.001) {
    return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  }
  return {
    x: x / (3 * areaTwice),
    y: y / (3 * areaTwice),
  };
}

function polygonAreaFor(polygon) {
  return polygonAreaDisplay(polygon.points, getReferenceLength(), currentReferenceValueMeters(), state.unit, polygonAreaPx);
}

function polygonAreaSquareMetersFor(polygon) {
  return polygonAreaSquareMeters(polygon.points, getReferenceLength(), currentReferenceValueMeters(), polygonAreaPx);
}

function isPolygonFootnoteVisible(polygon) {
  return polygon.labelHidden !== true;
}

function areaLabelTextFor(polygon) {
  const area = polygonAreaFor(polygon);
  if (area === null) return polygon.name;
  const value = formatMeasurementValue(area);
  return state.showUnitsInFootnotes ? `${value} ${areaUnitLabel()}` : value;
}

function isSegmentFootnoteVisible(segment) {
  return segment.labelHidden !== true;
}

function visibleFootnoteCount() {
  return state.segments.filter(isSegmentFootnoteVisible).length
    + state.polygons.filter(isPolygonFootnoteVisible).length;
}

function updateAllFootnotesButtonState() {
  if (!toggleAllFootnotesButton) return;

  const hasObjects = state.segments.length > 0 || state.polygons.length > 0;
  const hasVisible = hasObjects ? visibleFootnoteCount() > 0 : state.footnotesVisible;
  toggleAllFootnotesButton.disabled = !hasObjects;
  toggleAllFootnotesButton.classList.toggle("active", hasVisible);
  toggleAllFootnotesButton.setAttribute("aria-pressed", String(hasVisible));
  toggleAllFootnotesButton.title = hasVisible
    ? "Скрыть сноски всех измерений"
    : "Показать сноски всех измерений";
  toggleAllFootnotesButton.setAttribute("aria-label", toggleAllFootnotesButton.title);
}

function setSegmentFootnoteVisible(id, visible) {
  const segment = state.segments.find((item) => item.id === id);
  if (!segment) return;

  segment.labelHidden = !visible;
  state.footnotesVisible = visibleFootnoteCount() > 0;
  updateAll();
  commitHistory();
}

function toggleAllFootnotes() {
  if (!state.segments.length && !state.polygons.length) return;

  const shouldShow = visibleFootnoteCount() === 0;
  state.footnotesVisible = shouldShow;
  for (const segment of state.segments) {
    segment.labelHidden = !shouldShow;
  }
  for (const polygon of state.polygons) {
    polygon.labelHidden = !shouldShow;
  }
  updateAll();
  commitHistory();
}

function labelTextFor(segment) {
  const calculatedLength = calculatedLengthFor(segment);
  if (calculatedLength === null && state.segments.length) {
    return segment.name;
  }
  return formatLength(calculatedLength, state.showUnitsInFootnotes);
}

function getLabelOffset(segment, labelWidth, labelHeight) {
  if (segment.labelOffset) {
    return segment.labelOffset;
  }

  const candidates = [
    { x: 0, y: -36 },
    { x: 0, y: 36 },
    { x: 48, y: -36 },
    { x: -48, y: -36 },
    { x: 48, y: 36 },
    { x: -48, y: 36 },
    { x: 0, y: -66 },
    { x: 0, y: 66 },
    { x: 90, y: 0 },
    { x: -90, y: 0 },
  ];
  const mid = segmentMidpointScreen(segment);

  for (const offset of candidates) {
    const rect = {
      left: mid.x + offset.x - labelWidth / 2,
      top: mid.y + offset.y - labelHeight / 2,
      right: mid.x + offset.x + labelWidth / 2,
      bottom: mid.y + offset.y + labelHeight / 2,
    };

    if (![...state.labelBounds.values()].some((existing) => rectsIntersect(rect, existing, 5))) {
      return offset;
    }
  }

  return candidates[0];
}

function currentLabelOffset(segment) {
  if (segment.labelOffset) {
    return { ...segment.labelOffset };
  }

  const bounds = state.labelBounds.get(segment.id);
  if (!bounds) {
    return { x: 0, y: -36 };
  }

  const midpoint = segmentMidpointScreen(segment);
  return {
    x: (bounds.left + bounds.right) / 2 - midpoint.x,
    y: (bounds.top + bounds.bottom) / 2 - midpoint.y,
  };
}

function segmentMidpointScreen(segment) {
  const start = imageToScreen(segment.start);
  const end = imageToScreen(segment.end);
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function nearestPointOnRect(point, rect) {
  return {
    x: Math.min(Math.max(point.x, rect.left), rect.right),
    y: Math.min(Math.max(point.y, rect.top), rect.bottom),
  };
}

function draw() {
  canvasRenderer.draw();
}

function setHelpOpen(open) {
  if (!helpPopover || !helpButton) return;
  helpPopover.hidden = !open;
  helpButton.setAttribute("aria-expanded", String(open));
}

function toggleHelp() {
  setHelpOpen(helpPopover?.hidden !== false);
}

function setSettingsOpen(open) {
  if (!settingsMenu || !settingsButton) return;
  settingsMenu.hidden = !open;
  settingsButton.setAttribute("aria-expanded", String(open));
}

function toggleSettings() {
  setSettingsOpen(settingsMenu?.hidden !== false);
}

function hideSegmentContextMenu() {
  segmentContextMenu.hidden = true;
  activeContextSegmentId = null;
}

function showSegmentContextMenu(segment, clientX, clientY) {
  activeContextSegmentId = segment.id;
  selectOnlySegment(segment.id);
  updateAll();
  segmentContextMenu.hidden = false;
  const menuRect = segmentContextMenu.getBoundingClientRect();
  const left = Math.min(clientX, window.innerWidth - menuRect.width - 10);
  const top = Math.min(clientY, window.innerHeight - menuRect.height - 10);
  segmentContextMenu.style.left = `${Math.max(10, left)}px`;
  segmentContextMenu.style.top = `${Math.max(10, top)}px`;
}

async function renameSegmentWithPrompt(segment) {
  const nextName = await requestDialog({
    title: "Название отрезка",
    message: "Введите понятное имя для выбранного измерения.",
    inputValue: segment.name,
    confirmText: "Сохранить",
  });
  if (nextName === null) return;
  segment.name = nextName.trim() || `Отрезок ${segment.id}`;
  updateAll();
  commitHistory();
}

function dismissWelcome() {
  welcomeOverlay.hidden = true;
  updateToolControls();
  syncCanvasAfterLayout({ fit: Boolean(state.image) });
  if (state.image) {
    canvas.focus();
  } else {
    emptyUploadButton.focus();
  }
  try {
    sessionStorage.setItem("planscale-welcome-seen", "1");
  } catch {
    // Session storage is only a convenience; the app works without it.
  }
}

function initWelcome() {
  try {
    if (sessionStorage.getItem("planscale-welcome-seen")) {
      welcomeOverlay.hidden = true;
    }
  } catch {
    welcomeOverlay.hidden = false;
  }
}

function sortedSegmentsForPanel() {
  const sortMode = segmentsSortSelect?.value || "created";
  const segments = [...state.segments];
  if (sortMode === "length-desc") {
    segments.sort((a, b) => segmentLength(b) - segmentLength(a));
  } else if (sortMode === "name") {
    segments.sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true }));
  } else {
    segments.sort((a, b) => a.id - b.id);
  }
  return segments;
}

function renderPanelSummary() {
  if (!panelSummary) return;

  const count = state.segments.length + state.polygons.length;
  const base = hasCompleteBaseLength() ? "масштаб задан" : "масштаб не задан";
  const unit = state.unit.trim() || "без единицы";
  panelSummary.textContent = `${count} ${plural(count, "измерение", "измерения", "измерений")} · ${base} · ${unit}`;
}

function renderBaseSummary() {
  renderPanelSummary();

  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  if (!reference) {
    const realValue = parseDecimal(state.referenceValue);
    if (state.referencePixelLength && realValue !== null) {
      baseSegmentName.textContent = "Масштаб задан";
      baseSegmentMeta.textContent = `${formatLength(realValue)} · ${formatMeasurementValue(state.referencePixelLength)} px на изображении`;
      baseSegmentName.classList.remove("pending");
      return;
    }
    baseSegmentName.textContent = "Не выбран";
    baseSegmentMeta.textContent = state.segments.length
      ? "Выберите известный отрезок на изображении или в списке."
      : "Проведите отрезок по известному размеру на изображении.";
    baseSegmentName.classList.toggle("pending", state.segments.length > 0);
    return;
  }

  const realValue = parseDecimal(state.referenceValue);
  baseSegmentName.textContent = reference.name;
  baseSegmentName.classList.remove("pending");
  baseSegmentMeta.textContent = realValue === null
    ? `${formatMeasurementValue(segmentLength(reference))} px · введите реальную длину`
    : `${formatLength(realValue)} · ${formatMeasurementValue(segmentLength(reference))} px на изображении`;
}

function renderSegments() {
  renderSegmentsPanel({
    segmentsList,
    noSegments,
    segments: sortedSegmentsForPanel(),
    isSegmentSelected,
    handleSegmentPick,
    toggleSegmentSelection,
    selectOnlySegment,
    updateAll,
    renderOutput,
    updateStatus,
    draw,
    commitHistory,
    calculatedLengthFor,
    formatLength,
    formatDecimal,
    segmentLength,
    segmentAngle,
    referenceId: state.referenceId,
    isSegmentFootnoteVisible,
    setSegmentFootnoteVisible,
    setReferenceSegment,
    deleteSegment,
  });
}

function segmentsSummaryText() {
  if (!state.segments.length && !state.polygons.length) return "";

  const lengthHeader = state.unit.trim()
    ? `Расчетная длина (${state.unit.trim()})`
    : "Расчетная длина";
  const areaHeader = state.unit.trim()
    ? `Площадь (${areaUnitLabel()})`
    : "Площадь";
  const lines = [`Тип;Название;${lengthHeader};${areaHeader}`];
  for (const segment of state.segments) {
    const length = formatLength(calculatedLengthFor(segment), false);
    lines.push(`Отрезок;${segment.name};${length};`);
  }
  for (const polygon of state.polygons) {
    const area = polygonAreaFor(polygon);
    lines.push(`Площадь;${polygon.name};;${formatMeasurementValue(area)}`);
  }
  return lines.join("\n");
}

function renderOutput() {
  // Kept as a panel callback until segments-panel no longer needs the legacy hook.
}

function updateStatus() {
  if (!state.image) {
    statusText.textContent = "Загрузите изображение";
    return;
  }

  if (state.isAnalyzing) {
    statusText.textContent = "Анализ линий...";
    return;
  }

  if (state.pendingPoint) {
    statusText.textContent = "Выберите вторую точку отрезка";
    return;
  }

  if (state.isDrawingArea && state.polygonPoints.length) {
    statusText.textContent = "Продолжайте контур или нажмите «Готово»";
    return;
  }

  const count = state.segments.length;
  const detectedState = state.detectedSegments.length ? ` · предпросмотр ${state.detectedSegments.length}` : "";
  const underlayState = state.backgroundVisible ? "" : " · подложка скрыта";
  const drawingState = state.isDrawingSegments ? " · добавление отрезков" : "";
  const areaState = state.isDrawingArea ? " · измерение площади" : "";
  const choosingState = state.nextActionPromptVisible ? " · выберите режим" : "";
  const baseState = !getReferenceLength() && !state.nextActionPromptVisible
    ? " · задайте масштаб"
    : getReferenceLength() && parseDecimal(state.referenceValue) === null
      ? " · введите базовый размер"
      : "";
  statusText.textContent = `Изображение готово${detectedState}${choosingState}${baseState}${underlayState}${drawingState}${areaState}`;
}

function plural(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function updateAll() {
  updateToolControls();
  renderBaseSummary();
  renderSegments();
  renderOutput();
  updateStatus();
  updateGuidanceControls();
  updateHistoryButtons();
  if (window.matchMedia("(max-width: 760px)").matches) {
    resizeCanvas();
  } else {
    draw();
  }
}

function addPoint(point) {
  if (!state.pendingPoint) {
    state.pendingPoint = point;
    state.previewPoint = null;
    state.orthogonalGuide = null;
    state.alignmentGuide = null;
    clearSelection();
    updateAll();
    return;
  }

  const start = state.pendingPoint;
  const resolved = resolveEndpointPoint(point, start, null);
  const end = resolved.point;
  const id = nextSegmentId++;
  const segment = {
    id,
    name: `Отрезок ${id}`,
    start,
    end,
    labelHidden: !state.footnotesVisible,
  };

  state.segments.push(segment);
  if (!getReferenceLength()) {
    state.referenceId = id;
    state.referencePixelLength = segmentLength(segment);
    setReferenceValue("");
    state.isChoosingBase = false;
    state.isDrawingSegments = false;
  }
  state.pendingPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  selectOnlySegment(id);
  updateAll();
  commitHistory();
  if (state.referenceId === id && parseDecimal(state.referenceValue) === null) {
    window.setTimeout(() => {
      inlineReferenceLengthInput?.focus();
      inlineReferenceLengthInput?.select();
    }, 40);
  }
}

function polygonCloseSnapFor(point) {
  if (state.polygonPoints.length < 3) return null;
  const first = state.polygonPoints[0];
  const firstScreen = imageToScreen(first);
  const pointScreen = imageToScreen(point);
  const tolerance = isCoarsePointer() ? 34 : 18;
  return Math.hypot(firstScreen.x - pointScreen.x, firstScreen.y - pointScreen.y) <= tolerance
    ? clonePoint(first)
    : null;
}

function addPolygonPoint(point) {
  const closePoint = polygonCloseSnapFor(point);
  if (closePoint) {
    finishPolygon();
    return;
  }

  state.polygonPoints.push(clonePoint(point));
  state.polygonPreviewPoint = null;
  state.polygonCloseTarget = null;
  clearSelection();
  updateAll();
}

function finishPolygon() {
  if (state.polygonPoints.length < 3) {
    showToast("Поставьте минимум три точки");
    return;
  }

  const id = nextPolygonId++;
  state.polygons.push({
    id,
    name: `Площадь ${id}`,
    points: state.polygonPoints.map(clonePoint),
    labelHidden: !state.footnotesVisible,
  });
  state.isDrawingArea = false;
  cancelPendingPolygon();
  clearSelection();
  updateAll();
  commitHistory();
  showToast("Площадь добавлена");
}

function deleteSegment(id) {
  deleteSegments([id]);
}

function deleteSegments(ids) {
  const idsToDelete = new Set(ids);
  if (!idsToDelete.size) return;

  const deletedReferenceLength = idsToDelete.has(state.referenceId)
    ? getReferenceLengthFromSegments(state.referenceId)
    : 0;
  state.segments = state.segments.filter((segment) => !idsToDelete.has(segment.id));
  if (state.segments.length || state.polygons.length) {
    state.footnotesVisible = visibleFootnoteCount() > 0;
  }
  if (idsToDelete.has(state.referenceId)) {
    state.referencePixelLength = deletedReferenceLength || state.referencePixelLength;
    state.referenceId = null;
    state.isEditingReferenceLength = false;
    state.isChoosingBase = false;
  }
  if (idsToDelete.has(state.pendingReferenceId)) {
    hideBaseConfirmation();
  }
  selectSegments(getSelectedIds().filter((id) => !idsToDelete.has(id)));
  updateAll();
  commitHistory();
}

function deleteSelectedObjects() {
  const segmentIds = getSelectedIds();
  const polygonIds = getSelectedPolygonIds();
  if (!segmentIds.length && !polygonIds.length) {
    showToast("Выберите объект для удаления");
    return;
  }

  const deletedReferenceLength = segmentIds.includes(state.referenceId)
    ? getReferenceLengthFromSegments(state.referenceId)
    : 0;
  const segmentIdSet = new Set(segmentIds);
  const polygonIdSet = new Set(polygonIds);

  state.segments = state.segments.filter((segment) => !segmentIdSet.has(segment.id));
  state.polygons = state.polygons.filter((polygon) => !polygonIdSet.has(polygon.id));
  if (segmentIdSet.has(state.referenceId)) {
    state.referencePixelLength = deletedReferenceLength || state.referencePixelLength;
    state.referenceId = null;
    state.isEditingReferenceLength = false;
    state.isChoosingBase = false;
  }
  if (segmentIdSet.has(state.pendingReferenceId)) {
    hideBaseConfirmation();
  }
  clearSelection();
  if (state.segments.length || state.polygons.length) {
    state.footnotesVisible = visibleFootnoteCount() > 0;
  }
  updateAll();
  commitHistory();
  const count = segmentIds.length + polygonIds.length;
  showToast(count === 1 ? "Объект удалён" : `Удалено: ${count}`);
}

async function resetPlan() {
  if (!state.image && !state.segments.length && !state.polygons.length && !state.detectedSegments.length) return;
  const confirmed = await confirmAction("Удалить изображение, все измерения и настройки?", {
    title: "Сбросить проект",
    confirmText: "Сбросить",
    danger: true,
  });
  if (!confirmed) return;

  analysisRunId++;
  const rememberedUnit = state.unit || "м";
  const rememberedUnitSystem = state.unitSystem || unitSystemForUnit(rememberedUnit);
  const rememberedPrecision = state.measurementPrecision;
  const rememberedFootnoteSize = state.footnoteSize;
  const rememberedShowUnits = state.showUnitsInFootnotes;
  state.image = null;
  state.imageSrc = "";
  state.imageName = "";
  state.backgroundVisible = true;
  state.backgroundOpacity = 1;
  state.previousBackgroundOpacity = 1;
  state.scale = 1;
  state.homeScale = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  state.segments = [];
  state.polygons = [];
  state.detectedSegments = [];
  state.referenceId = null;
  state.referencePixelLength = null;
  state.selectedSegmentIds = new Set();
  state.selectedPolygonIds = new Set();
  setReferenceValue("");
  state.isEditingReferenceLength = false;
  state.unit = rememberedUnit;
  state.unitSystem = rememberedUnitSystem;
  state.footnotesVisible = true;
  state.measurementPrecision = rememberedPrecision;
  state.footnoteSize = rememberedFootnoteSize;
  state.showUnitsInFootnotes = rememberedShowUnits;
  state.pendingPoint = null;
  state.polygonPoints = [];
  state.polygonPreviewPoint = null;
  state.polygonCloseTarget = null;
  state.isDragging = false;
  state.dragStart = null;
  state.didDrag = false;
  state.interactionMode = null;
  state.selectionBox = null;
  state.labelBounds = new Map();
  state.snapPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  state.rightAngleHints = [];
  state.rightAngleIds = new Set();
  state.isDrawingSegments = false;
  state.isDrawingArea = false;
  state.isChoosingBase = false;
  state.nextActionPromptVisible = false;
  state.workflowMode = null;
  state.detectionSensitivity = DEFAULT_DETECTION_SENSITIVITY;
  state.isAnalyzing = false;
  state.hoveredSegmentId = null;
  nextSegmentId = 1;
  nextPolygonId = 1;

  imageInput.value = "";
  referenceLengthInput.value = "";
  setUnitInputValue(rememberedUnit);
  updateUnitSystemControls();
  emptyState.hidden = false;
  exportStatus.hidden = true;
  exportStatus.innerHTML = "";
  setExportMenuOpen(false);
  history.clear();
  updateAll();
  syncCanvasAfterLayout();
  commitHistory();
  showToast("Изображение удалено");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

async function shouldReplaceCurrentPlan() {
  if (!state.image || (!state.segments.length && !state.polygons.length && !state.detectedSegments.length)) {
    return true;
  }
  return await confirmAction("Заменить изображение? Текущая разметка будет очищена.", {
    title: "Заменить изображение",
    confirmText: "Заменить",
    danger: true,
  });
}

async function loadImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Выберите файл изображения");
    return;
  }
  if (!(await shouldReplaceCurrentPlan())) {
    return;
  }

  const preserveExistingMarkup = !state.image && state.segments.length > 0;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const image = new Image();
    image.addEventListener("load", () => {
      analysisRunId++;
      state.image = image;
      state.imageSrc = String(reader.result);
      state.imageName = file.name;
      setBackgroundOpacity(1);
      if (!preserveExistingMarkup) {
        state.segments = [];
        state.polygons = [];
        state.referenceId = null;
        state.referencePixelLength = null;
        setReferenceValue("");
        state.isEditingReferenceLength = false;
        state.isChoosingBase = false;
        clearSelection();
      }
      state.detectedSegments = [];
      state.pendingPoint = null;
      state.polygonPoints = [];
      state.polygonPreviewPoint = null;
      state.polygonCloseTarget = null;
      state.pendingReferenceId = null;
      state.previewPoint = null;
      state.orthogonalGuide = null;
      state.workflowMode = null;
      state.detectionSensitivity = DEFAULT_DETECTION_SENSITIVITY;
      state.isDrawingSegments = false;
      state.isDrawingArea = false;
      state.nextActionPromptVisible = !preserveExistingMarkup;
      state.isAnalyzing = false;
      state.hoveredSegmentId = null;
      emptyState.hidden = true;
      updateToolControls();
      resizeCanvas();
      fitImage();
      updateAll();
      commitHistory();
    });
    image.addEventListener("error", () => showToast("Не удалось прочитать изображение"), { once: true });
    image.src = reader.result;
  });
  reader.addEventListener("error", () => showToast("Не удалось открыть файл"), { once: true });
  reader.readAsDataURL(file);
}

function importProjectFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const payload = JSON.parse(String(reader.result || ""));
      const snapshot = snapshotFromProjectPayload(payload);
      history.clear();
      await applySnapshot(snapshot);
      commitHistory();
      showToast("Проект загружен");
    } catch {
      showToast("Не удалось открыть проект");
    } finally {
      if (projectImportInput) projectImportInput.value = "";
    }
  });
  reader.addEventListener("error", () => {
    showToast("Не удалось прочитать файл проекта");
    if (projectImportInput) projectImportInput.value = "";
  });
  reader.readAsText(file);
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  loadImageFile(file);
  imageInput.value = "";
});

emptyUploadButton.addEventListener("click", () => imageInput.click());

for (const target of [wrap, emptyState]) {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    wrap.classList.add("drag-over");
  });
  target.addEventListener("dragleave", (event) => {
    event.stopPropagation();
    if (!wrap.contains(event.relatedTarget)) {
      wrap.classList.remove("drag-over");
    }
  });
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    wrap.classList.remove("drag-over");
    loadImageFile(event.dataTransfer?.files?.[0]);
  });
}

document.addEventListener("paste", (event) => {
  const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith("image/"));
  if (file) {
    loadImageFile(file);
  }
});

acceptDetectedButton.addEventListener("click", () => materializeDetectedSegments(false));
addDetectedButton.addEventListener("click", () => materializeDetectedSegments(true));
cancelDetectedButton.addEventListener("click", () => {
  clearDetectedSegments();
  showToast("Найденные отрезки отменены");
});
focusReferenceButton.addEventListener("click", () => {
  state.isEditingReferenceLength = Boolean(state.referenceId);
  updateAll();
  inlineReferenceLengthInput?.focus();
  inlineReferenceLengthInput?.select();
});
focusBaseInputButton.addEventListener("click", () => {
  state.isEditingReferenceLength = Boolean(state.referenceId);
  updateAll();
  inlineReferenceLengthInput?.focus();
  inlineReferenceLengthInput?.select();
});
chooseBaseButton.addEventListener("click", startChoosingBase);
recalibrateButton?.addEventListener("click", startChoosingBase);
confirmBaseButton?.addEventListener("click", confirmPendingReference);
cancelBaseButton?.addEventListener("click", () => {
  hideBaseConfirmation();
  updateAll();
});

selectModeButton?.addEventListener("click", () => setToolMode("select"));
drawSegmentButton.addEventListener("click", () => setToolMode(state.isDrawingSegments ? "select" : "line"));
drawAreaButton?.addEventListener("click", () => setToolMode(state.isDrawingArea ? "select" : "area"));
finishPolygonButton?.addEventListener("click", finishPolygon);

reanalyzeButton.addEventListener("click", () => {
  if (!state.image || state.isAnalyzing) return;
  state.nextActionPromptVisible = true;
  state.workflowMode = "auto";
  state.isDrawingSegments = false;
  state.isDrawingArea = false;
  state.detectedSegments = [];
  cancelPendingLine();
  cancelPendingPolygon();
  updateAll();
});

removeUnderlayButton.addEventListener("click", () => {
  if (!state.image) return;
  if (state.backgroundVisible) {
    setBackgroundOpacity(0, { remember: false });
  } else {
    setBackgroundOpacity(state.previousBackgroundOpacity || 1);
  }
  updateAll();
  commitHistory();
  showToast(state.backgroundVisible ? "Подложка показана" : "Подложка скрыта");
});
resetPlanButton.addEventListener("click", resetPlan);

undoButton.addEventListener("click", undoHistory);
redoButton.addEventListener("click", redoHistory);

clearButton.addEventListener("click", () => {
  deleteSelectedObjects();
});

copyButton.addEventListener("click", async () => {
  const text = segmentsSummaryText();
  if (!text) {
    showToast("Пока нечего копировать");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast("Список измерений скопирован");
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.left = "-9999px";
    document.body.append(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
    showToast("Список измерений скопирован");
  }
});

toggleSegmentsButton.addEventListener("click", () => {
  const collapsed = segmentSection.classList.toggle("collapsed");
  toggleSegmentsButton.textContent = collapsed ? "Развернуть" : "Свернуть";
});

exportMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setHelpOpen(false);
  setSettingsOpen(false);
  toggleExportMenu();
});
exportPngButton.addEventListener("click", () => exportPng(false));
exportPngBgButton.addEventListener("click", () => exportPng(true));
exportPdfButton.addEventListener("click", () => exportPdf(false));
exportPdfBgButton.addEventListener("click", () => exportPdf(true));
exportSvgButton.addEventListener("click", exportSvg);
exportCsvButton.addEventListener("click", exportCsv);
exportJsonButton.addEventListener("click", exportJson);
exportProjectButton?.addEventListener("click", exportProject);
importProjectButton?.addEventListener("click", () => {
  setExportMenuOpen(false);
  projectImportInput?.click();
});
projectImportInput?.addEventListener("change", () => {
  importProjectFile(projectImportInput.files?.[0]);
});
copyShareLinkButton.addEventListener("click", copyShareLink);
helpButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  setExportMenuOpen(false);
  setSettingsOpen(false);
  toggleHelp();
});
helpCloseButton?.addEventListener("click", () => setHelpOpen(false));
settingsButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  setExportMenuOpen(false);
  setHelpOpen(false);
  toggleSettings();
});

document.addEventListener("click", (event) => {
  if (!segmentContextMenu.hidden && event.target instanceof Node && !segmentContextMenu.contains(event.target)) {
    hideSegmentContextMenu();
  }
  if (helpPopover && !helpPopover.hidden) {
    if (event.target instanceof Node && helpPopover.contains(event.target)) return;
    if (event.target instanceof Node && helpButton?.contains(event.target)) return;
    setHelpOpen(false);
  }
  if (settingsMenu && !settingsMenu.hidden) {
    if (event.target instanceof Node && settingsMenu.contains(event.target)) return;
    if (event.target instanceof Node && settingsButton?.contains(event.target)) return;
    setSettingsOpen(false);
  }
  if (exportMenu.hidden) return;
  if (event.target instanceof Node && exportMenu.contains(event.target)) return;
  if (event.target instanceof Node && exportMenuButton.contains(event.target)) return;
  setExportMenuOpen(false);
});

segmentContextMenu.addEventListener("click", (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest("button[data-action]") : null;
  if (!button) return;
  const segment = state.segments.find((item) => item.id === activeContextSegmentId);
  if (!segment) {
    hideSegmentContextMenu();
    return;
  }

  const action = button.dataset.action;
  hideSegmentContextMenu();
  if (action === "base") {
    setReferenceSegment(segment.id);
  } else if (action === "rename") {
    renameSegmentWithPrompt(segment);
  } else if (action === "delete") {
    deleteSegment(segment.id);
  }
});

welcomeStartButton.addEventListener("click", dismissWelcome);

referenceLengthInput.addEventListener("input", () => {
  setReferenceValue(referenceLengthInput.value);
  if (parseDecimal(state.referenceValue) !== null) {
    state.referencePixelLength = getReferenceLength() || state.referencePixelLength;
  }
  updateAll();
});
referenceLengthInput.addEventListener("change", () => {
  setReferenceValue(referenceLengthInput.value);
  if (parseDecimal(state.referenceValue) !== null) {
    state.referencePixelLength = getReferenceLength() || state.referencePixelLength;
  }
  updateAll();
  commitHistory();
});

unitInput.addEventListener("input", () => {
  setProjectUnit(unitInput.value);
  updateAll();
});
unitInput.addEventListener("change", () => {
  setProjectUnit(unitInput.value);
  updateAll();
  commitHistory();
});

segmentsSortSelect.addEventListener("change", renderSegments);

settingsUnitInput?.addEventListener("change", () => {
  setProjectUnit(settingsUnitInput.value);
  updateAll();
  commitHistory();
});

settingsUnitSystemInput?.addEventListener("change", () => {
  setProjectUnitSystem(settingsUnitSystemInput.value, { commit: Boolean(state.image || state.segments.length || state.polygons.length) });
});

settingsPrecisionInput?.addEventListener("change", () => {
  state.measurementPrecision = normalizePrecision(settingsPrecisionInput.value);
  updateAll();
  commitHistory();
});

settingsFootnoteSizeInput?.addEventListener("change", () => {
  state.footnoteSize = normalizeFootnoteSize(settingsFootnoteSizeInput.value);
  updateAll();
  commitHistory();
});

settingsShowUnitsInput?.addEventListener("change", () => {
  state.showUnitsInFootnotes = settingsShowUnitsInput.checked;
  updateAll();
  commitHistory();
});

backgroundOpacityInput?.addEventListener("input", () => {
  setBackgroundOpacity(Number(backgroundOpacityInput.value) / 100);
  updateAll();
});

backgroundOpacityInput?.addEventListener("change", () => {
  setBackgroundOpacity(Number(backgroundOpacityInput.value) / 100);
  updateAll();
  commitHistory();
});

settingsOpacityInput?.addEventListener("input", () => {
  setBackgroundOpacity(Number(settingsOpacityInput.value) / 100);
  updateAll();
});

settingsOpacityInput?.addEventListener("change", () => {
  setBackgroundOpacity(Number(settingsOpacityInput.value) / 100);
  updateAll();
  commitHistory();
});

settingsFootnotesInput?.addEventListener("change", () => {
  if (settingsFootnotesInput.checked === (visibleFootnoteCount() > 0)) return;
  toggleAllFootnotes();
});

toggleBackgroundOpacityButton?.addEventListener("click", () => {
  if (!state.image) return;
  if (state.backgroundVisible) {
    setBackgroundOpacity(0, { remember: false });
  } else {
    setBackgroundOpacity(state.previousBackgroundOpacity || 1);
  }
  updateAll();
  commitHistory();
});

inlineUnitInput?.addEventListener("change", () => {
  setProjectUnit(inlineUnitInput.value);
  updateAll();
});

inlineCalibration?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = inlineReferenceLengthInput?.value || "";
  if (parseDecimal(value) === null) {
    showToast("Введите длину базового отрезка");
    inlineReferenceLengthInput?.focus();
    return;
  }
  setReferenceValue(value);
  state.referencePixelLength = getReferenceLength() || state.referencePixelLength;
  setProjectUnit(inlineUnitInput?.value || state.unit, { convertReference: false });
  state.isEditingReferenceLength = false;
  state.isChoosingBase = false;
  state.nextActionPromptVisible = false;
  state.isDrawingSegments = state.workflowMode === "manual";
  updateAll();
  commitHistory();
});

manualModeButton?.addEventListener("click", () => {
  state.nextActionPromptVisible = false;
  state.workflowMode = "manual";
  state.isDrawingSegments = true;
  state.isDrawingArea = false;
  cancelPendingPolygon();
  state.detectedSegments = [];
  updateAll();
  saveSnapshotToStorage();
});

detectModeButton?.addEventListener("click", () => {
  state.workflowMode = "auto";
  state.isDrawingSegments = false;
  state.isDrawingArea = false;
  cancelPendingLine();
  cancelPendingPolygon();
  state.detectionSensitivity = normalizeDetectionSensitivity(detectionSensitivityInput?.value);
  updateAll();
  saveSnapshotToStorage();
});

runDetectionButton?.addEventListener("click", () => {
  if (!state.image || state.isAnalyzing) return;
  state.nextActionPromptVisible = false;
  state.workflowMode = "auto";
  analyzeImageSegments({ automatic: false, sensitivity: state.detectionSensitivity });
});

detectionSensitivityInput?.addEventListener("input", () => {
  state.detectionSensitivity = normalizeDetectionSensitivity(detectionSensitivityInput.value);
  updateDetectionSensitivityControls();
});

detectionSensitivityInput?.addEventListener("change", () => {
  state.detectionSensitivity = normalizeDetectionSensitivity(detectionSensitivityInput.value);
  updateDetectionSensitivityControls();
  saveSnapshotToStorage();
});

metricUnitsButton?.addEventListener("click", () => {
  setProjectUnitSystem("metric", { commit: Boolean(state.image || state.segments.length) });
});

imperialUnitsButton?.addEventListener("click", () => {
  setProjectUnitSystem("imperial", { commit: Boolean(state.image || state.segments.length) });
});

scaleRulerResetButton?.addEventListener("click", () => {
  fitImage();
  scheduleViewSave();
});

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  updateToolControls();
  syncCanvasAfterLayout();
}

sidebarToggleButton.addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));
sidebarCloseButton?.addEventListener("click", () => setSidebarCollapsed(true));
if (toggleAllFootnotesButton) {
  toggleAllFootnotesButton.addEventListener("click", toggleAllFootnotes);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!state.image) return;
  updatePointerFromEvent(event);
  safeSetPointerCapture(event.pointerId);
  if (event.pointerType === "touch" && activePointers.size >= 2) {
    event.preventDefault();
    startPinchGesture();
    updateAll();
    return;
  }

  if (state.isDrawingSegments || state.isDrawingArea) {
    event.preventDefault();
    const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
    state.isDragging = true;
    state.didDrag = false;
    touchContextMenuOpened = false;
    state.snapPoint = null;
    state.orthogonalGuide = null;
    state.alignmentGuide = null;
    state.selectionBox = null;
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
    state.dragStart = {
      x: event.clientX,
      y: event.clientY,
      screen: screenPointFromClient(event.clientX, event.clientY),
      offsetX: state.offsetX,
      offsetY: state.offsetY,
    };
    updateAll();
    canvas.classList.add("dragging");
    return;
  }

  const hitEndpoint = findEndpointAt(event.clientX, event.clientY);
  const hitLabel = hitEndpoint ? null : findLabelAt(event.clientX, event.clientY);
  const hitSegment = hitEndpoint || hitLabel ? null : findSegmentAt(event.clientX, event.clientY);
  const hitPolygonLabel = hitEndpoint || hitLabel || hitSegment ? null : findPolygonLabelAt(event.clientX, event.clientY);
  const hitPolygon = hitEndpoint || hitLabel || hitSegment || hitPolygonLabel ? null : findPolygonAt(event.clientX, event.clientY);
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

  state.isDragging = true;
  state.didDrag = false;
  touchContextMenuOpened = false;
  state.snapPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  state.selectionBox = null;

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

  state.dragStart = {
    x: event.clientX,
    y: event.clientY,
    screen: screenPointFromClient(event.clientX, event.clientY),
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    endpoint: hitEndpoint,
    labelSegment: hitLabel,
    hitSegment: hitLabel || hitSegment,
    polygon: hitPolygonLabel || hitPolygon,
    polygonPoints: hitPolygonLabel || hitPolygon
      ? (hitPolygonLabel || hitPolygon).points.map(clonePoint)
      : null,
    labelOffset: hitLabel ? currentLabelOffset(hitLabel) : { x: 0, y: -36 },
  };
  scheduleTouchContextMenu(hitLabel || hitSegment, event);
  updateAll();
  canvas.classList.add("dragging");
});

canvas.addEventListener("pointermove", (event) => {
  updatePointerFromEvent(event);
  if (pinchGesture && event.pointerType === "touch" && activePointers.size >= 2) {
    event.preventDefault();
    const metrics = pointerPairMetrics();
    if (metrics && metrics.distance >= 1) {
      const factor = metrics.distance / Math.max(pinchGesture.distance, 1);
      zoomAtClientPoint(metrics.center.x, metrics.center.y, factor);
      pinchGesture.distance = metrics.distance;
      draw();
      scheduleViewSave();
    }
    return;
  }

  updateCursorCoordinates(event.clientX, event.clientY);

  if (!state.isDragging || !state.dragStart) {
    const hoverTarget = state.image && !state.isDrawingSegments && !state.isDrawingArea
      ? findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY)
      : null;
    const hoverId = hoverTarget?.id ?? null;
    if (hoverId !== state.hoveredSegmentId) {
      state.hoveredSegmentId = hoverId;
      canvas.classList.toggle("hovering-segment", Boolean(hoverId));
      draw();
    }

    if (state.pendingPoint && state.isDrawingSegments) {
      const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
      const resolved = resolveEndpointPoint(rawPoint, state.pendingPoint, null);
      state.previewPoint = resolved.point;
      state.snapPoint = resolved.snap;
      state.orthogonalGuide = resolved.guide;
      state.alignmentGuide = resolved.alignmentGuide;
      draw();
    } else if (state.isDrawingSegments && !state.pendingPoint) {
      const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
      state.snapPoint = resolveStartPoint(rawPoint).snap;
      draw();
    } else if (state.isDrawingArea) {
      const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
      const resolved = resolvePolygonPoint(rawPoint);
      state.polygonCloseTarget = resolved.close ? resolved.point : null;
      state.polygonPreviewPoint = resolved.point;
      state.snapPoint = resolved.snap;
      state.orthogonalGuide = resolved.guide;
      state.alignmentGuide = resolved.alignmentGuide;
      draw();
    }
    return;
  }

  const dx = event.clientX - state.dragStart.x;
  const dy = event.clientY - state.dragStart.y;
  const distance = Math.hypot(dx, dy);

  if (distance > 4) {
    if (distance > 10) {
      clearLongPressTimer();
    }
    state.didDrag = true;

    if (state.interactionMode === "endpoint" && state.dragStart.endpoint) {
      const { segment, endpoint } = state.dragStart.endpoint;
      const fixedEndpoint = endpoint === "start" ? segment.end : segment.start;
      const dragPoint = adjustedEndpointDragPoint(event);
      const rawPoint = clampPointToImage(screenToImage(dragPoint.x, dragPoint.y));
      const resolved = resolveEndpointPoint(rawPoint, fixedEndpoint, segment.id);
      segment[endpoint] = resolved.point;
      state.snapPoint = resolved.snap;
      state.orthogonalGuide = resolved.guide;
      state.alignmentGuide = resolved.alignmentGuide;
      draw();
    } else if (state.interactionMode === "label" && state.dragStart.labelSegment) {
      const dx = event.clientX - state.dragStart.x;
      const dy = event.clientY - state.dragStart.y;
      state.dragStart.labelSegment.labelOffset = {
        x: state.dragStart.labelOffset.x + dx,
        y: state.dragStart.labelOffset.y + dy,
      };
      draw();
    } else if (state.interactionMode === "polygon" && state.dragStart.polygon && state.dragStart.polygonPoints) {
      const imageDx = dx / Math.max(state.scale, 0.001);
      const imageDy = dy / Math.max(state.scale, 0.001);
      state.dragStart.polygon.points = state.dragStart.polygonPoints.map((point) => ({
        x: point.x + imageDx,
        y: point.y + imageDy,
      }));
      draw();
    } else if (state.interactionMode === "draw-line" && state.pendingPoint) {
      const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
      const resolved = resolveEndpointPoint(rawPoint, state.pendingPoint, null);
      state.previewPoint = resolved.point;
      state.snapPoint = resolved.snap;
      state.orthogonalGuide = resolved.guide;
      state.alignmentGuide = resolved.alignmentGuide;
      draw();
    } else if (state.interactionMode === "draw-area") {
      const rawPoint = clampPointToImage(screenToImage(event.clientX, event.clientY));
      const resolved = resolvePolygonPoint(rawPoint);
      state.polygonCloseTarget = resolved.close ? resolved.point : null;
      state.polygonPreviewPoint = resolved.point;
      state.snapPoint = resolved.snap;
      state.orthogonalGuide = resolved.guide;
      state.alignmentGuide = resolved.alignmentGuide;
      draw();
    } else if (state.interactionMode === "base-pick") {
      state.offsetX = state.dragStart.offsetX + dx;
      state.offsetY = state.dragStart.offsetY + dy;
    } else if (state.interactionMode === "segment") {
      state.selectionBox = null;
      draw();
    } else if (state.pendingPoint) {
      draw();
    } else if (state.interactionMode === "pan") {
      state.offsetX = state.dragStart.offsetX + dx;
      state.offsetY = state.dragStart.offsetY + dy;
    } else {
      state.selectionBox = {
        start: state.dragStart.screen,
        end: screenPointFromClient(event.clientX, event.clientY),
      };
      selectSegments(segmentIdsInsideSelectionBox());
      selectPolygons(polygonIdsInsideSelectionBox());
    }

    draw();
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (!state.image) return;
  clearLongPressTimer();
  removePointerFromEvent(event);
  safeReleasePointerCapture(event.pointerId);
  if (touchContextMenuOpened) {
    touchContextMenuOpened = false;
    resetTransientGestureState(null);
    state.lastPointerUpAt = performance.now();
    draw();
    return;
  }
  if (pinchGesture || state.interactionMode === "pinch") {
    resetTransientGestureState(null);
    state.lastPointerUpAt = performance.now();
    scheduleViewSave();
    draw();
    return;
  }
  canvas.classList.remove("dragging");
  state.lastPointerUpAt = performance.now();

  const wasClick = !state.didDrag;
  const hadSelectionBox = Boolean(state.selectionBox);
  const hitLabel = wasClick ? findLabelAt(event.clientX, event.clientY) : null;
  const hitSegment = wasClick && !hitLabel ? findSegmentAt(event.clientX, event.clientY) : null;
  const hitPolygonLabel = wasClick && !hitLabel && !hitSegment ? findPolygonLabelAt(event.clientX, event.clientY) : null;
  const hitPolygon = wasClick && !hitLabel && !hitSegment && !hitPolygonLabel ? findPolygonAt(event.clientX, event.clientY) : null;
  const completedMode = state.interactionMode;
  const completedDragStart = state.dragStart;
  const shouldAddPoint = state.isDrawingSegments && wasClick && (
    completedMode === "draw-line" || (!hitLabel && !hitSegment && completedMode !== "endpoint")
  );
  const shouldAddPolygonPoint = state.isDrawingArea && wasClick && completedMode === "draw-area";
  state.isDragging = false;
  state.dragStart = null;
  state.interactionMode = null;
  state.snapPoint = null;
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;

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
      return;
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
      return;
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
});

canvas.addEventListener("dblclick", (event) => {
  if (!state.image) return;
  const segment = findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY);
  if (!segment) return;
  event.preventDefault();
  renameSegmentWithPrompt(segment);
});

canvas.addEventListener("contextmenu", (event) => {
  if (!state.image) return;
  const segment = findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY);
  if (!segment) return;
  event.preventDefault();
  showSegmentContextMenu(segment, event.clientX, event.clientY);
});

canvas.addEventListener("pointerleave", () => {
  hideCursorCoordinates();
  if (state.isDragging) return;
  state.hoveredSegmentId = null;
  canvas.classList.remove("hovering-segment");
  state.polygonPreviewPoint = null;
  state.polygonCloseTarget = null;
  if (!state.previewPoint && !state.orthogonalGuide && !state.alignmentGuide) {
    draw();
    return;
  }
  state.previewPoint = null;
  state.orthogonalGuide = null;
  state.alignmentGuide = null;
  draw();
});

canvas.addEventListener("pointercancel", (event) => {
  clearLongPressTimer();
  removePointerFromEvent(event);
  if (state.interactionMode === "pinch" || activePointers.size === 0) {
    resetTransientGestureState(null);
    draw();
  }
});

canvas.addEventListener("wheel", (event) => {
  if (!state.image) return;
  event.preventDefault();

  const deltaX = normalizedWheelDelta(event.deltaX, event.deltaMode);
  const deltaY = normalizedWheelDelta(event.deltaY, event.deltaMode);
  const shouldZoom = event.ctrlKey || event.metaKey || event.altKey;

  if (!shouldZoom) {
    canvasView.panBy(deltaX, deltaY);
    draw();
    scheduleViewSave();
    return;
  }

  if (performance.now() - state.lastPointerUpAt < 240 || Math.abs(deltaY) < 1.5) {
    return;
  }

  const rawFactor = Math.exp(-deltaY * 0.0025);
  const factor = Math.min(Math.max(rawFactor, 0.75), 1.33);
  zoomAtClientPoint(event.clientX, event.clientY, factor);
  draw();
  scheduleViewSave();
}, { passive: false });

smartGridToggle.addEventListener("change", () => {
  state.smartGridEnabled = smartGridToggle.checked;
  updateAll();
  commitHistory();
});

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    syncCalibrationPlacement();
    updateToolControls();
    resizeCanvas();
  }, 50);
});

window.visualViewport?.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    syncCalibrationPlacement();
    updateToolControls();
    resizeCanvas();
  }, 50);
});

if (typeof ResizeObserver !== "undefined") {
  const canvasResizeObserver = new ResizeObserver(() => resizeCanvas());
  canvasResizeObserver.observe(wrap);
}

resizeCanvas();
initWelcome();
restoreSavedState();
