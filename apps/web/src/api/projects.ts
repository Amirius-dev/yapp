import {
  apiErrorSchema,
  createProjectSchema,
  projectListSchema,
  projectSchema,
  type CreateProjectInput,
  type ProjectDto,
} from "@studio/contracts";

async function readResponse<T>(
  response: Response,
  parse: (value: unknown) => T,
): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    throw new Error(
      error.success ? error.data.error : "Сервер вернул непонятную ошибку.",
    );
  }
  return parse(body);
}

export async function listProjects(): Promise<ProjectDto[]> {
  const response = await fetch("/api/projects");
  return readResponse(response, (body) => projectListSchema.parse(body));
}

export async function getProject(id: string): Promise<ProjectDto> {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  return readResponse(response, (body) => projectSchema.parse(body));
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectDto> {
  const payload = createProjectSchema.parse(input);
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readResponse(response, (body) => projectSchema.parse(body));
}

export async function uploadProjectSource(
  id: string,
  file: File,
): Promise<ProjectDto> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(
    `/api/projects/${encodeURIComponent(id)}/source`,
    {
      method: "POST",
      body: form,
    },
  );
  return readResponse(response, (body) => projectSchema.parse(body));
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (response.status === 204) return;
  await readResponse(response, () => undefined);
}
