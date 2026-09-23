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
  Play,
  Plus,
  Scissors,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
import {
  useAiPromptQuery,
  useClipsQuery,
  useDownloadAiPackageMutation,
  useImportClipsMutation,
  useUpdateClipMutation,
  useValidateClipsMutation,
} from "./queries/clips";
import {
  useCreateProjectMutation,
  useProjectQuery,
  useProjectsQuery,
} from "./queries/projects";
import {
  useJobsQuery,
  useStartTranscriptionMutation,
  useTranscriptQuery,
} from "./queries/transcription";
import {
  useRenderResultsQuery,
  useStartRenderMutation,
} from "./queries/render";
import { useStudio } from "./studio-context";
import type { Project } from "./types";
import type { ClipDto, ClipsValidationResult } from "@studio/contracts";

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
              Видео не отправляется в облако. Транскрипцию можно запустить на
              следующей странице после старта локального worker.
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
  return <TranscriptWorkspace project={project} />;
}

function TranscriptWorkspace({ project }: { project: Project }) {
  const jobsQuery = useJobsQuery(project.id);
  const latestJob = jobsQuery.data?.[0];
  const isProcessing =
    latestJob?.status === "queued" || latestJob?.status === "running";
  const transcriptQuery = useTranscriptQuery(project.id, isProcessing);
  const { refetch: refetchTranscript } = transcriptQuery;
  const startMutation = useStartTranscriptionMutation(project.id);
  const transcript = transcriptQuery.data;
  const segments = transcript?.segments ?? [];

  useEffect(() => {
    if (latestJob?.status === "completed") void refetchTranscript();
  }, [latestJob?.status, refetchTranscript]);

  return (
    <>
      <ProjectHeader project={project} active="transcript" />
      {latestJob?.status === "failed" && (
        <Notice tone="error">
          <AlertCircle />
          <div>
            <strong>Транскрипция остановлена</strong>
            <p>
              {latestJob.errorMessage ?? "Неизвестная ошибка транскрипции."}
            </p>
          </div>
        </Notice>
      )}
      {startMutation.isError && (
        <Notice tone="error">
          <AlertCircle />
          <div>
            <strong>Не удалось запустить транскрипцию</strong>
            <p>{startMutation.error.message}</p>
          </div>
        </Notice>
      )}
      <div className="workspace-grid">
        <section className="panel transcript-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Текст с таймкодами</span>
              <h2>Транскрипт</h2>
            </div>
            <span className="language-pill">
              <Languages /> {transcript?.language ?? project.language}
            </span>
          </div>
          {isProcessing && (
            <div className="progress-card">
              <div className="progress-copy">
                <span>
                  <LoaderCircle className="spin" />
                  {latestJob.status === "queued"
                    ? "Ожидает worker"
                    : "Транскрипция на устройстве"}
                </span>
                <strong>{latestJob.progress}%</strong>
              </div>
              <div className="progress-track">
                <i style={{ width: `${latestJob.progress}%` }} />
              </div>
              <p>
                Модель: {latestJob.model}. При первом запуске её скачивание
                может занять несколько минут; точный прогресс загрузки модель не
                сообщает.
              </p>
            </div>
          )}
          {!latestJob || latestJob.status === "failed" ? (
            <EmptyState
              icon={<FileText />}
              title={latestJob ? "Попробуйте ещё раз" : "Транскрипта пока нет"}
              text="Запустите локальный worker, затем начните транскрипцию. Одновременно обрабатывается одна запись."
              action={
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || !project.mediaInfo}
                >
                  {startMutation.isPending ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <Play />
                  )}
                  {latestJob ? "Повторить транскрипцию" : "Начать транскрипцию"}
                </Button>
              }
            />
          ) : segments.length > 0 ? (
            <div className="transcript-list">
              {segments.map((segment) => (
                <div key={segment.id}>
                  <button
                    aria-label={`Перейти к ${formatDuration(segment.startSeconds)}`}
                  >
                    <Play />
                    {formatDuration(segment.startSeconds)}
                  </button>
                  <p>{segment.text}</p>
                  <span>#{segment.segmentIndex + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={
                isProcessing ? <LoaderCircle className="spin" /> : <FileText />
              }
              title={
                isProcessing ? "Распознаём речь" : "В записи нет сегментов"
              }
              text={
                isProcessing
                  ? "Готовые сегменты появятся после успешного завершения задачи."
                  : "Транскрипция завершилась, но распознаваемой речи не найдено."
              }
            />
          )}
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
                <dd>{transcript?.language ?? project.language}</dd>
              </div>
              <div>
                <dt>
                  <FileText /> Сегментов
                </dt>
                <dd>{segments.length}</dd>
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
            {latestJob?.status === "completed" ? (
              <Link
                className="button button-primary"
                to={`/projects/${project.id}/ai-export`}
              >
                Подготовить пакет <ArrowRight />
              </Link>
            ) : (
              <Button disabled>
                Сначала получите транскрипт <ArrowRight />
              </Button>
            )}
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
    url: "https://chatgpt.com/",
  },
  {
    id: "claude",
    name: "Claude",
    mark: "C",
    hint: "Используйте те же файлы и попросите вернуть только JSON.",
    url: "https://claude.ai/new",
  },
  {
    id: "gemini",
    name: "Gemini",
    mark: "✦",
    hint: "Добавьте транскрипт и схему ответа в новый диалог.",
    url: "https://gemini.google.com/app",
  },
  {
    id: "generic",
    name: "Другой AI",
    mark: "•••",
    hint: "Скопируйте промпт и приложите все файлы вручную.",
    url: null,
  },
];

