import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Copy,
  Download,
  FileArchive,
  FileJson,
  FileText,
  Film,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  Languages,
  LayoutTemplate,
  LoaderCircle,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  Scissors,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  DemoBadge,
  EmptyState,
  Notice,
  PageTitle,
  ProjectHeader,
  StatusBadge,
} from "./components";
import { formatDuration, formatFileSize, statusMeta } from "./lib";
import { demoClips } from "./mock-data";
import {
  useCreateProjectMutation,
  useProjectQuery,
  useProjectsQuery,
} from "./queries/projects";
import { useStudio } from "./studio-context";
import type { Clip, Project } from "./types";

function useProject() {
  const { id } = useParams();
  const query = useProjectQuery(id);
  const { decorateProject } = useStudio();
  if (query.isPending) return undefined;
  if (!query.data) return null;
  return decorateProject(query.data);
}

function ProjectLoading() {
  return (
    <EmptyState
      icon={<LoaderCircle className="spin" />}
      title="Загружаем проект"
      text="Получаем актуальные данные из локального backend."
    />
  );
}

function MissingProject() {
  return (
    <EmptyState
      icon={<FolderOpen />}
      title="Проект не найден"
      text="Возможно, ссылка устарела или демо-проект был создан в другой сессии."
      action={
        <Link className="button button-primary" to="/projects">
          К проектам
        </Link>
      }
    />
  );
}

