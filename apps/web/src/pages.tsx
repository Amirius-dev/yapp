import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertCircle,
  ArrowLeft,
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
  Trash2,
  Upload,
  WandSparkles,
  X,
  Eye,
  EyeOff,
  Redo2,
  Save,
  SkipBack,
  SkipForward,
  Undo2,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Button,
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
  useDeleteProjectMutation,
  useProjectQuery,
  useProjectsQuery,
} from "./queries/projects";
import {
  useJobsQuery,
  useRegenerateTranscriptionMutation,
  useStartTranscriptionMutation,
  useTranscriptQuery,
} from "./queries/transcription";
import {
  useRenderResultsQuery,
  useStartRenderMutation,
} from "./queries/render";
import { useStudio } from "./studio-context";
import type { Project } from "./types";
import {
  buildTimeline,
  clampSubtitlePosition,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  interpolateCrop,
  interpolateSubtitle,
  imageFilterCss,
  imageTransformCss,
  outputToSourceTime,
  rangeLocalToOutputTime,
  SUBTITLE_POSITION,
  subtitleSafeWidthPercent,
  timelineDuration,
  videoTemplate,
  type ClipDto,
  type ClipsValidationResult,
  type EditorSaveInput,
} from "@studio/contracts";
import {
  useCreateEditorPresetMutation,
  useDeleteEditorPresetMutation,
  useEditorQuery,
  useSaveEditorMutation,
  useUploadEditorMusicMutation,
} from "./queries/editor";

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
      text="Возможно, проект удалён или ссылка устарела."
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
        <div className="hero-copy">
          <span className="hero-kicker">Монтаж на вашем Mac</span>
          <h1>Из длинного видео — в готовые короткие истории.</h1>
          <p>
            Транскрибируйте, выбирайте сильные моменты и собирайте вертикальные
            ролики. Без облачной загрузки и платных API.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-primary button-large"
              to="/projects/new/long-video"
            >
              Новый проект <ArrowRight size={18} />
            </Link>
            <Link
              className="button button-secondary button-large"
              to="/projects"
            >
              Мои проекты
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <ShieldCheck /> Полностью локально
            </span>
            <span>FFmpeg · Whisper · Remotion</span>
          </div>
        </div>
        <div className="hero-studio" aria-hidden="true">
          <div className="studio-toolbar">
            <i />
            <i />
            <i />
            <span>Interview — Final Cut</span>
          </div>
          <div className="studio-body">
            <div className="studio-library">
              <span />
              <span />
              <span />
            </div>
            <div className="studio-canvas">
              <div className="studio-video">
                <div className="studio-caption">Make the idea clear.</div>
              </div>
              <div className="studio-controls">
                <b>00:18</b>
                <div>
                  <i />
                  <i />
                  <i />
                </div>
                <b>00:42</b>
              </div>
            </div>
          </div>
          <div className="studio-timeline">
            <span />
            <span />
            <span />
            <span />
            <i />
          </div>
        </div>
      </section>
      <section className="home-value">
        <article>
          <strong>01</strong>
          <h3>Расшифровка</h3>
          <p>Whisper работает локально и сохраняет точные таймкоды слов.</p>
        </article>
        <article>
          <strong>02</strong>
          <h3>Осознанный выбор</h3>
          <p>Вы сами выбираете AI и подтверждаете каждый момент до монтажа.</p>
        </article>
        <article>
          <strong>03</strong>
          <h3>Точный результат</h3>
          <p>
            Предпросмотр, монтажная шкала и финальный рендер используют одну
            модель.
          </p>
        </article>
      </section>
      <section className="mode-section home-product">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Рабочий процесс</span>
            <h2>Один понятный путь от видео до Shorts.</h2>
          </div>
          <p>
            Все тяжёлые операции выполняются на компьютере. Вы контролируете
            данные, решения и итоговый монтаж.
          </p>
        </div>
        <div className="product-card">
          <Link
            to="/projects/new/long-video"
            className="mode-card mode-card-active"
          >
            <div className="product-card-copy">
              <span className="availability">
                <i /> Доступно сейчас
              </span>
              <h3>Long Video to Shorts</h3>
              <p>
                Для интервью, подкастов, лекций и разговорных видео. От
                исходника до готового вертикального MP4 в одном проекте.
              </p>
              <span className="card-action">
                Создать проект <ArrowRight />
              </span>
            </div>
            <div className="product-card-visual">
              <div>
                <Film />
                <span>long-interview.mp4</span>
                <small>42:18</small>
              </div>
              <i />
              <div>
                <Subtitles />
                <span>Транскрипт</span>
                <small>4 812 слов</small>
              </div>
              <i />
              <div>
                <Scissors />
                <span>12 клипов</span>
                <small>Готово</small>
              </div>
            </div>
          </Link>
        </div>
      </section>
      <section className="workflow-showcase">
        <div className="workflow-intro">
          <span className="glass-label">От исходника до результата</span>
          <h2>
            Пять спокойных шагов.
            <br />
            Всё под вашим контролем.
          </h2>
          <p>
            Каждый этап сохраняется локально. Можно остановиться, проверить
            результат и продолжить в удобный момент.
          </p>
        </div>
        <div className="workflow-path">
          {[
            ["Добавьте видео", "MP4, MOV, WebM или MKV"],
            ["Получите текст", "Whisper и точные таймкоды"],
            ["Выберите моменты", "Любой AI, без API-ключа"],
            ["Настройте клипы", "Кадрирование и субтитры"],
            ["Соберите ролики", "Готовые вертикальные MP4"],
          ].map(([title, text], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
              {index < 4 && <i />}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ProjectsPage() {
  const query = useProjectsQuery();
  const deleteMutation = useDeleteProjectMutation();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  useEffect(() => {
    if (!deleteTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteMutation.isPending)
        setDeleteTarget(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleteMutation.isPending, deleteTarget]);
  const projects = query.data ?? [];
  const isEmpty = !query.isPending && !query.isError && projects.length === 0;
  return (
    <div className="projects-page">
      <header className="projects-hero">
        <div>
          <span className="glass-label">Ваша медиатека</span>
          <h1>Проекты</h1>
          <p>Продолжайте монтаж с того места, где остановились.</p>
        </div>
        <Link
          className="button button-primary button-large"
          to="/projects/new/long-video"
        >
          <Plus size={18} /> Новый проект
        </Link>
        <div className="projects-hero-glow" aria-hidden="true" />
      </header>
      {query.isError && (
        <Notice tone="error">
          <AlertCircle />
          <div>
            <strong>Не удалось получить проекты</strong>
            <p>{query.error.message}</p>
          </div>
        </Notice>
      )}
      {query.isPending && (
        <div className="project-gallery" aria-label="Загружаем проекты">
          <div className="project-tile project-tile-loading" />
          <div className="project-tile project-tile-loading" />
          <div className="project-tile project-tile-loading" />
        </div>
      )}
      {!query.isPending && projects.length > 0 && (
        <div className="projects-overview">
          <span>
            <b>{projects.length}</b> всего
          </span>
          <i />
          <span>
            <b>
              {
                projects.filter(
                  (p) => !["completed", "failed"].includes(p.status),
                ).length
              }
            </b>{" "}
            в работе
          </span>
          <i />
          <span>
            <b>{projects.filter((p) => p.status === "completed").length}</b>{" "}
            готово
          </span>
        </div>
      )}
      {!query.isPending && projects.length > 0 && (
        <div className="project-gallery">
          {projects.map((project) => {
            const meta = statusMeta[project.status];
            return (
              <article className="project-tile" key={project.id}>
                <Link
                  className="project-cover"
                  to={`/projects/${project.id}/${meta.route}`}
                >
                  <div className="project-cover-art">
                    <Film />
                  </div>
                  <span className="project-duration">
                    <Clock3 size={13} />
                    {project.mediaInfo
                      ? formatDuration(project.mediaInfo.durationSeconds)
                      : "—"}
                  </span>
                </Link>
                <div className="project-tile-body">
                  <div className="project-tile-status">
                    <StatusBadge status={project.status} />
                    <span>
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(project.updatedAt))}
                    </span>
                  </div>
                  <h2>{project.name}</h2>
                  <p>{project.sourceFileName ?? "Видео ещё не загружено"}</p>
                  <div className="project-tile-actions">
                    <Link to={`/projects/${project.id}/${meta.route}`}>
                      {meta.action} <ArrowRight />
                    </Link>
                    <Button
                      variant="danger"
                      className="icon-button"
                      aria-label={`Удалить проект ${project.name}`}
                      onClick={() => setDeleteTarget(project)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {isEmpty && (
        <section className="projects-empty">
          <div className="projects-empty-orb" aria-hidden="true">
            <Film />
          </div>
          <span className="glass-label">Первый проект</span>
          <h2>Здесь появятся ваши истории.</h2>
          <p>
            Добавьте длинное видео — Cutwise подготовит транскрипт, поможет
            выбрать моменты и соберёт вертикальные клипы локально.
          </p>
          <Link
            className="button button-primary button-large"
            to="/projects/new/long-video"
          >
            <Plus size={18} /> Добавить видео
          </Link>
          <small>Файл никуда не загружается</small>
        </section>
      )}
      {deleteTarget &&
        createPortal(
          <div
            className="dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !deleteMutation.isPending
              )
                setDeleteTarget(null);
            }}
          >
            <div
              className="confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-title"
            >
              <button
                className="dialog-close"
                type="button"
                aria-label="Закрыть окно"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
              >
                <X />
              </button>
              <div className="danger-icon">
                <Trash2 />
              </div>
              <h2 id="delete-title">Удалить «{deleteTarget.name}»?</h2>
              <p>
                Исходное видео, транскрипт, клипы и готовые результаты будут
                удалены без возможности восстановления.
              </p>
              {deleteMutation.isError && (
                <p className="form-error">
                  <AlertCircle />
                  {deleteMutation.error.message}
                </p>
              )}
              <div className="dialog-actions">
                <Button
                  variant="secondary"
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeleteTarget(null)}
                >
                  Отмена
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    deleteMutation.mutate(deleteTarget.id, {
                      onSuccess: () => setDeleteTarget(null),
                    });
                  }}
                >
                  {deleteMutation.isPending ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <Trash2 />
                  )}
                  Удалить проект
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
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
              следующей странице после запуска фоновой обработки.
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
  const latestJob = jobsQuery.data?.find((job) => job.type === "transcription");
  const isProcessing =
    latestJob?.status === "queued" || latestJob?.status === "running";
  const transcriptQuery = useTranscriptQuery(project.id, isProcessing);
  const { refetch: refetchTranscript } = transcriptQuery;
  const startMutation = useStartTranscriptionMutation(project.id);
  const regenerateMutation = useRegenerateTranscriptionMutation(project.id);
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
      {(startMutation.isError || regenerateMutation.isError) && (
        <Notice tone="error">
          <AlertCircle />
          <div>
            <strong>Не удалось запустить транскрипцию</strong>
            <p>{(startMutation.error ?? regenerateMutation.error)?.message}</p>
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
                    ? "Ожидает обработки"
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
              text="Запустите транскрипцию. Одновременно обрабатывается одна запись."
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
            <>
              <div className="transcript-toolbar">
                <span>
                  {transcript?.hasWordTimestamps
                    ? `${transcript.words.length} слов с точными таймкодами`
                    : "Старый транскрипт без таймкодов слов"}
                </span>
                <Button
                  className="transcript-regenerate"
                  variant="secondary"
                  disabled={isProcessing || regenerateMutation.isPending}
                  onClick={() => regenerateMutation.mutate()}
                >
                  {regenerateMutation.isPending ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <WandSparkles />
                  )}
                  Обновить таймкоды
                </Button>
              </div>
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
            </>
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
            <div className="next-card-top">
              <div className="next-icon">
                <Bot />
              </div>
              <span>02</span>
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
                Перейти к AI-мосту <ArrowRight />
              </Link>
            ) : (
              <div className="next-card-waiting">
                {isProcessing ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <FileText />
                )}
                <span>
                  <strong>Пока недоступно</strong>
                  <small>Завершите транскрипцию, чтобы продолжить</small>
                </span>
              </div>
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
          <div className="provider-handoff">
            <Notice>
              <Bot />
              <div>
                <strong>Как передать пакет в {provider.name}</strong>
                <p>{provider.hint}</p>
              </div>
            </Notice>
            <Button
              className="provider-open-button"
              disabled={!provider.url}
              onClick={() =>
                provider.url &&
                window.open(provider.url, "_blank", "noopener,noreferrer")
              }
            >
              {provider.url
                ? `Открыть ${provider.name}`
                : "Откройте свой AI вручную"}
              <ArrowRight />
            </Button>
          </div>
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
              <button
                className="json-upload-button"
                onClick={() => fileRef.current?.click()}
              >
                <Upload /> Выбрать JSON-файл
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
              placeholder={'{\n  "schemaVersion": 2,\n  "clips": [...]\n}'}
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
                    <article key={`${clip.title}-${index}`}>
                      <strong>
                        {index + 1}. {clip.title}
                      </strong>
                      <span>
                        {clip.ranges.length} range ·{" "}
                        {clip.ranges
                          .reduce(
                            (sum, range) => sum + range.end - range.start,
                            0,
                          )
                          .toFixed(1)}{" "}
                        сек. · {clip.hookScore}/10
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
    cropMode: clip.cropMode,
    cropX: clip.cropX,
    cropY: clip.cropY,
    zoom: clip.zoom,
    subtitleX: clip.subtitleX,
    subtitleY: clip.subtitleY,
    subtitleScale: clip.subtitleScale,
    subtitleAlign: clip.subtitleAlign,
  });
  const updateMutation = useUpdateClipMutation(clip.projectId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRangeIndex, setPreviewRangeIndex] = useState(0);
  useEffect(() => {
    setDraft({
      title: clip.title,
      start: clip.start,
      end: clip.end,
      openingCaption: clip.openingCaption,
      enabled: clip.enabled,
      cropMode: clip.cropMode,
      cropX: clip.cropX,
      cropY: clip.cropY,
      zoom: clip.zoom,
      subtitleX: clip.subtitleX,
      subtitleY: clip.subtitleY,
      subtitleScale: clip.subtitleScale,
      subtitleAlign: clip.subtitleAlign,
    });
  }, [clip]);
  const togglePreview = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    setPreviewRangeIndex(0);
    video.currentTime = previewRanges[0]!.start;
    if (backgroundVideoRef.current)
      backgroundVideoRef.current.currentTime = previewRanges[0]!.start;
    await video.play();
    if (backgroundVideoRef.current) void backgroundVideoRef.current.play();
    setIsPreviewing(true);
  };
  const moveSubtitle = (clientX: number, clientY: number) => {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = clampSubtitlePosition(
      ((clientX - bounds.left) / bounds.width) * 100,
      ((clientY - bounds.top) / bounds.height) * 100,
    );
    setDraft((current) => ({
      ...current,
      subtitleX: Math.round(position.x * 10) / 10,
      subtitleY: Math.round(position.y * 10) / 10,
    }));
  };
  const subtitleWidth = subtitleSafeWidthPercent(
    draft.subtitleX,
    draft.subtitleScale,
  );
  const previewRanges =
    clip.ranges.length === 1
      ? [{ ...clip.ranges[0]!, start: draft.start, end: draft.end }]
      : clip.ranges;
  const previewDuration = timelineDuration(previewRanges);
  return (
    <article
      className={draft.enabled ? "clip-card" : "clip-card clip-disabled"}
    >
      <div className="clip-preview" ref={previewRef}>
        {draft.cropMode === "fit" && (
          <video
            ref={backgroundVideoRef}
            className="crop-background"
            muted
            playsInline
            preload="metadata"
            src={`/api/projects/${encodeURIComponent(clip.projectId)}/source/media`}
          />
        )}
        <video
          ref={videoRef}
          preload="metadata"
          src={`/api/projects/${encodeURIComponent(clip.projectId)}/source/media`}
          playsInline
          style={{
            objectFit: draft.cropMode === "fill" ? "cover" : "contain",
            objectPosition: `${draft.cropX}% ${draft.cropY}%`,
            transform: `scale(${draft.zoom})`,
          }}
          onTimeUpdate={(event) => {
            const range = previewRanges[previewRangeIndex];
            if (!range || event.currentTarget.currentTime < range.end - 0.04)
              return;
            const next = previewRanges[previewRangeIndex + 1];
            if (!next) {
              event.currentTarget.pause();
              backgroundVideoRef.current?.pause();
              setIsPreviewing(false);
              return;
            }
            setPreviewRangeIndex((value) => value + 1);
            event.currentTarget.currentTime = next.start;
            if (backgroundVideoRef.current)
              backgroundVideoRef.current.currentTime = next.start;
          }}
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = previewRanges[0]!.start;
            if (backgroundVideoRef.current)
              backgroundVideoRef.current.currentTime = previewRanges[0]!.start;
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
          {formatDuration(previewDuration)}
        </span>
        <div className="subtitle-safe-area" aria-hidden="true" />
        <div
          className="preview-subtitle"
          role="slider"
          tabIndex={0}
          aria-label="Положение субтитров"
          aria-valuetext={`X ${draft.subtitleX}%, Y ${draft.subtitleY}%`}
          style={{
            left: `${draft.subtitleX}%`,
            top: `${draft.subtitleY}%`,
            width: `${subtitleWidth}%`,
            textAlign: draft.subtitleAlign,
            transform: `translate(-50%, -50%) scale(${draft.subtitleScale})`,
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            moveSubtitle(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              moveSubtitle(event.clientX, event.clientY);
          }}
          onPointerUp={(event) =>
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          onKeyDown={(event) => {
            const step = event.shiftKey ? 5 : 1;
            const delta = (
              {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              } as Record<string, [number, number]>
            )[event.key];
            if (!delta) return;
            event.preventDefault();
            const position = clampSubtitlePosition(
              draft.subtitleX + delta[0],
              draft.subtitleY + delta[1],
            );
            setDraft((current) => ({
              ...current,
              subtitleX: position.x,
              subtitleY: position.y,
            }));
          }}
        >
          Пример аккуратной фразы субтитров
        </div>
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
              onChange={(e) => {
                const enabled = e.target.checked;
                setDraft((current) => ({
                  ...current,
                  enabled,
                }));
                updateMutation.mutate({
                  clipId: clip.id,
                  patch: { enabled },
                });
              }}
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
        {overlapText && (
          <div className="overlap-warning">
            <AlertCircle /> {overlapText}
          </div>
        )}
      </div>
      <div className="clip-settings">
        <div className="clip-timing-controls">
          <div className="score">
            <Gauge />
            <span>
              Оценка хука<strong>{clip.hookScore}/10</strong>
            </span>
          </div>
          <div className="clip-range-summary">
            {previewRanges.map((range, rangeIndex) => (
              <div key={range.id}>
                <span>Диапазон {rangeIndex + 1}</span>
                <strong>
                  {formatDuration(range.start)} → {formatDuration(range.end)}
                </strong>
              </div>
            ))}
          </div>
          {previewRanges.length === 1 && (
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
          )}
          <small>
            Итоговая длительность: {previewDuration.toFixed(1)} сек.
          </small>
        </div>
        <div className="crop-controls">
          <div className="segmented-control">
            <button
              type="button"
              className={draft.cropMode === "fill" ? "active" : ""}
              onClick={() =>
                setDraft((value) => ({ ...value, cropMode: "fill" }))
              }
            >
              Fill
            </button>
            <button
              type="button"
              className={draft.cropMode === "fit" ? "active" : ""}
              onClick={() =>
                setDraft((value) => ({ ...value, cropMode: "fit" }))
              }
            >
              Fit
            </button>
          </div>
          <label>
            Позиция X <span>{draft.cropX}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={draft.cropX}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  cropX: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Позиция Y <span>{draft.cropY}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={draft.cropY}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  cropY: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Масштаб <span>{draft.zoom.toFixed(2)}×</span>
            <input
              type="range"
              min="1"
              max="1.5"
              step="0.05"
              value={draft.zoom}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  zoom: Number(event.target.value),
                }))
              }
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setDraft((value) => ({
                ...value,
                cropMode: "fill",
                cropX: 50,
                cropY: 50,
                zoom: 1,
              }))
            }
          >
            Сбросить кадрирование
          </Button>
        </div>
        <div className="subtitle-controls">
          <div className="settings-label">
            Положение субтитров
            <span>
              {draft.subtitleX.toFixed(0)} / {draft.subtitleY.toFixed(0)}
            </span>
          </div>
          <div className="subtitle-presets" aria-label="Позиция субтитров">
            {[
              ["Сверху", 28],
              ["По центру", 50],
              ["Снизу", 72],
            ].map(([label, y]) => (
              <button
                type="button"
                key={label}
                className={draft.subtitleY === y ? "active" : ""}
                onClick={() =>
                  setDraft((value) => ({
                    ...value,
                    subtitleX: 50,
                    subtitleY: Number(y),
                  }))
                }
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Масштаб текста <span>{draft.subtitleScale.toFixed(2)}×</span>
            <input
              type="range"
              min={SUBTITLE_POSITION.minScale}
              max={SUBTITLE_POSITION.maxScale}
              step="0.05"
              value={draft.subtitleScale}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  subtitleScale: Number(event.target.value),
                }))
              }
            />
          </label>
          <div className="subtitle-align" aria-label="Выравнивание субтитров">
            {[
              ["left", <AlignLeft key="left" />],
              ["center", <AlignCenter key="center" />],
              ["right", <AlignRight key="right" />],
            ].map(([align, icon]) => (
              <button
                type="button"
                key={String(align)}
                aria-label={`Выравнивание ${align}`}
                className={draft.subtitleAlign === align ? "active" : ""}
                onClick={() =>
                  setDraft((value) => ({
                    ...value,
                    subtitleAlign: align as "left" | "center" | "right",
                  }))
                }
              >
                {icon}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setDraft((value) => ({
                ...value,
                subtitleX: SUBTITLE_POSITION.defaultX,
                subtitleY: SUBTITLE_POSITION.defaultY,
                subtitleScale: SUBTITLE_POSITION.defaultScale,
                subtitleAlign: "center",
              }))
            }
          >
            Вернуть положение по умолчанию
          </Button>
        </div>
        {updateMutation.isError && (
          <p className="form-error">
            <AlertCircle />
            {updateMutation.error.message}
          </p>
        )}
        <div className="clip-card-actions">
          <Link
            className="button button-secondary"
            to={`/projects/${clip.projectId}/clips/${clip.id}/editor`}
          >
            Открыть редактор <ArrowRight />
          </Link>
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
            Сохранить изменения
          </Button>
        </div>
      </div>
    </article>
  );
}

