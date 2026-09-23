import { spawn } from "node:child_process";
import type { MediaInfo } from "@studio/contracts";
import { HttpError } from "../lib/http-error.js";

type ProbeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
};

type ProbeOutput = {
  streams?: ProbeStream[];
  format?: { duration?: string };
};

function parseRate(value: string | undefined) {
  if (!value) return Number.NaN;
  const parts = value.split("/");
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1] ?? "1");
  return denominator === 0 ? Number.NaN : numerator / denominator;
}

export function parseFfprobeOutput(
  output: unknown,
  fileSizeBytes: number,
): MediaInfo {
  if (!output || typeof output !== "object") {
    throw new HttpError(422, "ffprobe вернул некорректные метаданные.");
  }
  const probe = output as ProbeOutput;
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const durationSeconds = Number(probe.format?.duration);
  const fps = parseRate(video?.avg_frame_rate ?? video?.r_frame_rate);

  if (
    !video?.width ||
    !video.height ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0 ||
    !Number.isFinite(fps) ||
    fps <= 0
  ) {
    throw new HttpError(
      422,
      "Не удалось определить длительность, разрешение или FPS видео.",
    );
  }

  return {
    durationSeconds,
    width: video.width,
    height: video.height,
    fps,
    fileSizeBytes,
    hasAudio: Boolean(
      probe.streams?.some((stream) => stream.codec_type === "audio"),
    ),
  };
}

export async function probeVideo(
  filePath: string,
  fileSizeBytes: number,
  executable = "ffprobe",
): Promise<MediaInfo> {
  const args = [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ];

  const result = await new Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
  }>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(
          new HttpError(
            503,
            "ffprobe не установлен или недоступен в PATH. Установите FFmpeg и повторите загрузку.",
          ),
        );
        return;
      }
      reject(error);
    });
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });

  if (result.code !== 0) {
    throw new HttpError(
      422,
      `ffprobe не смог прочитать видео${result.stderr ? `: ${result.stderr.trim()}` : "."}`,
    );
  }

  try {
    return parseFfprobeOutput(JSON.parse(result.stdout), fileSizeBytes);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, "ffprobe вернул некорректный JSON.");
  }
}
