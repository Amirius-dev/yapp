import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type {
  TranscriptSegmentDto,
  TranscriptWordDto,
} from "@studio/contracts";
import {
  assertPythonAvailable,
  pythonPath,
  runnerPath,
  whisperLanguage,
  whisperModel,
} from "./config.js";
import { parseRunnerLine } from "./jsonl.js";

export type TranscriptionResult = {
  language: string;
  segments: Omit<TranscriptSegmentDto, "id">[];
  words: Omit<TranscriptWordDto, "id">[];
};

export async function runTranscription(
  inputPath: string,
  onProgress: (progress: number) => void,
): Promise<TranscriptionResult> {
  assertPythonAvailable();
  const args = [runnerPath, "--input", inputPath, "--model", whisperModel];
  if (whisperLanguage) args.push("--language", whisperLanguage);

  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, args, { shell: false, windowsHide: true });
    const lines = createInterface({ input: child.stdout });
    const segments: Omit<TranscriptSegmentDto, "id">[] = [];
    const words: Omit<TranscriptWordDto, "id">[] = [];
    let language = "";
    let reportedError: string | null = null;
    let protocolError: Error | null = null;

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) =>
      process.stderr.write(`[whisper] ${chunk}`),
    );
    lines.on("line", (line) => {
      if (!line.trim() || protocolError) return;
      try {
        const event = parseRunnerLine(line);
        if (event.type === "metadata") language = event.language;
        if (event.type === "segment") {
          segments.push({
            segmentIndex: event.index,
            startSeconds: event.start,
            endSeconds: event.end,
            text: event.text,
          });
        }
        if (event.type === "word") {
          words.push({
            segmentIndex: event.segmentIndex,
            wordIndex: event.wordIndex,
            startSeconds: event.start,
            endSeconds: event.end,
            text: event.text,
            probability: event.probability,
          });
        }
        if (event.type === "progress") onProgress(event.progress);
        if (event.type === "result") language = event.language;
        if (event.type === "error") reportedError = event.message;
      } catch (error) {
        protocolError =
          error instanceof Error
            ? error
            : new Error("Ошибка протокола runner.");
      }
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new Error(
              "Python не найден. Проверьте WHISPER_PYTHON и виртуальное окружение.",
            )
          : error,
      );
    });
    child.on("close", (code) => {
      if (protocolError) return reject(protocolError);
      if (reportedError) return reject(new Error(reportedError));
      if (code !== 0) {
        return reject(
          new Error(
            "Транскрипция завершилась с ошибкой. Подробности записаны в лог worker.",
          ),
        );
      }
      if (!language)
        return reject(new Error("Runner не вернул определённый язык."));
      resolve({ language, segments, words });
    });
  });
}
