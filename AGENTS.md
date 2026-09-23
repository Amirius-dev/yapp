# Instructions for coding agents

## Product scope

This repository is a personal, local-first AI video studio. The first milestone is Long video to Shorts with a manual AI handoff. Do not add direct AI APIs unless the user explicitly changes this requirement.

Read `README.md` and `docs/AI_WORKFLOW.md` before planning or changing architecture.

## Developer level and communication

The owner is a junior+ developer. Produce production-quality code that remains easy to trace and learn from.

Before a large change:

1. State the goal in one paragraph.
2. List the files or modules that will change.
3. Mention any meaningful tradeoff.

After a change:

1. List changed files.
2. Explain the request flow in plain language.
3. Report commands run and their results.
4. Mention remaining limitations.

## Architecture rules

- Use TypeScript across web, API, worker, shared contracts, and Remotion.
- Use React + Vite for the web application.
- Use Fastify for the local HTTP API.
- Use SQLite + Drizzle ORM for persistence.
- Use Zod schemas as the runtime boundary for API payloads and imported AI JSON.
- Run FFmpeg, ffprobe, faster-whisper, and Remotion only from the worker or dedicated service modules.
- Keep filesystem paths on the backend. Never expose arbitrary local paths to browser input.
- Keep the backend as the source of truth for project and job status.
- Store generated media under `data/projects/{projectId}`.
- Make heavy operations resumable where practical.

## Simplicity rules

- Do not introduce Docker, Redis, Kubernetes, message brokers, microservices, event sourcing, CQRS, or cloud infrastructure for the MVP.
- Do not create interfaces for every class. Add an interface only when there are multiple implementations, a clear boundary, or a meaningful testing need.
- Do not create generic factories or dependency injection containers for simple construction.
- Prefer explicit functions and small modules over framework-like abstractions.
- Do not build features from later phases while implementing the current phase.
- Do not refactor unrelated code.
- Do not add a dependency if a short, clear implementation is sufficient.
- Comments explain why, constraints, or non-obvious behavior. They should not narrate obvious code.

## Change discipline

- Inspect existing files and `git status` before editing.
- Preserve user changes and avoid destructive Git commands.
- Make one coherent milestone at a time.
- For schema changes, include the migration in the same change.
- Validate external command availability and return actionable errors.
- Never claim that FFmpeg, Whisper, rendering, or tests succeeded without running the relevant command.

## Quality gates

For frontend-only changes, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

For backend or shared-contract changes, also run relevant unit tests.

For video-pipeline changes, use one short fixture video. Verify output with ffprobe instead of watching it manually as the only check.

Do not add broad tests that only repeat implementation details. Prioritize validation, timestamp calculations, state transitions, and command failure handling.

## Security and ownership

- Process only media supplied by the user or media they are authorized to use.
- Treat imported AI output as untrusted input and validate it with Zod.
- Never execute text returned by an AI as a shell command.
- Pass command arguments without shell interpolation.
- Restrict file operations to the configured project data directory.
- Keep source media and generated outputs out of Git.

## Manual AI handoff contract

The application exports transcript data plus a prompt. A human sends the package to an AI and imports the returned JSON.

Agents must preserve these properties:

- provider-neutral workflow;
- no requirement for an API key;
- strict JSON validation;
- editable clip suggestions before rendering;
- deterministic processing after import.

The normalized response must follow `schemas/clips.example.json` and its eventual Zod equivalent in `packages/contracts`.

## Definition of done

A feature is complete when:

- the requested behavior works end to end for its current phase;
- errors are shown in understandable language;
- relevant quality gates pass;
- documentation changes when setup or workflow changes;
- the final response explains how the owner can inspect and verify the result.
