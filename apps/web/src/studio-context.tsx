import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProjectDto, ProjectStatus } from "@studio/contracts";
import { demoClips, demoTranscript } from "./mock-data";
import type { Clip, Project } from "./types";

type ProjectOverrides = { status?: ProjectStatus; clips?: Clip[] };
type StudioContextValue = {
  decorateProject: (project: ProjectDto) => Project;
  updateClip: (projectId: string, clipId: string, patch: Partial<Clip>) => void;
  updateStatus: (projectId: string, status: ProjectStatus) => void;
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
  const [overrides, setOverrides] = useState<Record<string, ProjectOverrides>>(
    {},
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      decorateProject: (project) => {
        const local = overrides[project.id];
        return {
          id: project.id,
          name: project.name,
          status: local?.status ?? project.status,
          durationSeconds: project.mediaInfo?.durationSeconds ?? 0,
          language: "Не определён",
          updatedAt: formatUpdatedAt(project.updatedAt),
          sourceName: project.sourceFileName ?? "Видео ещё не загружено",
          errorMessage: project.errorMessage ?? undefined,
          mediaInfo: project.mediaInfo,
          transcript: demoTranscript,
          clips: local?.clips ?? demoClips,
        };
      },
      updateClip: (projectId, clipId, patch) =>
        setOverrides((current) => {
          const clips = current[projectId]?.clips ?? demoClips;
          return {
            ...current,
            [projectId]: {
              ...current[projectId],
              clips: clips.map((clip) =>
                clip.id === clipId ? { ...clip, ...patch } : clip,
              ),
            },
          };
        }),
      updateStatus: (projectId, status) =>
        setOverrides((current) => ({
          ...current,
          [projectId]: { ...current[projectId], status },
        })),
    }),
    [overrides],
  );

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("useStudio must be used inside StudioProvider");
  return context;
}
