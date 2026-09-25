import { spawn } from "node:child_process";
import { access, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { buildTimelineSubtitleCues } from "@studio/remotion-video";
import { buildTimeline, timelineDuration } from "@studio/contracts";
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
    pix_fmt?: string;
    r_frame_rate?: string;
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

async function assembleRanges(
  sourcePath: string,
  outputPath: string,
  directory: string,
  ranges: RenderClipData["ranges"],
  sourceHasAudio: boolean,
) {
  const parts: string[] = [];
  for (const [index, range] of ranges.entries()) {
    const part = join(directory, `range-${index}.mp4`);
    await normalizeClip(sourcePath, part, range.start, range.end - range.start);
    parts.push(part);
  }
  if (parts.length === 1) {
    await rename(parts[0]!, outputPath);
    return;
  }
  const timeline = buildTimeline(ranges);
  const hasTransitions = timeline.some(
    (range) => range.transitionOutDuration > 0,
  );
  if (hasTransitions) {
    const args = ["-y"];
    parts.forEach((part) => args.push("-i", part));
    const filters: string[] = [];
    let videoLabel = "0:v";
    let audioLabel = "0:a";
    for (let index = 1; index < parts.length; index += 1) {
      const previous = timeline[index - 1]!;
      const transition = previous.transitionOutDuration;
      const nextVideo = `v${index}`;
      const nextAudio = `a${index}`;
      if (transition > 0) {
        const effect =
          previous.transition?.type === "dip-to-black" ? "fadeblack" : "fade";
        filters.push(
          `[${videoLabel}][${index}:v]xfade=transition=${effect}:duration=${transition}:offset=${timeline[index]!.outputStart}[${nextVideo}]`,
        );
        if (sourceHasAudio)
          filters.push(
            `[${audioLabel}][${index}:a]acrossfade=d=${transition}:c1=tri:c2=tri[${nextAudio}]`,
          );
      } else {
        filters.push(
          `[${videoLabel}][${index}:v]concat=n=2:v=1:a=0[${nextVideo}]`,
        );
        if (sourceHasAudio)
          filters.push(
            `[${audioLabel}][${index}:a]concat=n=2:v=0:a=1[${nextAudio}]`,
          );
      }
      videoLabel = nextVideo;
      if (sourceHasAudio) audioLabel = nextAudio;
    }
    args.push("-filter_complex", filters.join(";"), "-map", `[${videoLabel}]`);
    if (sourceHasAudio) args.push("-map", `[${audioLabel}]`);
    args.push(
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
    );
    if (sourceHasAudio) args.push("-c:a", "aac", "-b:a", "192k");
    args.push("-movflags", "+faststart", outputPath);
    await runCommand(ffmpegPath, args, "FFmpeg");
    return;
  }
  const listPath = join(directory, "ranges.txt");
  await writeFile(
    listPath,
    parts.map((part) => `file '${part.replaceAll("'", "'\\''")}'`).join("\n"),
    "utf8",
  );
  await runCommand(
    ffmpegPath,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "FFmpeg",
  );
}

async function applyAudioSettings(
  inputPath: string,
  outputPath: string,
  job: ClaimedRenderJob,
  clip: RenderClipData,
  duration: number,
) {
  const music = clip.audio.music;
  if (!job.sourceHasAudio && !music) {
    await rename(inputPath, outputPath);
    return;
  }
  const args = ["-y", "-i", inputPath];
  if (music) {
    if (basename(music.fileName) !== music.fileName)
      throw new Error("Некорректное имя музыкального файла.");
    const musicPath = join(
      dataRoot,
      "projects",
      job.projectId,
      "music",
      music.fileName,
    );
    await access(musicPath);
    if (music.loop) args.push("-stream_loop", "-1");
    args.push("-i", musicPath);
  }
  const filters: string[] = [];
  if (job.sourceHasAudio) {
    const sourceFilters = [
      `volume=${clip.audio.muted ? 0 : clip.audio.volume}`,
    ];
    if (clip.audio.fadeInSeconds > 0)
      sourceFilters.push(`afade=t=in:st=0:d=${clip.audio.fadeInSeconds}`);
    if (clip.audio.fadeOutSeconds > 0)
      sourceFilters.push(
        `afade=t=out:st=${Math.max(0, duration - clip.audio.fadeOutSeconds)}:d=${clip.audio.fadeOutSeconds}`,
      );
    if (clip.audio.noiseReduction) sourceFilters.push("afftdn=nf=-25");
    if (clip.audio.normalize)
      sourceFilters.push("loudnorm=I=-16:LRA=11:TP=-1.5");
    filters.push(`[0:a]${sourceFilters.join(",")}[speech]`);
  }
  if (music) {
    const musicDuration = Math.max(0.1, duration - music.startSeconds);
    const musicFilters = [
      `atrim=duration=${musicDuration}`,
      "asetpts=PTS-STARTPTS",
      `volume=${music.volume}`,
    ];
    if (music.fadeInSeconds > 0)
      musicFilters.push(`afade=t=in:st=0:d=${music.fadeInSeconds}`);
    if (music.fadeOutSeconds > 0)
      musicFilters.push(
        `afade=t=out:st=${Math.max(0, musicDuration - music.fadeOutSeconds)}:d=${music.fadeOutSeconds}`,
      );
    if (music.startSeconds > 0) {
      const delay = Math.round(music.startSeconds * 1000);
      musicFilters.push(`adelay=${delay}|${delay}`);
    }
    filters.push(`[1:a]${musicFilters.join(",")}[music]`);
  }
  let audioMap: string;
  if (job.sourceHasAudio && music) {
    if (music.duckDuringSpeech) {
      filters.push(
        "[music][speech]sidechaincompress=threshold=0.045:ratio=8:attack=20:release=420[ducked]",
      );
      filters.push(
        "[speech][ducked]amix=inputs=2:duration=first:dropout_transition=2[aout]",
      );
    } else {
      filters.push(
        "[speech][music]amix=inputs=2:duration=first:dropout_transition=2[aout]",
      );
    }
    audioMap = "[aout]";
  } else {
    audioMap = job.sourceHasAudio ? "[speech]" : "[music]";
  }
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v:0",
    "-map",
    audioMap,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    String(duration),
    "-movflags",
    "+faststart",
    outputPath,
  );
  await runCommand(ffmpegPath, args, "FFmpeg");
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
  if (audio && audio.codec_name !== "aac")
    throw new Error("Аудиодорожка результата не закодирована в AAC.");
  if (video.pix_fmt !== "yuv420p")
    throw new Error(
      `Результат использует ${video.pix_fmt ?? "неизвестный"} вместо совместимого pixel format yuv420p.`,
    );
  const [fpsNumerator, fpsDenominator] = (video.r_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  const fps = fpsNumerator! / Math.max(1, fpsDenominator!);
  if (Math.abs(fps - 30) > 0.01)
    throw new Error("Результат не имеет ожидаемую частоту 30 FPS.");
  if (!Number.isFinite(duration) || Math.abs(duration - expectedDuration) > 1)
    throw new Error(
      "Длительность результата слишком сильно отличается от выбранного диапазона.",
    );
  return { duration, size: info.size, hasAudio: Boolean(audio) };
}

async function publishCompatibleMp4(inputPath: string, outputPath: string) {
  await runCommand(
    ffmpegPath,
    [
      "-y",
      "-i",
      inputPath,
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
      "-vf",
      "scale=in_range=full:out_range=tv,format=yuv420p,setparams=range=limited",
      "-pix_fmt",
      "yuv420p",
      "-color_range",
      "tv",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    "FFmpeg",
  );
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
  const assembledPath = join(clipDir, "assembled.mp4");
  const renderedPath = join(clipDir, "rendered.mp4");
  const publishedPath = join(clipDir, "published.mp4");
  const outputDir = join(dataRoot, "projects", job.projectId, "outputs");
  const outputFileName = `${clip.id}.mp4`;
  const outputPath = join(outputDir, outputFileName);
  const duration = timelineDuration(clip.ranges);
  await mkdir(publicDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  try {
    onProgress(5);
    await assembleRanges(
      job.sourcePath,
      assembledPath,
      publicDir,
      clip.ranges,
      job.sourceHasAudio,
    );
    await applyAudioSettings(assembledPath, inputPath, job, clip, duration);
    onProgress(20);
    const cues = buildTimelineSubtitleCues(
      clip.ranges,
      clip.segments,
      clip.words,
      clip.subtitleStyle.maxWords,
    );
    await renderVerticalClip({
      publicDir,
      outputPath: renderedPath,
      props: {
        videoFileName: "input.mp4",
        durationSeconds: duration,
        fps: 30,
        openingCaption: clip.openingCaption,
        openingCaptionEnabled: clip.openingCaptionEnabled,
        captionsEnabled: clip.captionsEnabled,
        templateId: clip.templateId,
        accentColor: clip.accentColor,
        cropMode: clip.cropMode,
        cropX: clip.cropX,
        cropY: clip.cropY,
        zoom: clip.zoom,
        subtitleX: clip.subtitleX,
        subtitleY: clip.subtitleY,
        subtitleScale: clip.subtitleScale,
        subtitleAlign: clip.subtitleAlign,
        image: clip.image,
        subtitleStyle: clip.subtitleStyle,
        openingCaptionSettings: clip.openingCaptionSettings,
        cues,
        ranges: clip.ranges,
        cropKeyframes: clip.cropKeyframes,
        subtitleKeyframes: clip.subtitleKeyframes,
      },
      onProgress: (progress) => onProgress(20 + progress * 70),
      browserExecutable: remotionBrowserExecutable,
    });
    onProgress(92);
    // Remotion's bundled FFmpeg can emit yuvj420p on some local setups even
    // when yuv420p is requested. The publish pass is the compatibility
    // boundary: social/mobile players receive a deterministic H.264 format
    // and the MP4 metadata is moved to the beginning for progressive loading.
    await publishCompatibleMp4(renderedPath, publishedPath);
    const metadata = await verifyOutput(
      publishedPath,
      duration,
      job.sourceHasAudio || Boolean(clip.audio.music),
    );
    await rename(publishedPath, outputPath);
    onProgress(100);
    return { outputFileName, cues, metadata };
  } finally {
    await rm(clipDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