export function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <DemoBadge />
        <h1>
          Одна длинная запись.
          <br />
          <em>Несколько сильных историй.</em>
        </h1>
        <p>
          Cutwise помогает найти лучшие моменты и собрать вертикальные ролики —
          локально, прозрачно и без платных AI API.
        </p>
        <div className="hero-actions">
          <Link
            className="button button-primary button-large"
            to="/projects/new/long-video"
          >
            Создать первый проект <ArrowRight size={18} />
          </Link>
          <Link className="button button-secondary button-large" to="/projects">
            Открыть проекты
          </Link>
        </div>
        <div className="trust-row">
          <span>
            <ShieldCheck size={17} /> Видео остаётся на компьютере
          </span>
          <span>
            <Bot size={17} /> Любой AI через ручной экспорт
          </span>
          <span>
            <Scissors size={17} /> Детерминированный монтаж
          </span>
        </div>
      </section>
      <section className="mode-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Выберите сценарий</span>
            <h2>С чего начнём?</h2>
          </div>
          <p>
            Первый режим доступен в демо. Второй появится после завершения MVP.
          </p>
        </div>
        <div className="mode-grid">
          <Link
            to="/projects/new/long-video"
            className="mode-card mode-card-active"
          >
            <div className="mode-icon">
              <Scissors />
            </div>
            <span className="mode-tag">Доступно</span>
            <h3>Long video to Shorts</h3>
            <p>
              Превратите интервью, подкаст или лекцию в серию вертикальных
              клипов.
            </p>
            <ul>
              <li>
                <Check /> Транскрипция на устройстве
              </li>
              <li>
                <Check /> Ручной выбор AI
              </li>
              <li>
                <Check /> Контроль перед рендером
              </li>
            </ul>
            <span className="card-action">
              Начать проект <ArrowRight />
            </span>
          </Link>
          <article
            className="mode-card mode-card-disabled"
            aria-disabled="true"
          >
            <div className="mode-icon">
              <WandSparkles />
            </div>
            <span className="mode-tag">Coming soon</span>
            <h3>Idea to Video</h3>
            <p>Соберите видео из идеи, сценария и собственных материалов.</p>
            <ul>
              <li>
                <CircleDashed /> Сценарий и раскадровка
              </li>
              <li>
                <CircleDashed /> Ручной подбор материалов
              </li>
              <li>
                <CircleDashed /> Remotion-шаблоны
              </li>
            </ul>
            <span className="card-action muted">После MVP</span>
          </article>
        </div>
      </section>
      <section className="workflow-strip">
        <span className="eyebrow">Как это работает</span>
        <div>
          {[
            "Добавьте видео",
            "Получите транскрипт",
            "Передайте пакет AI",
            "Проверьте клипы",
            "Соберите ролики",
          ].map((label, index) => (
            <div key={label}>
              <span>{index + 1}</span>
              <p>{label}</p>
              {index < 4 && <ArrowRight />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ProjectsPage() {
  const query = useProjectsQuery();
  const projects = query.data ?? [];
  return (
    <>
      <PageTitle
        eyebrow="Рабочее пространство"
        title="Проекты"
        text="Все длинные видео и их текущий этап обработки."
        action={
          <Link className="button button-primary" to="/projects/new/long-video">
            <Plus size={18} /> Новый проект
          </Link>
        }
      />
      {query.isError && (
        <Notice tone="error">
          <AlertCircle />
          <div>
            <strong>Не удалось получить проекты</strong>
            <p>{query.error.message}</p>
          </div>
        </Notice>
      )}
      <div className="summary-grid">
        <div>
          <Film />
          <span>
            <strong>{projects.length}</strong>Всего проектов
          </span>
        </div>
        <div>
          <LoaderCircle />
          <span>
            <strong>
              {
                projects.filter(
                  (p) => !["completed", "failed"].includes(p.status),
                ).length
              }
            </strong>
            В работе
          </span>
        </div>
        <div>
          <CheckCircle2 />
          <span>
            <strong>
              {projects.filter((p) => p.status === "completed").length}
            </strong>
            Завершено
          </span>
        </div>
      </div>
      <div className="table-card">
        <div className="table-head">
          <span>Проект</span>
          <span>Длительность</span>
          <span>Статус</span>
          <span>Обновлён</span>
          <span />
        </div>
        {projects.map((project) => {
          const meta = statusMeta[project.status];
          return (
            <div className="project-row" key={project.id}>
              <div className="project-cell">
                <div className="file-thumb">
                  <Film />
                </div>
                <span>
                  <strong>{project.name}</strong>
                  <small>
                    {project.sourceFileName ?? "Видео ещё не загружено"}
                  </small>
                </span>
              </div>
              <span className="muted-text">
                <Clock3 size={15} />{" "}
                {project.mediaInfo
                  ? formatDuration(project.mediaInfo.durationSeconds)
                  : "—"}
              </span>
              <StatusBadge status={project.status} />
              <span className="muted-text">
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(project.updatedAt))}
              </span>
              <Link
                className="row-action"
                to={`/projects/${project.id}/${meta.route}`}
              >
                {meta.action} <ArrowRight />
              </Link>
            </div>
          );
        })}
        {!query.isPending && !query.isError && projects.length === 0 && (
          <EmptyState
            icon={<FolderOpen />}
            title="Проектов пока нет"
            text="Создайте первый проект и добавьте короткое тестовое видео."
            action={
              <Link
                className="button button-primary"
                to="/projects/new/long-video"
              >
                Создать проект
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}

export function NewProjectPage() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const createMutation = useCreateProjectMutation();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Добавьте понятное название проекта.");
    if (!file) return setError("Выберите исходный видеофайл.");
    setError("");
    try {
      const project = await createMutation.mutateAsync({
        input: { name: name.trim(), mode: "long_video_to_shorts" },
        file,
      });
      navigate(`/projects/${project.id}/transcript`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось создать проект или загрузить видео.",
      );
    }
  }

  return (
    <div className="narrow-page">
      <PageTitle
        eyebrow="Новый проект"
        title="Добавьте длинное видео"
        text="Файл сохранится только в локальной папке проекта, после чего ffprobe прочитает его метаданные."
      />
      <div className="wizard-steps">
        <span className="active">
          <b>1</b> Основное
        </span>
        <i />
        <span>
          <b>2</b> Транскрипт
        </span>
        <i />
        <span>
          <b>3</b> Короткие клипы
        </span>
      </div>
      <form className="form-card" onSubmit={submit}>
        <label className="field">
          <span>Название проекта</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="Например, Интервью о продуктивности"
          />
          <small>Название можно будет изменить позже.</small>
        </label>
        <div className="field">
          <span>Исходное видео</span>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError("");
            }}
          />
          <button
            className={file ? "drop-zone has-file" : "drop-zone"}
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <>
                <div className="upload-icon success">
                  <Check />
                </div>
                <strong>{file.name}</strong>
                <p>
                  {(file.size / 1024 / 1024).toFixed(1)} МБ · Файл выбран
                  локально
                </p>
                <span>Выбрать другой файл</span>
              </>
            ) : (
              <>
                <div className="upload-icon">
                  <Upload />
                </div>
                <strong>Перетащите видео сюда или выберите файл</strong>
                <p>MP4, MOV, WebM или MKV</p>
                <span>Выбрать видео</span>
              </>
            )}
          </button>
        </div>
        <Notice>
          <Sparkles size={18} />
          <div>
            <strong>Локальная обработка</strong>
            <p>
              Видео не отправляется в облако. Транскрипт на следующей странице
              пока останется демонстрационным до Этапа 3.
            </p>
          </div>
        </Notice>
        {error && (
          <p className="form-error">
            <AlertCircle />
            {error}
          </p>
        )}
        <div className="form-actions">
          <Link className="button button-ghost" to="/projects">
            Отмена
          </Link>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <LoaderCircle className="spin" /> Загружаем и анализируем
              </>
            ) : (
              <>
                Создать проект <ArrowRight size={18} />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function TranscriptPage() {
  const project = useProject();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  const isProcessing = project.status === "transcribing";
  return (
    <>
      <ProjectHeader project={project} active="transcript" />
      <Notice>
        <Sparkles />
        <div>
          <strong>Метаданные получены через ffprobe</strong>
          <p>
            Транскрипт ниже пока демонстрационный. Локальная транскрипция будет
            подключена на Этапе 3.
          </p>
        </div>
      </Notice>
      <div className="workspace-grid">
        <section className="panel transcript-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Текст с таймкодами</span>
              <h2>Транскрипт</h2>
            </div>
            <span className="language-pill">
              <Languages /> {project.language}
            </span>
          </div>
          {isProcessing && (
            <div className="progress-card">
              <div className="progress-copy">
                <span>
                  <LoaderCircle className="spin" /> Транскрипция в демо-режиме
                </span>
                <strong>{project.progress ?? 42}%</strong>
              </div>
              <div className="progress-track">
                <i style={{ width: `${project.progress ?? 42}%` }} />
              </div>
              <p>Можно изучить пример результата уже сейчас.</p>
            </div>
          )}
          <div className="transcript-list">
            {project.transcript.map((segment) => (
              <div key={segment.id}>
                <button
                  aria-label={`Перейти к ${formatDuration(segment.start)}`}
                >
                  <Play />
                  {formatDuration(segment.start)}
                </button>
                <p>{segment.text}</p>
                <span>#{segment.id}</span>
              </div>
            ))}
          </div>
        </section>
        <aside className="side-stack">
          <div className="panel">
            <h3>О записи</h3>
            <dl className="metadata">
              <div>
                <dt>
                  <Clock3 /> Длительность
                </dt>
                <dd>{formatDuration(project.durationSeconds)}</dd>
              </div>
              <div>
                <dt>
                  <Languages /> Язык
                </dt>
                <dd>{project.language}</dd>
              </div>
              <div>
                <dt>
                  <FileText /> Сегментов
                </dt>
                <dd>{project.transcript.length}</dd>
              </div>
              {project.mediaInfo && (
                <>
                  <div>
                    <dt>
                      <MonitorPlay /> Разрешение
                    </dt>
                    <dd>
                      {project.mediaInfo.width} × {project.mediaInfo.height}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Gauge /> FPS
                    </dt>
                    <dd>{project.mediaInfo.fps.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>
                      <FileArchive /> Размер
                    </dt>
                    <dd>{formatFileSize(project.mediaInfo.fileSizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>
                      <Film /> Аудио
                    </dt>
                    <dd>{project.mediaInfo.hasAudio ? "Есть" : "Нет"}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
          <div className="panel next-card">
            <div className="next-icon">
              <Bot />
            </div>
            <span className="eyebrow">Следующий шаг</span>
            <h3>Найдите лучшие моменты с AI</h3>
            <p>
              Экспортируйте транскрипт и инструкцию для любого удобного
              ассистента.
            </p>
            <Link
              className="button button-primary"
              to={`/projects/${project.id}/ai-export`}
            >
              Подготовить пакет <ArrowRight />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

const providers = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    mark: "◎",
    hint: "Прикрепите пакет в новом чате и отправьте подготовленный промпт.",
  },
  {
    id: "claude",
    name: "Claude",
    mark: "C",
    hint: "Используйте те же файлы и попросите вернуть только JSON.",
  },
  {
    id: "gemini",
    name: "Gemini",
    mark: "✦",
    hint: "Добавьте транскрипт и схему ответа в новый диалог.",
  },
  {
    id: "generic",
    name: "Другой AI",
    mark: "•••",
    hint: "Скопируйте промпт и приложите все файлы вручную.",
  },
];

export function AiExportPage() {
  const project = useProject();
  const [selected, setSelected] = useState("chatgpt");
  const [copied, setCopied] = useState(false);
  const { updateStatus } = useStudio();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  const provider = providers.find((item) => item.id === selected)!;
  return (
    <>
      <ProjectHeader project={project} active="ai-export" />
      <PageTitle
        eyebrow="Ручной AI-мост"
        title="Подготовьте пакет для анализа"
        text="Выбор сервиса меняет только подсказки. Формат ответа остаётся одинаковым."
      />
      <div className="export-grid">
        <section className="panel">
          <h3>1. Выберите AI</h3>
          <div className="provider-grid">
            {providers.map((item) => (
              <button
                key={item.id}
                className={selected === item.id ? "selected" : ""}
                onClick={() => setSelected(item.id)}
              >
                <span>{item.mark}</span>
                <strong>{item.name}</strong>
                {selected === item.id && <Check />}
              </button>
            ))}
          </div>
          <Notice>
            <Bot />
            <div>
              <strong>Как передать пакет в {provider.name}</strong>
              <p>{provider.hint}</p>
            </div>
          </Notice>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>2. Файлы пакета</h3>
            <span className="small-pill">4 файла</span>
          </div>
          <div className="file-list">
            <div>
              <FileText />
              <span>
                <strong>AI_PROMPT.md</strong>
                <small>Инструкция по выбору клипов</small>
              </span>
              <Check />
            </div>
            <div>
              <FileJson />
              <span>
                <strong>transcript.json</strong>
                <small>Сегменты с абсолютными таймкодами</small>
              </span>
              <Check />
            </div>
            <div>
              <LayoutTemplate />
              <span>
                <strong>clips.schema.json</strong>
                <small>Ожидаемый формат ответа</small>
              </span>
              <Check />
            </div>
            <div>
              <FileJson />
              <span>
                <strong>project-context.json</strong>
                <small>Контекст и длительность проекта</small>
              </span>
              <Check />
            </div>
          </div>
          <div className="button-stack">
            <Button
              onClick={() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              variant="secondary"
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Промпт скопирован" : "Скопировать промпт"}
            </Button>
            <Button>
              <Download /> Скачать демо-пакет
            </Button>
          </div>
        </section>
      </div>
      <div className="handoff-bar">
        <div>
          <ShieldCheck />
          <span>
            <strong>Никаких API-ключей</strong>
            <small>Вы сами отправляете пакет выбранному AI.</small>
          </span>
        </div>
        <Link
          className="button button-primary"
          to={`/projects/${project.id}/ai-import`}
          onClick={() => updateStatus(project.id, "waiting_for_ai_result")}
        >
          У меня есть JSON <ArrowRight />
        </Link>
      </div>
    </>
  );
}

const exampleJson = JSON.stringify(
  {
    schemaVersion: 1,
    projectId: "focus-not-motivation",
    clips: demoClips.slice(0, 2).map((clip) => ({
      title: clip.title,
      start: clip.start,
      end: clip.end,
      hookScore: clip.hookScore,
      reason: clip.reason,
      openingCaption: clip.openingCaption,
      segmentIds: clip.segmentIds,
    })),
  },
  null,
  2,
);

export function AiImportPage() {
  const project = useProject();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { updateStatus } = useStudio();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  const projectId = project.id;
  function validate() {
    try {
      const parsed = JSON.parse(value) as { clips?: unknown[] };
      if (!Array.isArray(parsed.clips) || parsed.clips.length === 0)
        throw new Error("В корневом объекте нужен непустой массив clips.");
      updateStatus(projectId, "reviewing_clips");
      navigate(`/projects/${projectId}/clips`);
    } catch (reason) {
      setError(
        reason instanceof SyntaxError
          ? "JSON содержит синтаксическую ошибку. Проверьте запятые и кавычки."
          : reason instanceof Error
            ? reason.message
            : "Не удалось прочитать JSON.",
      );
    }
  }
  return (
    <>
      <ProjectHeader project={project} active="ai-import" />
      <div className="import-layout">
        <section>
          <PageTitle
            eyebrow="Импорт ответа"
            title="Вставьте JSON от AI"
            text="Сейчас мы демонстрируем экран проверки. Строгая Zod-валидация появится на Этапе 4."
          />
          <div className="panel json-panel">
            <div className="json-toolbar">
              <span>
                <i /> JSON
              </span>
              <button
                onClick={() => {
                  setValue(exampleJson);
                  setError("");
                }}
              >
                Подставить пример
              </button>
            </div>
            <textarea
              aria-label="JSON от AI"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              placeholder={'{\n  "schemaVersion": 1,\n  "clips": [...]\n}'}
              spellCheck={false}
            />
            {error && (
              <div className="inline-error">
                <AlertCircle />
                <span>
                  <strong>Проверьте данные</strong>
                  {error}
                </span>
              </div>
            )}
            <div className="json-actions">
              <span>{value.length.toLocaleString("ru-RU")} символов</span>
              <Button onClick={validate} disabled={!value.trim()}>
                Проверить и продолжить <ArrowRight />
              </Button>
            </div>
          </div>
        </section>
        <aside className="side-stack import-help">
          <div className="panel">
            <h3>Перед импортом</h3>
            <ul className="check-list">
              <li>
                <Check /> Ответ содержит только JSON
              </li>
              <li>
                <Check /> Таймкоды абсолютные
              </li>
              <li>
                <Check /> Каждый клип длится 15–90 сек.
              </li>
              <li>
                <Check /> Есть ссылки на сегменты
              </li>
            </ul>
          </div>
          <Notice tone="warning">
            <AlertCircle />
            <div>
              <strong>AI-ответ недоверенный</strong>
              <p>
                Реальная версия проверит каждое поле и ничего не запустит
                автоматически.
              </p>
            </div>
          </Notice>
        </aside>
      </div>
    </>
  );
}

function ClipCard({
  project,
  clip,
  index,
}: {
  project: Project;
  clip: Clip;
  index: number;
}) {
  const { updateClip } = useStudio();
  const overlaps = index === 2;
  return (
    <article className={clip.enabled ? "clip-card" : "clip-card clip-disabled"}>
      <div className="clip-preview">
        <div className="video-placeholder">
          <span>9:16</span>
          <Play />
        </div>
        <button aria-label="Воспроизвести фрагмент">
          <Play />
        </button>
        <span className="preview-duration">
          {formatDuration(clip.end - clip.start)}
        </span>
      </div>
      <div className="clip-main">
        <div className="clip-topline">
          <span className="clip-index">
            Клип {String(index + 1).padStart(2, "0")}
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={clip.enabled}
              onChange={(e) =>
                updateClip(project.id, clip.id, { enabled: e.target.checked })
              }
            />
            <span />
          </label>
        </div>
        <input
          className="title-input"
          value={clip.title}
          onChange={(e) =>
            updateClip(project.id, clip.id, { title: e.target.value })
          }
        />
        <p>{clip.reason}</p>
        <div className="clip-caption">
          <Subtitles />
          <span>«{clip.openingCaption}»</span>
        </div>
        {overlaps && (
          <div className="overlap-warning">
            <AlertCircle /> Пересекается с клипом 1 на 22 секунды
          </div>
        )}
      </div>
      <div className="clip-settings">
        <div className="score">
          <Gauge />
          <span>
            Hook score<strong>{clip.hookScore}/10</strong>
          </span>
        </div>
        <div className="time-fields">
          <label>
            Начало
            <input
              type="number"
              step="0.1"
              value={clip.start}
              onChange={(e) =>
                updateClip(project.id, clip.id, {
                  start: Number(e.target.value),
                })
              }
            />
          </label>
          <span>→</span>
          <label>
            Конец
            <input
              type="number"
              step="0.1"
              value={clip.end}
              onChange={(e) =>
                updateClip(project.id, clip.id, { end: Number(e.target.value) })
              }
            />
          </label>
        </div>
      </div>
    </article>
  );
}

export function ClipsPage() {
  const project = useProject();
  const { updateStatus } = useStudio();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  const clips = project.clips.length ? project.clips : demoClips;
  const enabledCount = clips.filter((clip) => clip.enabled).length;
  return (
    <>
      <ProjectHeader project={{ ...project, clips }} active="clips" />
      <PageTitle
        eyebrow="Проверка предложений"
        title="Выберите лучшие моменты"
        text="Уточните границы, заголовки и отключите слабые фрагменты до рендера."
        action={
          <div className="selected-count">
            <strong>{enabledCount}</strong>
            <span>
              клипа
              <br />
              выбрано
            </span>
          </div>
        }
      />
      <Notice tone="warning">
        <AlertCircle />
        <div>
          <strong>Найдено пересечение</strong>
          <p>
            Это предупреждение не блокирует работу. Сравните клипы 1 и 3 перед
            рендером.
          </p>
        </div>
      </Notice>
      <div className="clip-list">
        {clips.map((clip, index) => (
          <ClipCard key={clip.id} project={project} clip={clip} index={index} />
        ))}
      </div>
      <div className="render-settings panel">
        <div>
          <span className="eyebrow">Настройки MVP</span>
          <h3>Формат результата</h3>
        </div>
        <div className="setting-chip">
          <MonitorPlay />
          <span>
            <small>Кадрирование</small>
            <strong>По центру · 9:16</strong>
          </span>
        </div>
        <div className="setting-chip">
          <Subtitles />
          <span>
            <small>Субтитры</small>
            <strong>Чистые · белые</strong>
          </span>
        </div>
        <span className="coming-note">Другие стили появятся позже</span>
        <Link
          className="button button-primary"
          to={`/projects/${project.id}/render`}
          onClick={() => updateStatus(project.id, "rendering")}
        >
          Подтвердить {enabledCount} клипа <ArrowRight />
        </Link>
      </div>
    </>
  );
}

export function RenderPage() {
  const project = useProject();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  const clips = (project.clips.length ? project.clips : demoClips).filter(
    (clip) => clip.enabled,
  );
  return (
    <>
      <ProjectHeader project={project} active="render" />
      <PageTitle
        eyebrow="Очередь рендера"
        title="Собираем вертикальные ролики"
        text="Это демонстрация будущего worker-процесса. Видео сейчас не обрабатывается."
        action={<DemoBadge />}
      />
      <div className="render-overview panel">
        <div className="render-ring">
          <span>68%</span>
        </div>
        <div>
          <span className="eyebrow">Общий прогресс</span>
          <h2>
            {clips.length > 1 ? "Рендерим второй клип" : "Подготавливаем клип"}
          </h2>
          <p>Центральное кадрирование · 1080 × 1920 · MP4</p>
          <div className="progress-track">
            <i style={{ width: "68%" }} />
          </div>
        </div>
        <Button variant="secondary">
          <Pause /> Приостановить
        </Button>
      </div>
      <div className="queue panel">
        <div className="panel-heading">
          <h3>Очередь</h3>
          <span className="small-pill">{clips.length} клипа</span>
        </div>
        {clips.map((clip, index) => {
          const state = index === 0 ? "completed" : "rendering";
          return (
            <div className="queue-row" key={clip.id}>
              <div className={`queue-icon ${state}`}>
                {state === "completed" ? (
                  <Check />
                ) : (
                  <LoaderCircle className="spin" />
                )}
              </div>
              <span>
                <strong>{clip.title}</strong>
                <small>
                  {formatDuration(clip.end - clip.start)} · 1080 × 1920
                </small>
              </span>
              <div className="queue-progress">
                <div className="progress-track">
                  <i
                    style={{ width: state === "completed" ? "100%" : "44%" }}
                  />
                </div>
                <small>{state === "completed" ? "Готово" : "44%"}</small>
              </div>
            </div>
          );
        })}
      </div>
      <Notice>
        <Sparkles />
        <div>
          <strong>Демо очереди</strong>
          <p>
            FFmpeg и Remotion не запускались. На Этапе 5 статусы будет обновлять
            локальный worker.
          </p>
        </div>
        <Link to={`/projects/${project.id}/results`}>
          Посмотреть пример результатов <ArrowRight />
        </Link>
      </Notice>
    </>
  );
}

export function ResultsPage() {
  const project = useProject();
  const { updateStatus } = useStudio();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  const clips = (project.clips.length ? project.clips : demoClips).filter(
    (clip) => clip.enabled,
  );
  return (
    <>
      <ProjectHeader project={project} active="results" />
      <div className="completion-banner">
        <div className="completion-icon">
          <CheckCircle2 />
        </div>
        <div>
          <span className="eyebrow">Демо завершено</span>
          <h1>Клипы готовы к просмотру</h1>
          <p>
            {clips.length} вертикальных ролика · Настоящие файлы появятся после
            подключения рендера.
          </p>
        </div>
        <Link
          className="button button-secondary"
          to="/projects"
          onClick={() => updateStatus(project.id, "completed")}
        >
          Все проекты
        </Link>
      </div>
      <div className="result-grid">
        {clips.map((clip, index) => (
          <article className="result-card" key={clip.id}>
            <div className={`result-preview result-preview-${index + 1}`}>
              <div className="fake-caption">{clip.openingCaption}</div>
              <button aria-label={`Воспроизвести ${clip.title}`}>
                <Play />
              </button>
              <span>{formatDuration(clip.end - clip.start)}</span>
            </div>
            <div className="result-copy">
              <span className="clip-index">
                Клип {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{clip.title}</h3>
              <div>
                <span>1080 × 1920</span>
                <span>MP4 · Демо</span>
              </div>
              <Button variant="secondary" disabled>
                <Download /> Файл появится на Этапе 5
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className="panel result-summary">
        <div>
          <ImageIcon />
          <span>
            <strong>{clips.length}</strong>
            <small>готовых макета</small>
          </span>
        </div>
        <div>
          <Clock3 />
          <span>
            <strong>
              {formatDuration(
                clips.reduce((sum, clip) => sum + clip.end - clip.start, 0),
              )}
            </strong>
            <small>общая длительность</small>
          </span>
        </div>
        <div>
          <FileArchive />
          <span>
            <strong>Локально</strong>
            <small>будущие MP4 не уйдут в облако</small>
          </span>
        </div>
      </div>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>Здесь пока ничего нет</h1>
      <p>Страница не найдена, но ваши демо-проекты на месте.</p>
      <Link className="button button-primary" to="/">
        Вернуться на главную
      </Link>
    </div>
  );
}
