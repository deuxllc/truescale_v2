const { resolvePointWithSnaps } = window.PlanScaleSnap;
const { renderSegmentsPanel } = window.PlanScaleSegmentsPanel;
const {
  analyzeImageData,
  normalizeDetectionSensitivity,
  detectionSensitivityProgress,
} = window.PlanScaleDetectionCore;
const {
  clonePoint,
  cloneSegment,
  clonePolygon,
  decodeBase64Json,
  normalizedRect,
  pointInsideRect,
  lineSegmentsIntersect,
  parseDecimal,
  formatDecimal,
  rectsIntersect,
  roundedRectPath,
  segmentAngle,
} = window.PlanScaleUtils;
const {
  canvas,
  wrap,
  appShell,
  ctx,
  imageInput,
  removeUnderlayButton,
  resetPlanButton,
  fitButton,
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
  resultOutput,
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
  copyShareLinkButton,
  helpButton,
  helpPopover,
  helpCloseButton,
  settingsButton,
  settingsMenu,
  settingsUnitInput,
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

const state = {
  image: null,
  imageSrc: "",
  imageName: "",
  backgroundVisible: true,
  backgroundOpacity: 1,
  previousBackgroundOpacity: 1,
  scale: 1,
  homeScale: 1,
  offsetX: 0,
  offsetY: 0,
  segments: [],
  polygons: [],
  referenceId: null,
  selectedSegmentIds: new Set(),
  referenceValue: "",
  unit: unitInput.value || "м",
  unitSystem: IMPERIAL_UNITS.has(unitInput.value) ? "imperial" : "metric",
  footnotesVisible: true,
  pendingPoint: null,
  polygonPoints: [],
  polygonPreviewPoint: null,
  polygonCloseTarget: null,
  isDragging: false,
  dragStart: null,
  didDrag: false,
  interactionMode: null,
  selectionBox: null,
  labelBounds: new Map(),
  polygonLabelBounds: new Map(),
  snapPoint: null,
  previewPoint: null,
  orthogonalGuide: null,
  alignmentGuide: null,
  rightAngleHints: [],
  rightAngleIds: new Set(),
  detectedSegments: [],
  smartGridEnabled: true,
  nextActionPromptVisible: false,
  workflowMode: null,
  detectionSensitivity: Number(detectionSensitivityInput?.value) || DEFAULT_DETECTION_SENSITIVITY,
  isEditingReferenceLength: false,
  isDrawingSegments: false,
  isDrawingArea: false,
  isChoosingBase: false,
  sidebarCollapsed: true,
  isSpacePressed: false,
  isAnalyzing: false,
  hoveredSegmentId: null,
  pendingReferenceId: null,
  lastPointerUpAt: 0,
};

const POLYGON_SNAP_OPTIONS = {
  axisFieldRadiusPx: 240,
  axisTolerancePx: 11,
  endpointTolerancePx: 18,
  strongEndpointTolerancePx: 10,
};

let nextSegmentId = 1;
let nextPolygonId = 1;
let analysisRunId = 0;
let activeContextSegmentId = null;
let resizeTimer = 0;
const historyState = {
  undo: [],
  redo: [],
  restoring: false,
};
let viewSaveTimer = 0;
const activePointers = new Map();
let pinchGesture = null;
let longPressTimer = 0;
let longPressSegment = null;
let touchContextMenuOpened = false;
const {
  setExportMenuOpen,
  toggleExportMenu,
  exportPng,
  exportPdf,
  exportCsv,
  exportJson,
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
    labelTextFor,
    areaLabelTextFor,
    polygonAreaFor,
    polygonCentroid,
    isSegmentFootnoteVisible,
    isPolygonFootnoteVisible,
    nearestPointOnRect,
    isGridAlignedSegment,
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

function unitSystemForUnit(unit) {
  return IMPERIAL_UNITS.has(unit) ? "imperial" : "metric";
}

function updateUnitSystemControls() {
  metricUnitsButton?.setAttribute("aria-pressed", String(state.unitSystem !== "imperial"));
  imperialUnitsButton?.setAttribute("aria-pressed", String(state.unitSystem === "imperial"));
}

function setProjectUnitSystem(system, { commit = false } = {}) {
  const nextSystem = system === "imperial" ? "imperial" : "metric";
  state.unitSystem = nextSystem;
  state.unit = nextSystem === "imperial" ? "ft" : "м";
  setUnitInputValue(state.unit);
  updateUnitSystemControls();
  if (commit) {
    updateAll();
    commitHistory();
  }
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
    selectedSegmentIds: getSelectedIds(),
    referenceValue: state.referenceValue,
    unit: state.unit,
    unitSystem: state.unitSystem,
    footnotesVisible: state.footnotesVisible,
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
  historyState.restoring = true;
  try {
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
    state.selectedSegmentIds = new Set(snapshot.selectedSegmentIds || []);
    state.referenceValue = snapshot.referenceValue || "";
    state.unit = snapshot.unit || "м";
    state.unitSystem = snapshot.unitSystem || unitSystemForUnit(state.unit);
    state.footnotesVisible = typeof snapshot.footnotesVisible === "boolean"
      ? snapshot.footnotesVisible
      : (state.segments.length + state.polygons.length) === 0
        || state.segments.some((segment) => segment.labelHidden !== true)
        || state.polygons.some((polygon) => polygon.labelHidden !== true);
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

    referenceLengthInput.value = state.referenceValue;
    setUnitInputValue(state.unit);
    updateUnitSystemControls();
    if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = state.referenceValue;
    if (inlineUnitInput) inlineUnitInput.value = state.unit;
    updateDetectionSensitivityControls();
    smartGridToggle.checked = state.smartGridEnabled;
    updateToolControls();
    emptyState.hidden = Boolean(state.image);
    updateAll();
  } finally {
    historyState.restoring = false;
  }
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
    state.referenceValue = payload.baseValue ? String(payload.baseValue).replace(".", ",") : "";
    state.unit = payload.unit || state.unit || "м";
    state.footnotesVisible = typeof payload.footnotesVisible === "boolean"
      ? payload.footnotesVisible
      : (state.segments.length + state.polygons.length) === 0
        || state.segments.some((segment) => segment.labelHidden !== true)
        || state.polygons.some((polygon) => polygon.labelHidden !== true);
    state.selectedSegmentIds = new Set(state.referenceId ? [state.referenceId] : []);
    state.isChoosingBase = !state.referenceId && state.segments.length > 0;
    nextSegmentId = Math.max(1, ...state.segments.map((segment) => segment.id + 1), 1);
    nextPolygonId = Math.max(1, ...state.polygons.map((polygon) => polygon.id + 1), 1);
    referenceLengthInput.value = state.referenceValue;
    setUnitInputValue(state.unit);
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

function hasCompleteBaseLength() {
  return Boolean(state.referenceId && parseDecimal(state.referenceValue) !== null);
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
  const hasSelection = state.selectedSegmentIds.size > 0;
  undoButton.disabled = historyState.undo.length <= 1;
  redoButton.disabled = historyState.redo.length === 0;
  removeUnderlayButton.disabled = !hasImage;
  resetPlanButton.disabled = !hasImage && !hasObjects && !hasDetected;
  if (fitButton) fitButton.disabled = !hasImage;
  if (selectModeButton) selectModeButton.disabled = !hasImage;
  drawSegmentButton.disabled = !hasImage;
  if (drawAreaButton) drawAreaButton.disabled = !hasImage;
  reanalyzeButton.disabled = !hasImage || state.isAnalyzing;
  exportMenuButton.disabled = !hasImage;
  clearButton.disabled = !hasSelection;
  clearButton.title = hasSelection
    ? "Удалить выбранный отрезок"
    : "Сначала выберите отрезок";
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

  const hasBase = Boolean(state.referenceId);
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

  const needsBase = Boolean(state.image && !state.referenceId && !state.nextActionPromptVisible && (state.isDrawingSegments || state.segments.length));
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

  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  const referenceValue = parseDecimal(state.referenceValue);
  if (!state.image || !reference || referenceValue === null || referenceValue <= 0) {
    scaleRuler.hidden = true;
    return;
  }

  const pixelsPerUnit = segmentLength(reference) * state.scale / referenceValue;
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
  if (historyState.restoring) return;

  const snapshot = snapshotState();
  const previous = historyState.undo[historyState.undo.length - 1];
  const serialized = JSON.stringify(snapshot);
  if (!previous || JSON.stringify(previous) !== serialized) {
    historyState.undo.push(snapshot);
    historyState.redo = [];
  }
  saveSnapshotToStorage(snapshot);
  updateHistoryButtons();
}

async function undoHistory() {
  if (historyState.undo.length <= 1) return;
  const current = historyState.undo.pop();
  historyState.redo.push(current);
  await applySnapshot(historyState.undo[historyState.undo.length - 1]);
  saveSnapshotToStorage();
  updateHistoryButtons();
}

async function redoHistory() {
  const snapshot = historyState.redo.pop();
  if (!snapshot) return;
  historyState.undo.push(snapshot);
  await applySnapshot(snapshot);
  saveSnapshotToStorage();
  updateHistoryButtons();
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
    historyState.undo = [snapshotState()];
    historyState.redo = [];
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
  syncCanvasHeightToViewport();
  const ratio = window.devicePixelRatio || 1;
  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function syncCanvasAfterLayout({ fit = false } = {}) {
  resizeCanvas();
  if (fit && state.image) {
    fitImage();
  }
}

function fitImage() {
  if (!state.image) {
    syncCanvasOverlays();
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

function clampViewScale(scale) {
  return Math.min(Math.max(scale, MIN_VIEW_SCALE), MAX_VIEW_SCALE);
}

function zoomAtClientPoint(clientX, clientY, factor) {
  const screen = screenPointFromClient(clientX, clientY);
  const before = screenToImage(clientX, clientY);
  state.scale = clampViewScale(state.scale * factor);
  state.offsetX = screen.x - before.x * state.scale;
  state.offsetY = screen.y - before.y * state.scale;
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
  const ratio = window.devicePixelRatio || 1;
  return {
    width: canvas.width / ratio,
    height: canvas.height / ratio,
  };
}

function screenPointFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const logical = canvasLogicalSize();
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
  return {
    x: point.x * state.scale + state.offsetX,
    y: point.y * state.scale + state.offsetY,
  };
}

function clampPointToImage(point) {
  return point;
}

function segmentLength(segment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  return Math.hypot(dx, dy);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
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

function isGridAlignedSegment(segment) {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return false;

  const axisError = Math.min(Math.abs(dx), Math.abs(dy));
  const tolerance = Math.max(1, length * 0.015);
  return axisError <= tolerance;
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

function isCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function selectOnlySegment(id) {
  state.selectedSegmentIds = id === null ? new Set() : new Set([id]);
}

function selectSegments(ids) {
  state.selectedSegmentIds = new Set(ids);
}

function toggleSegmentSelection(id) {
  const selected = new Set(state.selectedSegmentIds);
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }
  state.selectedSegmentIds = selected;
}

function clearSelection() {
  state.selectedSegmentIds = new Set();
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
  state.isChoosingBase = false;
  state.isEditingReferenceLength = true;
  if (changedReference) {
    state.referenceValue = "";
    referenceLengthInput.value = "";
    if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = "";
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
  if (state.isChoosingBase || !state.referenceId) {
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

function getReferenceLength() {
  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  return reference ? segmentLength(reference) : 0;
}

function ratioFor(segment) {
  const referenceLength = getReferenceLength();
  if (!referenceLength) return null;
  return segmentLength(segment) / referenceLength;
}

function calculatedLengthFor(segment) {
  const ratio = ratioFor(segment);
  const referenceValue = parseDecimal(state.referenceValue);
  if (ratio === null || referenceValue === null) return null;
  return ratio * referenceValue;
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
  if (!append) {
    state.segments = reference ? [cloneSegment(reference)] : [];
    state.referenceId = reference ? reference.id : null;
    state.referenceValue = reference ? referenceValue : "";
    referenceLengthInput.value = state.referenceValue;
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
  if (!state.referenceId) {
    state.isChoosingBase = true;
    clearSelection();
  } else {
    selectOnlySegment(state.referenceId);
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
  const formatted = formatDecimal(value);
  if (formatted === "—" || !includeUnit || !state.unit.trim()) return formatted;
  return `${formatted} ${state.unit.trim()}`;
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
  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  const referenceValue = parseDecimal(state.referenceValue);
  if (!reference || referenceValue === null || referenceValue <= 0) return null;
  const referencePx = segmentLength(reference);
  if (!referencePx) return null;
  const unitsPerPixel = referenceValue / referencePx;
  return polygonAreaPx(polygon.points) * unitsPerPixel * unitsPerPixel;
}

function isPolygonFootnoteVisible(polygon) {
  return polygon.labelHidden !== true;
}

function areaLabelTextFor(polygon) {
  const area = polygonAreaFor(polygon);
  if (area === null) return polygon.name;
  return `${formatDecimal(area)} ${areaUnitLabel()}`;
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
  return formatLength(calculatedLength);
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

function drawPoint(point, color, radius = 5) {
  const screen = imageToScreen(point);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fffdfa";
  ctx.stroke();
}

function drawHandle(point, color, radius = 5) {
  const screen = imageToScreen(point);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdfa";
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawSegment(segment) {
  const start = imageToScreen(segment.start);
  const end = imageToScreen(segment.end);
  const isReference = segment.id === state.referenceId;
  const isSelected = isSegmentSelected(segment);
  const isHovered = state.hoveredSegmentId === segment.id;
  const isAngleAligned = state.rightAngleIds.has(segment.id) || isGridAlignedSegment(segment);
  const handleColor = isSelected
    ? CANVAS_COLORS.selected
    : isReference
      ? CANVAS_COLORS.reference
      : isAngleAligned
        ? CANVAS_COLORS.angle
        : CANVAS_COLORS.normal;

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineWidth = isSelected ? 6 : isReference ? 4.5 : isHovered ? 4 : 3;
  ctx.strokeStyle = isSelected
    ? CANVAS_COLORS.selected
    : isReference
      ? CANVAS_COLORS.reference
      : isAngleAligned
        ? CANVAS_COLORS.angle
        : CANVAS_COLORS.normal;
  ctx.stroke();

  const handleRadius = isCoarsePointer() && isSelected ? 9 : isSelected || isHovered ? 6 : 5;
  drawHandle(segment.start, handleColor, handleRadius);
  drawHandle(segment.end, handleColor, handleRadius);

  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  if (!isSegmentFootnoteVisible(segment)) {
    state.labelBounds.delete(segment.id);
    return;
  }

  const label = labelTextFor(segment);
  const labelFontSize = state.scale > 3 ? 9 : 11;
  ctx.font = `400 ${labelFontSize}px 'DM Sans', Inter, system-ui, sans-serif`;
  const metrics = ctx.measureText(label);
  const labelWidth = metrics.width + 12;
  const labelHeight = Math.max(17, labelFontSize + 8);
  const offset = getLabelOffset(segment, labelWidth, labelHeight);
  const labelCenter = {
    x: midpoint.x + offset.x,
    y: midpoint.y + offset.y,
  };
  const labelRect = {
    left: labelCenter.x - labelWidth / 2,
    top: labelCenter.y - labelHeight / 2,
    right: labelCenter.x + labelWidth / 2,
    bottom: labelCenter.y + labelHeight / 2,
  };
  state.labelBounds.set(segment.id, labelRect);

  const leaderEnd = nearestPointOnRect(midpoint, labelRect);
  ctx.beginPath();
  ctx.moveTo(midpoint.x, midpoint.y);
  ctx.lineTo(leaderEnd.x, leaderEnd.y);
  ctx.lineWidth = isSelected ? 1.1 : 0.75;
  ctx.strokeStyle = isSelected ? CANVAS_COLORS.selected : CANVAS_COLORS.leader;
  ctx.stroke();

  const labelOpacity = state.scale < 0.45 ? 0.42 : 0.96;
  ctx.fillStyle = `rgba(255, 255, 255, ${labelOpacity})`;
  ctx.strokeStyle = isSelected ? CANVAS_COLORS.selected : isReference ? CANVAS_COLORS.reference : "rgba(79, 97, 120, 0.34)";
  ctx.lineWidth = 0.8;
  roundedRectPath(ctx, labelRect.left, labelRect.top, labelWidth, labelHeight, labelHeight / 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#202936";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelCenter.x, labelCenter.y);
}

function drawPolygonLabel(polygon) {
  if (!isPolygonFootnoteVisible(polygon)) {
    state.polygonLabelBounds.delete(polygon.id);
    return;
  }

  const label = areaLabelTextFor(polygon);
  const center = imageToScreen(polygonCentroid(polygon));
  const labelFontSize = state.scale > 3 ? 10 : 12;
  ctx.font = `500 ${labelFontSize}px 'DM Sans', Inter, system-ui, sans-serif`;
  const width = ctx.measureText(label).width + 16;
  const height = Math.max(20, labelFontSize + 9);
  const rect = {
    left: center.x - width / 2,
    top: center.y - height / 2,
    right: center.x + width / 2,
    bottom: center.y + height / 2,
  };
  state.polygonLabelBounds.set(polygon.id, rect);

  ctx.save();
  roundedRectPath(ctx, rect.left, rect.top, width, height, height / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = CANVAS_COLORS.area;
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#173f35";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, center.x, center.y + 0.2);
  ctx.restore();
}

function drawPolygon(polygon) {
  if (!polygon.points?.length) return;

  ctx.save();
  ctx.beginPath();
  for (let index = 0; index < polygon.points.length; index++) {
    const point = imageToScreen(polygon.points[index]);
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = CANVAS_COLORS.areaFill;
  ctx.strokeStyle = CANVAS_COLORS.area;
  ctx.lineWidth = 2.2;
  ctx.fill();
  ctx.stroke();

  for (const point of polygon.points) {
    drawHandle(point, CANVAS_COLORS.area, 4.8);
  }
  ctx.restore();

  drawPolygonLabel(polygon);
}

function drawPendingPolygon() {
  if (!state.polygonPoints.length) return;

  const points = [...state.polygonPoints];
  if (state.polygonPreviewPoint) {
    points.push(state.polygonPreviewPoint);
  }

  ctx.save();
  ctx.strokeStyle = state.polygonCloseTarget || state.orthogonalGuide
    ? CANVAS_COLORS.area
    : "rgba(15, 143, 115, 0.58)";
  ctx.fillStyle = "rgba(15, 143, 115, 0.08)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  points.forEach((point, index) => {
    const screen = imageToScreen(point);
    if (index === 0) {
      ctx.moveTo(screen.x, screen.y);
    } else {
      ctx.lineTo(screen.x, screen.y);
    }
  });
  if (state.polygonCloseTarget && state.polygonPoints.length >= 3) {
    ctx.closePath();
    ctx.fill();
  }
  ctx.stroke();
  ctx.setLineDash([]);

  for (const point of state.polygonPoints) {
    drawHandle(point, CANVAS_COLORS.area, 5);
  }
  if (state.polygonCloseTarget) {
    drawSnapPointAt(imageToScreen(state.polygonPoints[0]));
  }
  ctx.restore();
}

function drawDetectedSegments() {
  if (!state.detectedSegments.length) return;

  ctx.save();
  ctx.strokeStyle = "rgba(100, 117, 217, 0.5)";
  ctx.fillStyle = "rgba(100, 117, 217, 0.42)";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 6]);

  for (const segment of state.detectedSegments) {
    const start = imageToScreen(segment.start);
    const end = imageToScreen(segment.end);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 2.4, 0, Math.PI * 2);
    ctx.arc(end.x, end.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([5, 6]);
  }

  ctx.restore();
}

function drawSelectionBox() {
  if (!state.selectionBox) return;

  const rect = normalizedRect(state.selectionBox.start, state.selectionBox.end);
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  if (width < 1 || height < 1) return;

  ctx.save();
  ctx.fillStyle = "rgba(37, 99, 235, 0.13)";
  ctx.strokeStyle = CANVAS_COLORS.selected;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.fillRect(rect.left, rect.top, width, height);
  ctx.strokeRect(rect.left, rect.top, width, height);
  ctx.restore();
}

function drawSnapPoint() {
  if (!state.snapPoint) return;

  drawSnapPointAt(state.snapPoint.screen);
}

function drawSnapPointAt(screen) {
  if (!screen) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
  ctx.strokeStyle = CANVAS_COLORS.selected;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.restore();
}

function drawOrthogonalGuide() {
  if (!state.orthogonalGuide) return;
  if (state.pendingPoint && state.previewPoint) return;
  if (state.isDrawingArea && state.polygonPoints.length && state.polygonPreviewPoint) return;

  const anchor = imageToScreen(state.orthogonalGuide.anchor);
  const point = imageToScreen(state.orthogonalGuide.point);

  ctx.save();
  ctx.strokeStyle = "rgba(119, 104, 200, 0.72)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(119, 104, 200, 0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(119, 104, 200, 0.88)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawAlignmentGuide() {
  if (!state.alignmentGuide) return;

  const lines = Array.isArray(state.alignmentGuide.lines)
    ? state.alignmentGuide.lines
    : [state.alignmentGuide];

  ctx.save();
  ctx.strokeStyle = "rgba(37, 99, 235, 0.42)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);

  for (const line of lines) {
    if (!line?.from || !line?.to) continue;
    const from = imageToScreen(line.from);
    const to = imageToScreen(line.to);
    if (
      state.pendingPoint &&
      state.previewPoint &&
      Math.hypot(from.x - imageToScreen(state.pendingPoint).x, from.y - imageToScreen(state.pendingPoint).y) < 1 &&
      Math.hypot(to.x - imageToScreen(state.previewPoint).x, to.y - imageToScreen(state.previewPoint).y) < 1
    ) {
      continue;
    }
    if (
      state.isDrawingArea &&
      state.polygonPoints.length &&
      state.polygonPreviewPoint &&
      Math.hypot(from.x - imageToScreen(state.polygonPoints.at(-1)).x, from.y - imageToScreen(state.polygonPoints.at(-1)).y) < 1 &&
      Math.hypot(to.x - imageToScreen(state.polygonPreviewPoint).x, to.y - imageToScreen(state.polygonPreviewPoint).y) < 1
    ) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  const target = state.alignmentGuide.target || lines.at(-1)?.to;
  if (target) {
    const targetScreen = imageToScreen(target);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(targetScreen.x, targetScreen.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(37, 99, 235, 0.62)";
    ctx.stroke();
  }

  ctx.restore();
}

function drawPendingPreview() {
  if (!state.pendingPoint || !state.previewPoint) return;

  const start = imageToScreen(state.pendingPoint);
  const end = imageToScreen(state.previewPoint);
  ctx.save();
  ctx.strokeStyle = state.orthogonalGuide ? "rgba(119, 104, 200, 0.78)" : "rgba(37, 99, 235, 0.72)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawRightAngleHints() {
  return;
  if (!state.rightAngleHints.length) return;

  ctx.save();
  ctx.strokeStyle = "rgba(119, 104, 200, 0.64)";
  ctx.lineWidth = 1.4;

  for (const hint of state.rightAngleHints) {
    if (!hint.ids.some((id) => state.selectedSegmentIds.has(id))) {
      continue;
    }

    const joint = imageToScreen(hint.joint);
    const vectorA = hint.vectorA;
    const vectorB = hint.vectorB;
    const lengthA = Math.hypot(vectorA.x, vectorA.y);
    const lengthB = Math.hypot(vectorB.x, vectorB.y);
    if (!lengthA || !lengthB) continue;

    const size = 16;
    const a = {
      x: joint.x + (vectorA.x / lengthA) * size,
      y: joint.y + (vectorA.y / lengthA) * size,
    };
    const b = {
      x: joint.x + (vectorB.x / lengthB) * size,
      y: joint.y + (vectorB.y / lengthB) * size,
    };
    const corner = {
      x: a.x + b.x - joint.x,
      y: a.y + b.y - joint.y,
    };

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHintPill(text, x, y) {
  ctx.save();
  ctx.font = "700 13px 'DM Sans', Inter, system-ui, sans-serif";
  const width = ctx.measureText(text).width + 22;
  const height = 30;
  roundedRectPath(ctx, x - width / 2, y - height / 2, width, height, height / 2);
  ctx.fillStyle = "rgba(32, 41, 54, 0.88)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawCanvasHints() {
  if (!state.image) {
    syncCanvasOverlays();
    return;
  }

  if (state.nextActionPromptVisible) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  if (!state.segments.length && !state.polygons.length && !state.detectedSegments.length && !state.isAnalyzing) {
    drawHintPill(isCoarsePointer() ? "Поставьте первую точку" : "Нажмите «Отрезок» и поставьте первую точку", rect.width / 2, rect.height / 2);
  }

  if (state.isChoosingBase && state.segments.length) {
    drawHintPill("Задайте масштаб", rect.width / 2, 42);
  }

  if (state.pendingPoint && state.previewPoint) {
    const preview = imageToScreen(state.previewPoint);
    drawHintPill(isCoarsePointer() ? "Вторая точка" : "Кликните вторую точку", preview.x, preview.y - 28);
  }

  if (state.isSpacePressed) {
    drawHintPill("Пробел: перемещение", 110, rect.height - 56);
  }

}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.save();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.restore();

  if (!state.image) {
    syncCanvasOverlays();
    return;
  }

  state.labelBounds = new Map();
  const rightAngles = computeRightAngleHints();
  state.rightAngleHints = rightAngles.hints;
  state.rightAngleIds = rightAngles.ids;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (state.backgroundVisible) {
    ctx.globalAlpha = state.backgroundOpacity;
    ctx.drawImage(
      state.image,
      state.offsetX,
      state.offsetY,
      state.image.width * state.scale,
      state.image.height * state.scale,
    );
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.fillRect(
      state.offsetX,
      state.offsetY,
      state.image.width * state.scale,
      state.image.height * state.scale,
    );
  }
  ctx.restore();

  if (state.isDrawingSegments || state.isDrawingArea) {
    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.035)";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.restore();
  }

  drawDetectedSegments();

  state.polygonLabelBounds = new Map();
  for (const polygon of state.polygons) {
    drawPolygon(polygon);
  }

  for (const segment of state.segments) {
    drawSegment(segment);
  }

  drawRightAngleHints();
  drawOrthogonalGuide();
  drawAlignmentGuide();
  drawPendingPreview();
  drawPendingPolygon();

  if (state.pendingPoint) {
    drawPoint(state.pendingPoint, CANVAS_COLORS.selected);
  }

  drawSelectionBox();
  drawSnapPoint();
  drawCanvasHints();
  syncCanvasOverlays();
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

function renameSegmentWithPrompt(segment) {
  const nextName = window.prompt("Название отрезка", segment.name);
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
  const base = state.referenceId ? "база выбрана" : "база не выбрана";
  const unit = state.unit.trim() || "без единицы";
  panelSummary.textContent = `${count} ${plural(count, "измерение", "измерения", "измерений")} · ${base} · ${unit}`;
}

function renderBaseSummary() {
  renderPanelSummary();

  const reference = state.segments.find((segment) => segment.id === state.referenceId);
  if (!reference) {
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
    ? `${formatDecimal(segmentLength(reference))} px · введите реальную длину`
    : `${formatLength(realValue)} · ${formatDecimal(segmentLength(reference))} px на изображении`;
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
    lines.push(`Площадь;${polygon.name};;${formatDecimal(area)}`);
  }
  return lines.join("\n");
}

function renderOutput() {
  if (!resultOutput) return;
  resultOutput.value = segmentsSummaryText();
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
  const baseState = !state.referenceId && !state.nextActionPromptVisible
    ? " · задайте масштаб"
    : state.referenceId && parseDecimal(state.referenceValue) === null
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
  if (!state.referenceId) {
    state.referenceId = id;
    state.referenceValue = "";
    referenceLengthInput.value = "";
    if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = "";
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

  state.segments = state.segments.filter((segment) => !idsToDelete.has(segment.id));
  if (state.segments.length || state.polygons.length) {
    state.footnotesVisible = visibleFootnoteCount() > 0;
  }
  if (idsToDelete.has(state.referenceId)) {
    state.referenceId = null;
    state.referenceValue = "";
    state.isEditingReferenceLength = false;
    referenceLengthInput.value = "";
    if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = "";
    state.isChoosingBase = state.segments.length > 0;
  }
  if (idsToDelete.has(state.pendingReferenceId)) {
    hideBaseConfirmation();
  }
  selectSegments(getSelectedIds().filter((id) => !idsToDelete.has(id)));
  updateAll();
  commitHistory();
}

function resetPlan() {
  if (!state.image && !state.segments.length && !state.polygons.length && !state.detectedSegments.length) return;
  const confirmed = window.confirm("Удалить изображение, все измерения и настройки?");
  if (!confirmed) return;

  analysisRunId++;
  const rememberedUnit = state.unit || "м";
  const rememberedUnitSystem = state.unitSystem || unitSystemForUnit(rememberedUnit);
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
  state.selectedSegmentIds = new Set();
  state.referenceValue = "";
  state.isEditingReferenceLength = false;
  state.unit = rememberedUnit;
  state.unitSystem = rememberedUnitSystem;
  state.footnotesVisible = true;
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
  historyState.undo = [];
  historyState.redo = [];
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

function shouldReplaceCurrentPlan() {
  if (!state.image || (!state.segments.length && !state.polygons.length && !state.detectedSegments.length)) {
    return true;
  }
  return window.confirm("Заменить изображение? Текущая разметка будет очищена.");
}

function loadImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Выберите файл изображения");
    return;
  }
  if (!shouldReplaceCurrentPlan()) {
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
        state.referenceValue = "";
        state.isEditingReferenceLength = false;
        referenceLengthInput.value = "";
        if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = "";
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

fitButton?.addEventListener("click", () => {
  fitImage();
  scheduleViewSave();
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
  const selectedIds = getSelectedIds();
  if (!selectedIds.length) {
    showToast("Выберите отрезок для удаления");
    return;
  }
  deleteSegments(selectedIds);
  showToast(selectedIds.length === 1 ? "Отрезок удалён" : `Удалено: ${selectedIds.length}`);
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
  state.referenceValue = referenceLengthInput.value;
  if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = state.referenceValue;
  updateAll();
});
referenceLengthInput.addEventListener("change", () => {
  state.referenceValue = referenceLengthInput.value;
  if (inlineReferenceLengthInput) inlineReferenceLengthInput.value = state.referenceValue;
  updateAll();
  commitHistory();
});

unitInput.addEventListener("input", () => {
  state.unit = unitInput.value;
  state.unitSystem = unitSystemForUnit(state.unit);
  if (inlineUnitInput) inlineUnitInput.value = state.unit;
  if (settingsUnitInput) settingsUnitInput.value = state.unit;
  updateAll();
});
unitInput.addEventListener("change", () => {
  state.unit = unitInput.value;
  state.unitSystem = unitSystemForUnit(state.unit);
  if (inlineUnitInput) inlineUnitInput.value = state.unit;
  if (settingsUnitInput) settingsUnitInput.value = state.unit;
  updateAll();
  commitHistory();
});

segmentsSortSelect.addEventListener("change", renderSegments);

settingsUnitInput?.addEventListener("change", () => {
  state.unit = settingsUnitInput.value;
  state.unitSystem = unitSystemForUnit(state.unit);
  setUnitInputValue(state.unit);
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
  state.unit = inlineUnitInput.value;
  state.unitSystem = unitSystemForUnit(state.unit);
  setUnitInputValue(state.unit);
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
  state.referenceValue = value;
  referenceLengthInput.value = value;
  state.unit = inlineUnitInput?.value || state.unit;
  state.unitSystem = unitSystemForUnit(state.unit);
  setUnitInputValue(state.unit);
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
    && !hitSegment;
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
    const selectedCount = state.selectedSegmentIds.size;
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
    state.offsetX -= deltaX;
    state.offsetY -= deltaY;
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

function isTextInputTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  );
}

window.addEventListener("keydown", (event) => {
  const isEditingText = isTextInputTarget(event.target);
  if (event.code === "Space" && !isEditingText && state.image) {
    state.isSpacePressed = true;
    updateToolControls();
    event.preventDefault();
    return;
  }

  if (event.key === "Escape") {
    if (!segmentContextMenu.hidden) {
      hideSegmentContextMenu();
      event.preventDefault();
      return;
    }
    if (!exportMenu.hidden) {
      setExportMenuOpen(false);
      event.preventDefault();
      return;
    }
    if (helpPopover && !helpPopover.hidden) {
      setHelpOpen(false);
      event.preventDefault();
      return;
    }
    if (settingsMenu && !settingsMenu.hidden) {
      setSettingsOpen(false);
      event.preventDefault();
      return;
    }
    if (state.pendingReferenceId) {
      hideBaseConfirmation();
      updateAll();
      event.preventDefault();
      return;
    }
    if (state.detectedSegments.length) {
      state.detectedSegments = [];
      updateAll();
      showToast("Найденные отрезки отменены");
      event.preventDefault();
      return;
    }
    if (!welcomeOverlay.hidden) {
      dismissWelcome();
      event.preventDefault();
      return;
    }
  }

  if (!welcomeOverlay.hidden) {
    return;
  }

  if (event.key === "Escape") {
    if (state.pendingPoint || state.isDrawingSegments || state.isDrawingArea || state.selectedSegmentIds.size) {
      cancelPendingLine();
      cancelPendingPolygon();
      state.selectionBox = null;
      state.isDrawingSegments = false;
      state.isDrawingArea = false;
      clearSelection();
      updateAll();
      saveSnapshotToStorage();
      event.preventDefault();
    }
    return;
  }

  if (!isEditingText && (event.metaKey || event.ctrlKey)) {
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoHistory();
      } else {
        undoHistory();
      }
      return;
    }
    if (key === "y") {
      event.preventDefault();
      redoHistory();
      return;
    }
  }

  if (isEditingText || (event.key !== "Delete" && event.key !== "Backspace")) {
    return;
  }

  const selectedIds = getSelectedIds();
  if (selectedIds.length) {
    event.preventDefault();
    deleteSegments(selectedIds);
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return;
  state.isSpacePressed = false;
  updateToolControls();
});

resizeCanvas();
initWelcome();
restoreSavedState();
