(() => {
  function createSelectionController({
    state,
    hitTesting,
  }) {
    function isSegmentSelected(segment) {
      return state.selectedSegmentIds.has(segment.id);
    }

    function isPolygonSelected(polygon) {
      return state.selectedPolygonIds.has(polygon.id);
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

    function getSelectedIds() {
      return [...state.selectedSegmentIds];
    }

    function getSelectedPolygonIds() {
      return [...state.selectedPolygonIds];
    }

    function segmentIdsInsideSelectionBox() {
      return hitTesting.segmentIdsInsideSelectionBox();
    }

    function polygonIdsInsideSelectionBox() {
      return hitTesting.polygonIdsInsideSelectionBox();
    }

    return {
      clearSelection,
      getSelectedIds,
      getSelectedPolygonIds,
      isPolygonSelected,
      isSegmentSelected,
      polygonIdsInsideSelectionBox,
      segmentIdsInsideSelectionBox,
      selectOnlyPolygon,
      selectOnlySegment,
      selectPolygons,
      selectSegments,
      toggleSegmentSelection,
    };
  }

  window.PlanScaleSelection = {
    createSelectionController,
  };
})();
