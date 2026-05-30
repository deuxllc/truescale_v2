(() => {
  function createHistoryController({
    snapshotState,
    applySnapshot,
    saveSnapshotToStorage,
    updateHistoryButtons,
  }) {
    const stacks = {
      undo: [],
      redo: [],
      restoring: false,
    };

    function replace({ undo = stacks.undo, redo = stacks.redo } = {}) {
      stacks.undo = undo;
      stacks.redo = redo;
    }

    function clear() {
      replace({ undo: [], redo: [] });
    }

    async function runRestoring(callback) {
      stacks.restoring = true;
      try {
        return await callback();
      } finally {
        stacks.restoring = false;
      }
    }

    function commit() {
      if (stacks.restoring) return;

      const snapshot = snapshotState();
      const previous = stacks.undo[stacks.undo.length - 1];
      const serialized = JSON.stringify(snapshot);
      if (!previous || JSON.stringify(previous) !== serialized) {
        stacks.undo.push(snapshot);
        stacks.redo = [];
      }
      saveSnapshotToStorage(snapshot);
      updateHistoryButtons();
    }

    async function undo() {
      if (stacks.undo.length <= 1) return;
      const current = stacks.undo.pop();
      stacks.redo.push(current);
      await applySnapshot(stacks.undo[stacks.undo.length - 1]);
      saveSnapshotToStorage();
      updateHistoryButtons();
    }

    async function redo() {
      const snapshot = stacks.redo.pop();
      if (!snapshot) return;
      stacks.undo.push(snapshot);
      await applySnapshot(snapshot);
      saveSnapshotToStorage();
      updateHistoryButtons();
    }

    return {
      get undoLength() {
        return stacks.undo.length;
      },
      get redoLength() {
        return stacks.redo.length;
      },
      replace,
      clear,
      runRestoring,
      commit,
      undo,
      redo,
    };
  }

  window.PlanScaleHistory = {
    createHistoryController,
  };
})();
