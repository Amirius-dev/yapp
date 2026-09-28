import {
  Aperture,
  AudioLines,
  Image,
  Layers3,
  SlidersHorizontal,
  Sparkles,
  Subtitles,
  Type,
} from "lucide-react";
import { Tooltip } from "./EditorControls";

export type EditorToolId =
  | "crop"
  | "subtitle"
  | "image"
  | "audio"
  | "opening"
  | "template"
  | "masks"
  | "overlays";

const tools: Array<{ id: EditorToolId; label: string; icon: typeof Image }> = [
  { id: "crop", label: "Медиа", icon: Image },
  { id: "opening", label: "Текст", icon: Type },
  { id: "subtitle", label: "Субтитры", icon: Subtitles },
  { id: "audio", label: "Аудио", icon: AudioLines },
  { id: "masks", label: "Маски", icon: Aperture },
  { id: "overlays", label: "Слои", icon: Layers3 },
  { id: "image", label: "Коррекция", icon: SlidersHorizontal },
  { id: "template", label: "Переходы", icon: Sparkles },
];

export function ToolRail({
  active,
  onChange,
}: {
  active: EditorToolId;
  onChange: (tool: EditorToolId) => void;
}) {
  return (
    <nav className="ce-tool-rail" aria-label="Инструменты редактора">
      {tools.map(({ id, label, icon: Icon }) => (
        <Tooltip label={label} key={id}>
          <button
            className={active === id ? "is-active" : ""}
            aria-label={label}
            aria-pressed={active === id}
            onClick={() => onChange(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        </Tooltip>
      ))}
    </nav>
  );
}
