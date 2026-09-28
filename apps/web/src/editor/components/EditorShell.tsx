import { PanelLeftClose, PanelRightClose, Rows3 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "./EditorControls";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function storedNumber(key: string, fallback: number) {
  const stored = localStorage.getItem(key);
  if (stored === null) return fallback;
  const value = Number(stored);
  return Number.isFinite(value) ? value : fallback;
}

export function EditorShell({
  toolbar,
  toolRail,
  children,
}: {
  toolbar: ReactNode;
  toolRail: ReactNode;
  children: ReactNode;
}) {
  const [mediaWidth, setMediaWidth] = useState(() =>
    storedNumber("cutwise.editor.mediaWidth", 252),
  );
  const [inspectorWidth, setInspectorWidth] = useState(() =>
    storedNumber("cutwise.editor.inspectorWidth", 332),
  );
  const [timelineHeight, setTimelineHeight] = useState(() =>
    storedNumber("cutwise.editor.timelineHeight", 300),
  );
  const [mediaOpen, setMediaOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const valuesRef = useRef({ mediaWidth, inspectorWidth, timelineHeight });
  valuesRef.current = { mediaWidth, inspectorWidth, timelineHeight };

  useEffect(() => {
    localStorage.setItem("cutwise.editor.mediaWidth", String(mediaWidth));
    localStorage.setItem(
      "cutwise.editor.inspectorWidth",
      String(inspectorWidth),
    );
    localStorage.setItem(
      "cutwise.editor.timelineHeight",
      String(timelineHeight),
    );
  }, [mediaWidth, inspectorWidth, timelineHeight]);

  const resize = (
    kind: "media" | "inspector" | "timeline",
    event: React.PointerEvent,
  ) => {
    event.preventDefault();
    const originX = event.clientX;
    const originY = event.clientY;
    const origin = valuesRef.current;
    const move = (next: PointerEvent) => {
      if (kind === "media")
        setMediaWidth(
          clamp(origin.mediaWidth - next.clientX + originX, 200, 390),
        );
      if (kind === "inspector")
        setInspectorWidth(
          clamp(origin.inspectorWidth + next.clientX - originX, 280, 430),
        );
      if (kind === "timeline")
        setTimelineHeight(
          clamp(origin.timelineHeight - next.clientY + originY, 190, 520),
        );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("ce-is-resizing");
    };
    document.body.classList.add("ce-is-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  return (
    <div
      className={`ce-shell ${mediaOpen ? "" : "ce-media-collapsed"} ${inspectorOpen ? "" : "ce-inspector-collapsed"}`}
      style={
        {
          "--ce-media-width": `${mediaWidth}px`,
          "--ce-inspector-width": `${inspectorWidth}px`,
          "--ce-timeline-height": `${timelineHeight}px`,
        } as React.CSSProperties
      }
    >
      {toolbar}
      {toolRail}
      <div className="ce-shell__workspace">{children}</div>
      <div
        className="ce-resizer ce-resizer--media"
        onPointerDown={(event) => resize("media", event)}
      />
      <div
        className="ce-resizer ce-resizer--inspector"
        onPointerDown={(event) => resize("inspector", event)}
      />
      <div
        className="ce-resizer ce-resizer--timeline"
        onPointerDown={(event) => resize("timeline", event)}
      />
      <div className="ce-panel-toggles">
        <Tooltip label="Показать или скрыть инструменты">
          <button
            aria-label="Показать или скрыть инструменты"
            onClick={() => setInspectorOpen((value) => !value)}
          >
            <PanelLeftClose />
          </button>
        </Tooltip>
        <Tooltip label="Изменить высоту монтажной шкалы">
          <button
            aria-label="Изменить высоту монтажной шкалы"
            onClick={() =>
              setTimelineHeight((value) => (value > 210 ? 190 : 320))
            }
          >
            <Rows3 />
          </button>
        </Tooltip>
        <Tooltip label="Показать или скрыть диапазоны исходника">
          <button
            aria-label="Показать или скрыть диапазоны исходника"
            onClick={() => setMediaOpen((value) => !value)}
          >
            <PanelRightClose />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
