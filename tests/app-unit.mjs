import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = vm.createContext({
  window: {},
  console,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
});
context.globalThis = context;

for (const file of [
  "planscale-seo/app/geometry.js",
  "planscale-seo/app/app-utils.js",
  "planscale-seo/app/measurement.js",
  "planscale-seo/app/app-state.js",
  "planscale-seo/app/app-history.js",
  "planscale-seo/app/project-format.js",
  "planscale-seo/app/canvas-hit-testing.js",
  "planscale-seo/app/app-selection.js",
  "planscale-seo/app/canvas-drag-interactions.js",
  "planscale-seo/app/canvas-pointer-down.js",
  "planscale-seo/app/canvas-pointer-up.js",
  "planscale-seo/app/canvas-pointer-cleanup.js",
  "planscale-seo/app/canvas-pinch-zoom.js",
  "planscale-seo/app/pointer-tracker.js",
  "planscale-seo/app/canvas-gesture-state.js",
]) {
  vm.runInContext(await readFile(file, "utf8"), context, { filename: file });
}

const geometry = context.window.PlanScaleGeometry;
const utils = context.window.PlanScaleUtils;
const measurement = context.window.PlanScaleMeasurement;
const appState = context.window.PlanScaleState;
const appHistory = context.window.PlanScaleHistory;
const projectFormat = context.window.PlanScaleProjectFormat;
const hitTesting = context.window.PlanScaleCanvasHitTesting;
const selectionFactory = context.window.PlanScaleSelection;
const dragInteractionsFactory = context.window.PlanScaleCanvasDragInteractions;
const pointerDownFactory = context.window.PlanScaleCanvasPointerDown;
const pointerUpFactory = context.window.PlanScaleCanvasPointerUp;
const pointerCleanupFactory = context.window.PlanScaleCanvasPointerCleanup;
const pinchZoomFactory = context.window.PlanScaleCanvasPinchZoom;
const pointerTracking = context.window.PlanScalePointerTracker;
const gestureStateFactory = context.window.PlanScaleCanvasGestureState;

assert.equal(utils.parseDecimal("12,5"), 12.5);
assert.equal(utils.parseDecimal(" 1 200.25 "), 1200.25);
assert.equal(utils.parseDecimal("0"), null);

assert.equal(measurement.displayValueToMeters("500", "см"), 5);
assert.equal(measurement.displayValueToMeters("5000", "мм"), 5);
assert.equal(measurement.displayValueToMeters("0,005", "км"), 5);
assert.equal(measurement.displayValueToMeters("196,8503937007874", "in"), 5);
assert.equal(Number(measurement.metersToDisplayValue(5, "ft").toFixed(6)), 16.404199);
assert.equal(measurement.formatDisplayInput(500), "500");
assert.equal(measurement.formatDisplayInput(16.4041994751, 6), "16,404199");

