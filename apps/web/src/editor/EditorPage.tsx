import {
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Scissors,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EmptyState, Notice } from "../components";
import { formatDuration } from "../lib";
import { useProjectQuery } from "../queries/projects";
import {
  useCreateEditorPresetMutation,
  useDeleteEditorPresetMutation,
  useEditorDocumentQuery,
  useUploadEditorAssetMutation,
} from "../queries/editor";
import { useStudio } from "../studio-context";
import type { Project } from "../types";
import { saveEditorDocument } from "../api/editor";
import {
  buildTimeline,
  clampSubtitlePosition,
  DEFAULT_IMAGE_ADJUSTMENTS,
  DEFAULT_OPENING_CAPTION_SETTINGS,
  DEFAULT_SUBTITLE_STYLE,
  evaluateImageOverlay,
  evaluateMask,
  imageFilterCss,
  imageTransformCss,
  interpolateCrop,
  interpolateSubtitle,
  outputToSourceTime,
  rangeLocalToOutputTime,
  timelineDuration,
  videoTemplate,
  type EditorDocumentV2,
  type EditorEasing,
} from "@studio/contracts";
import "./editor.css";
import { EditorShell } from "./components/EditorShell";
import { EditorToolbar } from "./components/EditorToolbar";
import {
  EditorButton as Button,
  EditorEmptyState,
  Tabs,
} from "./components/EditorControls";
import { Inspector } from "./components/Inspector";
import { PlaybackControls } from "./components/PlaybackControls";
import { ParameterControl } from "./components/ParameterControl";
import { PreviewStage } from "./components/PreviewStage";
import { Timeline } from "./components/Timeline";
import { ToolRail } from "./components/ToolRail";
import { TimecodeInput } from "./components/TimecodeInput";

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
      title="Загружаем редактор"
      text="Получаем монтажный документ из локального backend."
    />
  );
}

function MissingProject() {
  return (
    <EmptyState
      icon={<AlertCircle />}
      title="Редактор недоступен"
      text="Проект или клип не найден."
      action={
        <Link className="button button-primary" to="/projects">
          К проектам
        </Link>
      }
    />
  );
}

const editorTools = [
  "crop",
  "subtitle",
  "image",
  "audio",
  "opening",
  "template",
  "masks",
  "overlays",
] as const;

const templateLabels: Record<string, string> = {
  clean: "Минималистичный",
  motivational: "Динамичный",
  podcast: "Подкаст",
};
type EditorTool = (typeof editorTools)[number];

function isEditorTool(value: string | null): value is EditorTool {
  return editorTools.some((tool) => tool === value);
}

function editorToolLabel(tool: EditorTool) {
  return {
    crop: "Кадр и трансформация",
    subtitle: "Субтитры",
    image: "Коррекция изображения",
    audio: "Аудио",
    opening: "Заставка",
    template: "Стиль и переходы",
    masks: "Маска",
    overlays: "Изображения",
  }[tool];
}

export function TimelineEditorPage() {
  const project = useProject();
  const { clipId } = useParams();
  const query = useEditorDocumentQuery(project?.id, clipId);
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
      project={project}
      state={query.data.context}
      initialDocument={query.data.document}
      initialRevision={query.data.revision}
      initialAssets={query.data.mediaAssets}
    />
  );
}

