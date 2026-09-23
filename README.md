# Personal AI Video Studio

Локальное приложение для личного использования с двумя режимами:

1. **Long video to Shorts** — загрузить длинное видео, получить транскрипцию, выбрать лучшие фрагменты с помощью любого AI и автоматически собрать 10–20 вертикальных роликов.
2. **Idea to Video** — ввести тему, получить от AI сценарий и план сцен, затем собрать видео через Remotion.

Первая версия должна реализовать только `Long video to Shorts`. Второй режим отображается в интерфейсе как `Coming soon`.

## Почему полуавтоматический режим

Приложение не вызывает платные AI API. Оно подготавливает пакет анализа, который пользователь вручную отправляет в ChatGPT, Claude или Gemini. AI возвращает JSON, пользователь импортирует его обратно, после чего локальные инструменты выполняют монтаж.

Это позволяет использовать существующие подписки и не требует API-биллинга. В будущем ручной шаг можно заменить провайдерами API или CLI, не меняя остальную обработку.

## Стек MVP

- Monorepo: `pnpm workspaces`
- Frontend: React, TypeScript, Vite, React Router, TanStack Query
- UI: Tailwind CSS и собственные простые компоненты
- Backend: Node.js, TypeScript, Fastify
- Validation: Zod
- Database: SQLite с Drizzle ORM
- Background jobs: простая таблица jobs и один локальный worker
- Video: FFmpeg и ffprobe
- Transcription: локальный `faster-whisper` через отдельный Python-скрипт
- Rendering: Remotion
- Tests: Vitest только для важной бизнес-логики

На первом этапе не использовать Docker, Redis, Kubernetes, микросервисы, брокеры сообщений и облачное хранилище.

## Общая архитектура

```text
apps/
  web/                 React UI
  api/                 Fastify HTTP API
  worker/              фоновые локальные задачи
packages/
  contracts/           Zod-схемы и общие TypeScript-типы
  video-core/          ffprobe, FFmpeg, таймкоды и клипы
  remotion-video/      композиции и шаблоны
scripts/
  transcription/       faster-whisper Python runner
data/
  uploads/             исходные видео, не добавлять в Git
  projects/            файлы обработки конкретных проектов
docs/
  AI_WORKFLOW.md
AGENTS.md
```

Backend управляет проектами и задачами. Worker выполняет тяжёлую локальную обработку. Frontend только вызывает API и показывает состояние.

## Пользовательский сценарий Long video to Shorts

### Шаг 1. Создание проекта

Пользователь нажимает `Long video to Shorts`, вводит название и загружает собственный видеофайл.

Backend создаёт проект и сохраняет файл:

```text
data/projects/{projectId}/source/video.mp4
```

### Шаг 2. Анализ медиа

Worker запускает `ffprobe` и сохраняет:

- длительность;
- разрешение;
- FPS;
- наличие аудио;
- размер файла.

Результат хранится в `media-info.json`.

### Шаг 3. Транскрипция

FFmpeg извлекает mono WAV 16 kHz. Python-скрипт запускает `faster-whisper` и возвращает сегменты с таймкодами.

Формат:

```json
{
  "language": "ru",
  "durationSeconds": 7200,
  "segments": [
    {
      "id": 1,
      "start": 12.4,
      "end": 18.8,
      "text": "Большинство людей допускают одну ошибку..."
    }
  ]
}
```

### Шаг 4. Экспорт для AI

Пользователь выбирает ChatGPT, Claude, Gemini или Generic. Приложение создаёт:

- `AI_PROMPT.md` с точной инструкцией;
- `transcript.json` или несколько частей при большом размере;
- `clips.schema.json` с ожидаемым форматом ответа.

Приложение показывает три действия:

1. `Скопировать промпт`;
2. `Скачать пакет`;
3. `Открыть выбранный AI`.

Пользователь самостоятельно прикрепляет файлы к AI.

### Шаг 5. Импорт ответа AI

AI должен вернуть только JSON со списком клипов. Пользователь вставляет JSON или загружает файл.

Backend валидирует его через Zod:

- начало меньше конца;
- фрагмент находится внутри видео;
- клипы не короче 15 и не длиннее 90 секунд;
- нет опасных пересечений;
- обязательные поля заполнены.

Невалидный JSON не запускает монтаж. UI показывает конкретные ошибки.

### Шаг 6. Редактор клипов

Перед рендером пользователь видит список найденных моментов и может:

- просмотреть фрагмент;
- изменить начало и конец;
- изменить заголовок;
- отключить клип;
- выбрать стиль субтитров;
- выбрать способ кадрирования.

### Шаг 7. Рендер

Для каждого подтверждённого клипа worker:

1. вырезает исходный диапазон через FFmpeg;
2. приводит видео к вертикальному формату 1080×1920;
3. создаёт слова или фразы субтитров с таймкодами;
4. передаёт данные в Remotion;
5. рендерит MP4;
6. сохраняет превью и итоговый файл.

Первая версия поддерживает только безопасное кадрирование по центру. Автоматическое слежение за лицом добавляется позже.

## Режим Idea to Video после MVP

