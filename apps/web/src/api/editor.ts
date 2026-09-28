import {
  apiErrorSchema,
  editorSaveSchema,
  editorStateSchema,
  editorPresetCreateSchema,
  editorPresetSchema,
  musicAssetSchema,
  editorDocumentSaveRequestSchema,
  editorDocumentSnapshotSchema,
  editorMediaAssetSchema,
  type EditorDocumentV2,
  type EditorPresetCreateInput,
  type EditorSaveInput,
  type EditorState,
} from "@studio/contracts";

async function parse(response: Response): Promise<EditorState> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    throw new Error(
      error.success ? error.data.error : "Не удалось получить editor state.",
    );
  }
  return editorStateSchema.parse(body);
}

async function errorMessage(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  const error = apiErrorSchema.safeParse(body);
  return error.success ? error.data.error : fallback;
}

export async function getEditorState(projectId: string, clipId: string) {
  return parse(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/editor`,
    ),
  );
}

export async function saveEditorState(
  projectId: string,
  clipId: string,
  input: EditorSaveInput,
) {
  const payload = editorSaveSchema.parse(input);
  return parse(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/editor`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  );
}

export async function getEditorDocument(projectId: string, clipId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/editor-document`,
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success
        ? parsed.data.error
        : "Не удалось загрузить editor document.",
    );
  }
  return editorDocumentSnapshotSchema.parse(body);
}

export async function saveEditorDocument(
  projectId: string,
  clipId: string,
  baseRevision: number,
  document: EditorDocumentV2,
) {
  const payload = editorDocumentSaveRequestSchema.parse({
    baseRevision,
    document,
  });
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/editor-document`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const message = parsed.success
      ? parsed.data.error
      : "Не удалось сохранить editor document.";
    const error = new Error(message) as Error & {
      code?: string;
      currentRevision?: number;
    };
    if (body && typeof body === "object") {
      if ("code" in body && typeof body.code === "string")
        error.code = body.code;
      if ("currentRevision" in body && typeof body.currentRevision === "number")
        error.currentRevision = body.currentRevision;
    }
    throw error;
  }
  return editorDocumentSnapshotSchema.parse(body);
}

export async function uploadEditorAsset(
  projectId: string,
  clipId: string,
  kind: "music" | "image",
  file: File,
) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/assets/${kind}`,
    { method: "POST", body: form },
  );
  if (!response.ok)
    throw new Error(
      await errorMessage(response, "Не удалось загрузить media asset."),
    );
  return editorMediaAssetSchema.parse(await response.json());
}

export async function uploadEditorMusic(
  projectId: string,
  clipId: string,
  file: File,
) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/music`,
    { method: "POST", body: form },
  );
  if (!response.ok)
    throw new Error(
      await errorMessage(response, "Не удалось загрузить музыку."),
    );
  return musicAssetSchema.parse(await response.json());
}

export async function createEditorPreset(input: EditorPresetCreateInput) {
  const payload = editorPresetCreateSchema.parse(input);
  const response = await fetch("/api/editor/presets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    throw new Error(
      await errorMessage(response, "Не удалось сохранить preset."),
    );
  return editorPresetSchema.parse(await response.json());
}

export async function deleteEditorPreset(id: string) {
  const response = await fetch(
    `/api/editor/presets/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok)
    throw new Error(await errorMessage(response, "Не удалось удалить preset."));
}
