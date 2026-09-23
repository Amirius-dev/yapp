import { pollIntervalMs, whisperModel } from "./config.js";
import {
  claimNextJob,
  completeJob,
  failJob,
  openWorkerDatabase,
  recoverInterruptedJobs,
  updateProgress,
} from "./db.js";
import { runTranscription } from "./transcription.js";

const db = openWorkerDatabase();
const recovered = recoverInterruptedJobs(db);
console.log(
  `Transcription worker started (model=${whisperModel}, recovered=${recovered}).`,
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

  console.log(`Starting transcription job ${job.id}.`);
  try {
    const result = await runTranscription(job.sourcePath, (progress) =>
      updateProgress(db, job.id, progress),
    );
    completeJob(db, job, result.language, result.segments);
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
console.log("Transcription worker stopped.");
