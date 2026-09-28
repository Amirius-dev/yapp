import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import { HttpError } from "../lib/http-error.js";

type AssetProbe = {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    pix_fmt?: string;
    duration?: string;
  }>;
  format?: { duration?: string };
};

async function probe(path: string, executable: string) {
  return new Promise<AssetProbe>((resolve, reject) => {
    const child = spawn(
      executable,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        path,
      ],
      { shell: false, windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new HttpError(
              503,
              "ffprobe не найден. Установите FFmpeg и повторите загрузку.",
            )
          : error,
      );
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new HttpError(
            422,
            `Не удалось прочитать media asset${stderr ? `: ${stderr.trim()}` : "."}`,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout) as AssetProbe);
      } catch {
        reject(
          new HttpError(422, "ffprobe вернул некорректные метаданные asset."),
        );
      }
    });
  });
}

export async function validateAssetSignature(
  path: string,
  kind: "music" | "image",
) {
  const handle = await open(path, "r");
  const header = Buffer.alloc(12);
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }
  if (kind === "image") {
    const png = header
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const webp =
      header.subarray(0, 4).toString("ascii") === "RIFF" &&
      header.subarray(8, 12).toString("ascii") === "WEBP";
    if (!png && !jpeg && !webp)
      throw new HttpError(
        415,
        "Содержимое файла не похоже на PNG, JPG или WebP.",
      );
  }
}

export async function inspectEditorAsset(
  path: string,
  kind: "music" | "image",
  executable: string,
) {
  await validateAssetSignature(path, kind);
  const metadata = await probe(path, executable);
  if (kind === "image") {
    const stream = metadata.streams?.find(
      (item) => item.codec_type === "video",
    );
    if (!stream?.width || !stream.height)
      throw new HttpError(422, "Не удалось определить размеры изображения.");
    return {
      durationSeconds: null,
      width: stream.width,
      height: stream.height,
    };
  }
  const duration = Number(
    metadata.format?.duration ?? metadata.streams?.[0]?.duration,
  );
  if (!Number.isFinite(duration) || duration <= 0)
    throw new HttpError(422, "Не удалось определить длительность аудиофайла.");
  return { durationSeconds: duration, width: null, height: null };
}

export async function generateWaveform(
  path: string,
  durationSeconds: number,
  executable: string,
  points = 512,
) {
  const sampleRate = 4000;
  const samplesPerPoint = Math.max(
    1,
    Math.ceil((durationSeconds * sampleRate) / points),
  );
  return new Promise<number[]>((resolve, reject) => {
    const child = spawn(
      executable,
      [
        "-v",
        "error",
        "-i",
        path,
        "-ac",
        "1",
        "-ar",
        String(sampleRate),
        "-f",
        "s16le",
        "pipe:1",
      ],
      { shell: false, windowsHide: true },
    );
    const peaks: number[] = [];
    let sampleCount = 0;
    let currentPeak = 0;
    let remainder: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.stdout.on("data", (chunk: Buffer) => {
      const data = remainder.length ? Buffer.concat([remainder, chunk]) : chunk;
      const usable = data.length - (data.length % 2);
      for (let offset = 0; offset < usable; offset += 2) {
        currentPeak = Math.max(
          currentPeak,
          Math.abs(data.readInt16LE(offset)) / 32768,
        );
        sampleCount += 1;
        if (sampleCount >= samplesPerPoint) {
          peaks.push(currentPeak);
          sampleCount = 0;
          currentPeak = 0;
        }
      }
      remainder = data.subarray(usable);
    });
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "ENOENT"
          ? new HttpError(
              503,
              "FFmpeg не найден. Установите FFmpeg для waveform.",
            )
          : error,
      ),
    );
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new HttpError(
            422,
            `Не удалось построить waveform${stderr ? `: ${stderr.trim()}` : "."}`,
          ),
        );
        return;
      }
      if (sampleCount) peaks.push(currentPeak);
      const maximum = Math.max(...peaks, 0.0001);
      resolve(
        peaks
          .slice(0, points)
          .map((peak) => Number((peak / maximum).toFixed(4))),
      );
    });
  });
}