export function AiExportPage() {
  const project = useProject();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  return <AiExportWorkspace project={project} />;
}

function AiExportWorkspace({ project }: { project: Project }) {
  const [selected, setSelected] = useState("chatgpt");
  const [copied, setCopied] = useState(false);
  const promptQuery = useAiPromptQuery(project.id);
  const downloadMutation = useDownloadAiPackageMutation(project.id);
  const provider = providers.find((item) => item.id === selected)!;

  async function copyPrompt() {
    if (!promptQuery.data) return;
    await navigator.clipboard.writeText(promptQuery.data.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function downloadPackage() {
    const result = await downloadMutation.mutateAsync();
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.name;
    link.click();
    URL.revokeObjectURL(url);
  }

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
          <Button
            variant="secondary"
            disabled={!provider.url}
            onClick={() =>
              provider.url &&
              window.open(provider.url, "_blank", "noopener,noreferrer")
            }
          >
            <ArrowRight />
            {provider.url
              ? `Открыть ${provider.name}`
              : "Откройте свой AI вручную"}
          </Button>
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
              onClick={() => void copyPrompt()}
              disabled={!promptQuery.data || promptQuery.isPending}
              variant="secondary"
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Промпт скопирован" : "Скопировать промпт"}
            </Button>
            <Button
              onClick={() => void downloadPackage()}
              disabled={downloadMutation.isPending}
            >
              {downloadMutation.isPending ? (
                <LoaderCircle className="spin" />
              ) : (
                <Download />
              )}
              Скачать AI-пакет
            </Button>
          </div>
          {(promptQuery.isError || downloadMutation.isError) && (
            <p className="form-error">
              <AlertCircle />
              {promptQuery.error?.message ?? downloadMutation.error?.message}
            </p>
          )}
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
        >
          У меня есть JSON <ArrowRight />
        </Link>
      </div>
    </>
  );
}

export function AiImportPage() {
  const project = useProject();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  return <AiImportWorkspace project={project} />;
}

function AiImportWorkspace({ project }: { project: Project }) {
  const [value, setValue] = useState("");
  const [validation, setValidation] = useState<ClipsValidationResult | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const validateMutation = useValidateClipsMutation(project.id);
  const importMutation = useImportClipsMutation(project.id);
  const navigate = useNavigate();

  function changeValue(next: string) {
    setValue(next);
    setValidation(null);
    validateMutation.reset();
    importMutation.reset();
  }

  async function validate() {
    setValidation(await validateMutation.mutateAsync(value));
  }

  async function confirmImport() {
    await importMutation.mutateAsync(value);
    navigate(`/projects/${project.id}/clips`);
  }

  return (
    <>
      <ProjectHeader project={project} active="ai-import" />
      <div className="import-layout">
        <section>
          <PageTitle
            eyebrow="Импорт ответа"
            title="Вставьте JSON от AI"
            text="Сначала backend проверит недоверенный ответ. Сохранение произойдёт только после вашего подтверждения."
          />
          <div className="panel json-panel">
            <div className="json-toolbar">
              <span>
                <i /> JSON
              </span>
              <button onClick={() => fileRef.current?.click()}>
                <Upload /> Загрузить .json
              </button>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void file.text().then(changeValue);
                  event.target.value = "";
                }}
              />
            </div>
            <textarea
              aria-label="JSON от AI"
              value={value}
              onChange={(e) => {
                changeValue(e.target.value);
              }}
              placeholder={'{\n  "schemaVersion": 1,\n  "clips": [...]\n}'}
              spellCheck={false}
            />
            {validateMutation.isError && (
              <div className="inline-error">
                <AlertCircle />
                <span>
                  <strong>Проверьте данные</strong>
                  {validateMutation.error.message}
                </span>
              </div>
            )}
            <div className="json-actions">
              <span>{value.length.toLocaleString("ru-RU")} символов</span>
              <Button
                onClick={() => void validate()}
                disabled={!value.trim() || validateMutation.isPending}
              >
                {validateMutation.isPending && (
                  <LoaderCircle className="spin" />
                )}
                Проверить JSON <ArrowRight />
              </Button>
            </div>
          </div>
          {validation && (
            <section className="validation-preview panel">
              <div className="panel-heading">
                <h3>Результат проверки</h3>
                <span className="small-pill">
                  {validation.valid ? "Можно импортировать" : "Есть ошибки"}
                </span>
              </div>
              {validation.errors.length > 0 && (
                <div className="validation-list validation-errors">
                  <strong>Ошибки</strong>
                  {validation.errors.map((item, index) => (
                    <p key={`${item.code}-${index}`}>
                      <AlertCircle /> {item.message}
                    </p>
                  ))}
                </div>
              )}
              {validation.warnings.length > 0 && (
                <div className="validation-list validation-warnings">
                  <strong>Предупреждения</strong>
                  {validation.warnings.map((item, index) => (
                    <p key={`${item.code}-${index}`}>
                      <AlertCircle /> {item.message}
                    </p>
                  ))}
                </div>
              )}
              {validation.preview && (
                <div className="preview-clips">
                  {validation.preview.clips.map((clip, index) => (
                    <article key={`${clip.start}-${clip.end}-${index}`}>
                      <strong>
                        {index + 1}. {clip.title}
                      </strong>
                      <span>
                        {clip.start.toFixed(1)}–{clip.end.toFixed(1)} сек. ·{" "}
                        {clip.hookScore}/10
                      </span>
                      <p>{clip.reason}</p>
                    </article>
                  ))}
                </div>
              )}
              {importMutation.isError && (
                <p className="form-error">
                  <AlertCircle />
                  {importMutation.error.message}
                </p>
              )}
              <Button
                onClick={() => void confirmImport()}
                disabled={!validation.valid || importMutation.isPending}
              >
                {importMutation.isPending && <LoaderCircle className="spin" />}
                Подтвердить импорт
              </Button>
            </section>
          )}
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
                Каждое поле повторно проверяется во время подтверждённого
                импорта.
              </p>
            </div>
          </Notice>
        </aside>
      </div>
    </>
  );
}

