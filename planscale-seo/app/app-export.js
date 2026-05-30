(() => {
  const {
    bytesToBase64,
    encodeBase64Json,
    escapeXml,
    parseDecimal,
    rectsIntersect,
    roundedRectPath,
    segmentAngle,
    textDataUrl,
  } = window.PlanScaleUtils;

  function createExportController({
    state,
    dom,
    colors,
    helpers,
  }) {
    const {
      exportStatus,
      exportMenu,
      exportMenuButton,
    } = dom;
    const {
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
    } = helpers;

    function colorForSegment(segment) {
      if (segment.id === state.referenceId) return colors.reference;
      if (state.rightAngleIds.has(segment.id) || isGridAlignedSegment(segment)) return colors.angle;
      return colors.normal;
    }

    function exportLabelOffset(segment, labelWidth, labelHeight, usedBounds, viewScale) {
      const midpoint = {
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
      };

      if (segment.labelOffset) {
        return {
          x: segment.labelOffset.x / viewScale,
          y: segment.labelOffset.y / viewScale,
        };
      }

      const candidates = [
        { x: 0, y: -36 / viewScale },
        { x: 0, y: 36 / viewScale },
        { x: 48 / viewScale, y: -36 / viewScale },
        { x: -48 / viewScale, y: -36 / viewScale },
        { x: 48 / viewScale, y: 36 / viewScale },
        { x: -48 / viewScale, y: 36 / viewScale },
        { x: 0, y: -66 / viewScale },
        { x: 0, y: 66 / viewScale },
      ];

      for (const offset of candidates) {
        const rect = {
          left: midpoint.x + offset.x - labelWidth / 2,
          top: midpoint.y + offset.y - labelHeight / 2,
          right: midpoint.x + offset.x + labelWidth / 2,
          bottom: midpoint.y + offset.y + labelHeight / 2,
        };
        if (!usedBounds.some((existing) => rectsIntersect(rect, existing, 5 / viewScale))) {
          return offset;
        }
      }

      return candidates[0];
    }

    function createExportLayout(viewScale) {
      const usedBounds = [];
      const labelLayouts = [];
      let bounds = {
        left: 0,
        top: 0,
        right: state.image.width,
        bottom: state.image.height,
      };

      for (const segment of state.segments) {
        bounds.left = Math.min(bounds.left, segment.start.x, segment.end.x);
        bounds.top = Math.min(bounds.top, segment.start.y, segment.end.y);
        bounds.right = Math.max(bounds.right, segment.start.x, segment.end.x);
        bounds.bottom = Math.max(bounds.bottom, segment.start.y, segment.end.y);
      }

      for (const polygon of state.polygons || []) {
        for (const point of polygon.points || []) {
          bounds.left = Math.min(bounds.left, point.x);
          bounds.top = Math.min(bounds.top, point.y);
          bounds.right = Math.max(bounds.right, point.x);
          bounds.bottom = Math.max(bounds.bottom, point.y);
        }
      }

      const measureCanvas = document.createElement("canvas");
      const measureContext = measureCanvas.getContext("2d");
      const fontSize = Math.max(9, 10 / viewScale);
      const horizontalPadding = 9 / viewScale;
      const labelHeight = 15 / viewScale;
      measureContext.font = `400 ${fontSize}px Inter, system-ui, sans-serif`;

      for (const segment of state.segments) {
        if (!isSegmentFootnoteVisible(segment)) continue;

        const midpoint = {
          x: (segment.start.x + segment.end.x) / 2,
          y: (segment.start.y + segment.end.y) / 2,
        };
        const label = labelTextFor(segment);
        const labelWidth = measureContext.measureText(label).width + horizontalPadding;
        const offset = exportLabelOffset(segment, labelWidth, labelHeight, usedBounds, viewScale);
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
        usedBounds.push(labelRect);
        labelLayouts.push({ segment, label, labelRect, labelCenter, labelWidth, labelHeight, fontSize });

        bounds.left = Math.min(bounds.left, labelRect.left);
        bounds.top = Math.min(bounds.top, labelRect.top);
        bounds.right = Math.max(bounds.right, labelRect.right);
        bounds.bottom = Math.max(bounds.bottom, labelRect.bottom);
      }

      const polygonLabelLayouts = [];
      for (const polygon of state.polygons || []) {
        if (!isPolygonFootnoteVisible(polygon)) continue;
        const label = areaLabelTextFor(polygon);
        const center = polygonCentroid(polygon);
        const labelWidth = measureContext.measureText(label).width + horizontalPadding * 1.4;
        const labelHeightForPolygon = Math.max(labelHeight, 18 / viewScale);
        const labelRect = {
          left: center.x - labelWidth / 2,
          top: center.y - labelHeightForPolygon / 2,
          right: center.x + labelWidth / 2,
          bottom: center.y + labelHeightForPolygon / 2,
        };
        usedBounds.push(labelRect);
        polygonLabelLayouts.push({ polygon, label, labelRect, labelCenter: center, labelWidth, labelHeight: labelHeightForPolygon, fontSize });
        bounds.left = Math.min(bounds.left, labelRect.left);
        bounds.top = Math.min(bounds.top, labelRect.top);
        bounds.right = Math.max(bounds.right, labelRect.right);
        bounds.bottom = Math.max(bounds.bottom, labelRect.bottom);
      }

      const margin = Math.max(18, 22 / viewScale);
      bounds.left -= margin;
      bounds.top -= margin;
      bounds.right += margin;
      bounds.bottom += margin;

      return {
        bounds,
        labelLayouts,
        polygonLabelLayouts,
        width: Math.ceil(bounds.right - bounds.left),
        height: Math.ceil(bounds.bottom - bounds.top),
        offsetX: -bounds.left,
        offsetY: -bounds.top,
      };
    }

    function renderExportCanvas({ withBackground, whiteBackground = false }) {
      if (!state.image) return null;

      const viewScale = Math.max(state.scale, 0.001);
      const layout = createExportLayout(viewScale);
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = layout.width;
      exportCanvas.height = layout.height;
      const exportContext = exportCanvas.getContext("2d");

      exportContext.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
      if (whiteBackground) {
        exportContext.fillStyle = "#ffffff";
        exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      }
      if (withBackground) {
        exportContext.save();
        exportContext.globalAlpha = state.backgroundOpacity;
        exportContext.drawImage(state.image, layout.offsetX, layout.offsetY);
        exportContext.restore();
      }

      exportContext.lineCap = "round";
      exportContext.lineJoin = "round";

      for (const polygon of state.polygons || []) {
        if (!polygon.points?.length) continue;
        exportContext.beginPath();
        polygon.points.forEach((point, index) => {
          const x = point.x + layout.offsetX;
          const y = point.y + layout.offsetY;
          if (index === 0) exportContext.moveTo(x, y);
          else exportContext.lineTo(x, y);
        });
        exportContext.closePath();
        exportContext.fillStyle = colors.areaFill || "rgba(15, 143, 115, 0.13)";
        exportContext.strokeStyle = colors.area || "#0f8f73";
        exportContext.lineWidth = Math.max(1.4, 2.2 / viewScale);
        exportContext.fill();
        exportContext.stroke();
      }

      for (const segment of state.segments) {
        const segmentColor = colorForSegment(segment);
        exportContext.beginPath();
        exportContext.moveTo(segment.start.x + layout.offsetX, segment.start.y + layout.offsetY);
        exportContext.lineTo(segment.end.x + layout.offsetX, segment.end.y + layout.offsetY);
        exportContext.strokeStyle = segmentColor;
        exportContext.lineWidth = Math.max(2, 3 / viewScale);
        exportContext.stroke();
      }

      for (const layoutItem of layout.labelLayouts) {
        const { segment, label, labelWidth, labelHeight, fontSize } = layoutItem;
        const segmentColor = colorForSegment(segment);
        const midpoint = {
          x: (segment.start.x + segment.end.x) / 2 + layout.offsetX,
          y: (segment.start.y + segment.end.y) / 2 + layout.offsetY,
        };
        exportContext.font = `400 ${fontSize}px Inter, system-ui, sans-serif`;
        const labelRect = {
          left: layoutItem.labelRect.left + layout.offsetX,
          top: layoutItem.labelRect.top + layout.offsetY,
          right: layoutItem.labelRect.right + layout.offsetX,
          bottom: layoutItem.labelRect.bottom + layout.offsetY,
        };
        const labelCenter = {
          x: layoutItem.labelCenter.x + layout.offsetX,
          y: layoutItem.labelCenter.y + layout.offsetY,
        };

        const leaderEnd = nearestPointOnRect(midpoint, labelRect);
        exportContext.beginPath();
        exportContext.moveTo(midpoint.x, midpoint.y);
        exportContext.lineTo(leaderEnd.x, leaderEnd.y);
        exportContext.strokeStyle = "rgba(79, 97, 120, 0.64)";
        exportContext.lineWidth = Math.max(0.8, 1 / viewScale);
        exportContext.stroke();

        const radius = 5 / viewScale;
        roundedRectPath(exportContext, labelRect.left, labelRect.top, labelWidth, labelHeight, radius);
        exportContext.fillStyle = "rgba(255, 255, 255, 0.88)";
        exportContext.strokeStyle = segmentColor;
        exportContext.lineWidth = Math.max(0.8, 1 / viewScale);
        exportContext.fill();
        exportContext.stroke();

        exportContext.fillStyle = "#202936";
        exportContext.textAlign = "center";
        exportContext.textBaseline = "middle";
        exportContext.fillText(label, labelCenter.x, labelCenter.y);
      }

      for (const layoutItem of layout.polygonLabelLayouts || []) {
        const { label, labelWidth, labelHeight, fontSize } = layoutItem;
        const labelRect = {
          left: layoutItem.labelRect.left + layout.offsetX,
          top: layoutItem.labelRect.top + layout.offsetY,
        };
        const labelCenter = {
          x: layoutItem.labelCenter.x + layout.offsetX,
          y: layoutItem.labelCenter.y + layout.offsetY,
        };

        exportContext.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
        roundedRectPath(exportContext, labelRect.left, labelRect.top, labelWidth, labelHeight, labelHeight / 2);
        exportContext.fillStyle = "rgba(255, 255, 255, 0.9)";
        exportContext.strokeStyle = colors.area || "#0f8f73";
        exportContext.lineWidth = Math.max(0.8, 1 / viewScale);
        exportContext.fill();
        exportContext.stroke();
        exportContext.fillStyle = "#173f35";
        exportContext.textAlign = "center";
        exportContext.textBaseline = "middle";
        exportContext.fillText(label, labelCenter.x, labelCenter.y);
      }

      return exportCanvas;
    }

    function showExportLink(dataUrl, filename) {
      exportStatus.innerHTML = "";
      exportStatus.hidden = false;

      const title = document.createElement("strong");
      title.textContent = `Экспорт готов: ${filename}`;

      const downloadLink = document.createElement("a");
      downloadLink.href = dataUrl;
      downloadLink.download = filename;
      downloadLink.textContent = "Скачать";

      const openLink = document.createElement("a");
      openLink.href = dataUrl;
      openLink.target = "_blank";
      openLink.rel = "noopener";
      openLink.textContent = "Открыть";

      exportStatus.append(title, downloadLink, openLink);
      showToast("Экспорт готов");

      window.setTimeout(() => {
        try {
          downloadLink.click();
        } catch {
          // The visible link remains available if the browser blocks automatic download.
        }
      }, 0);
    }

    function setExportMenuOpen(open) {
      exportMenu.hidden = !open;
      exportMenuButton.setAttribute("aria-expanded", String(open));
    }

    function toggleExportMenu() {
      setExportMenuOpen(exportMenu.hidden);
    }

    function safeExportName(extension, withBackground) {
      const base = (state.imageName || "image")
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9а-яё_-]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        || "image";
      return `${base}-${withBackground ? "with-image" : "measurements"}.${extension}`;
    }

    async function exportPng(withBackground) {
      setExportMenuOpen(false);
      if (!withBackground && !state.segments.length && !(state.polygons || []).length) {
        showToast("Сначала добавьте измерения");
        return;
      }
      const exportCanvas = renderExportCanvas({ withBackground });
      if (!exportCanvas) {
        showToast("Сначала загрузите изображение");
        return;
      }

      showExportLink(exportCanvas.toDataURL("image/png"), safeExportName("png", withBackground));
    }

    function makePdfFromJpeg(jpegBytes, width, height) {
      const encoder = new TextEncoder();
      const chunks = [];
      const offsets = [0];
      let position = 0;

      function addText(text) {
        const bytes = encoder.encode(text);
        chunks.push(bytes);
        position += bytes.length;
      }

      function addBytes(bytes) {
        chunks.push(bytes);
        position += bytes.length;
      }

      function object(id, body) {
        offsets[id] = position;
        addText(`${id} 0 obj\n${body}\nendobj\n`);
      }

      addText("%PDF-1.4\n");
      object(1, "<< /Type /Catalog /Pages 2 0 R >>");
      object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
      object(
        3,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
      );

      offsets[4] = position;
      addText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
      addBytes(jpegBytes);
      addText("\nendstream\nendobj\n");

      const drawCommand = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
      object(5, `<< /Length ${drawCommand.length} >>\nstream\n${drawCommand}endstream`);

      const xrefStart = position;
      addText(`xref\n0 6\n0000000000 65535 f \n`);
      for (let i = 1; i <= 5; i++) {
        addText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
      }
      addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

      const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const result = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }

    async function exportPdf(withBackground) {
      setExportMenuOpen(false);
      if (!withBackground && !state.segments.length && !(state.polygons || []).length) {
        showToast("Сначала добавьте измерения");
        return;
      }
      const exportCanvas = renderExportCanvas({ withBackground, whiteBackground: true });
      if (!exportCanvas) {
        showToast("Сначала загрузите изображение");
        return;
      }

      const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.94);
      const jpegBytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (char) => char.charCodeAt(0));
      const pdfBytes = makePdfFromJpeg(jpegBytes, exportCanvas.width, exportCanvas.height);
      const pdfDataUrl = `data:application/pdf;base64,${bytesToBase64(pdfBytes)}`;
      showExportLink(pdfDataUrl, safeExportName("pdf", withBackground));
    }

    function dataExportName(extension) {
      return safeExportName(extension, false);
    }

    function projectExportName() {
      const base = safeExportName("json", false).replace(/\.json$/, "");
      return `${base}-project.truescale.json`;
    }

    function escapeCsvCell(value) {
      const raw = String(value ?? "");
      const safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    }

    function segmentExportRows() {
      return state.segments.map((segment) => {
        const calculated = calculatedLengthFor(segment);
        const calculatedMeters = calculatedLengthMetersFor(segment);
        return {
          id: segment.id,
          name: segment.name,
          isBase: segment.id === state.referenceId,
          footnoteVisible: isSegmentFootnoteVisible(segment),
          lengthPx: Number(segmentLength(segment).toFixed(3)),
          calculatedLength: calculated === null ? null : Number(calculated.toFixed(3)),
          calculatedLengthMeters: calculatedMeters === null ? null : Number(calculatedMeters.toFixed(6)),
          unit: state.unit.trim(),
          angle: segmentAngle(segment),
          startX: Number(segment.start.x.toFixed(3)),
          startY: Number(segment.start.y.toFixed(3)),
          endX: Number(segment.end.x.toFixed(3)),
          endY: Number(segment.end.y.toFixed(3)),
        };
      });
    }

    function polygonExportRows() {
      return (state.polygons || []).map((polygon) => ({
        id: polygon.id,
        name: polygon.name,
        footnoteVisible: isPolygonFootnoteVisible(polygon),
        area: polygonAreaFor(polygon),
        areaSquareMeters: polygonAreaSquareMetersFor(polygon),
        unit: state.unit.trim(),
        points: polygon.points.map((point) => ({
          x: Number(point.x.toFixed(3)),
          y: Number(point.y.toFixed(3)),
        })),
      }));
    }

    function basePixelLength() {
      const reference = state.segments.find((segment) => segment.id === state.referenceId);
      if (reference) return Number(segmentLength(reference).toFixed(3));
      return typeof state.referencePixelLength === "number" && state.referencePixelLength > 0
        ? Number(state.referencePixelLength.toFixed(3))
        : null;
    }

    function exportCsv() {
      setExportMenuOpen(false);
      if (!state.segments.length && !(state.polygons || []).length) {
        showToast("Сначала добавьте измерения");
        return;
      }

      const header = "type;id;name;is_base;footnote_visible;length_px;calculated_length;calculated_length_meters;area;area_square_meters;unit;angle;start_x;start_y;end_x;end_y;points";
      const lines = segmentExportRows().map((row) => [
        "line",
        row.id,
        escapeCsvCell(row.name),
        row.isBase ? "yes" : "no",
        row.footnoteVisible ? "yes" : "no",
        row.lengthPx,
        row.calculatedLength ?? "",
        row.calculatedLengthMeters ?? "",
        "",
        "",
        row.unit,
        row.angle,
        row.startX,
        row.startY,
        row.endX,
        row.endY,
        "",
      ].join(";"));
      for (const row of polygonExportRows()) {
        lines.push([
          "area",
          row.id,
          `"${String(row.name).replace(/"/g, '""')}"`,
          "no",
          row.footnoteVisible ? "yes" : "no",
          "",
          "",
          "",
          row.area === null ? "" : Number(row.area.toFixed(3)),
          row.areaSquareMeters === null ? "" : Number(row.areaSquareMeters.toFixed(6)),
          row.unit ? `${row.unit}2` : "",
          "",
          "",
          "",
          "",
          "",
          escapeCsvCell(JSON.stringify(row.points)),
        ].join(";"));
      }
      showExportLink(textDataUrl("text/csv", [header, ...lines].join("\n")), dataExportName("csv"));
    }

    function exportJson() {
      setExportMenuOpen(false);
      if (!state.segments.length && !(state.polygons || []).length) {
        showToast("Сначала добавьте измерения");
        return;
      }

      const payload = {
        app: "TrueScale",
        imageName: state.imageName,
        baseSegmentId: state.referenceId,
        basePixelLength: basePixelLength(),
        baseValue: parseDecimal(state.referenceValue),
        baseValueMeters: state.referenceValueMeters ?? null,
        unit: state.unit.trim(),
        unitSystem: state.unitSystem,
        footnotesVisible: state.footnotesVisible,
        measurementPrecision: state.measurementPrecision,
        footnoteSize: state.footnoteSize,
        showUnitsInFootnotes: state.showUnitsInFootnotes,
        segments: segmentExportRows(),
        polygons: polygonExportRows(),
      };
      showExportLink(textDataUrl("application/json", JSON.stringify(payload, null, 2)), dataExportName("json"));
    }

    function exportProject() {
      setExportMenuOpen(false);
      const payload = createProjectPayload?.();
      if (!payload) {
        showToast("Сначала загрузите изображение или добавьте измерения");
        return;
      }
      showExportLink(
        textDataUrl("application/json", JSON.stringify(payload, null, 2)),
        projectExportName(),
      );
    }

    async function copyShareLink() {
      setExportMenuOpen(false);
      if (!state.segments.length && !(state.polygons || []).length) {
        showToast("Сначала добавьте измерения");
        return;
      }

      const payload = {
        baseSegmentId: state.referenceId,
        basePixelLength: basePixelLength(),
        baseValue: parseDecimal(state.referenceValue),
        baseValueMeters: state.referenceValueMeters ?? null,
        unit: state.unit.trim(),
        unitSystem: state.unitSystem,
        footnotesVisible: state.footnotesVisible,
        measurementPrecision: state.measurementPrecision,
        footnoteSize: state.footnoteSize,
        showUnitsInFootnotes: state.showUnitsInFootnotes,
        segments: segmentExportRows(),
        polygons: polygonExportRows(),
      };
      const link = `${window.location.origin}${window.location.pathname}${window.location.search}#state=${encodeBase64Json(payload)}`;
      window.history.replaceState(null, "", link);

      try {
        await navigator.clipboard.writeText(link);
        showToast("Ссылка скопирована");
      } catch {
        showToast("Ссылка добавлена в адресную строку");
      }
    }

    function createSvgMarkup() {
      const viewScale = Math.max(state.scale, 0.001);
      const layout = createExportLayout(viewScale);
      const lines = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
        `<rect width="100%" height="100%" fill="white"/>`,
        `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`,
      ];

      for (const polygon of state.polygons || []) {
        if (!polygon.points?.length) continue;
        const path = polygon.points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${(point.x + layout.offsetX).toFixed(2)} ${(point.y + layout.offsetY).toFixed(2)}`)
          .join(" ");
        lines.push(`<path d="${path} Z" fill="${colors.areaFill || "rgba(15, 143, 115, 0.13)"}" stroke="${colors.area || "#0f8f73"}" stroke-width="${Math.max(1.4, 2.2 / viewScale).toFixed(2)}"/>`);
      }

      for (const segment of state.segments) {
        const color = colorForSegment(segment);
        lines.push(
          `<line x1="${(segment.start.x + layout.offsetX).toFixed(2)}" y1="${(segment.start.y + layout.offsetY).toFixed(2)}" x2="${(segment.end.x + layout.offsetX).toFixed(2)}" y2="${(segment.end.y + layout.offsetY).toFixed(2)}" stroke="${color}" stroke-width="${Math.max(2, 3 / viewScale).toFixed(2)}"/>`,
        );
      }

      lines.push(`</g>`);
      lines.push(`<g font-family="Inter, Arial, sans-serif" font-weight="500">`);

      for (const layoutItem of layout.labelLayouts) {
        const { segment, label, labelWidth, labelHeight, fontSize } = layoutItem;
        const color = colorForSegment(segment);
        const labelRect = {
          left: layoutItem.labelRect.left + layout.offsetX,
          top: layoutItem.labelRect.top + layout.offsetY,
        };
        const labelCenter = {
          x: layoutItem.labelCenter.x + layout.offsetX,
          y: layoutItem.labelCenter.y + layout.offsetY,
        };
        const midpoint = {
          x: (segment.start.x + segment.end.x) / 2 + layout.offsetX,
          y: (segment.start.y + segment.end.y) / 2 + layout.offsetY,
        };
        const leaderEnd = nearestPointOnRect(midpoint, {
          left: labelRect.left,
          top: labelRect.top,
          right: labelRect.left + labelWidth,
          bottom: labelRect.top + labelHeight,
        });
        lines.push(`<line x1="${midpoint.x.toFixed(2)}" y1="${midpoint.y.toFixed(2)}" x2="${leaderEnd.x.toFixed(2)}" y2="${leaderEnd.y.toFixed(2)}" stroke="${color}" stroke-width="${Math.max(0.8, 1 / viewScale).toFixed(2)}" opacity="0.7"/>`);
        lines.push(`<rect x="${labelRect.left.toFixed(2)}" y="${labelRect.top.toFixed(2)}" width="${labelWidth.toFixed(2)}" height="${labelHeight.toFixed(2)}" rx="${(labelHeight / 2).toFixed(2)}" fill="#fffdf8" stroke="${color}" stroke-width="${Math.max(0.8, 1 / viewScale).toFixed(2)}"/>`);
        lines.push(`<rect x="${labelRect.left.toFixed(2)}" y="${labelRect.top.toFixed(2)}" width="${Math.max(3, 3 / viewScale).toFixed(2)}" height="${labelHeight.toFixed(2)}" rx="${(labelHeight / 2).toFixed(2)}" fill="${color}"/>`);
        lines.push(`<text x="${labelCenter.x.toFixed(2)}" y="${labelCenter.y.toFixed(2)}" font-size="${fontSize.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#25231f">${escapeXml(label)}</text>`);
      }

      for (const layoutItem of layout.polygonLabelLayouts || []) {
        const { label, labelWidth, labelHeight, fontSize } = layoutItem;
        const labelRect = {
          left: layoutItem.labelRect.left + layout.offsetX,
          top: layoutItem.labelRect.top + layout.offsetY,
        };
        const labelCenter = {
          x: layoutItem.labelCenter.x + layout.offsetX,
          y: layoutItem.labelCenter.y + layout.offsetY,
        };
        lines.push(`<rect x="${labelRect.left.toFixed(2)}" y="${labelRect.top.toFixed(2)}" width="${labelWidth.toFixed(2)}" height="${labelHeight.toFixed(2)}" rx="${(labelHeight / 2).toFixed(2)}" fill="#fffdf8" stroke="${colors.area || "#0f8f73"}" stroke-width="${Math.max(0.8, 1 / viewScale).toFixed(2)}"/>`);
        lines.push(`<text x="${labelCenter.x.toFixed(2)}" y="${labelCenter.y.toFixed(2)}" font-size="${fontSize.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#173f35">${escapeXml(label)}</text>`);
      }

      lines.push(`</g>`);
      lines.push(`</svg>`);
      return lines.join("\n");
    }

    function exportSvg() {
      setExportMenuOpen(false);
      if (!state.image || (!state.segments.length && !(state.polygons || []).length)) {
        showToast("Сначала добавьте измерения");
        return;
      }
      showExportLink(textDataUrl("image/svg+xml", createSvgMarkup()), dataExportName("svg"));
    }

    return {
      setExportMenuOpen,
      toggleExportMenu,
      exportPng,
      exportPdf,
      exportCsv,
      exportJson,
      exportProject,
      copyShareLink,
      exportSvg,
    };
  }

  window.PlanScaleExport = { createExportController };
})();
