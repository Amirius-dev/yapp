import { spawn } from "node:child_process";
import { access, mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildSubtitleCues } from "@studio/remotion-video";
import { renderVerticalClip } from "@studio/remotion-video/render";
import {
  dataRoot,
  ffmpegPath,
  ffprobePath,
  remotionBrowserExecutable,
} from "./config.js";
import type { ClaimedRenderJob, RenderClipData } from "./db.js";

type ProbeOutput = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
  }>;
  format?: { duration?: string; size?: string; format_name?: string };
};

function runCommand(command: string, args: string[], label: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout
      .setEncoding("utf8")
      .on("data", (chunk: string) => (stdout += chunk));
    child.stderr
      .setEncoding("utf8")
      .on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new Error(`${label} не найден. Установите FFmpeg и проверьте PATH.`)
          : new Error(`Не удалось запустить ${label}.`),
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `${label} завершился с ошибкой. Проверьте исходное видео и локальный лог worker.`,
          ),
        );
    });
  });
}

async function assertTools() {
  await runCommand(ffmpegPath, ["-version"], "FFmpeg");
  await runCommand(ffprobePath, ["-version"], "ffprobe");
}

async function normalizeClip(
  sourcePath: string,
  outputPath: string,
  start: number,
  duration: number,
) {
  await runCommand(
    ffmpegPath,
    [
      "-y",
      "-ss",
      String(start),
      "-i",
      sourcePath,
      "-t",
      String(duration),
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "FFmpeg",
  );
}

async function verifyOutput(
  path: string,
  expectedDuration: number,
  expectAudio: boolean,
) {
  const info = await stat(path).catch(() => null);
  if (!info?.isFile() || info.size === 0)
    throw new Error("Рендер не создал непустой MP4.");
  const { stdout } = await runCommand(
    ffprobePath,
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
    "ffprobe",
  );
  let probe: ProbeOutput;
  try {
    probe = JSON.parse(stdout) as ProbeOutput;
  } catch {
    throw new Error("ffprobe вернул некорректные метаданные результата.");
  }
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format?.duration);
  if (!video || video.width !== 1080 || video.height !== 1920)
    throw new Error("Результат не имеет ожидаемое разрешение 1080×1920.");
  if (video.codec_name !== "h264")
    throw new Error("Результат не закодирован в H.264.");
  if (expectAudio && !audio)
    throw new Error("В результате отсутствует ожидаемая аудиодорожка.");
  if (!Number.isFinite(duration) || Math.abs(duration - expectedDuration) > 1)
    throw new Error(
      "Длительность результата слишком сильно отличается от выбранного диапазона.",
    );
  return { duration, size: info.size, hasAudio: Boolean(audio) };
}

export async function renderClip(
  job: ClaimedRenderJob,
  clip: RenderClipData,
  onProgress: (progress: number) => void,
) {
  await access(job.sourcePath);
  await assertTools();
  const clipDir = join(
    dataRoot,
    "projects",
    job.projectId,
    "tmp",
    job.id,
    clip.id,
  );
  const publicDir = join(clipDir, "public");
  const inputPath = join(publicDir, "input.mp4");
  const renderedPath = join(clipDir, "rendered.mp4");
  const outputDir = join(dataRoot, "projects", job.projectId, "outputs");
  const outputFileName = `${clip.id}.mp4`;
  const outputPath = join(outputDir, outputFileName);
  const duration = clip.endSeconds - clip.startSeconds;
  await mkdir(publicDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  try {
    onProgress(5);
    await normalizeClip(job.sourcePath, inputPath, clip.startSeconds, duration);
    onProgress(20);
    const cues = buildSubtitleCues(
      clip.segments,
      clip.startSeconds,
      clip.endSeconds,
    );
    await renderVerticalClip({
      publicDir,
      outputPath: renderedPath,
      props: {
        videoFileName: "input.mp4",
        durationSeconds: duration,
        fps: 30,
        openingCaption: clip.openingCaption,
        cues,
      },
      onProgress: (progress) => onProgress(20 + progress * 70),
      browserExecutable: remotionBrowserExecutable,
    });
    onProgress(92);
    const metadata = await verifyOutput(
      renderedPath,
      duration,
      job.sourceHasAudio,
    );
    await rename(renderedPath, outputPath);
    onProgress(100);
    return { outputFileName, cues, metadata };
  } finally {
    await rm(clipDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
