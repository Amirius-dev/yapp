# Manual AI workflow

## Purpose

The manual bridge allows ChatGPT, Claude, Gemini, or another model to select clips without giving the application an API key.

## Export package

For each project, generate a directory or ZIP containing:

```text
ai-package/
  AI_PROMPT.md
  transcript.json
  clips.schema.json
  project-context.json
```

For very long transcripts, split only at segment boundaries:

```text
transcript-part-001.json
transcript-part-002.json
```

Every part repeats the original absolute timestamps. Never reset time to zero for each part.

## Prompt template

```text
You are selecting short vertical clips from a long video.

Analyze the attached transcript. Return 10 to 20 self-contained moments that can work as Shorts, Reels, or TikTok clips.

Selection criteria:
- an immediate hook or strong statement near the beginning;
- a complete idea with understandable context;
- emotional, surprising, useful, controversial, or memorable content;
- natural start and end boundaries;
- target duration 25 to 60 seconds;
- absolute allowed duration 15 to 90 seconds;
- avoid duplicate or heavily overlapping moments;
- do not invent words or timestamps.

For each clip include:
- title;
- exact start and end seconds from the transcript;
- hook score from 1 to 10;
- one-sentence reason;
- opening caption of at most 12 words;
- relevant transcript segment IDs.

Return valid JSON only. Follow clips.schema.json. Do not include Markdown fences or commentary.
```

## Import validation

Reject the entire import when JSON cannot be parsed or the root format is invalid. For individual clips, report field-level errors and allow the user to fix or remove them.

Validation rules:

- `start >= 0`;
- `end <= project.durationSeconds`;
- `end > start`;
- duration between 15 and 90 seconds;
- hook score is an integer from 1 to 10;
- title and reason are not empty;
- referenced segment IDs exist;
- overlapping clips receive a warning;
- identical ranges are rejected.

## Provider presets

Provider selection changes only helper text and the link opened by the UI. It must not change the normalized JSON contract.

### ChatGPT

Recommend attaching `AI_PROMPT.md`, `transcript.json`, and `clips.schema.json` in a new chat.

### Claude

Use the same files and require JSON-only output.

### Gemini

Use the same transcript workflow. A future optional mode may also attach the source video for visual review.

### Generic

Copy the prompt and download all files without provider-specific assumptions.

## Future CLI automation

CLI providers may later implement a shared interface:

```ts
type AnalysisProvider = {
  id: string;
  isAvailable(): Promise<boolean>;
  analyze(input: AnalysisInput): Promise<ClipSuggestionResult>;
};
```

Possible adapters include Codex CLI, Claude Code, Gemini CLI, a local Ollama model, and paid APIs. Keep this out of the MVP until manual export/import is stable.