function ClipCard({
  clip,
  index,
  overlapText,
}: {
  clip: ClipDto;
  index: number;
  overlapText?: string;
}) {
  const [draft, setDraft] = useState({
    title: clip.title,
    start: clip.start,
    end: clip.end,
    openingCaption: clip.openingCaption,
    enabled: clip.enabled,
  });
  const updateMutation = useUpdateClipMutation(clip.projectId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  useEffect(() => {
    setDraft({
      title: clip.title,
      start: clip.start,
      end: clip.end,
      openingCaption: clip.openingCaption,
      enabled: clip.enabled,
    });
  }, [clip]);
  const togglePreview = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    video.currentTime = draft.start;
    await video.play();
    setIsPreviewing(true);
  };
  return (
    <article
      className={draft.enabled ? "clip-card" : "clip-card clip-disabled"}
    >
      <div className="clip-preview">
        <video
          ref={videoRef}
          preload="metadata"
          src={`/api/projects/${encodeURIComponent(clip.projectId)}/source/media`}
          onTimeUpdate={(event) => {
            if (event.currentTarget.currentTime >= draft.end) {
              event.currentTarget.pause();
              setIsPreviewing(false);
            }
          }}
          onPause={() => setIsPreviewing(false)}
        />
        <button
          aria-label={
            isPreviewing ? "Остановить фрагмент" : "Воспроизвести фрагмент"
          }
          onClick={togglePreview}
        >
          <Play />
        </button>
        <span className="preview-duration">
          {formatDuration(draft.end - draft.start)}
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
              checked={draft.enabled}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  enabled: e.target.checked,
                }))
              }
            />
            <span />
          </label>
        </div>
        <input
          className="title-input"
          value={draft.title}
          onChange={(e) =>
            setDraft((current) => ({ ...current, title: e.target.value }))
          }
        />
        <p>{clip.reason}</p>
        <div className="clip-caption">
          <Subtitles />
          <input
            aria-label="Opening caption"
            value={draft.openingCaption}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                openingCaption: e.target.value,
              }))
            }
          />
        </div>
        {overlapText && (
          <div className="overlap-warning">
            <AlertCircle /> {overlapText}
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
              value={draft.start}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  start: Number(e.target.value),
                }))
              }
            />
          </label>
          <span>→</span>
          <label>
            Конец
            <input
              type="number"
              step="0.1"
              value={draft.end}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  end: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
        <small>Длительность: {(draft.end - draft.start).toFixed(1)} сек.</small>
        {updateMutation.isError && (
          <p className="form-error">
            <AlertCircle />
            {updateMutation.error.message}
          </p>
        )}
        <Button
          onClick={() =>
            updateMutation.mutate({ clipId: clip.id, patch: draft })
          }
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <LoaderCircle className="spin" />
          ) : (
            <Check />
          )}
          Сохранить
        </Button>
      </div>
    </article>
  );
}