const base = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
const double = { start: { x: 0, y: 0 }, end: { x: 200, y: 0 } };
assert.equal(geometry.segmentLength(base), 100);
assert.equal(measurement.segmentLengthMeters(double, 100, 5, geometry.segmentLength), 10);
assert.equal(measurement.segmentLengthDisplay(double, 100, 5, "см", geometry.segmentLength), 1000);

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
function polygonAreaPx(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

assert.equal(measurement.polygonAreaSquareMeters(square, 100, 5, polygonAreaPx), 25);
assert.equal(measurement.polygonAreaDisplay(square, 100, 5, "см", polygonAreaPx), 250000);

const encoded = utils.encodeBase64Json({ ok: true, unit: "м" });
assert.equal(JSON.stringify(utils.decodeBase64Json(encoded)), JSON.stringify({ ok: true, unit: "м" }));

const project = projectFormat.createProjectPayload({
  state: {
    imageSrc: "data:image/png;base64,AA==",
    imageName: "plan.png",
    segments: [{ id: 1, name: "Base", start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }],
    polygons: [],
    referenceId: 1,
    referencePixelLength: 100,
    referenceValue: "5",
    unit: "м",
    unitSystem: "metric",
    backgroundVisible: true,
    backgroundOpacity: 1,
    previousBackgroundOpacity: 1,
    footnotesVisible: true,
    measurementPrecision: 3,
    footnoteSize: "normal",
    showUnitsInFootnotes: true,
    smartGridEnabled: true,
    detectionSensitivity: 15,
    workflowMode: "manual",
    scale: 1,
    homeScale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  cloneSegment: utils.cloneSegment,
  clonePolygon: utils.clonePolygon,
  parseDecimal: utils.parseDecimal,
  getReferenceLength: () => 100,
  currentReferenceValueMeters: () => 5,
});
assert.equal(project.version, 1);
assert.equal(project.reference.valueMeters, 5);
assert.equal(project.segments[0].name, "Base");

const snapshot = projectFormat.snapshotFromProjectPayload(project, {
  cloneSegment: utils.cloneSegment,
  clonePolygon: utils.clonePolygon,
  unitSystemForUnit: measurement.unitSystemForUnit,
  defaultDetectionSensitivity: 15,
});
assert.equal(snapshot.referenceValueMeters, 5);
assert.equal(snapshot.segments.length, 1);

const initialState = appState.createAppState({
  unit: "см",
  unitSystem: "metric",
  detectionSensitivity: 50,
});
assert.equal(initialState.unit, "см");
assert.equal(initialState.detectionSensitivity, 50);
assert.equal(initialState.segments.length, 0);
assert.equal(initialState.selectedSegmentIds.size, 0);

let currentSnapshot = { version: 1 };
let savedSnapshot = null;
let updateCount = 0;
const appliedSnapshots = [];
const history = appHistory.createHistoryController({
  snapshotState: () => currentSnapshot,
  applySnapshot: async (snapshot) => {
    appliedSnapshots.push(snapshot);
    currentSnapshot = snapshot;
  },
  saveSnapshotToStorage: (snapshot = currentSnapshot) => {
    savedSnapshot = snapshot;
  },
  updateHistoryButtons: () => {
    updateCount++;
  },
});

history.commit();
currentSnapshot = { version: 2 };
history.commit();
assert.equal(history.undoLength, 2);
assert.equal(history.redoLength, 0);
await history.undo();
assert.equal(currentSnapshot.version, 1);
assert.equal(history.undoLength, 1);
assert.equal(history.redoLength, 1);
await history.redo();
assert.equal(currentSnapshot.version, 2);
assert.equal(history.undoLength, 2);
assert.equal(history.redoLength, 0);
await history.runRestoring(async () => {
  currentSnapshot = { version: 3 };
  history.commit();
});
assert.equal(history.undoLength, 2);
assert.equal(savedSnapshot.version, 2);
assert.ok(updateCount >= 4);
assert.equal(appliedSnapshots.length, 2);

const hitState = {
  segments: [
    { id: 1, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
    { id: 2, start: { x: 30, y: -20 }, end: { x: 30, y: 20 } },
  ],
  polygons: [
    {
      id: 10,
      points: [
        { x: 200, y: 200 },
        { x: 260, y: 200 },
        { x: 260, y: 260 },
        { x: 200, y: 260 },
      ],
    },
  ],
  selectedSegmentIds: new Set([1]),
  labelBounds: new Map([[1, { left: 45, top: -10, right: 65, bottom: 10 }]]),
  polygonLabelBounds: new Map([[10, { left: 210, top: 210, right: 230, bottom: 230 }]]),
  selectionBox: { start: { x: -10, y: -10 }, end: { x: 40, y: 10 } },
};
const identityView = {
  imageToScreen: (point) => point,
  screenPointFromClient: (clientX, clientY) => ({ x: clientX, y: clientY }),
};
const hit = hitTesting.createCanvasHitTesting({
  state: hitState,
  view: identityView,
  touchEndpointHitRadius: 28,
  helpers: {
    distanceToSegment: geometry.distanceToSegment,
    isCoarsePointer: () => false,
    lineSegmentsIntersect: utils.lineSegmentsIntersect,
    normalizedRect: utils.normalizedRect,
    pointInsideRect: geometry.pointInsideRect,
  },
});
assert.equal(hit.findEndpointAt(0, 0)?.endpoint, "start");
assert.equal(hit.resolveHit(50, 0).label?.id, 1);
assert.equal(hit.findSegmentAt(30, 17)?.id, 2);
assert.equal(hit.resolveHit(220, 220).polygonLabel?.id, 10);
assert.equal(hit.findPolygonAt(250, 250)?.id, 10);
assert.deepEqual(hit.segmentIdsInsideSelectionBox(), [1, 2]);
hitState.selectionBox = { start: { x: 205, y: 205 }, end: { x: 255, y: 255 } };
assert.deepEqual(hit.polygonIdsInsideSelectionBox(), [10]);

const selectionState = {
  selectedSegmentIds: new Set(),
  selectedPolygonIds: new Set(),
};
const selection = selectionFactory.createSelectionController({
  state: selectionState,
  hitTesting: {
    segmentIdsInsideSelectionBox: () => [1, 2],
    polygonIdsInsideSelectionBox: () => [10],
  },
});
const selectedSegments = () => Array.from(selection.getSelectedIds());
const selectedPolygons = () => Array.from(selection.getSelectedPolygonIds());
selection.selectOnlySegment(3);
assert.deepEqual(selectedSegments(), [3]);
assert.deepEqual(selectedPolygons(), []);
assert.equal(selection.isSegmentSelected({ id: 3 }), true);
selection.toggleSegmentSelection(4);
assert.deepEqual(selectedSegments().sort((a, b) => a - b), [3, 4]);
selection.toggleSegmentSelection(3);
assert.deepEqual(selectedSegments(), [4]);
selection.selectOnlyPolygon(8);
assert.deepEqual(selectedSegments(), []);
assert.deepEqual(selectedPolygons(), [8]);
assert.equal(selection.isPolygonSelected({ id: 8 }), true);
selection.selectSegments(selection.segmentIdsInsideSelectionBox());
selection.selectPolygons(selection.polygonIdsInsideSelectionBox());
assert.deepEqual(selectedSegments(), [1, 2]);
assert.deepEqual(selectedPolygons(), [10]);
selection.clearSelection();
assert.deepEqual(selectedSegments(), []);
assert.deepEqual(selectedPolygons(), []);

const dragSegment = {
  id: 1,
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
};
let dragDraws = 0;
let dragLongPressClears = 0;
let dragMarks = 0;
const dragState = {
  interactionMode: "endpoint",
  dragStart: {
    x: 0,
    y: 0,
    screen: { x: 0, y: 0 },
    endpoint: { segment: dragSegment, endpoint: "start" },
  },
  scale: 1,
  snapPoint: null,
  orthogonalGuide: null,
  alignmentGuide: null,
};
const dragInteractions = dragInteractionsFactory.createCanvasDragInteractions({
  state: dragState,
  view: identityView,
  actions: {
    adjustedEndpointDragPoint: (event) => ({ x: event.clientX, y: event.clientY }),
    clampPointToImage: (point) => point,
    clearLongPressTimer: () => {
      dragLongPressClears++;
    },
    draw: () => {
      dragDraws++;
    },
    markDragged: () => {
      dragMarks++;
    },
    polygonIdsInsideSelectionBox: () => [10],
    resolveEndpointPoint: (point) => ({
      point,
      snap: { x: point.x, y: point.y },
      guide: { axis: "horizontal" },
      alignmentGuide: { axis: "vertical" },
    }),
    resolvePolygonPoint: (point) => ({
      point,
      close: false,
      snap: null,
      guide: null,
      alignmentGuide: null,
    }),
    screenToImage: (clientX, clientY) => ({ x: clientX, y: clientY }),
    segmentIdsInsideSelectionBox: () => [1, 2],
    selectPolygons: (ids) => {
      dragState.selectedPolygons = Array.from(ids);
    },
    selectSegments: (ids) => {
      dragState.selectedSegments = Array.from(ids);
    },
  },
});
assert.equal(dragInteractions.handlePointerMove({ clientX: 20, clientY: 5 }), true);
assert.deepEqual(dragSegment.start, { x: 20, y: 5 });
assert.equal(dragLongPressClears, 1);
assert.equal(dragMarks, 1);
assert.equal(dragDraws, 2);
assert.equal(dragState.orthogonalGuide.axis, "horizontal");

dragState.interactionMode = "select";
dragState.dragStart = { x: 0, y: 0, screen: { x: -1, y: -1 } };
assert.equal(dragInteractions.handlePointerMove({ clientX: 8, clientY: 0 }), true);
assert.equal(dragState.selectionBox.start.x, -1);
assert.equal(dragState.selectionBox.end.x, 8);
assert.deepEqual(dragState.selectedSegments, [1, 2]);
assert.deepEqual(dragState.selectedPolygons, [10]);

function createPointerDownHarness(stateOverrides = {}, hit = {}) {
  const calls = [];
  const state = {
    image: true,
    isDrawingSegments: false,
    isDrawingArea: false,
    isChoosingBase: false,
    isSpacePressed: false,
    pendingPoint: null,
    interactionMode: null,
    snapPoint: { x: 1, y: 1 },
    orthogonalGuide: { axis: "horizontal" },
    alignmentGuide: { axis: "vertical" },
    selectionBox: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
    ...stateOverrides,
  };
  const controller = pointerDownFactory.createCanvasPointerDownController({
    state,
    pointerTracker: {
      activeCount: () => state.activePointers || 0,
    },
    hitTesting: {
      resolveHit: () => hit,
    },
    actions: {
      beginDrag: (event, dragStart = {}) => {
        calls.push(["beginDrag", dragStart]);
      },
      clonePoint: (point) => ({ x: point.x, y: point.y }),
      clampPointToImage: (point) => point,
      currentLabelOffset: () => ({ x: 11, y: -22 }),
      resolvePolygonPoint: (point) => ({
        point,
        close: true,
        snap: { x: point.x, y: point.y },
        guide: { axis: "horizontal" },
        alignmentGuide: { axis: "vertical" },
      }),
      resolveStartPoint: (point) => ({
        point,
        snap: { x: point.x, y: point.y },
      }),
      scheduleTouchContextMenu: (segment) => {
        calls.push(["scheduleTouchContextMenu", segment?.id ?? null]);
      },
      screenToImage: (clientX, clientY) => ({ x: clientX, y: clientY }),
      selectOnlyPolygon: (id) => {
        calls.push(["selectOnlyPolygon", id]);
      },
      selectOnlySegment: (id) => {
        calls.push(["selectOnlySegment", id]);
      },
      setPointerCapture: (pointerId) => {
        calls.push(["setPointerCapture", pointerId]);
      },
      startPinchGesture: () => {
        calls.push(["startPinchGesture"]);
      },
      toggleSegmentSelection: (id) => {
        calls.push(["toggleSegmentSelection", id]);
      },
      updateAll: () => {
        calls.push(["updateAll"]);
      },
      updatePointerFromEvent: () => {
        calls.push(["updatePointerFromEvent"]);
      },
    },
  });
  return { calls, controller, state };
}

const pinchHarness = createPointerDownHarness({ activePointers: 2 });
let pinchPrevented = false;
assert.equal(pinchHarness.controller.handlePointerDown({
  pointerId: 1,
  pointerType: "touch",
  clientX: 10,
  clientY: 20,
  preventDefault: () => {
    pinchPrevented = true;
  },
}), true);
assert.equal(pinchPrevented, true);
assert.equal(pinchHarness.calls.some((call) => call[0] === "startPinchGesture"), true);

const drawAreaHarness = createPointerDownHarness({ isDrawingArea: true });
let drawAreaPrevented = false;
assert.equal(drawAreaHarness.controller.handlePointerDown({
  pointerId: 2,
  pointerType: "mouse",
  clientX: 12,
  clientY: 24,
  preventDefault: () => {
    drawAreaPrevented = true;
  },
}), true);
assert.equal(drawAreaPrevented, true);
assert.equal(drawAreaHarness.state.interactionMode, "draw-area");
assert.equal(drawAreaHarness.state.polygonPreviewPoint.x, 12);
assert.equal(drawAreaHarness.state.snapPoint.y, 24);

const labelHit = { label: { id: 5 }, segment: null };
const labelHarness = createPointerDownHarness({}, labelHit);
assert.equal(labelHarness.controller.handlePointerDown({
  pointerId: 3,
  pointerType: "mouse",
  button: 0,
  clientX: 1,
  clientY: 2,
  shiftKey: false,
}), true);
assert.equal(labelHarness.state.interactionMode, "label");
assert.deepEqual(labelHarness.calls.find((call) => call[0] === "selectOnlySegment"), ["selectOnlySegment", 5]);
assert.equal(labelHarness.calls.some((call) => call[0] === "scheduleTouchContextMenu" && call[1] === 5), true);

const basePickHit = { segment: { id: 9 } };
const basePickHarness = createPointerDownHarness({ isChoosingBase: true }, basePickHit);
basePickHarness.controller.handlePointerDown({
  pointerId: 4,
  pointerType: "touch",
  button: 0,
  clientX: 1,
  clientY: 2,
});
assert.equal(basePickHarness.state.interactionMode, "base-pick");
assert.deepEqual(basePickHarness.calls.find((call) => call[0] === "selectOnlySegment"), ["selectOnlySegment", 9]);

function createPointerUpHarness(stateOverrides = {}, hit = {}, hasPinch = false) {
  const calls = [];
  const state = {
    image: true,
    didDrag: false,
    interactionMode: null,
    dragStart: null,
    isDrawingSegments: false,
    isDrawingArea: false,
    pendingPoint: null,
    selectionBox: null,
    selectedSegmentIds: new Set(),
    selectedPolygonIds: new Set(),
    ...stateOverrides,
  };
  const controller = pointerUpFactory.createCanvasPointerUpController({
    state,
    pointerTracker: {
      hasPinch: () => hasPinch,
    },
    hitTesting: {
      resolveHit: () => hit,
    },
    actions: {
      addPoint: (point) => {
        calls.push(["addPoint", point.x, point.y]);
      },
      addPolygonPoint: (point) => {
        calls.push(["addPolygonPoint", point.x, point.y]);
      },
      clampPointToImage: (point) => point,
      clearLongPressTimer: () => {
        calls.push(["clearLongPressTimer"]);
      },
      commitHistory: () => {
        calls.push(["commitHistory"]);
      },
      consumeTouchContextMenuOpened: () => Boolean(state.consumeTouchContextMenuOpened),
      draw: () => {
        calls.push(["draw"]);
      },
      endDrag: () => {
        calls.push(["endDrag"]);
      },
      handleSegmentPick: (id, options) => {
        calls.push(["handleSegmentPick", id, Boolean(options.requireConfirmation)]);
        return Boolean(state.segmentPickHandled);
      },
      now: () => 123,
      releasePointerCapture: (pointerId) => {
        calls.push(["releasePointerCapture", pointerId]);
      },
      removePointerFromEvent: () => {
        calls.push(["removePointerFromEvent"]);
      },
      resetTransient: () => {
        calls.push(["resetTransient"]);
      },
      resolvePolygonPoint: (point) => ({ point }),
      resolveStartPoint: (point) => ({ point: { x: point.x + 1, y: point.y + 1 } }),
      scheduleViewSave: () => {
        calls.push(["scheduleViewSave"]);
      },
      screenToImage: (clientX, clientY) => ({ x: clientX, y: clientY }),
      selectOnlyPolygon: (id) => {
        calls.push(["selectOnlyPolygon", id]);
      },
      selectOnlySegment: (id) => {
        calls.push(["selectOnlySegment", id]);
      },
      showToast: (message) => {
        calls.push(["showToast", message]);
      },
      toggleSegmentSelection: (id) => {
        calls.push(["toggleSegmentSelection", id]);
      },
      updateAll: () => {
        calls.push(["updateAll"]);
      },
    },
  });
  return { calls, controller, state };
}

const pinchUpHarness = createPointerUpHarness({ interactionMode: "pinch" }, {}, true);
assert.equal(pinchUpHarness.controller.handlePointerUp({ pointerId: 1, pointerType: "touch" }), true);
assert.equal(pinchUpHarness.state.lastPointerUpAt, 123);
assert.equal(pinchUpHarness.calls.some((call) => call[0] === "resetTransient"), true);
assert.equal(pinchUpHarness.calls.some((call) => call[0] === "scheduleViewSave"), true);

const addPointHarness = createPointerUpHarness({
  isDrawingSegments: true,
  interactionMode: "draw-line",
});
addPointHarness.controller.handlePointerUp({
  pointerId: 2,
  pointerType: "mouse",
  clientX: 20,
  clientY: 30,
});
assert.deepEqual(addPointHarness.calls.find((call) => call[0] === "addPoint"), ["addPoint", 21, 31]);
assert.equal(addPointHarness.calls.some((call) => call[0] === "endDrag"), true);

const dragCommitHarness = createPointerUpHarness({
  didDrag: true,
  interactionMode: "endpoint",
});
dragCommitHarness.controller.handlePointerUp({ pointerId: 3, pointerType: "mouse" });
assert.equal(dragCommitHarness.calls.some((call) => call[0] === "updateAll"), true);
assert.equal(dragCommitHarness.calls.some((call) => call[0] === "commitHistory"), true);

const selectionBoxHarness = createPointerUpHarness({
  didDrag: true,
  interactionMode: "select",
  selectionBox: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
  selectedSegmentIds: new Set([1, 2]),
  selectedPolygonIds: new Set([10]),
});
selectionBoxHarness.controller.handlePointerUp({ pointerId: 4, pointerType: "mouse" });
assert.equal(selectionBoxHarness.state.selectionBox, null);
assert.equal(selectionBoxHarness.state.pendingPoint, null);
assert.deepEqual(selectionBoxHarness.calls.find((call) => call[0] === "showToast"), ["showToast", "Выбрано: 3"]);

const removedCanvasClasses = [];
const cleanupState = {
  isDragging: false,
  interactionMode: null,
  hoveredSegmentId: 2,
  polygonPreviewPoint: { x: 1, y: 1 },
  polygonCloseTarget: { x: 2, y: 2 },
  previewPoint: { x: 3, y: 3 },
  orthogonalGuide: { axis: "horizontal" },
  alignmentGuide: { axis: "vertical" },
};
let cleanupDraws = 0;
let hiddenCoordinates = 0;
let cleanupLongPressClears = 0;
let cleanupPointerRemovals = 0;
let cleanupTransientResets = 0;
const pointerCleanup = pointerCleanupFactory.createCanvasPointerCleanup({
  canvas: {
    classList: {
      remove: (className) => removedCanvasClasses.push(className),
    },
  },
  state: cleanupState,
  pointerTracker: {
    activeCount: () => 0,
  },
  gestureState: {
    clearLongPressTimer: () => {
      cleanupLongPressClears++;
    },
    removePointerFromEvent: () => {
      cleanupPointerRemovals++;
    },
    resetTransient: () => {
      cleanupTransientResets++;
    },
  },
  actions: {
    draw: () => {
      cleanupDraws++;
    },
    hideCursorCoordinates: () => {
      hiddenCoordinates++;
    },
  },
});
pointerCleanup.handlePointerLeave();
assert.equal(hiddenCoordinates, 1);
assert.equal(cleanupDraws, 1);
assert.equal(cleanupState.hoveredSegmentId, null);
assert.equal(cleanupState.previewPoint, null);
assert.equal(cleanupState.polygonPreviewPoint, null);
assert.deepEqual(removedCanvasClasses, ["hovering-segment"]);
pointerCleanup.handlePointerCancel({ pointerId: 7 });
assert.equal(cleanupLongPressClears, 1);
assert.equal(cleanupPointerRemovals, 1);
assert.equal(cleanupTransientResets, 1);
assert.equal(cleanupDraws, 2);

const pinchCalls = [];
const pinchZoom = pinchZoomFactory.createCanvasPinchZoom({
  pointerTracker: {
    hasPinch: () => true,
    activeCount: () => 2,
    pairMetrics: () => ({
      center: { x: 50, y: 60 },
      distance: 40,
    }),
    currentPinchDistance: () => 20,
    updatePinchDistance: (distance) => {
      pinchCalls.push(["updatePinchDistance", distance]);
    },
  },
  actions: {
    draw: () => {
      pinchCalls.push(["draw"]);
    },
    scheduleViewSave: () => {
      pinchCalls.push(["scheduleViewSave"]);
    },
    zoomAtClientPoint: (x, y, factor) => {
      pinchCalls.push(["zoomAtClientPoint", x, y, factor]);
    },
  },
});
let pinchMovePrevented = false;
assert.equal(pinchZoom.handlePointerMove({
  pointerType: "touch",
  preventDefault: () => {
    pinchMovePrevented = true;
  },
}), true);
assert.equal(pinchMovePrevented, true);
assert.deepEqual(pinchCalls[0], ["zoomAtClientPoint", 50, 60, 2]);
assert.deepEqual(pinchCalls[1], ["updatePinchDistance", 40]);
assert.deepEqual(pinchCalls.slice(2), [["draw"], ["scheduleViewSave"]]);

const gestureTestState = {
  isDragging: false,
  dragStart: null,
  didDrag: false,
  interactionMode: null,
  selectionBox: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  snapPoint: { x: 1, y: 1 },
  previewPoint: { x: 2, y: 2 },
  orthogonalGuide: { axis: "horizontal" },
  alignmentGuide: { axis: "vertical" },
  polygonPreviewPoint: { x: 3, y: 3 },
  polygonCloseTarget: { x: 4, y: 4 },
  offsetX: 7,
  offsetY: 9,
};
const canvasClasses = new Set();
const fakeCanvas = {
  classList: {
    add: (className) => canvasClasses.add(className),
    remove: (className) => canvasClasses.delete(className),
  },
  setPointerCapture: () => {},
  hasPointerCapture: () => false,
  releasePointerCapture: () => {},
};
const gesture = gestureStateFactory.createCanvasGestureState({
  canvas: fakeCanvas,
  state: gestureTestState,
  view: identityView,
  pointerTracker: pointerTracking.createPointerTracker(),
  touchLongPressMs: 1,
  actions: {
    selectOnlySegment: () => {},
    showSegmentContextMenu: () => {},
    updateAll: () => {},
  },
});
gesture.beginDrag({ clientX: 12, clientY: 18 }, { custom: true });
assert.equal(gestureTestState.isDragging, true);
assert.equal(gestureTestState.didDrag, false);
assert.equal(gestureTestState.dragStart.custom, true);
assert.deepEqual(gestureTestState.dragStart.screen, { x: 12, y: 18 });
assert.equal(canvasClasses.has("dragging"), true);
gesture.markDragged();
assert.equal(gestureTestState.didDrag, true);
gesture.endDrag();
assert.equal(gestureTestState.isDragging, false);
assert.equal(gestureTestState.dragStart, null);
assert.equal(gestureTestState.interactionMode, null);
assert.equal(gestureTestState.didDrag, true);
assert.equal(canvasClasses.has("dragging"), false);
gesture.resetTransient("pinch");
assert.equal(gestureTestState.interactionMode, "pinch");
assert.equal(gestureTestState.selectionBox, null);
assert.equal(gestureTestState.polygonCloseTarget, null);

console.log("app-unit tests passed");
