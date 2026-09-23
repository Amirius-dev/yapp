import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoTranscript, initialProjects } from "./mock-data";
import type { Clip, Project } from "./types";

type NewProject = { name: string; fileName: string; durationSeconds: number };
type StudioContextValue = {
  projects: Project[];
  addProject: (input: NewProject) => Project;
  updateClip: (projectId: string, clipId: string, patch: Partial<Clip>) => void;
  updateStatus: (projectId: string, status: Project["status"]) => void;
};

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState(initialProjects);

  const value = useMemo<StudioContextValue>(
    () => ({
      projects,
      addProject: ({ name, fileName, durationSeconds }) => {
        const project: Project = {
          id: `demo-${Date.now()}`,
          name,
          sourceName: fileName,
          durationSeconds,
          language: "Определяется",
          updatedAt: "Только что",
          status: "transcribing",
          progress: 42,
          transcript: demoTranscript,
          clips: [],
        };
        setProjects((current) => [project, ...current]);
        return project;
      },
      updateClip: (projectId, clipId, patch) =>
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  clips: project.clips.map((clip) =>
                    clip.id === clipId ? { ...clip, ...patch } : clip,
                  ),
                }
              : project,
          ),
        ),
      updateStatus: (projectId, status) =>
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? { ...project, status, updatedAt: "Только что" }
              : project,
          ),
        ),
    }),
    [projects],
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
