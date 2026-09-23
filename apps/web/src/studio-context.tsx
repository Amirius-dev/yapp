import { createContext, useContext, type ReactNode } from "react";
import type { ProjectDto } from "@studio/contracts";
import type { Project } from "./types";
type StudioContextValue = {
  decorateProject: (project: ProjectDto) => Project;
};

const StudioContext = createContext<StudioContextValue | null>(null);

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const value: StudioContextValue = {
    decorateProject: (project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      durationSeconds: project.mediaInfo?.durationSeconds ?? 0,
      language: project.language ?? "Не определён",
      updatedAt: formatUpdatedAt(project.updatedAt),
      sourceName: project.sourceFileName ?? "Видео ещё не загружено",
      errorMessage: project.errorMessage ?? undefined,
      mediaInfo: project.mediaInfo,
    }),
  };

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("useStudio must be used inside StudioProvider");
  return context;
}
