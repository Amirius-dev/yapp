import {
  apiErrorSchema,
  jobListSchema,
  jobSchema,
  transcriptSchema,
  type JobDto,
  type TranscriptDto,
} from "@studio/contracts";

async function read<T>(
  response: Response,
  parse: (body: unknown) => T,
): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success ? parsed.data.error : "Сервер вернул непонятную ошибку.",
    );
  }
  return parse(body);
}

export async function startTranscription(projectId: string): Promise<JobDto> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/transcription`,
    {
      method: "POST",
    },
  );
  return read(response, (body) => jobSchema.parse(body));
}

export async function regenerateTranscription(
  projectId: string,
): Promise<JobDto> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/transcription/regenerate`,
    { method: "POST" },
  );
  return read(response, (body) => jobSchema.parse(body));
}

export async function getProjectJobs(projectId: string): Promise<JobDto[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/jobs`,
  );
  return read(response, (body) => jobListSchema.parse(body));
}

export async function getTranscript(projectId: string): Promise<TranscriptDto> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/transcript`,
  );
  return read(response, (body) => transcriptSchema.parse(body));
}
