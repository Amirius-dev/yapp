import {
  apiErrorSchema,
  jobSchema,
  renderRequestSchema,
  renderResultsSchema,
  type JobDto,
  type RenderRequest,
  type RenderResultsDto,
} from "@studio/contracts";

async function errorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success
    ? parsed.data.error
    : "Сервер вернул непонятную ошибку.";
}

export async function startRender(
  projectId: string,
  input: RenderRequest = {},
): Promise<JobDto> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/render`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(renderRequestSchema.parse(input)),
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return jobSchema.parse(await response.json());
}

export async function getRenderResults(
  projectId: string,
): Promise<RenderResultsDto> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/results`,
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return renderResultsSchema.parse(await response.json());
}
