import {
  aiResponseSchema,
  type AiResponseV2,
  type ClipsValidationResult,
  type ValidationIssue,
} from "@studio/contracts";

export type ValidationSegment = {
  id: number;
  start: number;
  end: number;
};

type ValidationContext = {
  projectId: string;
  durationSeconds: number;
  segments: ValidationSegment[];
};

function issue(
  code: string,
  path: string,
  message: string,
  clipIndex?: number,
  relatedClipIndex?: number,
): ValidationIssue {
  return {
    code,
    path,
    message,
    ...(clipIndex === undefined ? {} : { clipIndex }),
    ...(relatedClipIndex === undefined ? {} : { relatedClipIndex }),
  };
}

function wordCount(value: string) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function hasFullCoverage(
  start: number,
  end: number,
  selected: ValidationSegment[],
) {
  const tolerance = 0.5;
  const ranges = selected
    .map((segment) => ({ start: segment.start, end: segment.end }))
    .sort((a, b) => a.start - b.start);
  if (!ranges.length || ranges[0]!.start > start + tolerance) return false;
  let coveredUntil = ranges[0]!.end;
  for (const range of ranges.slice(1)) {
    if (range.start > coveredUntil + tolerance) return false;
    coveredUntil = Math.max(coveredUntil, range.end);
  }
  return coveredUntil >= end - tolerance;
}

function schemaCode(path: PropertyKey[]) {
  const joined = path.join(".");
  if (joined === "schemaVersion") return "unsupported_schema_version";
  if (joined === "clips") return "empty_clips";
  return "invalid_field";
}