export function ClipsPage() {
  const project = useProject();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  return <ClipsWorkspace project={project} />;
}

function ClipsWorkspace({ project }: { project: Project }) {
  const query = useClipsQuery(project.id);
  if (query.isPending) return <ProjectLoading />;
  if (query.isError)
    return (
      <EmptyState
        icon={<AlertCircle />}
        title="Не удалось получить clips"
        text={query.error.message}
      />
    );
  const clips = query.data;
  const enabledCount = clips.filter((clip) => clip.enabled).length;
  const overlaps = new Map<number, string>();
  clips.forEach((clip, index) => {
    for (let other = 0; other < index; other += 1) {
      const previous = clips[other]!;
      const overlap = Math.max(
        0,
        Math.min(clip.end, previous.end) - Math.max(clip.start, previous.start),
      );
      const shorter = Math.min(
        clip.end - clip.start,
        previous.end - previous.start,
      );
      if (shorter > 0 && overlap / shorter >= 0.5) {
        overlaps.set(
          index,
          `Пересекается с clip ${other + 1} на ${overlap.toFixed(1)} сек.`,
        );
        break;
      }
    }
  });
  return (
    <>
      <ProjectHeader project={project} active="clips" />
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
      {overlaps.size > 0 && (
        <Notice tone="warning">
          <AlertCircle />
          <div>
            <strong>Найдены пересечения</strong>
            <p>Предупреждения не блокируют редактирование.</p>
          </div>
        </Notice>
      )}
      <div className="clip-list">
        {clips.map((clip, index) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            index={index}
            overlapText={overlaps.get(index)}
          />
        ))}
      </div>
      <Notice>
        <CircleDashed />
        <div>
          <strong>Готово к локальному рендеру</strong>
          <p>
            {enabledCount} clips включено и будет обработано последовательно.
          </p>
        </div>
        <Link to={`/projects/${project.id}/render`}>
          Перейти к рендеру <ArrowRight />
        </Link>
      </Notice>
    </>
  );
}

