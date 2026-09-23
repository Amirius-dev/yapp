export type ProjectStatus =
  | "transcribing"
  | "ready_for_ai"
  | "waiting_for_ai_result"
  | "reviewing_clips"
  | "rendering"
  | "completed"
  | "failed";

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
  transcript: TranscriptSegment[];
  clips: Clip[];
};