export function validateClipsContent(
  content: string,
  context: ValidationContext,
): ClipsValidationResult {
  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch {
    return {
      valid: false,
      preview: null,
      errors: [
        issue(
          "invalid_json",
          "",
          "JSON содержит синтаксическую ошибку. Проверьте запятые и кавычки.",
        ),
      ],
      warnings: [],
    };
  }

  const parsed = aiResponseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      preview: null,
      errors: parsed.error.issues.map((item) => {
        const clipIndex =
          item.path[0] === "clips" && typeof item.path[1] === "number"
            ? item.path[1]
            : undefined;
        return issue(
          schemaCode(item.path),
          item.path.join("."),
          item.path.length
            ? `Некорректное поле ${item.path.join(".")}: ${item.message}`
            : `Некорректный корневой объект: ${item.message}`,
          clipIndex,
        );
      }),
      warnings: [],
    };
  }

  const preview: AiResponseV2 =
    parsed.data.schemaVersion === 2
      ? parsed.data
      : {
          schemaVersion: 2,
          projectId: parsed.data.projectId,
          clips: parsed.data.clips.map((clip) => ({
            title: clip.title,
            ranges: [
              {
                start: clip.start,
                end: clip.end,
                segmentIds: clip.segmentIds,
              },
            ],
            hookScore: clip.hookScore,
            reason: clip.reason,
            openingCaption: clip.openingCaption,
          })),
        };
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const segmentMap = new Map(
    context.segments.map((segment) => [segment.id, segment]),
  );

  if (preview.projectId !== context.projectId) {
    errors.push(
      issue(
        "wrong_project_id",
        "projectId",
        "projectId в JSON не совпадает с открытым проектом.",
      ),
    );
  }
  if (preview.clips.length === 0) {
    errors.push(
      issue("empty_clips", "clips", "Массив clips не может быть пустым."),
    );
  } else if (preview.clips.length < 10 || preview.clips.length > 20) {
    warnings.push(
      issue(
        "clip_count_outside_recommended",
        "clips",
        `Рекомендуется от 10 до 20 clips; получено ${preview.clips.length}.`,
      ),
    );
  }

  preview.clips.forEach((clip, clipIndex) => {
    const path = `clips.${clipIndex}`;
    const duration = clip.ranges.reduce(
      (total, range) => total + range.end - range.start,
      0,
    );
    const seenRanges = new Set<string>();
    clip.ranges.forEach((range, rangeIndex) => {
      const rangePath = `${path}.ranges.${rangeIndex}`;
      if (range.start < 0)
        errors.push(
          issue(
            "negative_start",
            `${rangePath}.start`,
            "Начало не может быть меньше нуля.",
            clipIndex,
          ),
        );
      if (range.end <= range.start)
        errors.push(
          issue(
            "invalid_range",
            `${rangePath}.end`,
            "Конец должен быть позже начала.",
            clipIndex,
          ),
        );
      if (range.end - range.start < 1)
        errors.push(
          issue(
            "range_too_short",
            rangePath,
            "Каждый range должен длиться минимум 1 секунду.",
            clipIndex,
          ),
        );
      if (range.end > context.durationSeconds)
        errors.push(
          issue(
            "outside_video",
            `${rangePath}.end`,
            `Конец выходит за длительность видео (${context.durationSeconds.toFixed(2)} сек.).`,
            clipIndex,
          ),
        );
      const rangeKey = `${range.start}:${range.end}`;
      if (seenRanges.has(rangeKey))
        errors.push(
          issue(
            "duplicate_range",
            rangePath,
            "Одинаковые ranges внутри одного clip запрещены.",
            clipIndex,
          ),
        );
      seenRanges.add(rangeKey);

      const uniqueIds = new Set(range.segmentIds);
      if (uniqueIds.size !== range.segmentIds.length)
        errors.push(
          issue(
            "duplicate_segment_ids",
            `${rangePath}.segmentIds`,
            "segmentIds содержит дубликаты.",
            clipIndex,
          ),
        );
      const unknown = [...uniqueIds].filter((id) => !segmentMap.has(id));
      if (unknown.length)
        errors.push(
          issue(
            "unknown_segment_ids",
            `${rangePath}.segmentIds`,
            `Неизвестные segmentIds: ${unknown.join(", ")}.`,
            clipIndex,
          ),
        );
      const selected = [...uniqueIds]
        .map((id) => segmentMap.get(id))
        .filter((segment): segment is ValidationSegment => Boolean(segment));
      if (!unknown.length && !hasFullCoverage(range.start, range.end, selected))
        warnings.push(
          issue(
            "segments_do_not_cover_range",
            `${rangePath}.segmentIds`,
            "Указанные сегменты не полностью покрывают выбранный range.",
            clipIndex,
          ),
        );
    });
    if (duration < 15 || duration > 90)
      errors.push(
        issue(
          "invalid_duration",
          path,
          "Длительность clip должна быть от 15 до 90 секунд.",
          clipIndex,
        ),
      );
    else if (duration < 25 || duration > 60)
      warnings.push(
        issue(
          "duration_outside_recommended",
          path,
          "Рекомендуемая длительность — от 25 до 60 секунд.",
          clipIndex,
        ),
      );

    if (wordCount(clip.openingCaption) > 12)
      warnings.push(
        issue(
          "opening_caption_too_long",
          `${path}.openingCaption`,
          "Opening caption длиннее 12 слов.",
          clipIndex,
        ),
      );
  });

  for (let left = 0; left < preview.clips.length; left += 1) {
    for (let right = left + 1; right < preview.clips.length; right += 1) {
      const a = preview.clips[left]!;
      const b = preview.clips[right]!;
      if (
        JSON.stringify(a.ranges.map(({ start, end }) => ({ start, end }))) ===
        JSON.stringify(b.ranges.map(({ start, end }) => ({ start, end })))
      ) {
        errors.push(
          issue(
            "duplicate_range",
            `clips.${right}`,
            `Диапазон полностью совпадает с clip ${left + 1}.`,
            right,
            left,
          ),
        );
        continue;
      }
      const overlap = a.ranges.reduce(
        (total, leftRange) =>
          total +
          b.ranges.reduce(
            (rangeTotal, rightRange) =>
              rangeTotal +
              Math.max(
                0,
                Math.min(leftRange.end, rightRange.end) -
                  Math.max(leftRange.start, rightRange.start),
              ),
            0,
          ),
        0,
      );
      const shorter = Math.min(
        a.ranges.reduce((sum, range) => sum + range.end - range.start, 0),
        b.ranges.reduce((sum, range) => sum + range.end - range.start, 0),
      );
      if (shorter > 0 && overlap / shorter >= 0.5)
        warnings.push(
          issue(
            "heavy_overlap",
            `clips.${right}`,
            `Сильное пересечение с clip ${left + 1}: ${overlap.toFixed(1)} сек.`,
            right,
            left,
          ),
        );
    }
  }

  return { valid: errors.length === 0, preview, errors, warnings };
}
