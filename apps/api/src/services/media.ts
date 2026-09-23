import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { dataRoot } from "../config.js";
import { HttpError } from "../lib/http-error.js";

export function resolveDataFile(relativePath: string) {
  const absolute = resolve(dataRoot, relativePath);
  if (!absolute.startsWith(`${dataRoot}${sep}`))
    throw new HttpError(400, "Некорректный путь медиафайла.");
  return absolute;
}

export function parseByteRange(header: string | undefined, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) throw new HttpError(416, "Некорректный HTTP Range.");
  const startText = match[1]!;
  const endText = match[2]!;
  let start: number;
  let end: number;
  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isInteger(suffix) || suffix <= 0)
      throw new HttpError(416, "Некорректный HTTP Range.");
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new HttpError(416, "Запрошенный диапазон недоступен.");
  return { start, end: Math.min(end, size - 1) };
}

export async function sendMedia(
  request: FastifyRequest,
  reply: FastifyReply,
  absolutePath: string,
  options: { mimeType?: string | null; download?: boolean } = {},
) {
  const info = await stat(absolutePath).catch(() => null);
  if (!info?.isFile()) throw new HttpError(404, "Медиафайл не найден.");
  const range = parseByteRange(request.headers.range, info.size);
  const mimeType = options.mimeType ?? "video/mp4";
  reply.header("accept-ranges", "bytes").header("content-type", mimeType);
  if (options.download)
    reply.header(
      "content-disposition",
      `attachment; filename="${basename(absolutePath)}"`,
    );
  if (!range) {
    return reply
      .header("content-length", info.size)
      .send(createReadStream(absolutePath));
  }
  const length = range.end - range.start + 1;
  return reply
    .status(206)
    .header("content-range", `bytes ${range.start}-${range.end}/${info.size}`)
    .header("content-length", length)
    .send(createReadStream(absolutePath, range));
}
