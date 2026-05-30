(() => {
  function isTextInputTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    );
  }

  function createKeyboardController({
    state,
    dom,
    actions,
  }) {
    const {
      exportMenu,
      helpPopover,
      segmentContextMenu,
      settingsMenu,
      welcomeOverlay,
    } = dom;

    const {
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
    } = actions;

    function handleKeydown(event) {
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
        if (state.pendingPoint || state.isDrawingSegments || state.isDrawingArea || state.selectedSegmentIds.size || state.selectedPolygonIds.size) {
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

      if (state.selectedSegmentIds.size || state.selectedPolygonIds.size) {
        event.preventDefault();
        deleteSelectedObjects();
      }
    }

    function handleKeyup(event) {
      if (event.code !== "Space") return;
      state.isSpacePressed = false;
      updateToolControls();
    }

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("keyup", handleKeyup);

    return {
      destroy() {
        window.removeEventListener("keydown", handleKeydown);
        window.removeEventListener("keyup", handleKeyup);
      },
    };
  }

  window.PlanScaleKeyboard = {
    createKeyboardController,
  };
})();