Пользователь вводит тему, длительность, стиль и язык. Приложение экспортирует AI-пакет и ожидает `storyboard.json`:

```json
{
  "title": "Что если бы Златан перешёл в Реал?",
  "voiceover": "Полный текст озвучки...",
  "scenes": [
    {
      "start": 0,
      "duration": 4,
      "voiceText": "В 2010 году футбол мог измениться навсегда.",
      "visualPrompt": "Bernabeu at night, cinematic",
      "assetPath": null,
      "animation": "slowZoom"
    }
  ]
}
```

Сначала пользователь вручную добавляет изображения и видео для сцен. Позже можно подключить генерацию изображений, TTS и библиотеки стоковых материалов.

## Основные страницы

```text
/
  выбор режима
/projects
  список проектов
/projects/new/long-video
  создание проекта и загрузка
/projects/:id/transcript
  состояние транскрипции и просмотр текста
/projects/:id/ai-export
  выбор AI и экспорт пакета
/projects/:id/ai-import
  импорт и проверка clips.json
/projects/:id/clips
  редактор предложенных фрагментов
/projects/:id/render
  очередь и прогресс рендера
/projects/:id/results
  просмотр и скачивание результатов
```

## Состояния проекта

```text
created
uploading
probing
transcribing
ready_for_ai
waiting_for_ai_result
reviewing_clips
rendering
completed
failed
```

Backend является источником истины. Frontend не должен самостоятельно угадывать следующий статус.

## Минимальные таблицы

### projects

- id
- name
- mode
- status
- source_file_path
- duration_seconds
- language
- created_at
- updated_at
- error_message

### transcript_segments

- id
- project_id
- start_seconds
- end_seconds
- text

### clips

- id
- project_id
- title
- start_seconds
- end_seconds
- hook_score
- reason
- enabled
- render_status
- output_file_path

### jobs

- id
- project_id
- type
- status
- progress
- payload_json
- error_message
- created_at
- started_at
- finished_at

## API MVP

```text
POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects/:id/source
POST   /api/projects/:id/transcription
GET    /api/projects/:id/transcript
POST   /api/projects/:id/ai-package
POST   /api/projects/:id/clips/import
GET    /api/projects/:id/clips
PATCH  /api/projects/:id/clips/:clipId
POST   /api/projects/:id/render
GET    /api/projects/:id/jobs
GET    /api/projects/:id/results
```

## Локальный запуск после Этапа 2

Требования: Node.js 20+, pnpm и FFmpeg с `ffprobe`. Если pnpm ещё не включён,
выполните `corepack enable` один раз. На macOS FFmpeg можно установить через
Homebrew:

```bash
brew install ffmpeg
```

```bash
pnpm install
pnpm dev
```

Команда запускает Fastify API на `http://127.0.0.1:3001` и Vite frontend на
адресе, который напечатает Vite (обычно `http://localhost:5173`). Проекты и
метаданные сохраняются в `data/studio.sqlite`, исходные видео — в
`data/projects/{projectId}/source/`. Транскрипт и последующие страницы пока
остаются демонстрационными.

Сервисы также можно запустить отдельно:

```bash
pnpm dev:api
pnpm dev:web
```

Проверки проекта:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Этапы разработки

### Этап 1 — UI на моках

- создать monorepo;
- реализовать навигацию и страницы;
- стартовый экран с двумя режимами;
- мастер Long video to Shorts;
- использовать фиктивные проекты и клипы;
- добиться понятного интерфейса до подключения обработки.

### Этап 2 — проекты и загрузка

- Fastify API;
- SQLite;
- создание проекта;
- загрузка локального файла;
- ffprobe;
- отображение метаданных.

### Этап 3 — транскрипция

- faster-whisper;
- фоновые jobs;
- прогресс;
- сохранение сегментов;
- страница транскрипта.

### Этап 4 — ручной AI-мост

- создание AI-пакета;
- шаблоны промптов;
- импорт JSON;
- Zod-валидация;
- понятные ошибки;
- редактор клипов.

### Этап 5 — монтаж

- FFmpeg clipping;
- вертикальное кадрирование;
- субтитры;
- первая Remotion-композиция;
- очередь рендера;
- результаты.

### Этап 6 — улучшения

- определение активного лица;
- оценка тишины и границ фразы;
- waveform editor;
- несколько стилей субтитров;
- CLI-провайдеры;
- режим Idea to Video.

## Критерий готовности MVP

MVP готов, если пользователь может загрузить принадлежащее ему видео, локально получить транскрипцию, экспортировать её в любой AI, импортировать корректный JSON и получить минимум один готовый вертикальный MP4 с субтитрами.

## Первый запрос к Codex

```text
Прочитай README.md и AGENTS.md полностью. Пока ничего не реализуй. Проверь предложенную архитектуру для личного локального MVP и найди противоречия или недостающие решения. Затем составь детальный план только для Этапа 1. Не проектируй будущие микросервисы и не подключай AI API.
```

После проверки:

```text
Реализуй Этап 1 из README.md. Создай React-интерфейс на моковых данных. После изменений запусти formatter, typecheck и тест сборки. Покажи изменённые файлы и объясни, как запустить проект.
```
