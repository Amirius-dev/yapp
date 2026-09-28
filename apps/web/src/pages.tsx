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
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  useRecoverRenderMutation,
  useRenderResultsQuery,
  useStartRenderMutation,
} from "./queries/render";
import { useStudio } from "./studio-context";
import type { Project } from "./types";
import {
  clampSubtitlePosition,
  SUBTITLE_POSITION,
  subtitleSafeWidthPercent,
  timelineDuration,
  type ClipDto,
  type ClipsValidationResult,
} from "@studio/contracts";

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

export { TimelineEditorPage } from "./editor/EditorPage";
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
  const recover = useRecoverRenderMutation(project.id);
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
          <div className="render-actions">
            {active && (
              <Button
                variant="secondary"
                disabled={recover.isPending}
                onClick={() => recover.mutate()}
              >
                {recover.isPending ? <LoaderCircle className="spin" /> : <X />}
                Сбросить зависшую очередь
              </Button>
            )}
            <Button
              onClick={() => start.mutate({})}
              disabled={active || !enabled.length || start.isPending}
            >
              {active ? <LoaderCircle className="spin" /> : <Play />}
              {results.length ? "Рендерить недостающие" : "Начать рендер"}
            </Button>
          </div>
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
      {recover.isError && (
        <Notice tone="warning">
          <AlertCircle />
          <div>
            <strong>Очередь не удалось сбросить</strong>
            <p>{recover.error.message}</p>
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
