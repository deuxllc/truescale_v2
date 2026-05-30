(() => {
  function createCanvasRenderer({
    state,
    canvas,
    ctx,
    view,
    colors,
    helpers,
  }) {
    const {
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
    } = helpers;

    function drawPoint(point, color, radius = 5) {
      const screen = view.imageToScreen(point);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fffdfa";
      ctx.stroke();
    }

    function drawHandle(point, color, radius = 5) {
      const screen = view.imageToScreen(point);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#fffdfa";
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    function footnoteFontSize(baseSize) {
      const delta = state.footnoteSize === "large" ? 2 : state.footnoteSize === "compact" ? -1 : 0;
      return Math.max(9, baseSize + delta);
    }

    function drawSegment(segment) {
      const start = view.imageToScreen(segment.start);
      const end = view.imageToScreen(segment.end);
      const isReference = segment.id === state.referenceId;
      const isSelected = isSegmentSelected(segment);
      const isHovered = state.hoveredSegmentId === segment.id;
      const isAngleAligned = state.rightAngleIds.has(segment.id) || isGridAlignedSegment(segment);
      const handleColor = isSelected
        ? colors.selected
        : isReference
          ? colors.reference
          : isAngleAligned
            ? colors.angle
            : colors.normal;

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineWidth = isSelected ? 6 : isReference ? 4.5 : isHovered ? 4 : 3;
      ctx.strokeStyle = isSelected
        ? colors.selected
        : isReference
          ? colors.reference
          : isAngleAligned
            ? colors.angle
            : colors.normal;
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
      const labelFontSize = footnoteFontSize(state.scale > 3 ? 9 : 11);
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
      ctx.strokeStyle = isSelected ? colors.selected : colors.leader;
      ctx.stroke();

      const labelOpacity = state.scale < 0.45 ? 0.42 : 0.96;
      ctx.fillStyle = `rgba(255, 255, 255, ${labelOpacity})`;
      ctx.strokeStyle = isSelected ? colors.selected : isReference ? colors.reference : "rgba(79, 97, 120, 0.34)";
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
      const center = view.imageToScreen(polygonCentroid(polygon));
      const labelFontSize = footnoteFontSize(state.scale > 3 ? 10 : 12);
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
      ctx.strokeStyle = colors.area;
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

      const isSelected = isPolygonSelected(polygon);
      ctx.save();
      ctx.beginPath();
      for (let index = 0; index < polygon.points.length; index++) {
        const point = view.imageToScreen(polygon.points[index]);
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = isSelected ? "rgba(37, 99, 235, 0.1)" : colors.areaFill;
      ctx.strokeStyle = isSelected ? colors.selected : colors.area;
      ctx.lineWidth = isSelected ? 3 : 2.2;
      ctx.fill();
      ctx.stroke();

      for (const point of polygon.points) {
        drawHandle(point, isSelected ? colors.selected : colors.area, isSelected ? 5.8 : 4.8);
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
      ctx.strokeStyle = state.orthogonalGuide
        ? colors.angle
        : state.polygonCloseTarget
          ? colors.area
          : "rgba(15, 143, 115, 0.58)";
      ctx.fillStyle = "rgba(15, 143, 115, 0.08)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      points.forEach((point, index) => {
        const screen = view.imageToScreen(point);
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
        drawHandle(point, colors.area, 5);
      }
      if (state.polygonCloseTarget) {
        drawSnapPointAt(view.imageToScreen(state.polygonPoints[0]));
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
        const start = view.imageToScreen(segment.start);
        const end = view.imageToScreen(segment.end);
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
      ctx.strokeStyle = colors.selected;
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
      ctx.strokeStyle = colors.selected;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }

    function drawOrthogonalGuide() {
      if (!state.orthogonalGuide) return;
      if (state.pendingPoint && state.previewPoint) return;
      if (state.isDrawingArea && state.polygonPoints.length && state.polygonPreviewPoint) return;

      const anchor = view.imageToScreen(state.orthogonalGuide.anchor);
      const point = view.imageToScreen(state.orthogonalGuide.point);

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
        const from = view.imageToScreen(line.from);
        const to = view.imageToScreen(line.to);
        if (
          state.pendingPoint &&
          state.previewPoint &&
          Math.hypot(from.x - view.imageToScreen(state.pendingPoint).x, from.y - view.imageToScreen(state.pendingPoint).y) < 1 &&
          Math.hypot(to.x - view.imageToScreen(state.previewPoint).x, to.y - view.imageToScreen(state.previewPoint).y) < 1
        ) {
          continue;
        }
        if (
          state.isDrawingArea &&
          state.polygonPoints.length &&
          state.polygonPreviewPoint &&
          Math.hypot(from.x - view.imageToScreen(state.polygonPoints.at(-1)).x, from.y - view.imageToScreen(state.polygonPoints.at(-1)).y) < 1 &&
          Math.hypot(to.x - view.imageToScreen(state.polygonPreviewPoint).x, to.y - view.imageToScreen(state.polygonPreviewPoint).y) < 1
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
        const targetScreen = view.imageToScreen(target);
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

      const start = view.imageToScreen(state.pendingPoint);
      const end = view.imageToScreen(state.previewPoint);
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
        const preview = view.imageToScreen(state.previewPoint);
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

      drawOrthogonalGuide();
      drawAlignmentGuide();
      drawPendingPreview();
      drawPendingPolygon();

      if (state.pendingPoint) {
        drawPoint(state.pendingPoint, colors.selected);
      }

      drawSelectionBox();
      drawSnapPoint();
      drawCanvasHints();
      syncCanvasOverlays();
    }

    return {
      draw,
    };
  }

  window.PlanScaleCanvasRenderer = {
    createCanvasRenderer,
  };
})();