function editorDraft(
  state: NonNullable<ReturnType<typeof useEditorQuery>["data"]>,
): EditorSaveInput {
  return {
    ranges: state.ranges,
    cropKeyframes: state.cropKeyframes,
    subtitleKeyframes: state.subtitleKeyframes,
    frameMode: state.frameMode,
    subtitleX: state.subtitleX,
    subtitleY: state.subtitleY,
    subtitleScale: state.subtitleScale,
    subtitleAlign: state.subtitleAlign,
    templateId: state.templateId,
    accentColor: state.accentColor,
    captionsEnabled: state.captionsEnabled,
    openingCaptionEnabled: state.openingCaptionEnabled,
    image: state.image,
    audio: state.audio,
    subtitleStyle: state.subtitleStyle,
    openingCaption: state.openingCaption,
  };
}

const editorTools = [
  "crop",
  "subtitle",
  "image",
  "audio",
  "opening",
  "template",
] as const;
type EditorTool = (typeof editorTools)[number];

function isEditorTool(value: string | null): value is EditorTool {
  return editorTools.some((tool) => tool === value);
}

export function TimelineEditorPage() {
  const project = useProject();
  const { clipId } = useParams();
  const query = useEditorQuery(project?.id, clipId);
  if (project === undefined || query.isPending) return <ProjectLoading />;
  if (!project || !clipId) return <MissingProject />;
  if (query.isError || !query.data)
    return (
      <EmptyState
        icon={<AlertCircle />}
        title="Редактор недоступен"
        text={query.error?.message ?? "Состояние редактора не найдено."}
      />
    );
  return (
    <TimelineEditorWorkspace
      key={`${query.data.clip.id}-${query.data.clip.updatedAt}`}
      project={project}
      state={query.data}
    />
  );
}

