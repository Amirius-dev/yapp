import {
  aiPackagePromptSchema,
  apiErrorSchema,
  clipListSchema,
  clipSchema,
  clipsValidationResultSchema,
  type AiPackagePrompt,
  type ClipDto,
  type ClipsValidationResult,
  type ClipUpdateInput,
} from "@studio/contracts";

async function errorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success
    ? parsed.data.error
    : "Сервер вернул непонятную ошибку.";
}

export async function getAiPrompt(projectId: string): Promise<AiPackagePrompt> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/ai-package`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: "prompt" }),
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return aiPackagePromptSchema.parse(await response.json());
}

export async function downloadAiPackage(projectId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/ai-package`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format: "zip" }),
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  const disposition = response.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "ai-package.zip";
  return { blob: await response.blob(), name };
}

export async function validateClips(
  projectId: string,
  content: string,
): Promise<ClipsValidationResult> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/validate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return clipsValidationResultSchema.parse(await response.json());
}

export async function importClips(
  projectId: string,
  content: string,
): Promise<ClipDto[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/import`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const validation = clipsValidationResultSchema.safeParse(body);
    if (validation.success) {
      throw new Error(
        validation.data.errors.map((item) => item.message).join(" "),
      );
    }
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success ? parsed.data.error : "Не удалось импортировать clips.",
    );
  }
  return clipListSchema.parse(await response.json());
}

export async function listClips(projectId: string): Promise<ClipDto[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips`,
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return clipListSchema.parse(await response.json());
}

export async function updateClip(
  projectId: string,
  clipId: string,
  patch: ClipUpdateInput,
): Promise<ClipDto> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return clipSchema.parse(await response.json());
}
