#!/usr/bin/env python3
"""Stream faster-whisper events as JSON Lines on stdout."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def fail(code: str, message: str, diagnostic: Exception | None = None) -> int:
    if diagnostic is not None:
        print(f"{type(diagnostic).__name__}: {diagnostic}", file=sys.stderr, flush=True)
    emit({"type": "error", "code": code, "message": message})
    return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local faster-whisper JSONL runner")
    parser.add_argument("--input", required=True)
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    parser.add_argument("--language", default=os.environ.get("WHISPER_LANGUAGE"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = Path(args.input)
    if not source.is_file():
        return fail("INVALID_MEDIA", "Исходный видеофайл не найден.")

    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError as error:
        return fail(
            "MISSING_DEPENDENCY",
            "faster-whisper не установлен в виртуальном окружении. Установите scripts/transcription/requirements.txt.",
            error,
        )

    try:
        model = WhisperModel(
            args.model,
            device=os.environ.get("WHISPER_DEVICE", "cpu"),
            compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        )
        segments, info = model.transcribe(
            str(source),
            language=args.language,
            vad_filter=True,
        )
        language = info.language or args.language or "unknown"
        duration = float(info.duration or 0)
        emit(
            {
                "type": "metadata",
                "language": language,
                "durationSeconds": duration,
                "model": args.model,
            }
        )

        count = 0
        for index, segment in enumerate(segments):
            text = segment.text.strip()
            if not text:
                continue
            emit(
                {
                    "type": "segment",
                    "index": index,
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "text": text,
                }
            )
            count += 1
            progress = min(99, round((float(segment.end) / duration) * 100)) if duration > 0 else 1
            emit({"type": "progress", "progress": progress})

        emit({"type": "result", "language": language, "segmentCount": count})
        return 0
    except Exception as error:  # faster-whisper exposes several backend-specific exceptions
        message = str(error).lower()
        if any(token in message for token in ("huggingface", "download", "connection", "repository")):
            return fail(
                "MODEL_DOWNLOAD_FAILED",
                f"Не удалось загрузить модель {args.model}. Проверьте интернет и повторите запуск.",
                error,
            )
        if any(token in message for token in ("invalid data", "av.error", "moov atom", "could not open")):
            return fail(
                "INVALID_MEDIA",
                "Видео повреждено или его формат не поддерживается локальным декодером.",
                error,
            )
        return fail("TRANSCRIPTION_FAILED", "Локальная транскрипция завершилась с ошибкой.", error)


if __name__ == "__main__":
    raise SystemExit(main())
