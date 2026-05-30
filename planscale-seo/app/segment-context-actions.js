(() => {
  function createSegmentContextActions({
    canvas,
    state,
    menu,
    actions,
  }) {
    const {
      commitHistory,
      deleteSegment,
      findLabelAt,
      findSegmentAt,
      requestDialog,
      selectOnlySegment,
      setReferenceSegment,
      updateAll,
    } = actions;
    let activeSegmentId = null;

    function hide() {
      menu.hidden = true;
      activeSegmentId = null;
    }

    function show(segment, clientX, clientY) {
      activeSegmentId = segment.id;
      selectOnlySegment(segment.id);
      updateAll();
      menu.hidden = false;
      const menuRect = menu.getBoundingClientRect();
      const left = Math.min(clientX, window.innerWidth - menuRect.width - 10);
      const top = Math.min(clientY, window.innerHeight - menuRect.height - 10);
      menu.style.left = `${Math.max(10, left)}px`;
      menu.style.top = `${Math.max(10, top)}px`;
    }

    async function rename(segment) {
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

    function segmentAtEvent(event) {
      return findLabelAt(event.clientX, event.clientY) || findSegmentAt(event.clientX, event.clientY);
    }

    canvas.addEventListener("dblclick", (event) => {
      if (!state.image) return;
      const segment = segmentAtEvent(event);
      if (!segment) return;
      event.preventDefault();
      rename(segment);
    });

    canvas.addEventListener("contextmenu", (event) => {
      if (!state.image) return;
      const segment = segmentAtEvent(event);
      if (!segment) return;
      event.preventDefault();
      show(segment, event.clientX, event.clientY);
    });

    menu.addEventListener("click", (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest("button[data-action]") : null;
      if (!button) return;
      const segment = state.segments.find((item) => item.id === activeSegmentId);
      if (!segment) {
        hide();
        return;
      }

      const action = button.dataset.action;
      hide();
      if (action === "base") {
        setReferenceSegment(segment.id);
      } else if (action === "rename") {
        rename(segment);
      } else if (action === "delete") {
        deleteSegment(segment.id);
      }
    });

    return {
      hide,
      rename,
      show,
    };
  }

  window.PlanScaleSegmentContextActions = {
    createSegmentContextActions,
  };
})();
