import { pollIntervalMs, whisperModel } from "./config.js";
import {
  claimNextJob,
  completeJob,
  completeRenderClip,
  failJob,
  failRenderClip,
  finalizeRenderJob,
  getRenderClip,
  openWorkerDatabase,
  recoverInterruptedJobs,
  startRenderClip,
  updateRenderProgress,
  updateProgress,
} from "./db.js";
import { runTranscription } from "./transcription.js";
import { renderClip } from "./render.js";

const db = openWorkerDatabase();
const recovered = recoverInterruptedJobs(db);
console.log(
  `Local worker started (model=${whisperModel}, recovered=${recovered}).`,
);

let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

while (!stopping) {
  const job = claimNextJob(db);
  if (!job) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    continue;
  }

  if (job.type === "render_clips") {
    console.log(`Starting render job ${job.id} (${job.clipIds.length} clips).`);
    for (const [index, clipId] of job.clipIds.entries()) {
      startRenderClip(db, clipId);
      try {
        const clip = getRenderClip(db, job.projectId, clipId);
        const result = await renderClip(job, clip, (progress) =>
          updateRenderProgress(db, job, clipId, index, progress),
        );
        completeRenderClip(db, clipId, result.outputFileName);
        console.log(
          `Rendered clip ${clipId} (${result.cues.length} cues, ${result.metadata.duration.toFixed(2)}s).`,
        );
      } catch (error) {
        console.error(`Render clip ${clipId} failed:`, error);
        failRenderClip(db, clipId, renderErrorMessage(error));
      }
    }
    const result = finalizeRenderJob(db, job);
    console.log(
      `Render job ${job.id} finished (${result.completed} completed, ${result.failed} failed).`,
    );
    continue;
  }

  console.log(`Starting transcription job ${job.id}.`);
  try {
    const result = await runTranscription(job.sourcePath, (progress) =>
      updateProgress(db, job.id, progress),
    );
    completeJob(db, job, result.language, result.segments, result.words);
    console.log(
      `Completed transcription job ${job.id} (${result.segments.length} segments).`,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Неизвестная ошибка транскрипции.";
    failJob(db, job, message);
    console.error(`Transcription job ${job.id} failed: ${message}`);
  }
}

db.close();
console.log("Local worker stopped.");

function renderErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/chrome|chromium|browser/i.test(message)) {
    return "Chromium для Remotion недоступен. Проверьте установку Remotion и повторите рендер.";
  }
  if (
    /FFmpeg|ffprobe|исходное видео|разрешение|аудиодорожка|длительность|MP4/.test(
      message,
    )
  ) {
    return message;
  }
  return "Локальный Remotion-рендер завершился с ошибкой. Подробности записаны в лог worker.";
}
