import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const repositoryRoot = fileURLToPath(
  new URL("../../../", import.meta.url),
);
export const dataRoot = resolve(
  process.env.STUDIO_DATA_DIR ?? resolve(repositoryRoot, "data"),
);
export const databasePath = resolve(dataRoot, "studio.sqlite");
export const projectsRoot = resolve(dataRoot, "projects");
export const apiPort = Number(process.env.API_PORT ?? 3001);
export const apiHost = process.env.API_HOST ?? "127.0.0.1";
export const ffprobePath = process.env.FFPROBE_PATH ?? "ffprobe";
export const whisperModel = process.env.WHISPER_MODEL ?? "small";
export const maxUploadBytes = Number(
  process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 ** 3,
);
export const maxMusicUploadBytes = Number(
  process.env.MAX_MUSIC_UPLOAD_BYTES ?? 200 * 1024 ** 2,
);
