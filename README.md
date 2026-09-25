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
/projects/:id/clips/:clipId/editor
  полноэкранный монтажный редактор клипа
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
ready_for_transcription
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

Настройки изображения, звука, субтитров и opening caption хранятся в
валидируемых JSON-полях клипа. Несмежные части клипа, переходы и keyframes
хранятся отдельно в `clip_ranges`, `crop_keyframes` и
`subtitle_keyframes`. Пользовательские пресеты находятся в
`editor_presets`. Старые клипы миграция автоматически превращает в один
range, не удаляя исходные данные и готовые renders.

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
POST   /api/projects/:id/clips/validate
POST   /api/projects/:id/clips/import
GET    /api/projects/:id/clips
PATCH  /api/projects/:id/clips/:clipId
GET    /api/projects/:id/clips/:clipId/editor
PUT    /api/projects/:id/clips/:clipId/editor
POST   /api/projects/:id/clips/:clipId/music
GET    /api/projects/:id/music/:fileName
GET    /api/editor/presets
POST   /api/editor/presets
DELETE /api/editor/presets/:presetId
POST   /api/projects/:id/render
GET    /api/projects/:id/jobs
GET    /api/projects/:id/results
GET    /api/projects/:id/source/media
GET    /api/projects/:id/clips/:clipId/media
```

## Локальный запуск после Этапа 7

Требования: Node.js 20+, pnpm, Python 3.9+ и FFmpeg с `ffprobe`. Если pnpm ещё
не включён, выполните `corepack enable` один раз. На macOS FFmpeg можно
установить через Homebrew:

```bash
brew install ffmpeg
```

```bash
pnpm install
python3 -m venv scripts/transcription/.venv
scripts/transcription/.venv/bin/python -m pip install --upgrade pip
scripts/transcription/.venv/bin/python -m pip install -r scripts/transcription/requirements.txt
pnpm dev
```

Команда применяет миграции и запускает Fastify API на
`http://127.0.0.1:3001`, один локальный worker и Vite frontend на адресе,
который напечатает Vite (обычно `http://localhost:5173`). Проекты, jobs и
сегменты сохраняются в `data/studio.sqlite`, исходные видео — в
`data/projects/{projectId}/source/`.

После транскрипции страница ручного AI-моста создаёт ZIP с настоящим
транскриптом, промптом, JSON Schema и контекстом проекта. Пользователь вручную
передаёт пакет выбранному AI, вставляет полученный JSON, проверяет preview и
явно подтверждает импорт. `schemaVersion: 2` поддерживает как один цельный
фрагмент, так и несколько несмежных ranges в заданном порядке; версия 1 по-
прежнему принимается и нормализуется в один range.

Полноэкранный редактор сохраняет ranges, transitions, crop/subtitle keyframes,
Fill/Fit, коррекцию изображения, настройки звука и музыки, субтитры, opening
caption и пользовательские пресеты в SQLite. Preview, worker и Remotion
используют общую output-time модель из `@studio/contracts`: пропуски между
ranges не воспроизводятся, а длительность считается как сумма частей с учётом
переходов. После сохранения устаревший render автоматически инвалидируется.

Страница рендера создаёт фоновую задачу: worker последовательно собирает
ranges и звук через FFmpeg, создаёт вертикальный ролик 1080×1920 через
Remotion, публикует H.264/AAC MP4 атомарно и проверяет итог через ffprobe.
Готовые файлы находятся в `data/projects/{projectId}/outputs/`, доступны для
просмотра и скачивания через API. Никакие AI API или CLI-агенты не вызываются.

Первый Remotion-рендер может занять больше времени: renderer подготавливает
локальный Chromium. Для рендера API, worker и frontend должны работать
одновременно; `pnpm dev` запускает все три процесса.
Если автоматическая подготовка Chromium недоступна, укажите установленный
браузер полным путём в `REMOTION_BROWSER_EXECUTABLE`.

По умолчанию worker использует модель `small`. Для быстрой разработки можно
запустить весь набор с `tiny`:

```bash
WHISPER_MODEL=tiny pnpm dev
```

При первом использовании faster-whisper скачивает выбранную модель. Это может
занять несколько минут и требует доступа к интернету; последующие запуски
используют локальный кеш. Язык определяется автоматически. Чтобы зафиксировать
его, задайте, например, `WHISPER_LANGUAGE=ru`. Если виртуальное окружение
находится в другом месте, передайте полный путь через `WHISPER_PYTHON`.

Сервисы также можно запустить отдельно:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

Перед раздельным запуском один раз примените миграции:

```bash
pnpm --filter @studio/api db:migrate
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

### Этап 5.1 — визуальная доводка монтажа

- вертикальный preview с тем же кадрированием, что и итоговый Remotion-рендер;
- ручная позиция и масштаб кадра;
- статическое положение subtitle safe-zone для каждого клипа;
- drag мышкой и touch с ограничением безопасной области;
- presets Top, Center и Bottom; Bottom используется по умолчанию;
- масштаб и выравнивание субтитров;
- сохранение `subtitleX`, `subtitleY`, `subtitleScale` и `subtitleAlign` в SQLite;
- повторный рендер после изменения визуальных настроек;
- аккуратные главная страница, список проектов и подтверждение удаления.

Timeline, keyframes и изменение положения субтитров во времени относятся к
Этапу 6 и в Этап 5.1 не входят.

### Этап 6 — продвинутый timeline editor

- word-level timestamps из faster-whisper с phrase-level fallback;
- clips из одного или нескольких упорядоченных ranges;
- общий source-to-output timeline для preview, worker и Remotion;
- crop и subtitle keyframes без интерполяции через монтажные cuts;
- шаблоны Clean, Motivational и Podcast с безопасным accent color;
- локальный preview, scrub, keyboard, mouse и touch;
- hard-cut сборка ranges и финальный Remotion-рендер 1080×1920.

Определение лица, waveform, CLI-провайдеры и Idea to Video не входят в этот
этап и остаются за пределами текущего MVP.

### Этап 7 — практичный desktop-видеоредактор

- AI-пакет `schemaVersion: 2` с одним или несколькими несмежными ranges;
- единая source/output-time модель для frontend, worker и Remotion;
- трёхпанельный desktop editor и многодорожечная монтажная шкала;
- reorder, resize, split, duplicate и удаление ranges;
- локальный draft, undo/redo, горячие клавиши и атомарное сохранение;
- Fill и Fit с синхронным размытым фоном;
- коррекция изображения, crop/subtitle keyframes и безопасные пресеты;
- громкость, fades, нормализация, шумоподавление и один локальный music track;
- расширенный стиль субтитров, opening caption и переходы между ranges;
- пользовательские пресеты и автоматическая инвалидация старого render;
- совместимый MP4: H.264/AAC, 1080×1920, 30 FPS, `yuv420p`, faststart.

Remotion является источником истины для финального изображения. Browser
preview использует те же значения и CSS-фильтры; небольшое отличие оттенков
возможно из-за цветового управления браузера и кодека. Нормализация,
шумоподавление, fades и ducking музыки слышны только после render — интерфейс
не имитирует эти FFmpeg-фильтры в реальном времени.

Текущие ограничения: без определения и сопровождения лица, waveform,
покадровой кривой громкости, нескольких музыкальных дорожек и удаления текста,
который уже был вшит в исходное видео.

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
