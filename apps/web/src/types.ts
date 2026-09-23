import type { MediaInfo, ProjectStatus } from "@studio/contracts";

export type { ProjectStatus } from "@studio/contracts";

export type TranscriptSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

export type Clip = {
  id: string;
  title: string;
  start: number;
  end: number;
  hookScore: number;
  reason: string;
  openingCaption: string;
  segmentIds: number[];
  enabled: boolean;
  renderStatus: "queued" | "rendering" | "completed" | "failed";
};

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
  transcript: TranscriptSegment[];
  clips: Clip[];
};
