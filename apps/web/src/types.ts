import type { MediaInfo, ProjectStatus } from "@studio/contracts";

export type { ProjectStatus } from "@studio/contracts";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  durationSeconds: number;
  language: string;
  updatedAt: string;
  sourceName: string;
  progress?: number;
  errorMessage?: string;
  mediaInfo: MediaInfo | null;
};
