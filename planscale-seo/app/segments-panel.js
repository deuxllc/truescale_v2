(() => {
function renderSegmentsPanel({
  segmentsList,
  noSegments,
  segments,
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
  referenceId,
  isSegmentFootnoteVisible,
  setSegmentFootnoteVisible,
  setReferenceSegment,
  deleteSegment,
}) {
  segmentsList.innerHTML = "";
  noSegments.hidden = segments.length > 0;

  for (const segment of segments) {
    const card = document.createElement("article");
    card.className = "segment-card";
    if (isSegmentSelected(segment)) {
      card.classList.add("selected");
    }
    if (segment.id === referenceId) {
      card.classList.add("base");
    }
    card.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button, input, select, textarea")) {
        return;
      }
      if (handleSegmentPick(segment.id)) {
        return;
      }
      if (event.shiftKey) {
        toggleSegmentSelection(segment.id);
      } else {
        selectOnlySegment(segment.id);
      }
      updateAll();
    });

    const mainRow = document.createElement("div");
    mainRow.className = "segment-main-row";

    const nameInput = document.createElement("input");
    nameInput.className = "segment-name";
    nameInput.value = segment.name;
    nameInput.setAttribute("aria-label", "Название отрезка");
    nameInput.addEventListener("click", (event) => event.stopPropagation());
    nameInput.addEventListener("input", () => {
      segment.name = nameInput.value.trim() || `Отрезок ${segment.id}`;
      renderOutput();
      updateStatus();
      draw();
    });
    nameInput.addEventListener("change", () => {
      segment.name = nameInput.value.trim() || `Отрезок ${segment.id}`;
      updateAll();
      commitHistory();
    });

    const lengthValue = document.createElement("div");
    lengthValue.className = "segment-length";
    const calculatedLength = calculatedLengthFor(segment);
    lengthValue.textContent = formatLength(calculatedLength);
    lengthValue.title = calculatedLength === null
      ? "Введите базовый размер, чтобы получить расчетную длину"
      : "Расчетная длина";

    mainRow.append(nameInput, lengthValue);

    const metaRow = document.createElement("div");
    metaRow.className = "segment-meta-row";
    if (segment.id === referenceId) {
      const baseBadge = document.createElement("span");
      baseBadge.className = "segment-badge base-badge";
      baseBadge.textContent = "Базовый";
      metaRow.append(baseBadge);
    }

    const pixelBadge = document.createElement("span");
    pixelBadge.className = "segment-badge";
    pixelBadge.textContent = `${formatDecimal(segmentLength(segment))} px`;
    metaRow.append(pixelBadge);

    const angleBadge = document.createElement("span");
    angleBadge.className = "segment-badge";
    angleBadge.textContent = `${formatDecimal(segmentAngle(segment))}°`;
    metaRow.append(angleBadge);

    const actionsRow = document.createElement("div");
    actionsRow.className = "segment-actions-row";

    const referenceButton = document.createElement("button");
    referenceButton.className = "reference-button segment-action-chip";
    referenceButton.type = "button";
    referenceButton.textContent = segment.id === referenceId
      ? "База"
      : referenceId
        ? "Сделать базой"
        : "Выбрать базой";
    referenceButton.disabled = segment.id === referenceId;
    referenceButton.setAttribute(
      "aria-label",
      segment.id === referenceId
        ? `${segment.name}: базовый отрезок`
        : `Сделать ${segment.name} базовым`,
    );
    referenceButton.title = segment.id === referenceId
      ? "Этот отрезок сейчас базовый"
      : "Сделать этот отрезок базовым";
    referenceButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setReferenceSegment(segment.id);
    });

    const footnoteVisible = isSegmentFootnoteVisible(segment);
    const footnoteButton = document.createElement("button");
    footnoteButton.className = "footnote-button segment-icon-action";
    footnoteButton.type = "button";
    footnoteButton.innerHTML = `<svg class="button-icon" aria-hidden="true"><use href="#icon-footnote"></use></svg>`;
    footnoteButton.classList.toggle("active", footnoteVisible);
    footnoteButton.setAttribute("aria-pressed", String(footnoteVisible));
    footnoteButton.setAttribute(
      "aria-label",
      footnoteVisible
        ? `Скрыть сноску ${segment.name}`
        : `Показать сноску ${segment.name}`,
    );
    footnoteButton.title = footnoteVisible
      ? "Скрыть сноску этого отрезка"
      : "Показать сноску этого отрезка";
    footnoteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setSegmentFootnoteVisible(segment.id, !footnoteVisible);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button segment-icon-action";
    deleteButton.type = "button";
    deleteButton.innerHTML = `<svg class="button-icon" aria-hidden="true"><use href="#icon-trash"></use></svg>`;
    deleteButton.setAttribute("aria-label", `Удалить ${segment.name}`);
    deleteButton.title = "Удалить отрезок";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSegment(segment.id);
    });

    actionsRow.append(referenceButton, footnoteButton, deleteButton);
    card.append(mainRow, metaRow, actionsRow);

    if (isSegmentSelected(segment)) {
      const details = document.createElement("div");
      details.className = "segment-details";
      details.textContent = `Начало: ${formatDecimal(segment.start.x)}, ${formatDecimal(segment.start.y)} · Конец: ${formatDecimal(segment.end.x)}, ${formatDecimal(segment.end.y)}`;
      card.append(details);
    }

    segmentsList.append(card);
  }
}

window.PlanScaleSegmentsPanel = {
  renderSegmentsPanel,
};
})();