function TimelineEditorWorkspace({
  project,
  state,
}: {
  project: Project;
  state: NonNullable<ReturnType<typeof useEditorQuery>["data"]>;
}) {
  const original = editorDraft(state);
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<EditorSaveInput>(original);
  const [outputTime, setOutputTime] = useState(0);
  const [activeRangeId, setActiveRangeId] = useState(draft.ranges[0]!.id);
  const [editing, setEditing] = useState<EditorTool>(() => {
    const requestedTool = searchParams.get("tool");
    return isEditorTool(requestedTool) ? requestedTool : "crop";
  });
  const [cropEasing, setCropEasing] = useState<
    "linear" | "ease-in-out" | "hold"
  >("ease-in-out");
  const [subtitleTransition, setSubtitleTransition] = useState<
    "hold" | "smooth"
  >("smooth");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showBefore, setShowBefore] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(18);
  const [selectedRangeId, setSelectedRangeId] = useState(draft.ranges[0]!.id);
  const [selectedKeyframe, setSelectedKeyframe] = useState<{
    kind: "crop" | "subtitle";
    id: string;
  } | null>(null);
  const [presetName, setPresetName] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fitBackgroundRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveMutation = useSaveEditorMutation(project.id, state.clip.id);
  const musicMutation = useUploadEditorMusicMutation(project.id, state.clip.id);
  const createPresetMutation = useCreateEditorPresetMutation(
    project.id,
    state.clip.id,
  );
  const deletePresetMutation = useDeleteEditorPresetMutation(
    project.id,
    state.clip.id,
  );
  const historyRef = useRef<EditorSaveInput[]>([structuredClone(original)]);
  const historyIndexRef = useRef(0);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringHistoryRef = useRef(false);
  const [, redrawHistory] = useState(0);
  const timeline = buildTimeline(draft.ranges);
  const duration = timelineDuration(draft.ranges);
  const selectEditorTool = (tool: EditorTool) => {
    setEditing(tool);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("tool", tool);
        return next;
      },
      { replace: true },
    );
  };
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = Math.min(1, draft.audio.volume);
      videoRef.current.muted = draft.audio.muted;
    }
    if (musicRef.current && draft.audio.music) {
      musicRef.current.volume = Math.min(1, draft.audio.music.volume);
    }
  }, [draft.audio.muted, draft.audio.music, draft.audio.volume]);
  const mapping = outputToSourceTime(draft.ranges, outputTime) ?? {
    rangeId: draft.ranges[0]!.id,
    sourceTime: draft.ranges[0]!.start,
  };
  const crop = interpolateCrop(
    draft.cropKeyframes,
    mapping.rangeId,
    mapping.sourceTime,
    { cropX: state.clip.cropX, cropY: state.clip.cropY, zoom: state.clip.zoom },
  );
  const subtitle = interpolateSubtitle(
    draft.subtitleKeyframes,
    mapping.rangeId,
    mapping.sourceTime,
    {
      subtitleX: draft.subtitleX,
      subtitleY: draft.subtitleY,
      subtitleScale: draft.subtitleScale,
      subtitleAlign: draft.subtitleAlign,
    },
  );
  const [visualCrop, setVisualCrop] = useState({
    cropX: crop.cropX,
    cropY: crop.cropY,
    zoom: crop.zoom,
  });
  const [visualSubtitle, setVisualSubtitle] = useState({
    subtitleX: subtitle.subtitleX,
    subtitleY: subtitle.subtitleY,
    subtitleScale: subtitle.subtitleScale,
    subtitleAlign: subtitle.subtitleAlign,
  });
  useEffect(() => {
    if (!isPlaying) return;
    setVisualCrop({ cropX: crop.cropX, cropY: crop.cropY, zoom: crop.zoom });
    setVisualSubtitle({
      subtitleX: subtitle.subtitleX,
      subtitleY: subtitle.subtitleY,
      subtitleScale: subtitle.subtitleScale,
      subtitleAlign: subtitle.subtitleAlign,
    });
  }, [
    crop.cropX,
    crop.cropY,
    crop.zoom,
    isPlaying,
    subtitle.subtitleAlign,
    subtitle.subtitleScale,
    subtitle.subtitleX,
    subtitle.subtitleY,
  ]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const invalidDuration = duration < 15 || duration > 90;
  useEffect(() => {
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      return;
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const current = historyRef.current[historyIndexRef.current];
      if (JSON.stringify(current) === JSON.stringify(draft)) return;
      historyRef.current = [
        ...historyRef.current.slice(0, historyIndexRef.current + 1),
        structuredClone(draft),
      ].slice(-80);
      historyIndexRef.current = historyRef.current.length - 1;
      redrawHistory((value) => value + 1);
    }, 280);
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, [draft]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const restoreHistory = (index: number) => {
    const snapshot = historyRef.current[index];
    if (!snapshot) return;
    restoringHistoryRef.current = true;
    historyIndexRef.current = index;
    setDraft(structuredClone(snapshot));
    redrawHistory((value) => value + 1);
  };
  const undo = () => restoreHistory(historyIndexRef.current - 1);
  const redo = () => restoreHistory(historyIndexRef.current + 1);
  const saveDraft = () => {
    if (!invalidDuration && dirty && !saveMutation.isPending)
      saveMutation.mutate(draft);
  };
  const activeWordIndex = state.words.findIndex(
    (word) =>
      mapping.sourceTime >= word.startSeconds &&
      mapping.sourceTime < word.endSeconds,
  );
  const visibleWords =
    activeWordIndex >= 0
      ? state.words.slice(
          Math.floor(activeWordIndex / 5) * 5,
          Math.floor(activeWordIndex / 5) * 5 + 5,
        )
      : [];
  const fallbackSegment = state.segments.find(
    (segment) =>
      mapping.sourceTime >= segment.startSeconds &&
      mapping.sourceTime < segment.endSeconds,
  );
  const seek = (nextOutputTime: number) => {
    const bounded = Math.max(0, Math.min(duration, nextOutputTime));
    setOutputTime(bounded);
    const next = outputToSourceTime(draft.ranges, bounded);
    if (next && videoRef.current) {
      setActiveRangeId(next.rangeId);
      videoRef.current.currentTime = next.sourceTime;
      if (fitBackgroundRef.current)
        fitBackgroundRef.current.currentTime = next.sourceTime;
    }
    if (musicRef.current && draft.audio.music) {
      const musicTime = Math.max(0, bounded - draft.audio.music.startSeconds);
      musicRef.current.currentTime = musicTime;
    }
  };
  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      fitBackgroundRef.current?.pause();
      musicRef.current?.pause();
      return;
    }
    const next = outputToSourceTime(draft.ranges, outputTime);
    if (next) {
      setActiveRangeId(next.rangeId);
      video.currentTime = next.sourceTime;
      if (fitBackgroundRef.current)
        fitBackgroundRef.current.currentTime = next.sourceTime;
    }
    await video.play();
    if (fitBackgroundRef.current) void fitBackgroundRef.current.play();
    if (musicRef.current && draft.audio.music) {
      musicRef.current.volume = Math.min(1, draft.audio.music.volume);
      if (outputTime >= draft.audio.music.startSeconds)
        void musicRef.current.play();
    }
  };
  const updateFromPointer = (clientX: number, clientY: number) => {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = ((clientX - bounds.left) / bounds.width) * 100;
    const y = ((clientY - bounds.top) / bounds.height) * 100;
    if (editing === "crop")
      setVisualCrop((value) => ({
        ...value,
        cropX: Math.max(0, Math.min(100, x)),
        cropY: Math.max(0, Math.min(100, y)),
      }));
    else if (editing === "image") {
      setDraft((value) => ({
        ...value,
        image: {
          ...value.image,
          positionX: Math.max(0, Math.min(100, x)),
          positionY: Math.max(0, Math.min(100, y)),
        },
      }));
      setVisualCrop((value) => ({
        ...value,
        cropX: Math.max(0, Math.min(100, x)),
        cropY: Math.max(0, Math.min(100, y)),
      }));
    } else if (editing === "subtitle") {
      const position = clampSubtitlePosition(x, y);
      setVisualSubtitle((value) => ({
        ...value,
        subtitleX: position.x,
        subtitleY: position.y,
      }));
    }
  };
  const addCropKeyframe = () =>
    setDraft((value) => ({
      ...value,
      cropKeyframes: [
        ...value.cropKeyframes.filter(
          (frame) =>
            !(
              frame.rangeId === mapping.rangeId &&
              Math.abs(frame.sourceTimeSeconds - mapping.sourceTime) < 0.05
            ),
        ),
        {
          id: crypto.randomUUID(),
          rangeId: mapping.rangeId,
          sourceTimeSeconds: mapping.sourceTime,
          ...visualCrop,
          easing: cropEasing,
        },
      ],
    }));
  const addSubtitleKeyframe = () =>
    setDraft((value) => ({
      ...value,
      subtitleKeyframes: [
        ...value.subtitleKeyframes.filter(
          (frame) =>
            !(
              frame.rangeId === mapping.rangeId &&
              Math.abs(frame.sourceTimeSeconds - mapping.sourceTime) < 0.05
            ),
        ),
        {
          id: crypto.randomUUID(),
          rangeId: mapping.rangeId,
          sourceTimeSeconds: mapping.sourceTime,
          ...visualSubtitle,
          transition: subtitleTransition,
        },
      ],
    }));
  const seekAdjacentKeyframe = (direction: -1 | 1) => {
    const frames = (
      editing === "crop" ? draft.cropKeyframes : draft.subtitleKeyframes
    )
      .flatMap((frame) => {
        const range = draft.ranges.find((item) => item.id === frame.rangeId);
        if (!range) return [];
        const time = rangeLocalToOutputTime(
          draft.ranges,
          range.id,
          frame.sourceTimeSeconds - range.start,
        );
        return time === null ? [] : [{ frame, time }];
      })
      .sort((a, b) => a.time - b.time);
    const target =
      direction < 0
        ? [...frames].reverse().find((item) => item.time < outputTime - 0.001)
        : frames.find((item) => item.time > outputTime + 0.001);
    if (!target) return;
    setSelectedKeyframe({
      kind: editing as "crop" | "subtitle",
      id: target.frame.id,
    });
    seek(target.time);
  };
  const reorderRange = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setDraft((value) => {
      const ranges = [...value.ranges];
      const from = ranges.findIndex((range) => range.id === draggedId);
      const to = ranges.findIndex((range) => range.id === targetId);
      if (from < 0 || to < 0) return value;
      const [moved] = ranges.splice(from, 1);
      ranges.splice(to, 0, moved!);
      return { ...value, ranges };
    });
  };
  const splitAtPlayhead = () => {
    const range = draft.ranges.find((item) => item.id === mapping.rangeId);
    if (
      !range ||
      mapping.sourceTime - range.start < 0.5 ||
      range.end - mapping.sourceTime < 0.5
    )
      return;
    const secondId = crypto.randomUUID();
    setDraft((value) => ({
      ...value,
      ranges: value.ranges.flatMap((item) =>
        item.id === range.id
          ? [
              {
                ...item,
                end: mapping.sourceTime,
                transition: { type: "hard-cut", durationSeconds: 0 },
              },
              {
                ...item,
                id: secondId,
                start: mapping.sourceTime,
                transition: item.transition,
              },
            ]
          : [item],
      ),
      cropKeyframes: [
        ...value.cropKeyframes.map((frame) =>
          frame.rangeId === range.id &&
          frame.sourceTimeSeconds >= mapping.sourceTime
            ? { ...frame, rangeId: secondId }
            : frame,
        ),
        {
          id: crypto.randomUUID(),
          rangeId: secondId,
          sourceTimeSeconds: mapping.sourceTime,
          ...visualCrop,
          easing: "linear" as const,
        },
      ],
      subtitleKeyframes: value.subtitleKeyframes.map((frame) =>
        frame.rangeId === range.id &&
        frame.sourceTimeSeconds >= mapping.sourceTime
          ? { ...frame, rangeId: secondId }
          : frame,
      ),
    }));
    setSelectedRangeId(secondId);
  };
  const duplicateSelectedRange = () => {
    const selected = draft.ranges.find((range) => range.id === selectedRangeId);
    if (!selected) return;
    const newId = crypto.randomUUID();
    setDraft((value) => {
      const index = value.ranges.findIndex((range) => range.id === selected.id);
      const ranges = [...value.ranges];
      ranges.splice(index + 1, 0, { ...selected, id: newId });
      return {
        ...value,
        ranges,
        cropKeyframes: [
          ...value.cropKeyframes,
          ...value.cropKeyframes
            .filter((frame) => frame.rangeId === selected.id)
            .map((frame) => ({
              ...frame,
              id: crypto.randomUUID(),
              rangeId: newId,
            })),
        ],
        subtitleKeyframes: [
          ...value.subtitleKeyframes,
          ...value.subtitleKeyframes
            .filter((frame) => frame.rangeId === selected.id)
            .map((frame) => ({
              ...frame,
              id: crypto.randomUUID(),
              rangeId: newId,
            })),
        ],
      };
    });
    setSelectedRangeId(newId);
  };
  const deleteSelected = () => {
    if (selectedKeyframe) {
      setDraft((value) => ({
        ...value,
        cropKeyframes:
          selectedKeyframe.kind === "crop"
            ? value.cropKeyframes.filter(
                (frame) => frame.id !== selectedKeyframe.id,
              )
            : value.cropKeyframes,
        subtitleKeyframes:
          selectedKeyframe.kind === "subtitle"
            ? value.subtitleKeyframes.filter(
                (frame) => frame.id !== selectedKeyframe.id,
              )
            : value.subtitleKeyframes,
      }));
      setSelectedKeyframe(null);
      return;
    }
    if (draft.ranges.length === 1 || !selectedRangeId) return;
    if (
      !window.confirm("Удалить выбранный диапазон и связанные ключевые кадры?")
    )
      return;
    setDraft((value) => ({
      ...value,
      ranges: value.ranges.filter((range) => range.id !== selectedRangeId),
      cropKeyframes: value.cropKeyframes.filter(
        (frame) => frame.rangeId !== selectedRangeId,
      ),
      subtitleKeyframes: value.subtitleKeyframes.filter(
        (frame) => frame.rangeId !== selectedRangeId,
      ),
    }));
    setSelectedRangeId(
      draft.ranges.find((range) => range.id !== selectedRangeId)?.id ?? "",
    );
  };
  const beginRangeResize = (
    event: React.PointerEvent,
    rangeId: string,
    edge: "start" | "end",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const origin = draft.ranges.find((range) => range.id === rangeId);
    if (!origin) return;
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - originX) / timelineZoom;
      setDraft((value) => ({
        ...value,
        ranges: value.ranges.map((range) => {
          if (range.id !== rangeId) return range;
          return edge === "start"
            ? {
                ...range,
                start: Math.max(
                  0,
                  Math.min(range.end - 1, origin.start + delta),
                ),
              }
            : {
                ...range,
                end: Math.min(
                  state.sourceDurationSeconds,
                  Math.max(range.start + 1, origin.end + delta),
                ),
              };
        }),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.matches("input, textarea, select, [contenteditable='true']") ??
        false;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDraft();
      } else if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (!typing && event.code === "Space") {
        event.preventDefault();
        void togglePlayback();
      } else if (!typing && event.key === "ArrowLeft") {
        event.preventDefault();
        seek(outputTime - (event.shiftKey ? 1 : 1 / 30));
      } else if (!typing && event.key === "ArrowRight") {
        event.preventDefault();
        seek(outputTime + (event.shiftKey ? 1 : 1 / 30));
      } else if (
        !typing &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const audio = {
      volume: draft.audio.volume,
      muted: draft.audio.muted,
      fadeInSeconds: draft.audio.fadeInSeconds,
      fadeOutSeconds: draft.audio.fadeOutSeconds,
      normalize: draft.audio.normalize,
      noiseReduction: draft.audio.noiseReduction,
    };
    createPresetMutation.mutate(
      {
        name,
        settings: {
          frameMode: draft.frameMode,
          image: draft.image,
          audio,
          subtitles: draft.subtitleStyle,
          openingCaption: draft.openingCaption,
          templateId: draft.templateId,
          accentColor: draft.accentColor,
        },
      },
      { onSuccess: () => setPresetName("") },
    );
  };
  const applyPreset = (preset: (typeof state.presets)[number]) => {
    setDraft((value) => ({
      ...value,
      frameMode: preset.settings.frameMode,
      image: preset.settings.image,
      audio: { ...preset.settings.audio, music: value.audio.music },
      subtitleStyle: preset.settings.subtitles,
      openingCaption: preset.settings.openingCaption,
      templateId: preset.settings.templateId,
      accentColor: preset.settings.accentColor,
    }));
  };
  return (
    <>
      <ProjectHeader project={project} active="clips" />
      <PageTitle
        eyebrow="Продвинутый монтаж"
        title={state.clip.title}
        text="Соберите последовательность, настройте кадр, субтитры и стиль. Перетаскивание и перемотка остаются в черновике до явного сохранения."
        action={
          <Link
            className="button button-secondary"
            to={`/projects/${project.id}/clips`}
          >
            Назад к клипам
          </Link>
        }
      />
      <div className="editor-commandbar">
        <div>
          <Button
            variant="ghost"
            aria-label="Отменить"
            title="Отменить · Cmd/Ctrl+Z"
            disabled={historyIndexRef.current <= 0}
            onClick={undo}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            aria-label="Повторить"
            title="Повторить · Cmd/Ctrl+Shift+Z"
            disabled={historyIndexRef.current >= historyRef.current.length - 1}
            onClick={redo}
          >
            <Redo2 />
          </Button>
        </div>
        <span className={dirty ? "dirty" : "saved"}>
          {saveMutation.isPending
            ? "Сохраняем…"
            : saveMutation.isError
              ? "Ошибка сохранения"
              : dirty
                ? "Есть несохранённые изменения"
                : "Сохранено"}
        </span>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              if (!dirty || window.confirm("Уйти без сохранения изменений?"))
                window.location.assign(`/projects/${project.id}/render`);
            }}
          >
            К рендеру <ArrowRight />
          </Button>
          <Button
            disabled={!dirty || invalidDuration || saveMutation.isPending}
            onClick={saveDraft}
            title="Сохранить · Cmd/Ctrl+S"
          >
            <Save /> Сохранить
          </Button>
        </div>
      </div>
      <div className="timeline-editor">
        <section className="timeline-preview-panel panel">
          <div
            className={`timeline-preview editing-${editing}`}
            ref={previewRef}
            tabIndex={0}
            aria-label="Предпросмотр видео. Пробел — воспроизведение или пауза, стрелки — шаг по шкале времени."
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault();
                void togglePlayback();
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                seek(outputTime - (event.shiftKey ? 5 : 0.25));
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                seek(outputTime + (event.shiftKey ? 5 : 0.25));
              }
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateFromPointer(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                updateFromPointer(event.clientX, event.clientY);
            }}
          >
            {draft.frameMode === "fit" && (
              <video
                ref={fitBackgroundRef}
                className="editor-fit-background"
                muted
                playsInline
                preload="metadata"
                src={`/api/projects/${encodeURIComponent(project.id)}/source/media`}
                style={{
                  objectPosition: `${visualCrop.cropX}% ${visualCrop.cropY}%`,
                  filter: `blur(${draft.image.backgroundBlur / 5}px) saturate(${draft.image.backgroundSaturation}) brightness(${1 - draft.image.backgroundDim})`,
                }}
              />
            )}
            <video
              ref={videoRef}
              playsInline
              preload="metadata"
              src={`/api/projects/${encodeURIComponent(project.id)}/source/media`}
              muted={draft.audio.muted}
              style={{
                objectFit: draft.frameMode === "fill" ? "cover" : "contain",
                objectPosition: `${visualCrop.cropX}% ${visualCrop.cropY}%`,
                transform: showBefore
                  ? "none"
                  : imageTransformCss(draft.image, visualCrop.zoom),
                filter: showBefore ? "none" : imageFilterCss(draft.image),
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(event) => {
                const initial = outputToSourceTime(draft.ranges, outputTime);
                if (initial)
                  event.currentTarget.currentTime = initial.sourceTime;
                if (initial && fitBackgroundRef.current)
                  fitBackgroundRef.current.currentTime = initial.sourceTime;
              }}
              onTimeUpdate={(event) => {
                const currentRange = timeline.find(
                  (range) => range.id === activeRangeId,
                );
                if (!currentRange) return;
                if (
                  event.currentTarget.currentTime >=
                  currentRange.end - 0.04
                ) {
                  const nextIndex = timeline.indexOf(currentRange) + 1;
                  const nextRange = timeline[nextIndex];
                  if (!nextRange) {
                    event.currentTarget.pause();
                    setOutputTime(duration);
                    return;
                  }
                  setActiveRangeId(nextRange.id);
                  setOutputTime(nextRange.outputStart);
                  event.currentTarget.currentTime = nextRange.start;
                  if (fitBackgroundRef.current)
                    fitBackgroundRef.current.currentTime = nextRange.start;
                  return;
                }
                setOutputTime(
                  currentRange.outputStart +
                    event.currentTarget.currentTime -
                    currentRange.start,
                );
              }}
            />
            {draft.audio.music && (
              <audio
                ref={musicRef}
                preload="metadata"
                src={`/api/projects/${encodeURIComponent(project.id)}/music/${encodeURIComponent(draft.audio.music.fileName)}`}
                loop={draft.audio.music.loop}
              />
            )}
            {showSafeZones && (
              <div className="editor-safe-zones" aria-hidden="true">
                <span />
                <span />
              </div>
            )}
            {draft.openingCaption.enabled &&
              outputTime < draft.openingCaption.durationSeconds && (
                <div
                  className={`editor-opening editor-opening-${draft.openingCaption.animation}`}
                  style={{
                    left: `${draft.openingCaption.x}%`,
                    top: `${draft.openingCaption.y}%`,
                    color: draft.openingCaption.color,
                    backgroundColor: `${draft.openingCaption.backgroundColor}${Math.round(
                      draft.openingCaption.backgroundOpacity * 255,
                    )
                      .toString(16)
                      .padStart(2, "0")}`,
                    transform: `translate(-50%, -50%) scale(${draft.openingCaption.scale})`,
                  }}
                >
                  {draft.openingCaption.text}
                </div>
              )}
            {draft.captionsEnabled &&
              (!draft.openingCaption.enabled ||
                outputTime >= draft.openingCaption.durationSeconds) && (
                <div
                  className="editor-subtitle"
                  key={visibleWords[0]?.id ?? fallbackSegment?.id ?? "fallback"}
                  style={{
                    left: `${visualSubtitle.subtitleX}%`,
                    top: `${visualSubtitle.subtitleY}%`,
                    transform: `translate(-50%, -50%) scale(${visualSubtitle.subtitleScale})`,
                    textAlign: visualSubtitle.subtitleAlign,
                    color: videoTemplate(draft.templateId).textColor,
                    fontFamily: draft.subtitleStyle.fontFamily,
                    fontWeight: draft.subtitleStyle.fontWeight,
                    textTransform: draft.subtitleStyle.uppercase
                      ? "uppercase"
                      : "none",
                    backgroundColor: `${draft.subtitleStyle.backgroundColor}${Math.round(
                      draft.subtitleStyle.backgroundOpacity * 255,
                    )
                      .toString(16)
                      .padStart(2, "0")}`,
                    borderRadius: `${draft.subtitleStyle.borderRadius / 5}px`,
                    padding: `${draft.subtitleStyle.paddingVertical / 5}px ${draft.subtitleStyle.paddingHorizontal / 5}px`,
                    fontSize: `${videoTemplate(draft.templateId).fontSize / 5}px`,
                    animation:
                      videoTemplate(draft.templateId).animation === "energetic"
                        ? "subtitle-pop 140ms ease-out"
                        : "subtitle-fade 140ms ease-out",
                  }}
                >
                  {visibleWords.length
                    ? visibleWords.map((word) => (
                        <span
                          key={word.id}
                          style={{
                            color:
                              word.id === state.words[activeWordIndex]?.id
                                ? draft.subtitleStyle.activeWordColor
                                : undefined,
                          }}
                        >
                          {word.text}{" "}
                        </span>
                      ))
                    : (fallbackSegment?.text ?? "Предпросмотр субтитров")}
                </div>
              )}
          </div>
          <div className="editor-transport">
            <Button
              variant="ghost"
              aria-label="Предыдущий кадр"
              title="Предыдущий кадр"
              onClick={() => seek(outputTime - 1 / 30)}
            >
              <SkipBack />
            </Button>
            <Button variant="secondary" onClick={() => void togglePlayback()}>
              <Play /> {isPlaying ? "Пауза" : "Воспроизвести"}
            </Button>
            <Button
              variant="ghost"
              aria-label="Следующий кадр"
              title="Следующий кадр"
              onClick={() => seek(outputTime + 1 / 30)}
            >
              <SkipForward />
            </Button>
            <strong>
              {formatDuration(outputTime)} / {formatDuration(duration)}
            </strong>
            <span>Источник: {mapping.sourceTime.toFixed(2)} сек.</span>
            <Button
              variant="ghost"
              onClick={() => setShowSafeZones((value) => !value)}
              title="Безопасные зоны Shorts/TikTok"
            >
              {showSafeZones ? <Eye /> : <EyeOff />} Безопасные зоны
            </Button>
            <Button
              variant="ghost"
              onPointerDown={() => setShowBefore(true)}
              onPointerUp={() => setShowBefore(false)}
              onPointerLeave={() => setShowBefore(false)}
              title="Удерживайте для исходного изображения"
            >
              До / после
            </Button>
          </div>
          <input
            className="editor-scrubber"
            type="range"
            min="0"
            max={duration}
            step="0.01"
            value={outputTime}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <div className="keyframe-track" aria-label="Маркеры ключевых кадров">
            {[...draft.cropKeyframes, ...draft.subtitleKeyframes].map(
              (frame) => {
                const range = timeline.find(
                  (item) => item.id === frame.rangeId,
                );
                if (!range) return null;
                const position =
                  ((range.outputStart + frame.sourceTimeSeconds - range.start) /
                    duration) *
                  100;
                return (
                  <i key={frame.id} style={{ left: `${position}%` }}>
                    ◆
                  </i>
                );
              },
            )}
          </div>
        </section>

        <aside className="timeline-tools panel">
          <div className="editor-mode-tabs">
            <button
              className={editing === "crop" ? "active" : ""}
              onClick={() => selectEditorTool("crop")}
            >
              Кадр
            </button>
            <button
              className={editing === "subtitle" ? "active" : ""}
              onClick={() => selectEditorTool("subtitle")}
            >
              Субтитры
            </button>
            <button
              className={editing === "image" ? "active" : ""}
              onClick={() => selectEditorTool("image")}
            >
              Изображение
            </button>
            <button
              className={editing === "audio" ? "active" : ""}
              onClick={() => selectEditorTool("audio")}
            >
              Звук
            </button>
            <button
              className={editing === "opening" ? "active" : ""}
              onClick={() => selectEditorTool("opening")}
            >
              Заставка
            </button>
            <button
              className={editing === "template" ? "active" : ""}
              onClick={() => selectEditorTool("template")}
            >
              Шаблоны
            </button>
          </div>
          {editing === "crop" && (
            <>
              <p className="helper-text">
                Перетащите точку внимания к человеку. Горизонтальное видео
                заполняет вертикальный кадр и обрезается по краям.
              </p>
              <div className="crop-preset-grid" aria-label="Пресеты кадра">
                {(
                  [
                    ["По центру", 50, 50, 1],
                    ["Слева", 28, 50, 1],
                    ["Справа", 72, 50, 1],
                    ["Приблизить", 50, 50, 1.25],
                    ["Отдалить", 50, 50, 1],
                  ] as const
                ).map(([label, cropX, cropY, zoom]) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => setVisualCrop({ cropX, cropY, zoom })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="editor-control">
                Масштаб <b>{visualCrop.zoom.toFixed(2)}×</b>
                <input
                  type="range"
                  min="1"
                  max="1.5"
                  step="0.01"
                  value={visualCrop.zoom}
                  onChange={(event) =>
                    setVisualCrop((value) => ({
                      ...value,
                      zoom: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <small>
                X {visualCrop.cropX.toFixed(0)} · Y{" "}
                {visualCrop.cropY.toFixed(0)}
              </small>
              <label className="editor-control compact-control">
                Переход
                <select
                  value={cropEasing}
                  onChange={(event) =>
                    setCropEasing(
                      event.target.value as "linear" | "ease-in-out" | "hold",
                    )
                  }
                >
                  <option value="linear">Линейный</option>
                  <option value="ease-in-out">Плавный</option>
                  <option value="hold">Без интерполяции</option>
                </select>
              </label>
              <Button onClick={addCropKeyframe}>
                ◆ Добавить ключевой кадр
              </Button>
              <div className="keyframe-navigation">
                <Button
                  variant="ghost"
                  onClick={() => seekAdjacentKeyframe(-1)}
                >
                  <SkipBack /> Предыдущий
                </Button>
                <Button variant="ghost" onClick={() => seekAdjacentKeyframe(1)}>
                  Следующий <SkipForward />
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setVisualCrop({ cropX: 50, cropY: 50, zoom: 1 })}
              >
                Сбросить кадр
              </Button>
            </>
          )}
          {editing === "subtitle" && (
            <>
              <p className="helper-text">
                Перетащите блок внутри пунктирной safe-zone. Keyframe меняет
                положение с текущего source time.
              </p>
              <label className="editor-control">
                Масштаб <b>{visualSubtitle.subtitleScale.toFixed(2)}×</b>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={visualSubtitle.subtitleScale}
                  onChange={(event) =>
                    setVisualSubtitle((value) => ({
                      ...value,
                      subtitleScale: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="editor-control compact-control">
                Переход
                <select
                  value={subtitleTransition}
                  onChange={(event) =>
                    setSubtitleTransition(
                      event.target.value as "hold" | "smooth",
                    )
                  }
                >
                  <option value="hold">Резкий</option>
                  <option value="smooth">Плавный</option>
                </select>
              </label>
              <Button onClick={addSubtitleKeyframe}>
                ◆ Добавить ключевой кадр субтитров
              </Button>
              <div className="subtitle-presets" aria-label="Позиция субтитров">
                {(
                  [
                    ["Сверху", 28],
                    ["По центру", 50],
                    ["Снизу", 72],
                  ] as const
                ).map(([label, subtitleY]) => (
                  <button
                    type="button"
                    key={label}
                    className={
                      visualSubtitle.subtitleY === subtitleY ? "active" : ""
                    }
                    onClick={() =>
                      setVisualSubtitle((value) => ({
                        ...value,
                        subtitleX: 50,
                        subtitleY,
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="keyframe-navigation">
                <Button
                  variant="ghost"
                  onClick={() => seekAdjacentKeyframe(-1)}
                >
                  <SkipBack /> Предыдущий
                </Button>
                <Button variant="ghost" onClick={() => seekAdjacentKeyframe(1)}>
                  Следующий <SkipForward />
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  setVisualSubtitle({
                    subtitleX: 50,
                    subtitleY: 72,
                    subtitleScale: 1,
                    subtitleAlign: "center",
                  })
                }
              >
                Сбросить субтитры
              </Button>
            </>
          )}
          {editing === "image" && (
            <div className="editor-tool-section">
              <div className="segmented-control">
                <button
                  className={draft.frameMode === "fill" ? "active" : ""}
                  onClick={() =>
                    setDraft((value) => ({ ...value, frameMode: "fill" }))
                  }
                >
                  Fill · заполнить
                </button>
                <button
                  className={draft.frameMode === "fit" ? "active" : ""}
                  onClick={() =>
                    setDraft((value) => ({ ...value, frameMode: "fit" }))
                  }
                >
                  Fit · целиком
                </button>
              </div>
              {(
                [
                  ["brightness", "Яркость", 0, 200, 1],
                  ["exposure", "Экспозиция", -2, 2, 0.05],
                  ["contrast", "Контраст", 0, 200, 1],
                  ["saturation", "Насыщенность", 0, 200, 1],
                  ["temperature", "Температура", -100, 100, 1],
                  ["tint", "Оттенок", -100, 100, 1],
                  ["sharpness", "Резкость", 0, 100, 1],
                  ["blur", "Размытие", 0, 20, 0.1],
                  ["vignette", "Виньетка", 0, 100, 1],
                  ["opacity", "Непрозрачность", 0, 100, 1],
                  ["rotation", "Поворот", -180, 180, 1],
                  ["zoom", "Масштаб", 1, 2, 0.01],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label className="editor-control" key={key}>
                  {label} <b>{draft.image[key]}</b>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={draft.image[key]}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        image: {
                          ...value.image,
                          [key]: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ))}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={draft.image.flipHorizontal}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      image: {
                        ...value.image,
                        flipHorizontal: event.target.checked,
                      },
                    }))
                  }
                />
                Отразить по горизонтали
              </label>
              {draft.frameMode === "fit" && (
                <>
                  {(
                    [
                      ["backgroundBlur", "Размытие фона", 0, 80, 1],
                      ["backgroundDim", "Затемнение фона", 0, 0.8, 0.01],
                      ["backgroundSaturation", "Насыщенность фона", 0, 2, 0.01],
                    ] as const
                  ).map(([key, label, min, max, step]) => (
                    <label className="editor-control" key={key}>
                      {label} <b>{draft.image[key]}</b>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={draft.image[key]}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            image: {
                              ...value.image,
                              [key]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                </>
              )}
              <Button
                variant="ghost"
                onClick={() =>
                  setDraft((value) => ({
                    ...value,
                    image: DEFAULT_IMAGE_ADJUSTMENTS,
                    frameMode: "fill",
                  }))
                }
              >
                Сбросить коррекцию
              </Button>
            </div>
          )}
          {editing === "audio" && (
            <div className="editor-tool-section">
              <label className="editor-control">
                Громкость клипа <b>{draft.audio.volume.toFixed(2)}×</b>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={draft.audio.volume}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      audio: {
                        ...value.audio,
                        volume: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              {(
                [
                  ["muted", "Выключить исходный звук"],
                  ["normalize", "Нормализовать громкость после render"],
                  ["noiseReduction", "Шумоподавление после render"],
                ] as const
              ).map(([key, label]) => (
                <label className="check-row" key={key}>
                  <input
                    type="checkbox"
                    checked={draft.audio[key]}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        audio: {
                          ...value.audio,
                          [key]: event.target.checked,
                        },
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
              {(
                [
                  ["fadeInSeconds", "Fade-in речи", 0, 10],
                  ["fadeOutSeconds", "Fade-out речи", 0, 10],
                ] as const
              ).map(([key, label, min, max]) => (
                <label className="editor-control" key={key}>
                  {label} <b>{draft.audio[key].toFixed(1)} сек.</b>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step="0.1"
                    value={draft.audio[key]}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        audio: {
                          ...value.audio,
                          [key]: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ))}
              <label className="editor-file-button button button-secondary">
                <Volume2 />
                {musicMutation.isPending ? "Загружаем…" : "Добавить музыку"}
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.aac,audio/*"
                  disabled={musicMutation.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    musicMutation.mutate(file, {
                      onSuccess: (asset) =>
                        setDraft((value) => ({
                          ...value,
                          audio: {
                            ...value.audio,
                            music: {
                              fileName: asset.fileName,
                              originalName: asset.originalName,
                              mimeType: asset.mimeType,
                              volume: 0.28,
                              startSeconds: 0,
                              loop: true,
                              fadeInSeconds: 1,
                              fadeOutSeconds: 1,
                              duckDuringSpeech: true,
                            },
                          },
                        })),
                    });
                  }}
                />
              </label>
              {draft.audio.music && (
                <div className="music-settings">
                  <strong>{draft.audio.music.originalName}</strong>
                  <label className="editor-control">
                    Громкость музыки
                    <b>{draft.audio.music.volume.toFixed(2)}×</b>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      value={draft.audio.music.volume}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          audio: {
                            ...value.audio,
                            music: value.audio.music
                              ? {
                                  ...value.audio.music,
                                  volume: Number(event.target.value),
                                }
                              : null,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Начало музыки, сек.
                    <input
                      type="number"
                      min="0"
                      max="90"
                      step="0.1"
                      value={draft.audio.music.startSeconds}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          audio: {
                            ...value.audio,
                            music: value.audio.music
                              ? {
                                  ...value.audio.music,
                                  startSeconds: Number(event.target.value),
                                }
                              : null,
                          },
                        }))
                      }
                    />
                  </label>
                  {(
                    [
                      ["fadeInSeconds", "Плавное появление"],
                      ["fadeOutSeconds", "Плавное затухание"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="editor-control" key={key}>
                      {label}
                      <b>{draft.audio.music?.[key].toFixed(1)} сек.</b>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.1"
                        value={draft.audio.music?.[key] ?? 0}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            audio: {
                              ...value.audio,
                              music: value.audio.music
                                ? {
                                    ...value.audio.music,
                                    [key]: Number(event.target.value),
                                  }
                                : null,
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                  <div className="inline-checks">
                    {(
                      [
                        ["loop", "Повторять"],
                        ["duckDuringSpeech", "Приглушать во время речи"],
                      ] as const
                    ).map(([key, label]) => (
                      <label className="check-row" key={key}>
                        <input
                          type="checkbox"
                          checked={draft.audio.music?.[key] ?? false}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              audio: {
                                ...value.audio,
                                music: value.audio.music
                                  ? {
                                      ...value.audio.music,
                                      [key]: event.target.checked,
                                    }
                                  : null,
                              },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setDraft((value) => ({
                        ...value,
                        audio: { ...value.audio, music: null },
                      }))
                    }
                  >
                    Убрать музыку
                  </Button>
                </div>
              )}
              <p className="helper-text">
                Нормализация, шумоподавление и автоматическое ducking слышны
                только после локального render.
              </p>
            </div>
          )}
          {editing === "subtitle" && (
            <div className="editor-tool-section subtitle-style-tools">
              <label>
                Шрифт
                <select
                  value={draft.subtitleStyle.fontFamily}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      subtitleStyle: {
                        ...value.subtitleStyle,
                        fontFamily: event.target
                          .value as typeof value.subtitleStyle.fontFamily,
                      },
                    }))
                  }
                >
                  {[
                    "Arial",
                    "Helvetica",
                    "Georgia",
                    "Courier New",
                    "Trebuchet MS",
                  ].map((font) => (
                    <option value={font} key={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>
              <label className="editor-control">
                Насыщенность шрифта <b>{draft.subtitleStyle.fontWeight}</b>
                <input
                  type="range"
                  min="400"
                  max="900"
                  step="100"
                  value={draft.subtitleStyle.fontWeight}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      subtitleStyle: {
                        ...value.subtitleStyle,
                        fontWeight: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <div className="editor-color-grid">
                {(
                  [
                    ["textColor", "Текст"],
                    ["activeWordColor", "Активное слово"],
                    ["backgroundColor", "Фон"],
                    ["outlineColor", "Контур"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="color"
                      value={draft.subtitleStyle[key]}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          subtitleStyle: {
                            ...value.subtitleStyle,
                            [key]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              {(
                [
                  ["backgroundOpacity", "Прозрачность фона", 0, 1, 0.05],
                  ["outlineWidth", "Толщина контура", 0, 8, 0.5],
                  ["borderRadius", "Скругление", 0, 40, 1],
                  ["paddingHorizontal", "Отступ по горизонтали", 0, 48, 1],
                  ["paddingVertical", "Отступ по вертикали", 0, 32, 1],
                  ["maxWords", "Слов во фразе", 1, 12, 1],
                  ["maxLines", "Максимум строк", 1, 3, 1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label className="editor-control" key={key}>
                  {label} <b>{draft.subtitleStyle[key]}</b>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={draft.subtitleStyle[key]}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        subtitleStyle: {
                          ...value.subtitleStyle,
                          [key]: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ))}
              <label>
                Анимация
                <select
                  value={draft.subtitleStyle.animation}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      subtitleStyle: {
                        ...value.subtitleStyle,
                        animation: event.target
                          .value as typeof value.subtitleStyle.animation,
                      },
                    }))
                  }
                >
                  <option value="none">Нет</option>
                  <option value="minimal">Минимальная</option>
                  <option value="fade">Появление</option>
                  <option value="pop">Pop</option>
                </select>
              </label>
              <div className="inline-checks">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.subtitleStyle.shadow}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        subtitleStyle: {
                          ...value.subtitleStyle,
                          shadow: event.target.checked,
                        },
                      }))
                    }
                  />
                  Тень
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.subtitleStyle.uppercase}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        subtitleStyle: {
                          ...value.subtitleStyle,
                          uppercase: event.target.checked,
                        },
                      }))
                    }
                  />
                  Верхний регистр
                </label>
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  setDraft((value) => ({
                    ...value,
                    subtitleStyle: DEFAULT_SUBTITLE_STYLE,
                  }))
                }
              >
                Сбросить стиль субтитров
              </Button>
            </div>
          )}
          {editing === "opening" && (
            <div className="editor-tool-section">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={draft.openingCaption.enabled}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      openingCaption: {
                        ...value.openingCaption,
                        enabled: event.target.checked,
                      },
                      openingCaptionEnabled: event.target.checked,
                    }))
                  }
                />
                Показывать вступительную заставку
              </label>
              <label>
                Текст
                <textarea
                  rows={3}
                  value={draft.openingCaption.text}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      openingCaption: {
                        ...value.openingCaption,
                        text: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              {(
                [
                  ["x", "Позиция X", 15, 85, 1],
                  ["y", "Позиция Y", 10, 90, 1],
                  ["scale", "Размер", 0.5, 2, 0.05],
                  ["backgroundOpacity", "Прозрачность фона", 0, 1, 0.05],
                  ["durationSeconds", "Длительность", 0.5, 10, 0.1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label className="editor-control" key={key}>
                  {label} <b>{draft.openingCaption[key]}</b>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={draft.openingCaption[key]}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        openingCaption: {
                          ...value.openingCaption,
                          [key]: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ))}
              <div className="editor-color-grid">
                <label>
                  Текст
                  <input
                    type="color"
                    value={draft.openingCaption.color}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        openingCaption: {
                          ...value.openingCaption,
                          color: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Фон
                  <input
                    type="color"
                    value={draft.openingCaption.backgroundColor}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        openingCaption: {
                          ...value.openingCaption,
                          backgroundColor: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Анимация
                <select
                  value={draft.openingCaption.animation}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      openingCaption: {
                        ...value.openingCaption,
                        animation: event.target
                          .value as typeof value.openingCaption.animation,
                      },
                    }))
                  }
                >
                  <option value="none">Нет</option>
                  <option value="fade">Появление</option>
                  <option value="pop">Pop</option>
                  <option value="slide">Сдвиг</option>
                </select>
              </label>
              <Button
                variant="ghost"
                onClick={() =>
                  setDraft((value) => ({
                    ...value,
                    openingCaption: {
                      ...DEFAULT_OPENING_CAPTION_SETTINGS,
                      text: value.openingCaption.text,
                    },
                    openingCaptionEnabled: false,
                  }))
                }
              >
                Сбросить заставку
              </Button>
            </div>
          )}
          {editing === "template" && (
            <div className="editor-tool-section">
              <div className="template-grid compact-template-grid">
                {state.templates.map((template) => (
                  <button
                    key={template.id}
                    className={draft.templateId === template.id ? "active" : ""}
                    onClick={() =>
                      setDraft((value) => ({
                        ...value,
                        templateId: template.id,
                        accentColor: template.defaultAccentColor,
                        subtitleStyle: {
                          ...value.subtitleStyle,
                          activeWordColor: template.defaultAccentColor,
                        },
                      }))
                    }
                  >
                    <i style={{ background: template.defaultAccentColor }} />
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
              <label className="color-field">
                Акцентный цвет
                <input
                  type="color"
                  value={draft.accentColor}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      accentColor: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="preset-create-row">
                <input
                  value={presetName}
                  placeholder="Название своего пресета"
                  onChange={(event) => setPresetName(event.target.value)}
                />
                <Button
                  disabled={
                    !presetName.trim() || createPresetMutation.isPending
                  }
                  onClick={savePreset}
                >
                  Сохранить
                </Button>
              </div>
              <div className="preset-list">
                {state.presets.map((preset) => (
                  <div key={preset.id}>
                    <button onClick={() => applyPreset(preset)}>
                      {preset.name}
                    </button>
                    <button
                      aria-label={`Удалить ${preset.name}`}
                      onClick={() => deletePresetMutation.mutate(preset.id)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(editing === "crop" || editing === "subtitle") && (
            <div className="keyframe-list">
              <strong>Ключевые кадры текущего диапазона</strong>
              {(editing === "crop"
                ? draft.cropKeyframes
                : draft.subtitleKeyframes
              )
                .filter((frame) => frame.rangeId === mapping.rangeId)
                .sort((a, b) => a.sourceTimeSeconds - b.sourceTimeSeconds)
                .map((frame) => {
                  const range = draft.ranges.find(
                    (item) => item.id === frame.rangeId,
                  );
                  const required =
                    editing === "crop" &&
                    Boolean(
                      range &&
                      Math.abs(frame.sourceTimeSeconds - range.start) < 0.001,
                    );
                  return (
                    <div key={frame.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKeyframe({
                            kind: editing,
                            id: frame.id,
                          });
                          seek(
                            (timeline.find((item) => item.id === frame.rangeId)
                              ?.outputStart ?? 0) +
                              frame.sourceTimeSeconds -
                              (range?.start ?? 0),
                          );
                        }}
                      >
                        ◆ {frame.sourceTimeSeconds.toFixed(2)} сек.
                      </button>
                      <button
                        type="button"
                        disabled={required}
                        title={
                          required
                            ? "Начальный ключевой кадр обязателен"
                            : "Удалить ключевой кадр"
                        }
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            cropKeyframes:
                              editing === "crop"
                                ? value.cropKeyframes.filter(
                                    (item) => item.id !== frame.id,
                                  )
                                : value.cropKeyframes,
                            subtitleKeyframes:
                              editing === "subtitle"
                                ? value.subtitleKeyframes.filter(
                                    (item) => item.id !== frame.id,
                                  )
                                : value.subtitleKeyframes,
                          }))
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </aside>

        <section className="ranges-panel panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">1. Соберите моменты</span>
              <h3>Диапазоны исходника</h3>
            </div>
            <strong>{duration.toFixed(1)} сек.</strong>
          </div>
          <p className="helper-text">
            Диапазон (Range) — отдельный кусок исходного видео. Перетащите
            строки, чтобы изменить порядок истории.
          </p>
          <div className="range-list">
            {draft.ranges.map((range, index) => (
              <div
                className={`range-row ${selectedRangeId === range.id ? "selected" : ""}`}
                key={range.id}
                draggable
                onClick={() => setSelectedRangeId(range.id)}
                onDragStart={(event) =>
                  event.dataTransfer.setData("text/range-id", range.id)
                }
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  reorderRange(
                    event.dataTransfer.getData("text/range-id"),
                    range.id,
                  );
                }}
              >
                <b>{index + 1}</b>
                <label>
                  Начало
                  <input
                    type="number"
                    step="0.1"
                    value={range.start}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        ranges: value.ranges.map((item) =>
                          item.id === range.id
                            ? { ...item, start: Number(event.target.value) }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  Конец
                  <input
                    type="number"
                    step="0.1"
                    value={range.end}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        ranges: value.ranges.map((item) =>
                          item.id === range.id
                            ? { ...item, end: Number(event.target.value) }
                            : item,
                        ),
                      }))
                    }
                  />
                </label>
                {index < draft.ranges.length - 1 && (
                  <div className="range-transition-fields">
                    <label>
                      Переход
                      <select
                        value={range.transition.type}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            ranges: value.ranges.map((item) =>
                              item.id === range.id
                                ? {
                                    ...item,
                                    transition: {
                                      ...item.transition,
                                      type: event.target
                                        .value as typeof item.transition.type,
                                      durationSeconds:
                                        event.target.value === "hard-cut"
                                          ? 0
                                          : Math.max(
                                              0.15,
                                              item.transition.durationSeconds,
                                            ),
                                    },
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        <option value="hard-cut">Жёсткая склейка</option>
                        <option value="crossfade">Плавное смешивание</option>
                        <option value="dip-to-black">Через затемнение</option>
                      </select>
                    </label>
                    {range.transition.type !== "hard-cut" && (
                      <label>
                        Сек.
                        <input
                          type="number"
                          min="0.1"
                          max="1.5"
                          step="0.1"
                          value={range.transition.durationSeconds}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              ranges: value.ranges.map((item) =>
                                item.id === range.id
                                  ? {
                                      ...item,
                                      transition: {
                                        ...item.transition,
                                        durationSeconds: Number(
                                          event.target.value,
                                        ),
                                      },
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                      </label>
                    )}
                  </div>
                )}
                <button
                  disabled={index === 0}
                  onClick={() =>
                    setDraft((value) => ({
                      ...value,
                      ranges: value.ranges.map((item, itemIndex, all) =>
                        itemIndex === index - 1
                          ? all[index]!
                          : itemIndex === index
                            ? all[index - 1]!
                            : item,
                      ),
                    }))
                  }
                >
                  ↑
                </button>
                <button
                  disabled={index === draft.ranges.length - 1}
                  onClick={() =>
                    setDraft((value) => ({
                      ...value,
                      ranges: value.ranges.map((item, itemIndex, all) =>
                        itemIndex === index
                          ? all[index + 1]!
                          : itemIndex === index + 1
                            ? all[index]!
                            : item,
                      ),
                    }))
                  }
                >
                  ↓
                </button>
                <button
                  disabled={draft.ranges.length === 1}
                  onClick={() =>
                    setDraft((value) => ({
                      ...value,
                      ranges: value.ranges.filter(
                        (item) => item.id !== range.id,
                      ),
                      cropKeyframes: value.cropKeyframes.filter(
                        (frame) => frame.rangeId !== range.id,
                      ),
                      subtitleKeyframes: value.subtitleKeyframes.filter(
                        (frame) => frame.rangeId !== range.id,
                      ),
                    }))
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const start = Math.min(
                mapping.sourceTime,
                state.sourceDurationSeconds - 1,
              );
              const end = Math.min(state.sourceDurationSeconds, start + 5);
              const id = crypto.randomUUID();
              setDraft((value) => ({
                ...value,
                ranges: [
                  ...value.ranges,
                  {
                    id,
                    start,
                    end,
                    transition: { type: "hard-cut", durationSeconds: 0 },
                  },
                ],
                cropKeyframes: [
                  ...value.cropKeyframes,
                  {
                    id: crypto.randomUUID(),
                    rangeId: id,
                    sourceTimeSeconds: start,
                    cropX: 50,
                    cropY: 50,
                    zoom: 1,
                    easing: "linear",
                  },
                ],
              }));
            }}
          >
            <Plus /> Добавить диапазон с текущего времени
          </Button>
          <div className="range-action-row">
            <Button variant="ghost" onClick={splitAtPlayhead}>
              <Scissors /> Разделить по playhead
            </Button>
            <Button variant="ghost" onClick={duplicateSelectedRange}>
              <Copy /> Дублировать
            </Button>
            <Button
              variant="ghost"
              disabled={draft.ranges.length === 1}
              onClick={deleteSelected}
            >
              <Trash2 /> Удалить
            </Button>
          </div>
          <div className="editor-transcript-list">
            <strong>Транскрипт выбранных ranges</strong>
            {state.segments.map((segment) => (
              <button
                key={segment.id}
                onClick={() => {
                  const range = draft.ranges.find(
                    (item) =>
                      segment.startSeconds < item.end &&
                      segment.endSeconds > item.start,
                  );
                  if (!range) return;
                  const mapped = rangeLocalToOutputTime(
                    draft.ranges,
                    range.id,
                    Math.max(0, segment.startSeconds - range.start),
                  );
                  if (mapped !== null) seek(mapped);
                }}
              >
                <span>{formatDuration(segment.startSeconds)}</span>
                {segment.text}
              </button>
            ))}
          </div>
          {invalidDuration && (
            <p className="form-error">
              <AlertCircle />
              Суммарная длительность должна быть от 15 до 90 секунд.
            </p>
          )}
        </section>

        <section className="template-panel panel editor-timeline-panel">
          <div className="editor-timeline-toolbar">
            <div>
              <strong>Монтажная шкала</strong>
              <span>{duration.toFixed(2)} сек.</span>
            </div>
            <div>
              <Button variant="ghost" onClick={splitAtPlayhead}>
                <Scissors /> Разделить
              </Button>
              <label>
                Масштаб
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={timelineZoom}
                  onChange={(event) =>
                    setTimelineZoom(Number(event.target.value))
                  }
                />
              </label>
            </div>
          </div>
          <div className="editor-timeline-scroll">
            <div
              className="editor-timeline-canvas"
              style={{ width: `${Math.max(720, duration * timelineZoom)}px` }}
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                seek((event.clientX - bounds.left) / timelineZoom);
              }}
            >
              <div className="timeline-ruler">
                {Array.from(
                  { length: Math.floor(duration / 5) + 1 },
                  (_, index) => index * 5,
                ).map((second) => (
                  <i key={second} style={{ left: second * timelineZoom }}>
                    {formatDuration(second)}
                  </i>
                ))}
              </div>
              <div className="timeline-track timeline-video-track">
                <b>Видео</b>
                {timeline.map((range, index) => (
                  <button
                    key={range.id}
                    draggable
                    className={selectedRangeId === range.id ? "selected" : ""}
                    style={{
                      left: range.outputStart * timelineZoom,
                      width: Math.max(24, range.duration * timelineZoom),
                    }}
                    onClick={() => {
                      setSelectedRangeId(range.id);
                      seek(range.outputStart);
                    }}
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/range-id", range.id)
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      reorderRange(
                        event.dataTransfer.getData("text/range-id"),
                        range.id,
                      );
                    }}
                  >
                    <span
                      className="range-resize-handle start"
                      onPointerDown={(event) =>
                        beginRangeResize(event, range.id, "start")
                      }
                    />
                    <strong>Диапазон {index + 1}</strong>
                    <small>{range.duration.toFixed(1)} сек.</small>
                    <span
                      className="range-resize-handle end"
                      onPointerDown={(event) =>
                        beginRangeResize(event, range.id, "end")
                      }
                    />
                  </button>
                ))}
              </div>
              <div className="timeline-track timeline-crop-track">
                <b>Кадр</b>
                {draft.cropKeyframes.map((frame) => {
                  const range = draft.ranges.find(
                    (item) => item.id === frame.rangeId,
                  );
                  const position = range
                    ? rangeLocalToOutputTime(
                        draft.ranges,
                        range.id,
                        frame.sourceTimeSeconds - range.start,
                      )
                    : null;
                  if (position === null) return null;
                  return (
                    <button
                      key={frame.id}
                      className={
                        selectedKeyframe?.id === frame.id ? "selected" : ""
                      }
                      style={{ left: position * timelineZoom }}
                      title={`Ключевой кадр изображения ${frame.sourceTimeSeconds.toFixed(2)} сек.`}
                      onClick={() => {
                        setSelectedKeyframe({ kind: "crop", id: frame.id });
                        seek(position);
                      }}
                    >
                      ◆
                    </button>
                  );
                })}
              </div>
              <div className="timeline-track timeline-subtitle-keyframe-track">
                <b>Позиция текста</b>
                {draft.subtitleKeyframes.map((frame) => {
                  const range = draft.ranges.find(
                    (item) => item.id === frame.rangeId,
                  );
                  const position = range
                    ? rangeLocalToOutputTime(
                        draft.ranges,
                        range.id,
                        frame.sourceTimeSeconds - range.start,
                      )
                    : null;
                  if (position === null) return null;
                  return (
                    <button
                      key={frame.id}
                      className={
                        selectedKeyframe?.id === frame.id ? "selected" : ""
                      }
                      style={{ left: position * timelineZoom }}
                      title={`Ключевой кадр субтитров ${frame.sourceTimeSeconds.toFixed(2)} сек.`}
                      onClick={() => {
                        setSelectedKeyframe({
                          kind: "subtitle",
                          id: frame.id,
                        });
                        seek(position);
                      }}
                    >
                      ◆
                    </button>
                  );
                })}
              </div>
              <div className="timeline-track timeline-words-track">
                <b>Субтитры</b>
                {state.words.map((word) => {
                  const range = draft.ranges.find(
                    (item) =>
                      word.endSeconds > item.start &&
                      word.startSeconds < item.end,
                  );
                  if (!range) return null;
                  const start = rangeLocalToOutputTime(
                    draft.ranges,
                    range.id,
                    Math.max(0, word.startSeconds - range.start),
                  );
                  if (start === null) return null;
                  const width =
                    Math.max(
                      0.05,
                      Math.min(range.end, word.endSeconds) -
                        Math.max(range.start, word.startSeconds),
                    ) * timelineZoom;
                  return (
                    <span
                      key={word.id}
                      style={{ left: start * timelineZoom, width }}
                      title={word.text}
                    />
                  );
                })}
              </div>
              {timeline.slice(1).map((range) => (
                <i
                  className="timeline-cut"
                  key={`cut-${range.id}`}
                  style={{ left: range.outputStart * timelineZoom }}
                />
              ))}
              <i
                className="timeline-playhead"
                style={{ left: outputTime * timelineZoom }}
              />
            </div>
          </div>
          {!state.hasWordTimestamps && (
            <Notice tone="warning">
              <AlertCircle />
              <div>
                <strong>Старый транскрипт без таймкодов слов</strong>
                <p>
                  Рендер использует фразы целиком. На странице транскрипта можно
                  обновить точные таймкоды.
                </p>
              </div>
            </Notice>
          )}
        </section>
      </div>
      {saveMutation.isError && (
        <Notice tone="error">
          <AlertCircle />
          <div>
            <strong>Не удалось сохранить редактор</strong>
            <p>{saveMutation.error.message}</p>
          </div>
        </Notice>
      )}
    </>
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
        title="Не удалось получить клипы"
        text={query.error.message}
      />
    );
  const clips = query.data;
  const enabledCount = clips.filter((clip) => clip.enabled).length;
  const overlaps = new Map<number, string>();
  clips.forEach((clip, index) => {
    for (let other = 0; other < index; other += 1) {
      const previous = clips[other]!;
      const overlap = clip.ranges.reduce(
        (total, range) =>
          total +
          previous.ranges.reduce(
            (rangeTotal, previousRange) =>
              rangeTotal +
              Math.max(
                0,
                Math.min(range.end, previousRange.end) -
                  Math.max(range.start, previousRange.start),
              ),
            0,
          ),
        0,
      );
      const shorter = Math.min(
        timelineDuration(clip.ranges),
        timelineDuration(previous.ranges),
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
      <div className="render-ready">
        <Notice>
          <CircleDashed />
          <div>
            <strong>Готово к локальному рендеру</strong>
            <p>
              {enabledCount} клипов включено и будет обработано последовательно.
            </p>
          </div>
          <Link to={`/projects/${project.id}/render`}>
            Перейти к рендеру <ArrowRight />
          </Link>
        </Notice>
      </div>
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
        text="Клипы собираются локально в вертикальные MP4 с выбранным кадрированием и субтитрами."
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
          <span className="small-pill">{enabled.length} клипов</span>
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
                  {formatDuration(timelineDuration(clip.ranges))} · 1080 × 1920
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
      <div className="render-local-notice">
        <Notice>
          <Sparkles />
          <div>
            <strong>Локальная обработка</strong>
            <p>
              Одновременно собирается один клип. Страницу можно закрыть —
              прогресс сохранится.
            </p>
          </div>
          <Link to={`/projects/${project.id}/results`}>
            Открыть результаты <ArrowRight />
          </Link>
        </Notice>
      </div>
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
          text="Запустите рендер или повторите клипы, завершившиеся с ошибкой."
          action={
            <Link
              className="button button-secondary editor-return-button"
              to={`/projects/${project.id}/clips`}
            >
              <ArrowLeft />
              Вернуться к редактору клипов
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
            <strong>{failed.length} клипов требуют повторной попытки</strong>
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
      <Link className="editor-return-link" to={`/projects/${project.id}/clips`}>
        <ArrowLeft /> Вернуться к редактору клипов
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
      <p>Страница не найдена. Вернитесь на главную или откройте проекты.</p>
      <Link className="button button-primary" to="/">
        Вернуться на главную
      </Link>
    </div>
  );
}
