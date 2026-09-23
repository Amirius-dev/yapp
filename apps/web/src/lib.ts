import type { ProjectStatus } from "./types";

export function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours > 0
    ? [hours, minutes, secs]
        .map((value) => String(value).padStart(2, "0"))
        .join(":")
    : [minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

export const statusMeta: Record<
  ProjectStatus,
  { label: string; tone: string; action: string; route: string }
> = {
  transcribing: {
    label: "Транскрипция",
    tone: "blue",
    action: "Смотреть прогресс",
    route: "transcript",
  },
  ready_for_ai: {
    label: "Готов к анализу",
    tone: "violet",
    action: "Экспортировать для AI",
    route: "ai-export",
  },
  waiting_for_ai_result: {
    label: "Ожидает JSON",
    tone: "amber",
    action: "Импортировать ответ",
    route: "ai-import",
  },
  reviewing_clips: {
    label: "Проверка клипов",
    tone: "pink",
    action: "Редактировать клипы",
    route: "clips",
  },
  rendering: {
    label: "Рендер",
    tone: "blue",
    action: "Смотреть очередь",
    route: "render",
  },
  completed: {
    label: "Готово",
    tone: "green",
    action: "Открыть результаты",
    route: "results",
  },
  failed: {
    label: "Нужна помощь",
    tone: "red",
    action: "Посмотреть ошибку",
    route: "transcript",
  },
};
