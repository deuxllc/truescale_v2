((global) => {
  const config = global.PlanScaleConfig || {};
  const DETECTION_SENSITIVITY_MIN = config.DETECTION_SENSITIVITY_MIN ?? 15;
  const DETECTION_SENSITIVITY_MAX = config.DETECTION_SENSITIVITY_MAX ?? 100;
  const DEFAULT_DETECTION_SENSITIVITY = config.DEFAULT_DETECTION_SENSITIVITY ?? DETECTION_SENSITIVITY_MIN;

  function normalizeDetectionSensitivity(value) {
    if (value === "clear") return DETECTION_SENSITIVITY_MIN;
    if (value === "balanced") return 50;
    if (value === "detailed") return 85;
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Math.min(DETECTION_SENSITIVITY_MAX, Math.max(DETECTION_SENSITIVITY_MIN, numeric))
      : DEFAULT_DETECTION_SENSITIVITY;
  }

  function detectionSensitivityProgress(value) {
    const range = Math.max(1, DETECTION_SENSITIVITY_MAX - DETECTION_SENSITIVITY_MIN);
    return (normalizeDetectionSensitivity(value) - DETECTION_SENSITIVITY_MIN) / range;
  }

  function detectionProfile(value) {
    const t = detectionSensitivityProgress(value);
    const strictness = (1 - t) ** 2;
    return {
      minRunRatio: 0.02 + strictness * 0.28,
      axisToleranceRatio: 0.001 + t * 0.01,
      maxThicknessRatio: 0.004 + t * 0.06,
    };
  }

  function segmentLength(segment) {
    return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function otsuThreshold(grayscale) {
    const histogram = new Array(256).fill(0);
    for (const value of grayscale) histogram[value]++;

    const total = grayscale.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumBackground = 0;
    let weightBackground = 0;
    let maxVariance = 0;
    let threshold = 128;

    for (let i = 0; i < 256; i++) {
      weightBackground += histogram[i];
      if (!weightBackground) continue;

      const weightForeground = total - weightBackground;
      if (!weightForeground) break;

      sumBackground += i * histogram[i];
      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sum - sumBackground) / weightForeground;
      const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }

    return Math.min(200, Math.max(70, threshold));
  }

  function collectRuns(binary, width, height, horizontal, minRun) {
    const runs = [];
    const primarySize = horizontal ? height : width;
    const secondarySize = horizontal ? width : height;

    for (let primary = 0; primary < primarySize; primary++) {
      let secondary = 0;
      while (secondary < secondarySize) {
        while (secondary < secondarySize) {
          const index = horizontal ? primary * width + secondary : secondary * width + primary;
          if (binary[index]) break;
          secondary++;
        }

        const start = secondary;
        while (secondary < secondarySize) {
          const index = horizontal ? primary * width + secondary : secondary * width + primary;
          if (!binary[index]) break;
          secondary++;
        }

        const end = secondary - 1;
        if (end - start + 1 >= minRun) {
          runs.push({ start, end, axis: primary });
        }
      }
    }

    return runs;
  }

  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart) + 1);
  }

  function mergeRuns(runs, axisTolerance) {
    const groups = [];

    for (const run of runs) {
      let bestGroup = null;
      let bestOverlap = 0;
      const runLength = run.end - run.start + 1;

      for (const group of groups) {
        if (run.axis > group.maxAxis + axisTolerance) continue;
        if (run.axis < group.minAxis - axisTolerance) continue;

        const groupStart = median(group.starts);
        const groupEnd = median(group.ends);
        const groupLength = groupEnd - groupStart + 1;
        const overlap = rangesOverlap(run.start, run.end, groupStart, groupEnd);
        const overlapRatio = overlap / Math.min(runLength, groupLength);

        if (overlapRatio > 0.45 && overlap > bestOverlap) {
          bestGroup = group;
          bestOverlap = overlap;
        }
      }

      if (!bestGroup) {
        groups.push({
          minAxis: run.axis,
          maxAxis: run.axis,
          starts: [run.start],
          ends: [run.end],
        });
        continue;
      }

      bestGroup.minAxis = Math.min(bestGroup.minAxis, run.axis);
      bestGroup.maxAxis = Math.max(bestGroup.maxAxis, run.axis);
      bestGroup.starts.push(run.start);
      bestGroup.ends.push(run.end);
    }

    return groups;
  }

  function groupsToSegments(groups, horizontal, minRun, maxThickness, processScale) {
    const segments = [];

    for (const group of groups) {
      const start = median(group.starts);
      const end = median(group.ends);
      const axis = (group.minAxis + group.maxAxis) / 2;
      const length = end - start + 1;
      const thickness = group.maxAxis - group.minAxis + 1;

      if (length < minRun || thickness > maxThickness || length / Math.max(1, thickness) < 4) {
        continue;
      }

      if (horizontal) {
        segments.push({
          start: { x: start / processScale, y: axis / processScale },
          end: { x: end / processScale, y: axis / processScale },
        });
      } else {
        segments.push({
          start: { x: axis / processScale, y: start / processScale },
          end: { x: axis / processScale, y: end / processScale },
        });
      }
    }

    return segments;
  }

  function areSimilarSegments(a, b) {
    const aHorizontal = Math.abs(a.start.y - a.end.y) <= Math.abs(a.start.x - a.end.x);
    const bHorizontal = Math.abs(b.start.y - b.end.y) <= Math.abs(b.start.x - b.end.x);
    if (aHorizontal !== bHorizontal) return false;

    if (aHorizontal) {
      const yA = (a.start.y + a.end.y) / 2;
      const yB = (b.start.y + b.end.y) / 2;
      if (Math.abs(yA - yB) > 5) return false;
      const overlap = rangesOverlap(
        Math.min(a.start.x, a.end.x),
        Math.max(a.start.x, a.end.x),
        Math.min(b.start.x, b.end.x),
        Math.max(b.start.x, b.end.x),
      );
      return overlap / Math.min(segmentLength(a), segmentLength(b)) > 0.85;
    }

    const xA = (a.start.x + a.end.x) / 2;
    const xB = (b.start.x + b.end.x) / 2;
    if (Math.abs(xA - xB) > 5) return false;
    const overlap = rangesOverlap(
      Math.min(a.start.y, a.end.y),
      Math.max(a.start.y, a.end.y),
      Math.min(b.start.y, b.end.y),
      Math.max(b.start.y, b.end.y),
    );
    return overlap / Math.min(segmentLength(a), segmentLength(b)) > 0.85;
  }

  function dedupeSegments(segments) {
    const sorted = [...segments].sort((a, b) => segmentLength(b) - segmentLength(a));
    const unique = [];

    for (const segment of sorted) {
      if (!unique.some((existing) => areSimilarSegments(segment, existing))) {
        unique.push(segment);
      }
    }

    return unique;
  }

  function analyzeImageData({ data, width, height, processScale, sensitivity, maxSegments = Infinity }) {
    const profile = detectionProfile(sensitivity);
    const grayscale = new Uint8Array(width * height);

    for (let i = 0, pixel = 0; i < data.length; i += 4, pixel++) {
      const alpha = data[i + 3] / 255;
      const luma = Math.round((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * alpha + 255 * (1 - alpha));
      grayscale[pixel] = luma;
    }

    const threshold = otsuThreshold(grayscale);
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < grayscale.length; i++) {
      binary[i] = grayscale[i] < threshold ? 1 : 0;
    }

    const minDimension = Math.min(width, height);
    const minRun = Math.max(18, Math.round(minDimension * profile.minRunRatio));
    const axisTolerance = Math.max(3, Math.round(minDimension * profile.axisToleranceRatio));
    const maxThickness = Math.max(8, Math.round(minDimension * profile.maxThicknessRatio));

    const horizontalGroups = mergeRuns(collectRuns(binary, width, height, true, minRun), axisTolerance);
    const verticalGroups = mergeRuns(collectRuns(binary, width, height, false, minRun), axisTolerance);
    return dedupeSegments([
      ...groupsToSegments(horizontalGroups, true, minRun, maxThickness, processScale),
      ...groupsToSegments(verticalGroups, false, minRun, maxThickness, processScale),
    ]).slice(0, maxSegments);
  }

  global.PlanScaleDetectionCore = {
    analyzeImageData,
    normalizeDetectionSensitivity,
    detectionSensitivityProgress,
  };
})(globalThis);
