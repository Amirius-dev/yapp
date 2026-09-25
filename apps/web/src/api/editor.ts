import {
  apiErrorSchema,
  editorSaveSchema,
  editorStateSchema,
  editorPresetCreateSchema,
  editorPresetSchema,
  musicAssetSchema,
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
