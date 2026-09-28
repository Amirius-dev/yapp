import {
  ArrowLeft,
  ChevronRight,
  CloudAlert,
  CloudCheck,
  LoaderCircle,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Badge,
  EditorButton,
  EditorIconButton,
  Tooltip,
} from "./EditorControls";

export type EditorSaveStatus =
  "saved" | "dirty" | "saving" | "failed" | "conflict";

export function EditorToolbar({
  projectId,
  projectName,
  title,
  status,
  canUndo,
  canRedo,
  canSave,
  onUndo,
  onRedo,
  onSave,
  onRender,
}: {
  projectId: string;
  projectName: string;
  title: string;
  status: EditorSaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  canSave: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onRender: () => void;
}) {
  const statusLabel = {
    saved: "Сохранено",
    dirty: "Есть изменения",
    saving: "Сохраняем…",
    failed: "Ошибка сохранения",
    conflict: "Конфликт версии",
  }[status];
  return (
    <header className="ce-toolbar">
      <div className="ce-toolbar__identity">
        <Tooltip label="Вернуться к клипам">
          <Link
            to={`/projects/${projectId}/clips`}
            className="ce-icon-control ce-control--small"
            aria-label="Вернуться к клипам"
          >
            <ArrowLeft />
          </Link>
        </Tooltip>
        <span className="ce-brand-mark">C</span>
        <div className="ce-breadcrumbs">
          <span>{projectName}</span>
          <ChevronRight />
          <strong title={title}>{title}</strong>
        </div>
      </div>
      <div className="ce-toolbar__history">
        <EditorIconButton
          label="Отменить · ⌘Z"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 />
        </EditorIconButton>
        <EditorIconButton
          label="Повторить · ⇧⌘Z"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 />
        </EditorIconButton>
      </div>
      <div className="ce-toolbar__actions">
        <div className="ce-toolbar__actions-surface">
          <Badge
            className={`ce-save-state is-${status}`}
            tone={
              status === "saved"
                ? "success"
                : status === "failed" || status === "conflict"
                  ? "danger"
                  : status === "dirty"
                    ? "warning"
                    : "neutral"
            }
          >
            {status === "saving" ? (
              <LoaderCircle className="spin" />
            ) : status === "failed" || status === "conflict" ? (
              <CloudAlert />
            ) : (
              <CloudCheck />
            )}
            {statusLabel}
          </Badge>
          <EditorButton
            variant="secondary"
            className="ce-toolbar-button"
            disabled={!canSave}
            onClick={onSave}
            title="Сохранить · ⌘S"
          >
            <Save />
            Сохранить
          </EditorButton>
          <EditorButton
            variant="primary"
            className="ce-toolbar-button ce-toolbar-button--primary"
            onClick={onRender}
          >
            Рендер
            <ChevronRight />
          </EditorButton>
        </div>
      </div>
    </header>
  );
}
