import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { dataRoot, projectsRoot } from "../config.js";
import { HttpError } from "../lib/http-error.js";
import type { ProjectsRepository } from "../repositories/projects.js";

export function projectDirectory(projectId: string) {
  const directory = resolve(projectsRoot, projectId);
  if (!directory.startsWith(`${projectsRoot}${sep}`))
    throw new HttpError(400, "Некорректный идентификатор директории проекта.");
  return directory;
}

export async function deleteProjectSafely(
  projectId: string,
  repository: ProjectsRepository,
) {
  repository.assertDeletable(projectId);
  const source = projectDirectory(projectId);
  const trashRoot = resolve(dataRoot, ".trash");
  const trash = join(trashRoot, `${projectId}-${randomUUID()}`);
  const exists = await stat(source)
    .then((value) => value.isDirectory())
    .catch(() => false);
  let moved = false;
  try {
    if (exists) {
      await mkdir(trashRoot, { recursive: true });
      await rename(source, trash);
      moved = true;
    }
  } catch {
    throw new HttpError(
      500,
      "Не удалось безопасно переместить файлы проекта перед удалением.",
    );
  }

  try {
    repository.delete(projectId);
  } catch (error) {
    if (moved) await rename(trash, source).catch(() => undefined);
    throw error;
  }

  if (moved) {
    await rm(trash, { recursive: true, force: true }).catch(() => undefined);
  }
}