function TimelineEditorWorkspace({
  project,
  state,
  initialDocument,
  initialRevision,
  initialAssets,
}: {
  project: Project;
  state: NonNullable<
    ReturnType<typeof useEditorDocumentQuery>["data"]
  >["context"];
  initialDocument: EditorDocumentV2;
  initialRevision: number;
  initialAssets: NonNullable<
    ReturnType<typeof useEditorDocumentQuery>["data"]
  >["mediaAssets"];
}) {
  const [original, setOriginal] = useState(initialDocument);
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraftState] = useState<EditorDocumentV2>(initialDocument);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const revisionRef = useRef(initialRevision);
  const localVersionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "dirty" | "saving" | "failed" | "conflict"
  >("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveDraftRef = useRef<() => Promise<void>>(async () => undefined);
  const setDraft = (
    action: EditorDocumentV2 | ((value: EditorDocumentV2) => EditorDocumentV2),
  ) => {
    localVersionRef.current += 1;
    setSaveStatus("dirty");
    setDraftState((value) =>
      typeof action === "function" ? action(value) : action,
    );
  };
  const [outputTime, setOutputTime] = useState(0);
  const [activeRangeId, setActiveRangeId] = useState(draft.ranges[0]!.id);
  const [editing, setEditing] = useState<EditorTool>(() => {
    const requestedTool = searchParams.get("tool");
    return isEditorTool(requestedTool) ? requestedTool : "crop";
  });
  const [cropEasing, setCropEasing] = useState<EditorEasing>("ease-in-out");
  const [subtitleTransition, setSubtitleTransition] = useState<
    "hold" | "smooth"
  >("smooth");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showBefore, setShowBefore] = useState(false);
  const [canvasGuides, setCanvasGuides] = useState({ x: false, y: false });
  const [timelineZoom, setTimelineZoom] = useState(18);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rangeId: string;
  } | null>(null);
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicSolo, setMusicSolo] = useState(false);
  const [selectedRangeId, setSelectedRangeId] = useState(draft.ranges[0]!.id);
  const [selectedKeyframe, setSelectedKeyframe] = useState<{
    kind: "crop" | "subtitle";
    id: string;
  } | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(
    initialDocument.masks[0]?.id ?? null,
  );
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    initialDocument.imageOverlays[0]?.id ?? null,
  );
  const [presetName, setPresetName] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fitBackgroundRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const musicMutation = useUploadEditorAssetMutation(
    project.id,
    state.clip.id,
    "music",
  );
  const imageAssetMutation = useUploadEditorAssetMutation(
    project.id,
    state.clip.id,
    "image",
  );
  const [mediaAssets, setMediaAssets] = useState(initialAssets);
  const createPresetMutation = useCreateEditorPresetMutation(
    project.id,
    state.clip.id,
  );
  const deletePresetMutation = useDeleteEditorPresetMutation(
    project.id,
    state.clip.id,
  );
  const historyRef = useRef<EditorDocumentV2[]>([structuredClone(original)]);
  const historyIndexRef = useRef(0);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringHistoryRef = useRef(false);
  const [, redrawHistory] = useState(0);
  const timeline = buildTimeline(draft.ranges);
  const duration = timelineDuration(draft.ranges);
  const timelineHeaderWidth = 144;
  const timelineX = (seconds: number) =>
    timelineHeaderWidth + seconds * timelineZoom;
  const musicAsset = mediaAssets.find(
    (asset) => asset.id === draft.audio.music?.assetId,
  );
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
      videoRef.current.muted = draft.audio.muted || musicSolo;
    }
    if (musicRef.current && draft.audio.music) {
      musicRef.current.volume = musicMuted
        ? 0
        : Math.min(1, draft.audio.music.volume);
    }
  }, [
    draft.audio.muted,
    draft.audio.music,
    draft.audio.volume,
    musicMuted,
    musicSolo,
  ]);
  const mapping = outputToSourceTime(draft.ranges, outputTime) ?? {
    rangeId: draft.ranges[0]!.id,
    sourceTime: draft.ranges[0]!.start,
  };
  const mappedRangeIndex = timeline.findIndex(
    (range) => range.id === mapping.rangeId,
  );
  const incomingTransition =
    mappedRangeIndex > 0 ? timeline[mappedRangeIndex - 1] : undefined;
  const transitionProgress = incomingTransition?.transitionOutDuration
    ? Math.max(
        0,
        Math.min(
          1,
          (outputTime - timeline[mappedRangeIndex]!.outputStart) /
            incomingTransition.transitionOutDuration,
        ),
      )
    : 1;
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
  const visibleMasks = draft.masks
    .map((mask) => evaluateMask(mask, draft.ranges, outputTime))
    .filter((mask) => mask !== null)
    .sort((a, b) => a.layerOrder - b.layerOrder);
  const visibleOverlays = draft.imageOverlays
    .map((overlay) => evaluateImageOverlay(overlay, draft.ranges, outputTime))
    .filter((overlay) => overlay !== null)
    .sort((a, b) => a.layerOrder - b.layerOrder);
  const [visualCrop, setVisualCrop] = useState({
    cropX: crop.cropX,
    cropY: crop.cropY,
    zoom: crop.zoom,
    rotation: crop.rotation ?? 0,
  });
  const [visualSubtitle, setVisualSubtitle] = useState({
    subtitleX: subtitle.subtitleX,
    subtitleY: subtitle.subtitleY,
    subtitleScale: subtitle.subtitleScale,
    subtitleAlign: subtitle.subtitleAlign,
  });
  useEffect(() => {
    if (!isPlaying) return;
    setVisualCrop({
      cropX: crop.cropX,
      cropY: crop.cropY,
      zoom: crop.zoom,
      rotation: crop.rotation ?? 0,
    });
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
    crop.rotation,
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
  const saveDraft = async () => {
    if (invalidDuration || !dirty) return;
    if (savingRef.current) {
      queuedSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    const ticketVersion = localVersionRef.current;
    const ticketDocument = structuredClone(draftRef.current);
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const snapshot = await saveEditorDocument(
        project.id,
        state.clip.id,
        revisionRef.current,
        ticketDocument,
      );
      revisionRef.current = snapshot.revision;
      setOriginal(snapshot.document);
      if (ticketVersion === localVersionRef.current) setSaveStatus("saved");
      else {
        setSaveStatus("dirty");
        queuedSaveRef.current = true;
      }
    } catch (error) {
      const typed = error as Error & { code?: string };
      setSaveStatus(
        typed.code === "EDITOR_REVISION_CONFLICT" ? "conflict" : "failed",
      );
      setSaveError(typed.message);
    } finally {
      savingRef.current = false;
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        window.setTimeout(() => void saveDraft(), 0);
      }
    }
  };
  saveDraftRef.current = saveDraft;
  useEffect(() => {
    if (
      !dirty ||
      invalidDuration ||
      saveStatus === "conflict" ||
      saveStatus === "saving" ||
      saveStatus === "saved"
    )
      return;
    const timer = window.setTimeout(() => void saveDraftRef.current(), 850);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, invalidDuration, saveStatus]);
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
    const rawX = ((clientX - bounds.left) / bounds.width) * 100;
    const rawY = ((clientY - bounds.top) / bounds.height) * 100;
    const snapX = Math.abs(rawX - 50) <= 2;
    const snapY = Math.abs(rawY - 50) <= 2;
    const x = snapX ? 50 : rawX;
    const y = snapY ? 50 : rawY;
    setCanvasGuides({ x: snapX, y: snapY });
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
    } else if (editing === "masks" && selectedMaskId) {
      setDraft((value) => ({
        ...value,
        masks: value.masks.map((mask) =>
          mask.id === selectedMaskId && !mask.locked
            ? {
                ...mask,
                x: Math.max(0, Math.min(100, x)),
                y: Math.max(0, Math.min(100, y)),
              }
            : mask,
        ),
      }));
    } else if (editing === "overlays" && selectedOverlayId) {
      setDraft((value) => ({
        ...value,
        imageOverlays: value.imageOverlays.map((overlay) =>
          overlay.id === selectedOverlayId && !overlay.locked
            ? (() => {
                const minX = overlay.safeZone ? 7 : 0;
                const maxX = overlay.safeZone ? 93 : 100;
                const minY = overlay.safeZone ? 8 : 0;
                const maxY = overlay.safeZone ? 87 : 100;
                return {
                  ...overlay,
                  x: Math.max(minX, Math.min(maxX, x)),
                  y: Math.max(minY, Math.min(maxY, y)),
                };
              })()
            : overlay,
        ),
      }));
    }
  };
  const beginCanvasResize = (
    event: React.PointerEvent,
    kind: "mask" | "overlay",
    id: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const origin =
      kind === "mask"
        ? draft.masks.find((item) => item.id === id)
        : draft.imageOverlays.find((item) => item.id === id);
    if (!origin || origin.locked) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(
        1,
        Math.min(
          100,
          origin.width + ((moveEvent.clientX - startX) / bounds.width) * 100,
        ),
      );
      const height = Math.max(
        1,
        Math.min(
          100,
          origin.height + ((moveEvent.clientY - startY) / bounds.height) * 100,
        ),
      );
      setDraft((value) =>
        kind === "mask"
          ? {
              ...value,
              masks: value.masks.map((item) =>
                item.id === id ? { ...item, width, height } : item,
              ),
            }
          : {
              ...value,
              imageOverlays: value.imageOverlays.map((item) =>
                item.id === id ? { ...item, width, height } : item,
              ),
            },
      );
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up, { once: true });
  };
  const beginCanvasRotate = (
    event: React.PointerEvent,
    kind: "mask" | "overlay",
    id: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const element = event.currentTarget.parentElement;
    const origin =
      kind === "mask"
        ? draft.masks.find((item) => item.id === id)
        : draft.imageOverlays.find((item) => item.id === id);
    if (!element || !origin || origin.locked) return;
    const bounds = element.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const startAngle = Math.atan2(
      event.clientY - centerY,
      event.clientX - centerX,
    );
    const move = (next: PointerEvent) => {
      const angle = Math.atan2(next.clientY - centerY, next.clientX - centerX);
      const rotation = Math.max(
        -180,
        Math.min(180, origin.rotation + ((angle - startAngle) * 180) / Math.PI),
      );
      setDraft((value) =>
        kind === "mask"
          ? {
              ...value,
              masks: value.masks.map((item) =>
                item.id === id ? { ...item, rotation } : item,
              ),
            }
          : {
              ...value,
              imageOverlays: value.imageOverlays.map((item) =>
                item.id === id ? { ...item, rotation } : item,
              ),
            },
      );
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up, { once: true });
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
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
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
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up, { once: true });
  };
  const beginMusicDrag = (event: React.PointerEvent) => {
    if (!draft.audio.music) return;
    event.preventDefault();
    const originX = event.clientX;
    const origin = draft.audio.music.startSeconds;
    const move = (next: PointerEvent) => {
      const startSeconds = Math.max(
        0,
        Math.min(
          duration - 0.25,
          origin + (next.clientX - originX) / timelineZoom,
        ),
      );
      setDraft((value) => ({
        ...value,
        audio: {
          ...value.audio,
          music: value.audio.music
            ? { ...value.audio.music, startSeconds }
            : null,
        },
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
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [contextMenu]);
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
    <EditorShell
      toolbar={
        <EditorToolbar
          projectId={project.id}
          projectName={project.name}
          title={state.clip.title}
          status={saveStatus}
          canUndo={historyIndexRef.current > 0}
          canRedo={historyIndexRef.current < historyRef.current.length - 1}
          canSave={dirty && !invalidDuration && saveStatus !== "saving"}
          onUndo={undo}
          onRedo={redo}
          onSave={() => void saveDraft()}
          onRender={() => {
            if (!dirty || window.confirm("Уйти без сохранения изменений?"))
              window.location.assign(`/projects/${project.id}/render`);
          }}
        />
      }
      toolRail={<ToolRail active={editing} onChange={selectEditorTool} />}
    >
      <div className="timeline-editor">
        <PreviewStage>
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
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              setCanvasGuides({ x: false, y: false });
            }}
            onPointerCancel={() => setCanvasGuides({ x: false, y: false })}
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
                  : `${imageTransformCss(draft.image, visualCrop.zoom)} rotate(${visualCrop.rotation}deg)`,
                filter: showBefore ? "none" : imageFilterCss(draft.image),
                opacity:
                  incomingTransition?.transition?.type === "crossfade"
                    ? transitionProgress
                    : 1,
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
                  currentRange.end - currentRange.transitionOutDuration - 0.04
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
                src={
                  draft.audio.music.assetId
                    ? mediaAssets.find(
                        (asset) => asset.id === draft.audio.music?.assetId,
                      )?.mediaUrl
                    : `/api/projects/${encodeURIComponent(project.id)}/music/${encodeURIComponent(draft.audio.music.fileName ?? "")}`
                }
                loop={draft.audio.music.loop}
              />
            )}
            {visibleMasks.map((mask) => (
              <div
                key={mask.id}
                className={`canvas-mask ${selectedMaskId === mask.id ? "selected" : ""}`}
                style={{
                  zIndex: 10 + mask.layerOrder,
                  left: `${mask.x}%`,
                  top: `${mask.y}%`,
                  width: `${mask.width}%`,
                  height: `${mask.height}%`,
                  opacity: mask.opacity,
                  transform: `translate(-50%, -50%) rotate(${mask.rotation}deg)`,
                  borderRadius:
                    mask.shape === "ellipse"
                      ? "50%"
                      : mask.shape === "rounded-rectangle"
                        ? "18%"
                        : "2px",
                  background:
                    mask.type === "solid" ? mask.fillColor : "transparent",
                  backdropFilter:
                    mask.type === "blur"
                      ? `blur(${Math.max(1, mask.intensity / 4)}px)`
                      : mask.type === "pixelate"
                        ? `blur(${Math.max(1, mask.intensity / 18)}px) contrast(1.8)`
                        : undefined,
                  boxShadow:
                    mask.feather > 0
                      ? `0 0 ${mask.feather / 2}px ${mask.feather / 5}px ${mask.fillColor}55`
                      : undefined,
                }}
                onPointerDown={() => {
                  setSelectedMaskId(mask.id);
                  selectEditorTool("masks");
                }}
              >
                {selectedMaskId === mask.id && !mask.locked && (
                  <>
                    <i
                      className="canvas-rotation-handle"
                      onPointerDown={(event) =>
                        beginCanvasRotate(event, "mask", mask.id)
                      }
                    />
                    <i
                      className="canvas-resize-handle"
                      onPointerDown={(event) =>
                        beginCanvasResize(event, "mask", mask.id)
                      }
                    />
                  </>
                )}
              </div>
            ))}
            {visibleOverlays.map((overlay) => {
              const asset = mediaAssets.find(
                (item) => item.id === overlay.assetId,
              );
              if (!asset) return null;
              const animationProgress = Math.min(
                1,
                Math.max(0, (outputTime - overlay.startSeconds) / 0.35),
              );
              const animatedScale =
                overlay.animation === "pop" || overlay.animation === "zoom"
                  ? overlay.scale * (0.75 + animationProgress * 0.25)
                  : overlay.scale;
              const animatedX =
                overlay.animation === "slide"
                  ? overlay.x - (1 - animationProgress) * 12
                  : overlay.x;
              return (
                <div
                  key={overlay.id}
                  className={`canvas-overlay ${selectedOverlayId === overlay.id ? "selected" : ""}`}
                  style={{
                    zIndex: 100 + overlay.layerOrder,
                    left: `${animatedX}%`,
                    top: `${overlay.y}%`,
                    width: `${overlay.width}%`,
                    height: `${overlay.height}%`,
                    opacity:
                      overlay.animation === "fade"
                        ? overlay.opacity * animationProgress
                        : overlay.opacity,
                    transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${animatedScale})`,
                    borderRadius: `${overlay.borderRadius}%`,
                    boxShadow: overlay.shadow
                      ? "0 10px 30px rgba(0,0,0,.34)"
                      : undefined,
                  }}
                  onPointerDown={() => {
                    setSelectedOverlayId(overlay.id);
                    selectEditorTool("overlays");
                  }}
                >
                  <img src={asset.mediaUrl} alt="" draggable={false} />
                  {selectedOverlayId === overlay.id && !overlay.locked && (
                    <>
                      <i
                        className="canvas-rotation-handle"
                        onPointerDown={(event) =>
                          beginCanvasRotate(event, "overlay", overlay.id)
                        }
                      />
                      <i
                        className="canvas-resize-handle"
                        onPointerDown={(event) =>
                          beginCanvasResize(event, "overlay", overlay.id)
                        }
                      />
                    </>
                  )}
                </div>
              );
            })}
            {(canvasGuides.x || canvasGuides.y) && (
              <div className="canvas-snapping-guides" aria-hidden="true">
                {canvasGuides.x && <i className="is-vertical" />}
                {canvasGuides.y && <i className="is-horizontal" />}
              </div>
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
                    lineHeight: draft.subtitleStyle.lineHeight ?? 1.08,
                    letterSpacing: `${draft.subtitleStyle.letterSpacing ?? 0}px`,
                    maxWidth: `${draft.subtitleStyle.maxWidth ?? 85}%`,
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
                    fontSize: `${(draft.subtitleStyle.fontSize ?? videoTemplate(draft.templateId).fontSize) / 5}px`,
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
          <PlaybackControls>
            <div className="ce-transport-primary">
              <div
                className="ce-transport-cluster"
                aria-label="Воспроизведение"
              >
                <button
                  className="ce-transport-icon"
                  aria-label="Предыдущий кадр"
                  title="Предыдущий кадр"
                  onClick={() => seek(outputTime - 1 / 30)}
                >
                  <SkipBack />
                </button>
                <button
                  className="ce-transport-play"
                  aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
                  title={isPlaying ? "Пауза" : "Воспроизвести"}
                  onClick={() => void togglePlayback()}
                >
                  {isPlaying ? <Pause /> : <Play />}
                </button>
                <button
                  className="ce-transport-icon"
                  aria-label="Следующий кадр"
                  title="Следующий кадр"
                  onClick={() => seek(outputTime + 1 / 30)}
                >
                  <SkipForward />
                </button>
              </div>
              <div className="ce-transport-time">
                <strong>{formatDuration(outputTime)}</strong>
                <i>/</i>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
            <span className="ce-transport-source">
              Источник {mapping.sourceTime.toFixed(2)} сек.
            </span>
            <div className="ce-transport-tools">
              <button
                className={showSafeZones ? "is-active" : ""}
                onClick={() => setShowSafeZones((value) => !value)}
                title="Безопасные зоны Shorts/TikTok"
              >
                {showSafeZones ? <Eye /> : <EyeOff />}
                <span>Безопасные зоны</span>
              </button>
              <button
                onPointerDown={() => setShowBefore(true)}
                onPointerUp={() => setShowBefore(false)}
                onPointerCancel={() => setShowBefore(false)}
                onPointerLeave={() => setShowBefore(false)}
                title="Удерживайте для исходного изображения"
              >
                До / после
              </button>
            </div>
          </PlaybackControls>
          <div className="ce-scrub-hint">
            Используйте playhead на timeline для перемотки
          </div>
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
        </PreviewStage>

        <Inspector title={editorToolLabel(editing)}>
          <Tabs label="Инструмент редактора" className="editor-mode-tabs">
            <button
              role="tab"
              aria-selected={editing === "crop"}
              className={editing === "crop" ? "active" : ""}
              onClick={() => selectEditorTool("crop")}
            >
              Кадр
            </button>
            <button
              role="tab"
              aria-selected={editing === "subtitle"}
              className={editing === "subtitle" ? "active" : ""}
              onClick={() => selectEditorTool("subtitle")}
            >
              Субтитры
            </button>
            <button
              role="tab"
              aria-selected={editing === "image"}
              className={editing === "image" ? "active" : ""}
              onClick={() => selectEditorTool("image")}
            >
              Изображение
            </button>
            <button
              role="tab"
              aria-selected={editing === "audio"}
              className={editing === "audio" ? "active" : ""}
              onClick={() => selectEditorTool("audio")}
            >
              Звук
            </button>
            <button
              role="tab"
              aria-selected={editing === "opening"}
              className={editing === "opening" ? "active" : ""}
              onClick={() => selectEditorTool("opening")}
            >
              Заставка
            </button>
            <button
              role="tab"
              aria-selected={editing === "template"}
              className={editing === "template" ? "active" : ""}
              onClick={() => selectEditorTool("template")}
            >
              Шаблоны
            </button>
            <button
              role="tab"
              aria-selected={editing === "masks"}
              className={editing === "masks" ? "active" : ""}
              onClick={() => selectEditorTool("masks")}
            >
              Маски
            </button>
            <button
              role="tab"
              aria-selected={editing === "overlays"}
              className={editing === "overlays" ? "active" : ""}
              onClick={() => selectEditorTool("overlays")}
            >
              Лого
            </button>
          </Tabs>
          {editing === "masks" && (
            <div className="editor-tool-section layer-inspector">
              <Button
                onClick={() => {
                  const id = crypto.randomUUID();
                  setDraft((value) => ({
                    ...value,
                    masks: [
                      ...value.masks,
                      {
                        id,
                        name: `Маска ${value.masks.length + 1}`,
                        type: "blur",
                        shape: "rounded-rectangle",
                        startSeconds: outputTime,
                        endSeconds: Math.min(duration, outputTime + 5),
                        x: 50,
                        y: 20,
                        width: 28,
                        height: 12,
                        rotation: 0,
                        intensity: 55,
                        opacity: 1,
                        feather: 8,
                        fillColor: "#111111",
                        visible: true,
                        locked: false,
                        layerOrder: value.masks.length,
                        keyframes: [],
                      },
                    ],
                  }));
                  setSelectedMaskId(id);
                }}
              >
                <Plus /> Добавить маску
              </Button>
              {draft.masks.length === 0 && (
                <EditorEmptyState
                  title="Масок пока нет"
                  description="Добавьте маску, чтобы скрыть логотип или другую область кадра."
                />
              )}
              {draft.masks.map((mask) => (
                <button
                  type="button"
                  className={`layer-row ${selectedMaskId === mask.id ? "active" : ""}`}
                  key={mask.id}
                  onClick={() => setSelectedMaskId(mask.id)}
                >
                  <span>{mask.visible ? <Eye /> : <EyeOff />}</span>
                  <strong>{mask.name}</strong>
                  <small>{mask.type}</small>
                </button>
              ))}
              {draft.masks
                .filter((mask) => mask.id === selectedMaskId)
                .map((mask) => (
                  <div className="layer-properties" key={mask.id}>
                    <div className="music-trim-grid">
                      {(["startSeconds", "endSeconds"] as const).map((key) => (
                        <label key={key}>
                          {key === "startSeconds" ? "Начало" : "Конец"}
                          <input
                            type="number"
                            min="0"
                            max={duration}
                            step="0.1"
                            value={mask[key]}
                            onChange={(event) =>
                              setDraft((value) => ({
                                ...value,
                                masks: value.masks.map((item) =>
                                  item.id === mask.id
                                    ? {
                                        ...item,
                                        [key]: Number(event.target.value),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Эффект
                      <select
                        value={mask.type}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            masks: value.masks.map((item) =>
                              item.id === mask.id
                                ? {
                                    ...item,
                                    type: event.target
                                      .value as typeof item.type,
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        <option value="blur">Размытие</option>
                        <option value="pixelate">Пикселизация</option>
                        <option value="solid">Сплошная заливка</option>
                      </select>
                    </label>
                    <label>
                      Форма
                      <select
                        value={mask.shape}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            masks: value.masks.map((item) =>
                              item.id === mask.id
                                ? {
                                    ...item,
                                    shape: event.target
                                      .value as typeof item.shape,
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        <option value="rectangle">Прямоугольник</option>
                        <option value="rounded-rectangle">Скруглённый</option>
                        <option value="ellipse">Ellipse</option>
                      </select>
                    </label>
                    {(
                      [
                        ["x", "X", 0, 100, 1],
                        ["y", "Y", 0, 100, 1],
                        ["width", "Ширина", 1, 100, 1],
                        ["height", "Высота", 1, 100, 1],
                        ["rotation", "Поворот", -180, 180, 1],
                        ["intensity", "Интенсивность", 0, 100, 1],
                        ["opacity", "Прозрачность", 0, 1, 0.01],
                        ["feather", "Растушёвка", 0, 100, 1],
                      ] as const
                    ).map(([key, label, min, max, step]) => (
                      <ParameterControl
                        key={key}
                        label={label}
                        value={mask[key]}
                        min={min}
                        max={max}
                        step={step}
                        defaultValue={
                          key === "opacity"
                            ? 1
                            : key === "intensity"
                              ? 70
                              : key === "width"
                                ? 28
                                : key === "height"
                                  ? 12
                                  : key === "x"
                                    ? 50
                                    : key === "y"
                                      ? 20
                                      : 0
                        }
                        unit={
                          key === "opacity"
                            ? ""
                            : key === "rotation"
                              ? "°"
                              : "%"
                        }
                        onChange={(next) =>
                          setDraft((value) => ({
                            ...value,
                            masks: value.masks.map((item) =>
                              item.id === mask.id
                                ? { ...item, [key]: next }
                                : item,
                            ),
                          }))
                        }
                      />
                    ))}
                    <div className="layer-actions">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            masks: value.masks.map((item) =>
                              item.id === mask.id
                                ? { ...item, visible: !item.visible }
                                : item,
                            ),
                          }))
                        }
                      >
                        {mask.visible ? <Eye /> : <EyeOff />}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            masks: value.masks.map((item) =>
                              item.id === mask.id
                                ? { ...item, locked: !item.locked }
                                : item,
                            ),
                          }))
                        }
                      >
                        {mask.locked ? "Unlock" : "Lock"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const id = crypto.randomUUID();
                          setDraft((value) => ({
                            ...value,
                            masks: [
                              ...value.masks,
                              {
                                ...mask,
                                id,
                                name: `${mask.name} copy`,
                                x: Math.min(100, mask.x + 3),
                                y: Math.min(100, mask.y + 3),
                                keyframes: mask.keyframes.map((frame) => ({
                                  ...frame,
                                  id: crypto.randomUUID(),
                                })),
                              },
                            ],
                          }));
                          setSelectedMaskId(id);
                        }}
                      >
                        <Copy />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const range = draft.ranges.find(
                            (item) => item.id === mapping.rangeId,
                          );
                          if (!range) return;
                          setDraft((value) => ({
                            ...value,
                            masks: value.masks.map((item) =>
                              item.id === mask.id
                                ? {
                                    ...item,
                                    keyframes: [
                                      ...item.keyframes,
                                      {
                                        id: crypto.randomUUID(),
                                        rangeId: mapping.rangeId,
                                        rangeTimeSeconds:
                                          mapping.sourceTime - range.start,
                                        x: item.x,
                                        y: item.y,
                                        width: item.width,
                                        height: item.height,
                                        rotation: item.rotation,
                                        intensity: item.intensity,
                                        opacity: item.opacity,
                                        easing: "ease-in-out",
                                      },
                                    ],
                                  }
                                : item,
                            ),
                          }));
                        }}
                      >
                        ◆ Keyframe
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            masks: value.masks.filter(
                              (item) => item.id !== mask.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {mask.keyframes.map((frame) => (
                      <div className="keyframe-row" key={frame.id}>
                        <button
                          onClick={() => {
                            const time = rangeLocalToOutputTime(
                              draft.ranges,
                              frame.rangeId,
                              frame.rangeTimeSeconds,
                            );
                            if (time !== null) seek(time);
                          }}
                        >
                          ◆ {frame.rangeTimeSeconds.toFixed(2)}s
                        </button>
                        <select
                          value={frame.easing}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              masks: value.masks.map((item) =>
                                item.id === mask.id
                                  ? {
                                      ...item,
                                      keyframes: item.keyframes.map(
                                        (keyframe) =>
                                          keyframe.id === frame.id
                                            ? {
                                                ...keyframe,
                                                easing: event.target
                                                  .value as typeof keyframe.easing,
                                              }
                                            : keyframe,
                                      ),
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          <option value="linear">Линейный</option>
                          <option value="ease-in">Ускорение</option>
                          <option value="ease-out">Замедление</option>
                          <option value="ease-in-out">
                            Плавный вход и выход
                          </option>
                          <option value="smooth">Плавный</option>
                          <option value="hold">Без интерполяции</option>
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}
          {editing === "overlays" && (
            <div className="editor-tool-section layer-inspector">
              <label className="editor-file-button">
                {imageAssetMutation.isPending ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <Upload />
                )}
                <span>
                  {imageAssetMutation.isPending
                    ? "Загружаем…"
                    : "Добавить PNG / JPG / WebP"}
                </span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  disabled={imageAssetMutation.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    imageAssetMutation.mutate(file, {
                      onSuccess: (asset) => {
                        setMediaAssets((items) => [...items, asset]);
                        const id = crypto.randomUUID();
                        setDraft((value) => ({
                          ...value,
                          imageOverlays: [
                            ...value.imageOverlays,
                            {
                              id,
                              assetId: asset.id,
                              name: asset.originalName,
                              startSeconds: 0,
                              endSeconds: duration,
                              x: 84,
                              y: 12,
                              width: 18,
                              height: Math.max(
                                4,
                                18 *
                                  ((asset.height ?? 1) / (asset.width ?? 1)) *
                                  (9 / 16),
                              ),
                              scale: 1,
                              rotation: 0,
                              opacity: 0.9,
                              borderRadius: 0,
                              shadow: false,
                              visible: true,
                              locked: false,
                              layerOrder: value.imageOverlays.length,
                              animation: "none",
                              watermark: true,
                              safeZone: true,
                              keyframes: [],
                            },
                          ],
                        }));
                        setSelectedOverlayId(id);
                      },
                    });
                  }}
                />
              </label>
              {draft.imageOverlays.length === 0 && (
                <EditorEmptyState
                  title="Изображений пока нет"
                  description="Загрузите PNG, JPG или WebP и разместите его поверх видео."
                />
              )}
              {draft.imageOverlays.map((overlay) => (
                <button
                  type="button"
                  className={`layer-row ${selectedOverlayId === overlay.id ? "active" : ""}`}
                  key={overlay.id}
                  onClick={() => setSelectedOverlayId(overlay.id)}
                >
                  <ImageIcon /> <strong>{overlay.name}</strong>
                  <small>слой {overlay.layerOrder + 1}</small>
                </button>
              ))}
              {draft.imageOverlays
                .filter((overlay) => overlay.id === selectedOverlayId)
                .map((overlay) => (
                  <div className="layer-properties" key={overlay.id}>
                    <div className="music-trim-grid">
                      {(["startSeconds", "endSeconds"] as const).map((key) => (
                        <label key={key}>
                          {key === "startSeconds" ? "Начало" : "Конец"}
                          <input
                            type="number"
                            min="0"
                            max={duration}
                            step="0.1"
                            value={overlay[key]}
                            onChange={(event) =>
                              setDraft((value) => ({
                                ...value,
                                imageOverlays: value.imageOverlays.map(
                                  (item) =>
                                    item.id === overlay.id
                                      ? {
                                          ...item,
                                          [key]: Number(event.target.value),
                                        }
                                      : item,
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="crop-preset-grid">
                      {(
                        [
                          ["↖", 12, 10],
                          ["↗", 88, 10],
                          ["↙", 12, 88],
                          ["↘", 88, 88],
                        ] as const
                      ).map(([label, x, y]) => (
                        <button
                          key={label}
                          onClick={() =>
                            setDraft((value) => ({
                              ...value,
                              imageOverlays: value.imageOverlays.map((item) =>
                                item.id === overlay.id
                                  ? { ...item, x, y, safeZone: true }
                                  : item,
                              ),
                            }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {(
                      [
                        ["x", "X", 0, 100, 1],
                        ["y", "Y", 0, 100, 1],
                        ["width", "Ширина", 1, 100, 1],
                        ["height", "Высота", 1, 100, 1],
                        ["scale", "Scale", 0.05, 3, 0.01],
                        ["rotation", "Поворот", -180, 180, 1],
                        ["opacity", "Прозрачность", 0, 1, 0.01],
                        ["borderRadius", "Скругление", 0, 100, 1],
                      ] as const
                    ).map(([key, label, min, max, step]) => (
                      <ParameterControl
                        key={key}
                        label={label}
                        value={overlay[key]}
                        min={min}
                        max={max}
                        step={step}
                        defaultValue={
                          key === "opacity" || key === "scale"
                            ? 1
                            : key === "width"
                              ? 24
                              : key === "height"
                                ? 14
                                : key === "x" || key === "y"
                                  ? 50
                                  : 0
                        }
                        unit={
                          key === "rotation"
                            ? "°"
                            : key === "opacity" || key === "scale"
                              ? ""
                              : "%"
                        }
                        onChange={(next) =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, [key]: next }
                                : item,
                            ),
                          }))
                        }
                      />
                    ))}
                    <label>
                      Анимация
                      <select
                        value={overlay.animation}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.map((item) =>
                              item.id === overlay.id
                                ? {
                                    ...item,
                                    animation: event.target
                                      .value as typeof item.animation,
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        <option value="none">Нет</option>
                        <option value="fade">Появление</option>
                        <option value="pop">Акцент</option>
                        <option value="slide">Сдвиг</option>
                        <option value="zoom">Масштаб</option>
                      </select>
                    </label>
                    <div className="layer-actions">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, visible: !item.visible }
                                : item,
                            ),
                          }))
                        }
                      >
                        {overlay.visible ? <Eye /> : <EyeOff />}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, locked: !item.locked }
                                : item,
                            ),
                          }))
                        }
                      >
                        {overlay.locked ? "Unlock" : "Lock"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const id = crypto.randomUUID();
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: [
                              ...value.imageOverlays,
                              {
                                ...overlay,
                                id,
                                name: `${overlay.name} copy`,
                                x: Math.min(100, overlay.x + 3),
                                y: Math.min(100, overlay.y + 3),
                                layerOrder: overlay.layerOrder + 1,
                                keyframes: overlay.keyframes.map((frame) => ({
                                  ...frame,
                                  id: crypto.randomUUID(),
                                })),
                              },
                            ],
                          }));
                          setSelectedOverlayId(id);
                        }}
                      >
                        <Copy />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.map((item) =>
                              item.id === overlay.id
                                ? {
                                    ...item,
                                    keyframes: [
                                      ...item.keyframes,
                                      {
                                        id: crypto.randomUUID(),
                                        anchor: "timeline",
                                        rangeId: null,
                                        localTimeSeconds: outputTime,
                                        x: item.x,
                                        y: item.y,
                                        width: item.width,
                                        height: item.height,
                                        scale: item.scale,
                                        rotation: item.rotation,
                                        opacity: item.opacity,
                                        easing: "ease-in-out",
                                      },
                                    ],
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        ◆ Keyframe
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.map((item) =>
                              item.id === overlay.id
                                ? {
                                    ...item,
                                    layerOrder: Math.max(
                                      0,
                                      item.layerOrder - 1,
                                    ),
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        Ниже
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.map((item) =>
                              item.id === overlay.id
                                ? { ...item, layerOrder: item.layerOrder + 1 }
                                : item,
                            ),
                          }))
                        }
                      >
                        Выше
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraft((value) => ({
                            ...value,
                            imageOverlays: value.imageOverlays.filter(
                              (item) => item.id !== overlay.id,
                            ),
                          }))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
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
                    onClick={() =>
                      setVisualCrop({ cropX, cropY, zoom, rotation: 0 })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ParameterControl
                label="Масштаб"
                value={visualCrop.zoom}
                min={1}
                max={1.5}
                step={0.01}
                defaultValue={1}
                unit="×"
                onChange={(zoom) =>
                  setVisualCrop((value) => ({ ...value, zoom }))
                }
              />
              <ParameterControl
                label="Поворот"
                value={visualCrop.rotation}
                min={-180}
                max={180}
                step={1}
                defaultValue={0}
                unit="°"
                onChange={(rotation) =>
                  setVisualCrop((value) => ({ ...value, rotation }))
                }
              />
              <small>
                X {visualCrop.cropX.toFixed(0)} · Y{" "}
                {visualCrop.cropY.toFixed(0)}
              </small>
              <label className="editor-control compact-control">
                Переход
                <select
                  value={cropEasing}
                  onChange={(event) =>
                    setCropEasing(event.target.value as EditorEasing)
                  }
                >
                  <option value="linear">Линейный</option>
                  <option value="ease-in">Ускорение</option>
                  <option value="ease-out">Замедление</option>
                  <option value="ease-in-out">Плавный вход и выход</option>
                  <option value="smooth">Плавный</option>
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
                onClick={() =>
                  setVisualCrop({ cropX: 50, cropY: 50, zoom: 1, rotation: 0 })
                }
              >
                Сбросить кадр
              </Button>
            </>
          )}
          {editing === "subtitle" && (
            <>
              <p className="helper-text">
                Перетащите блок внутри пунктирной safe-zone. Keyframe меняет
                положение с текущего времени исходника.
              </p>
              <ParameterControl
                label="Масштаб"
                value={visualSubtitle.subtitleScale}
                min={0.75}
                max={1.5}
                step={0.05}
                defaultValue={1}
                unit="×"
                onChange={(subtitleScale) =>
                  setVisualSubtitle((value) => ({ ...value, subtitleScale }))
                }
              />
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
                  Заполнить
                </button>
                <button
                  className={draft.frameMode === "fit" ? "active" : ""}
                  onClick={() =>
                    setDraft((value) => ({ ...value, frameMode: "fit" }))
                  }
                >
                  Вписать целиком
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
                <ParameterControl
                  key={key}
                  label={label}
                  value={draft.image[key]}
                  min={min}
                  max={max}
                  step={step}
                  defaultValue={DEFAULT_IMAGE_ADJUSTMENTS[key]}
                  unit={key === "rotation" ? "°" : key === "zoom" ? "×" : ""}
                  onChange={(next) =>
                    setDraft((value) => ({
                      ...value,
                      image: { ...value.image, [key]: next },
                    }))
                  }
                />
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
                    <ParameterControl
                      key={key}
                      label={label}
                      value={draft.image[key]}
                      min={min}
                      max={max}
                      step={step}
                      defaultValue={DEFAULT_IMAGE_ADJUSTMENTS[key]}
                      onChange={(next) =>
                        setDraft((value) => ({
                          ...value,
                          image: { ...value.image, [key]: next },
                        }))
                      }
                    />
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
              <ParameterControl
                label="Громкость клипа"
                value={draft.audio.volume}
                min={0}
                max={2}
                step={0.05}
                defaultValue={1}
                unit="×"
                onChange={(volume) =>
                  setDraft((value) => ({
                    ...value,
                    audio: { ...value.audio, volume },
                  }))
                }
              />
              {(
                [
                  ["muted", "Выключить исходный звук"],
                  ["normalize", "Нормализовать громкость после рендера"],
                  ["noiseReduction", "Шумоподавление после рендера"],
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
                  ["fadeInSeconds", "Появление речи", 0, 10],
                  ["fadeOutSeconds", "Затухание речи", 0, 10],
                ] as const
              ).map(([key, label, min, max]) => (
                <ParameterControl
                  key={key}
                  label={label}
                  value={draft.audio[key]}
                  min={min}
                  max={max}
                  step={0.1}
                  defaultValue={0}
                  unit="с"
                  onChange={(next) =>
                    setDraft((value) => ({
                      ...value,
                      audio: { ...value.audio, [key]: next },
                    }))
                  }
                />
              ))}
              <label className="editor-file-button">
                {musicMutation.isPending ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <Volume2 />
                )}
                <span>
                  {musicMutation.isPending ? "Загружаем…" : "Добавить музыку"}
                </span>
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.aac,audio/*"
                  disabled={musicMutation.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    musicMutation.mutate(file, {
                      onSuccess: (asset) => {
                        setMediaAssets((items) => [...items, asset]);
                        setDraft((value) => ({
                          ...value,
                          audio: {
                            ...value.audio,
                            music: {
                              assetId: asset.id,
                              originalName: asset.originalName,
                              mimeType: asset.mimeType as NonNullable<
                                typeof value.audio.music
                              >["mimeType"],
                              volume: 0.28,
                              startSeconds: 0,
                              trimStartSeconds: 0,
                              trimEndSeconds: asset.durationSeconds,
                              loop: true,
                              fadeInSeconds: 1,
                              fadeOutSeconds: 1,
                              duckDuringSpeech: true,
                              duckAmount: 0.55,
                              duckAttackSeconds: 0.08,
                              duckReleaseSeconds: 0.42,
                            },
                          },
                        }));
                      },
                    });
                  }}
                />
              </label>
              {draft.audio.music && (
                <div className="music-settings">
                  <strong>{draft.audio.music.originalName}</strong>
                  <div
                    className="ce-audio-monitoring"
                    role="group"
                    aria-label="Прослушивание музыки"
                  >
                    <button
                      className={musicMuted ? "is-active" : ""}
                      onClick={() => setMusicMuted((value) => !value)}
                    >
                      Без звука
                    </button>
                    <button
                      className={musicSolo ? "is-active" : ""}
                      onClick={() => setMusicSolo((value) => !value)}
                    >
                      Соло
                    </button>
                  </div>
                  {draft.audio.music.assetId &&
                    mediaAssets.find(
                      (asset) => asset.id === draft.audio.music?.assetId,
                    )?.waveform && (
                      <div
                        className="music-waveform"
                        aria-label="Форма волны музыки"
                      >
                        {mediaAssets
                          .find(
                            (asset) => asset.id === draft.audio.music?.assetId,
                          )!
                          .waveform!.map((peak, index) => (
                            <i
                              key={index}
                              style={{ height: `${Math.max(5, peak * 100)}%` }}
                            />
                          ))}
                      </div>
                    )}
                  <ParameterControl
                    label="Громкость музыки"
                    value={draft.audio.music.volume}
                    min={0}
                    max={1}
                    step={0.02}
                    defaultValue={0.28}
                    unit="×"
                    onChange={(volume) =>
                      setDraft((value) => ({
                        ...value,
                        audio: {
                          ...value.audio,
                          music: value.audio.music
                            ? { ...value.audio.music, volume }
                            : null,
                        },
                      }))
                    }
                  />
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
                  <div className="music-trim-grid">
                    <label>
                      Начало фрагмента
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.audio.music.trimStartSeconds ?? 0}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            audio: {
                              ...value.audio,
                              music: value.audio.music
                                ? {
                                    ...value.audio.music,
                                    trimStartSeconds: Number(
                                      event.target.value,
                                    ),
                                  }
                                : null,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Конец фрагмента
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={draft.audio.music.trimEndSeconds ?? ""}
                        onChange={(event) =>
                          setDraft((value) => ({
                            ...value,
                            audio: {
                              ...value.audio,
                              music: value.audio.music
                                ? {
                                    ...value.audio.music,
                                    trimEndSeconds: event.target.value
                                      ? Number(event.target.value)
                                      : null,
                                  }
                                : null,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                  {draft.audio.music.duckDuringSpeech && (
                    <ParameterControl
                      label="Ducking"
                      value={draft.audio.music.duckAmount ?? 0.55}
                      min={0}
                      max={1}
                      step={0.05}
                      defaultValue={0.55}
                      unit="×"
                      onChange={(duckAmount) =>
                        setDraft((value) => ({
                          ...value,
                          audio: {
                            ...value.audio,
                            music: value.audio.music
                              ? { ...value.audio.music, duckAmount }
                              : null,
                          },
                        }))
                      }
                    />
                  )}
                  {(
                    [
                      ["fadeInSeconds", "Плавное появление"],
                      ["fadeOutSeconds", "Плавное затухание"],
                    ] as const
                  ).map(([key, label]) => (
                    <ParameterControl
                      key={key}
                      label={label}
                      value={draft.audio.music?.[key] ?? 0}
                      min={0}
                      max={10}
                      step={0.1}
                      defaultValue={1}
                      unit="с"
                      onChange={(next) =>
                        setDraft((value) => ({
                          ...value,
                          audio: {
                            ...value.audio,
                            music: value.audio.music
                              ? { ...value.audio.music, [key]: next }
                              : null,
                          },
                        }))
                      }
                    />
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
                только после локального рендера.
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
              <ParameterControl
                label="Насыщенность шрифта"
                value={draft.subtitleStyle.fontWeight}
                min={400}
                max={900}
                step={100}
                defaultValue={DEFAULT_SUBTITLE_STYLE.fontWeight}
                onChange={(fontWeight) =>
                  setDraft((value) => ({
                    ...value,
                    subtitleStyle: { ...value.subtitleStyle, fontWeight },
                  }))
                }
              />
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
                  ["fontSize", "Размер шрифта", 24, 120, 1],
                  ["lineHeight", "Высота строки", 0.8, 2, 0.05],
                  ["letterSpacing", "Интервал букв", -5, 20, 0.5],
                  ["shadowBlur", "Размытие тени", 0, 40, 1],
                  ["maxWidth", "Максимальная ширина", 30, 90, 1],
                  ["outlineWidth", "Толщина контура", 0, 8, 0.5],
                  ["borderRadius", "Скругление", 0, 40, 1],
                  ["paddingHorizontal", "Отступ по горизонтали", 0, 48, 1],
                  ["paddingVertical", "Отступ по вертикали", 0, 32, 1],
                  ["maxWords", "Слов во фразе", 1, 12, 1],
                  ["maxLines", "Максимум строк", 1, 3, 1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <ParameterControl
                  key={key}
                  label={label}
                  value={
                    draft.subtitleStyle[key] ?? DEFAULT_SUBTITLE_STYLE[key]
                  }
                  min={min}
                  max={max}
                  step={step}
                  defaultValue={DEFAULT_SUBTITLE_STYLE[key]}
                  unit={
                    key === "fontSize" ||
                    key === "shadowBlur" ||
                    key === "outlineWidth" ||
                    key === "borderRadius" ||
                    key === "paddingHorizontal" ||
                    key === "paddingVertical" ||
                    key === "letterSpacing"
                      ? "px"
                      : key === "maxWidth"
                        ? "%"
                        : ""
                  }
                  onChange={(next) =>
                    setDraft((value) => ({
                      ...value,
                      subtitleStyle: { ...value.subtitleStyle, [key]: next },
                    }))
                  }
                />
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
                  <option value="pop">Акцент</option>
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
                <ParameterControl
                  key={key}
                  label={label}
                  value={draft.openingCaption[key]}
                  min={min}
                  max={max}
                  step={step}
                  defaultValue={DEFAULT_OPENING_CAPTION_SETTINGS[key]}
                  unit={
                    key === "x" || key === "y" || key === "backgroundOpacity"
                      ? "%"
                      : key === "durationSeconds"
                        ? "с"
                        : "×"
                  }
                  onChange={(next) =>
                    setDraft((value) => ({
                      ...value,
                      openingCaption: { ...value.openingCaption, [key]: next },
                    }))
                  }
                />
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
                  <option value="pop">Акцент</option>
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
                    <strong>
                      {templateLabels[template.id] ?? template.name}
                    </strong>
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
                        className="keyframe-delete-button"
                        aria-label={
                          required
                            ? "Начальный ключевой кадр обязателен"
                            : "Удалить ключевой кадр"
                        }
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
        </Inspector>

        <section className="ranges-panel panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">1. Соберите моменты</span>
              <h3>Диапазоны исходника</h3>
            </div>
            <strong>{duration.toFixed(1)} сек.</strong>
          </div>
          <p className="helper-text">
            Диапазон — отдельный фрагмент исходного видео. Перетащите строки,
            чтобы изменить порядок истории.
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
                <TimecodeInput
                  label="Начало"
                  value={range.start}
                  max={range.end - 0.05}
                  sourceTime={range.start}
                  onChange={(start) =>
                    setDraft((value) => ({
                      ...value,
                      ranges: value.ranges.map((item) =>
                        item.id === range.id ? { ...item, start } : item,
                      ),
                    }))
                  }
                />
                <TimecodeInput
                  label="Конец"
                  value={range.end}
                  min={range.start + 0.05}
                  max={state.sourceDurationSeconds}
                  sourceTime={range.end}
                  onChange={(end) =>
                    setDraft((value) => ({
                      ...value,
                      ranges: value.ranges.map((item) =>
                        item.id === range.id ? { ...item, end } : item,
                      ),
                    }))
                  }
                />
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
                        <option value="dip-to-white">Через белый</option>
                        <option value="slide">Сдвиг</option>
                        <option value="zoom">Масштаб</option>
                        <option value="blur-dissolve">Размытие</option>
                      </select>
                    </label>
                    {range.transition.type !== "hard-cut" && (
                      <>
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
                        <label>
                          Easing
                          <select
                            value={range.transition.easing ?? "ease-in-out"}
                            onChange={(event) =>
                              setDraft((value) => ({
                                ...value,
                                ranges: value.ranges.map((item) =>
                                  item.id === range.id
                                    ? {
                                        ...item,
                                        transition: {
                                          ...item.transition,
                                          easing: event.target
                                            .value as NonNullable<
                                            typeof item.transition.easing
                                          >,
                                        },
                                      }
                                    : item,
                                ),
                              }))
                            }
                          >
                            <option value="linear">Линейный</option>
                            <option value="ease-in">Ускорение</option>
                            <option value="ease-out">Замедление</option>
                            <option value="ease-in-out">
                              Плавный вход и выход
                            </option>
                            <option value="smooth">Плавный</option>
                            <option value="hold">Без интерполяции</option>
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                )}
                <button
                  className="range-order-button"
                  aria-label="Переместить диапазон выше"
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
                  className="range-order-button"
                  aria-label="Переместить диапазон ниже"
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
                  className="range-delete-button"
                  aria-label={`Удалить диапазон ${index + 1}`}
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
              setSelectedRangeId(id);
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
              variant="danger"
              disabled={draft.ranges.length === 1}
              onClick={deleteSelected}
            >
              <Trash2 /> Удалить
            </Button>
          </div>
          <div className="editor-transcript-list">
            <strong>Транскрипт выбранных диапазонов</strong>
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

        <Timeline>
          <div className="editor-timeline-toolbar">
            <div>
              <strong>Монтажная шкала</strong>
              <span>{duration.toFixed(2)} сек.</span>
            </div>
            <div>
              <Button variant="ghost" onClick={splitAtPlayhead}>
                <Scissors /> Разделить
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setDraft((value) => ({
                    ...value,
                    markers: [
                      ...value.markers,
                      {
                        id: crypto.randomUUID(),
                        timeSeconds: outputTime,
                        label: "Маркер",
                        color: "#ff6b00",
                      },
                    ],
                  }))
                }
              >
                <Plus /> Маркер
              </Button>
              <ParameterControl
                label="Масштаб"
                value={timelineZoom}
                min={10}
                max={60}
                step={1}
                defaultValue={18}
                unit="px/s"
                onChange={setTimelineZoom}
              />
            </div>
          </div>
          <div
            className="editor-timeline-scroll"
            onWheel={(event) => {
              if (!event.metaKey && !event.ctrlKey) return;
              event.preventDefault();
              setTimelineZoom((value) =>
                Math.max(10, Math.min(60, value - event.deltaY * 0.04)),
              );
            }}
          >
            <div
              className="editor-timeline-canvas"
              style={{
                width: `${Math.max(
                  720,
                  timelineHeaderWidth + duration * timelineZoom,
                )}px`,
              }}
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                seek(
                  Math.max(
                    0,
                    (event.clientX - bounds.left - timelineHeaderWidth) /
                      timelineZoom,
                  ),
                );
              }}
            >
              <div className="timeline-ruler">
                {Array.from(
                  { length: Math.floor(duration / 5) + 1 },
                  (_, index) => index * 5,
                ).map((second) => (
                  <i key={second} style={{ left: timelineX(second) }}>
                    {formatDuration(second)}
                  </i>
                ))}
                {draft.markers.map((marker) => (
                  <button
                    className="timeline-marker"
                    key={marker.id}
                    title={marker.label}
                    style={{
                      left: timelineX(marker.timeSeconds),
                      color: marker.color,
                    }}
                    onClick={() => seek(marker.timeSeconds)}
                  >
                    ◆
                  </button>
                ))}
              </div>
              <div className="timeline-group-heading">
                <b>Монтаж</b>
                <span>Диапазоны видео</span>
              </div>
              <div className="timeline-track timeline-video-track">
                <b>Видео</b>
                {timeline.map((range, index) => (
                  <button
                    key={range.id}
                    draggable
                    className={selectedRangeId === range.id ? "selected" : ""}
                    style={{
                      left: timelineX(range.outputStart),
                      width: Math.max(2, range.duration * timelineZoom),
                    }}
                    onClick={() => {
                      setSelectedRangeId(range.id);
                      seek(range.outputStart);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectedRangeId(range.id);
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        rangeId: range.id,
                      });
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
                    {range.transitionOutDuration > 0 && (
                      <i
                        className="timeline-transition-block"
                        style={{
                          width: Math.max(
                            8,
                            range.transitionOutDuration * timelineZoom,
                          ),
                        }}
                        title={`${range.transition?.type ?? "transition"} · ${range.transitionOutDuration.toFixed(2)} сек.`}
                      />
                    )}
                    <span
                      className="range-resize-handle end"
                      onPointerDown={(event) =>
                        beginRangeResize(event, range.id, "end")
                      }
                    />
                  </button>
                ))}
              </div>
              <div className="timeline-group-heading">
                <b>Графика</b>
                <span>Маски и изображения</span>
              </div>
              <div className="timeline-track timeline-mask-track">
                <b>Маски</b>
                {draft.masks.map((mask) => (
                  <button
                    key={mask.id}
                    className={selectedMaskId === mask.id ? "selected" : ""}
                    style={{
                      left: timelineX(mask.startSeconds),
                      width: Math.max(
                        24,
                        (mask.endSeconds - mask.startSeconds) * timelineZoom,
                      ),
                    }}
                    onClick={() => {
                      setSelectedMaskId(mask.id);
                      selectEditorTool("masks");
                      seek(mask.startSeconds);
                    }}
                  >
                    <span>{mask.name}</span>
                    {mask.keyframes.map((frame) => {
                      const position = rangeLocalToOutputTime(
                        draft.ranges,
                        frame.rangeId,
                        frame.rangeTimeSeconds,
                      );
                      if (position === null) return null;
                      return (
                        <i
                          key={frame.id}
                          className="timeline-layer-keyframe"
                          style={{
                            left: Math.max(
                              4,
                              (position - mask.startSeconds) * timelineZoom,
                            ),
                          }}
                          title={`Mask keyframe · ${position.toFixed(2)} сек.`}
                        />
                      );
                    })}
                  </button>
                ))}
              </div>
              <div className="timeline-track timeline-overlay-track">
                <b>Изображения</b>
                {draft.imageOverlays.map((overlay) => (
                  <button
                    key={overlay.id}
                    className={
                      selectedOverlayId === overlay.id ? "selected" : ""
                    }
                    style={{
                      left: timelineX(overlay.startSeconds),
                      width: Math.max(
                        24,
                        (overlay.endSeconds - overlay.startSeconds) *
                          timelineZoom,
                      ),
                    }}
                    onClick={() => {
                      setSelectedOverlayId(overlay.id);
                      selectEditorTool("overlays");
                      seek(overlay.startSeconds);
                    }}
                  >
                    <span>{overlay.name}</span>
                    {overlay.keyframes.map((frame) => {
                      const position =
                        frame.anchor === "timeline"
                          ? frame.localTimeSeconds
                          : frame.rangeId
                            ? rangeLocalToOutputTime(
                                draft.ranges,
                                frame.rangeId,
                                frame.localTimeSeconds,
                              )
                            : null;
                      if (position === null) return null;
                      return (
                        <i
                          key={frame.id}
                          className="timeline-layer-keyframe"
                          style={{
                            left: Math.max(
                              4,
                              (position - overlay.startSeconds) * timelineZoom,
                            ),
                          }}
                          title={`Ключевой кадр изображения · ${position.toFixed(2)} сек.`}
                        />
                      );
                    })}
                  </button>
                ))}
              </div>
              <div className="timeline-group-heading">
                <b>Звук</b>
                <span>Оригинал и музыка</span>
              </div>
              <div className="timeline-track timeline-audio-track">
                <b>Звук видео</b>
                <span
                  style={{
                    left: timelineX(0),
                    width: duration * timelineZoom,
                  }}
                  title={`Громкость ${draft.audio.volume.toFixed(2)}×`}
                />
              </div>
              <div className="timeline-track timeline-music-track">
                <b>Музыка</b>
                {draft.audio.music && (
                  <span
                    className="timeline-music-clip"
                    style={{
                      left: timelineX(draft.audio.music.startSeconds),
                      width: Math.max(
                        30,
                        (duration - draft.audio.music.startSeconds) *
                          timelineZoom,
                      ),
                    }}
                    title={draft.audio.music.originalName}
                    onPointerDown={beginMusicDrag}
                  >
                    <i
                      className="music-fade-handle is-start"
                      style={{
                        width: `${Math.min(45, draft.audio.music.fadeInSeconds * timelineZoom)}px`,
                      }}
                    />
                    <span className="timeline-music-waveform">
                      {musicAsset?.waveform?.slice(0, 96).map((peak, index) => (
                        <i
                          key={index}
                          style={{ height: `${Math.max(8, peak * 100)}%` }}
                        />
                      ))}
                    </span>
                    <small>{draft.audio.music.originalName}</small>
                    <i
                      className="music-fade-handle is-end"
                      style={{
                        width: `${Math.min(45, draft.audio.music.fadeOutSeconds * timelineZoom)}px`,
                      }}
                    />
                  </span>
                )}
              </div>
              <div className="timeline-group-heading">
                <b>Оформление</b>
                <span>Кадр и текст</span>
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
                      style={{
                        left:
                          timelineX(position) + (position <= 0.001 ? 11 : 0),
                      }}
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
                      style={{
                        left:
                          timelineX(position) + (position <= 0.001 ? 11 : 0),
                      }}
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
                      style={{ left: timelineX(start), width }}
                      title={word.text}
                    />
                  );
                })}
              </div>
              {timeline.slice(1).map((range) => (
                <i
                  className="timeline-cut"
                  key={`cut-${range.id}`}
                  style={{ left: timelineX(range.outputStart) }}
                />
              ))}
              <i
                className="timeline-playhead"
                style={{ left: timelineX(outputTime) }}
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
        </Timeline>
      </div>
      {contextMenu && (
        <div
          className="ce-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => {
              splitAtPlayhead();
              setContextMenu(null);
            }}
          >
            <Scissors /> Разделить по playhead
          </button>
          <button
            onClick={() => {
              duplicateSelectedRange();
              setContextMenu(null);
            }}
          >
            <Copy /> Дублировать диапазон
          </button>
          <button
            className="is-danger"
            disabled={draft.ranges.length === 1}
            onClick={() => {
              deleteSelected();
              setContextMenu(null);
            }}
          >
            <Trash2 /> Удалить диапазон
          </button>
        </div>
      )}
      {(saveStatus === "failed" || saveStatus === "conflict") && (
        <Notice tone="error">
          <AlertCircle />
          <div>
            <strong>Не удалось сохранить редактор</strong>
            <p>{saveError}</p>
            {saveStatus === "failed" && (
              <Button variant="secondary" onClick={() => void saveDraft()}>
                Повторить
              </Button>
            )}
          </div>
        </Notice>
      )}
    </EditorShell>
  );
}