export function RenderPage() {
  const project = useProject();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  return <RenderWorkspace project={project} />;
}

function RenderWorkspace({ project }: { project: Project }) {
  const query = useRenderResultsQuery(project.id);
  const start = useStartRenderMutation(project.id);
  if (query.isPending) return <ProjectLoading />;
  if (query.isError)
    return (
      <EmptyState
        icon={<AlertCircle />}
        title="Не удалось получить очередь"
        text={query.error.message}
      />
    );
  const { clips, job, results } = query.data;
  const enabled = clips.filter((clip) => clip.enabled);
  const failed = enabled.filter((clip) => clip.renderStatus === "failed");
  const active = job?.status === "queued" || job?.status === "running";
  const progress = job?.progress ?? (results.length ? 100 : 0);
  return (
    <>
      <ProjectHeader project={project} active="render" />
      <PageTitle
        eyebrow="Очередь рендера"
        title="Собираем вертикальные ролики"
        text="FFmpeg нормализует исходник, затем Remotion собирает MP4 с captions и субтитрами."
        action={
          <Button
            onClick={() => start.mutate({})}
            disabled={active || !enabled.length || start.isPending}
          >
            {active ? <LoaderCircle className="spin" /> : <Play />}
            {results.length ? "Рендерить недостающие" : "Начать рендер"}
          </Button>
        }
      />
      <div className="render-overview panel">
        <div
          className="render-ring"
          style={{
            background: `conic-gradient(var(--violet) ${progress}%, #e6e8ed 0)`,
          }}
        >
          <span>{progress}%</span>
        </div>
        <div>
          <span className="eyebrow">Общий прогресс</span>
          <h2>
            {active
              ? "Worker обрабатывает очередь"
              : results.length
                ? "Готовые клипы сохранены"
                : "Очередь готова к запуску"}
          </h2>
          <p>Центральное кадрирование · 1080 × 1920 · MP4</p>
          <div className="progress-track">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        {failed.length > 0 && !active && (
          <Button
            variant="secondary"
            onClick={() =>
              start.mutate({ clipIds: failed.map((clip) => clip.id) })
            }
          >
            Повторить failed ({failed.length})
          </Button>
        )}
      </div>
      {start.isError && (
        <Notice tone="warning">
          <AlertCircle />
          <div>
            <strong>Рендер не запущен</strong>
            <p>{start.error.message}</p>
          </div>
        </Notice>
      )}
      <div className="queue panel">
        <div className="panel-heading">
          <h3>Очередь</h3>
          <span className="small-pill">{enabled.length} clips</span>
        </div>
        {enabled.map((clip) => {
          const state = clip.renderStatus;
          return (
            <div className="queue-row" key={clip.id}>
              <div className={`queue-icon ${state}`}>
                {state === "completed" ? (
                  <Check />
                ) : state === "queued" || state === "rendering" ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <CircleDashed />
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
                  <i style={{ width: `${clip.renderProgress}%` }} />
                </div>
                <small>
                  {state === "completed" ? "Готово" : `${clip.renderProgress}%`}
                </small>
              </div>
            </div>
          );
        })}
      </div>
      <Notice>
        <Sparkles />
        <div>
          <strong>Локальная обработка</strong>
          <p>
            Одновременно рендерится один clip. Состояние очереди хранится в
            SQLite.
          </p>
        </div>
        <Link to={`/projects/${project.id}/results`}>
          Открыть результаты <ArrowRight />
        </Link>
      </Notice>
    </>
  );
}

export function ResultsPage() {
  const project = useProject();
  if (project === undefined) return <ProjectLoading />;
  if (!project) return <MissingProject />;
  return <ResultsWorkspace project={project} />;
}

function ResultsWorkspace({ project }: { project: Project }) {
  const query = useRenderResultsQuery(project.id);
  const retry = useStartRenderMutation(project.id);
  if (query.isPending) return <ProjectLoading />;
  if (query.isError)
    return (
      <EmptyState
        icon={<AlertCircle />}
        title="Не удалось получить результаты"
        text={query.error.message}
      />
    );
  const clips = query.data.results;
  const failed = query.data.clips.filter(
    (clip) => clip.enabled && clip.renderStatus === "failed",
  );
  return (
    <>
      <ProjectHeader project={project} active="results" />
      <div className="completion-banner">
        <div className="completion-icon">
          <CheckCircle2 />
        </div>
        <div>
          <span className="eyebrow">Локальный рендер</span>
          <h1>Клипы готовы к просмотру</h1>
          <p>
            {clips.length} готовых вертикальных ролика в локальном хранилище.
          </p>
        </div>
        <Link className="button button-secondary" to="/projects">
          Все проекты
        </Link>
      </div>
      {!clips.length && (
        <EmptyState
          icon={<Film />}
          title="Готовых роликов пока нет"
          text="Запустите локальный рендер или повторите clips, завершившиеся с ошибкой."
          action={
            <Link
              className="button button-secondary"
              to={`/projects/${project.id}/clips`}
            >
              Вернуться к редактору clips
            </Link>
          }
        />
      )}
      <div className="result-grid">
        {clips.map((result, index) => (
          <article className="result-card" key={result.clip.id}>
            <div className={`result-preview result-preview-${index + 1}`}>
              <video controls preload="metadata" src={result.mediaUrl} />
              <span>{formatDuration(result.durationSeconds)}</span>
            </div>
            <div className="result-copy">
              <span className="clip-index">
                Клип {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{result.clip.title}</h3>
              <div>
                <span>1080 × 1920</span>
                <span>MP4 · {formatFileSize(result.fileSizeBytes)}</span>
                <span>
                  {result.clip.renderedAt
                    ? new Date(result.clip.renderedAt).toLocaleString("ru-RU")
                    : "Дата неизвестна"}
                </span>
              </div>
              <a
                className="button button-secondary"
                href={result.downloadUrl}
                download
              >
                <Download /> Скачать MP4
              </a>
            </div>
          </article>
        ))}
      </div>
      {failed.length > 0 && (
        <Notice tone="warning">
          <AlertCircle />
          <div>
            <strong>{failed.length} clips требуют повторной попытки</strong>
            <p>
              {failed
                .map((clip) => clip.renderError)
                .filter(Boolean)
                .join(" ")}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={retry.isPending}
            onClick={() =>
              retry.mutate({ clipIds: failed.map((clip) => clip.id) })
            }
          >
            Повторить failed
          </Button>
        </Notice>
      )}
      <Link to={`/projects/${project.id}/clips`}>
        ← Вернуться к редактору clips
      </Link>
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
                clips.reduce((sum, result) => sum + result.durationSeconds, 0),
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
