# Local transcription environment

Create the virtual environment from the repository root:

```bash
python3 -m venv scripts/transcription/.venv
scripts/transcription/.venv/bin/python -m pip install --upgrade pip
scripts/transcription/.venv/bin/python -m pip install -r scripts/transcription/requirements.txt
```

The worker uses the `small` model by default. Use `tiny` for development:

```bash
WHISPER_MODEL=tiny pnpm dev
```

Optional settings:

- `WHISPER_LANGUAGE=ru` skips language auto-detection;
- `WHISPER_PYTHON=/absolute/path/to/python` uses another Python interpreter;
- `WHISPER_DEVICE` and `WHISPER_COMPUTE_TYPE` are passed to faster-whisper.

The first run downloads the selected model. Model files are kept in the normal
Hugging Face cache and are not stored in this repository.
