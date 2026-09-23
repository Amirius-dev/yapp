import { accessSync, constants } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(
  new URL("../../../", import.meta.url),
);
export const dataRoot = resolve(
  process.env.STUDIO_DATA_DIR ?? join(repositoryRoot, "data"),
);
export const databasePath = join(dataRoot, "studio.sqlite");
export const whisperModel = process.env.WHISPER_MODEL ?? "small";
export const whisperLanguage = process.env.WHISPER_LANGUAGE;
export const runnerPath = join(
  repositoryRoot,
  "scripts/transcription/runner.py",
);
export const defaultPythonPath = join(
  repositoryRoot,
  "scripts/transcription/.venv/bin/python",
);
export const pythonPath = process.env.WHISPER_PYTHON ?? defaultPythonPath;
export const pollIntervalMs = Number(
  process.env.WORKER_POLL_INTERVAL_MS ?? 1000,
);

export function assertPythonAvailable() {
  try {
    accessSync(pythonPath, constants.X_OK);
  } catch {
    if (process.env.WHISPER_PYTHON) {
      throw new Error(
        `Python не найден по пути WHISPER_PYTHON=${pythonPath}. Проверьте переменную окружения.`,
      );
    }
    throw new Error(
      "Виртуальное окружение транскрипции не найдено. Создайте scripts/transcription/.venv и установите requirements.txt.",
    );
  }
}
