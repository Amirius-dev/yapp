import { Maximize2, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { EditorIconButton } from "./EditorControls";

export function PreviewStage({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const toggleFullscreen = () => {
    const stage = document.querySelector<HTMLElement>(
      ".timeline-preview-panel",
    );
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen();
  };
  return (
    <section
      className="timeline-preview-panel ce-preview-stage"
      style={{ "--ce-canvas-zoom": zoom } as React.CSSProperties}
    >
      <div className="ce-preview-stage__chrome">
        <span>Предпросмотр</span>
        <div>
          <EditorIconButton
            label="Уменьшить масштаб"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
          >
            <ZoomOut />
          </EditorIconButton>
          <EditorIconButton label="Вписать в окно" onClick={() => setZoom(1)}>
            <Scan />
          </EditorIconButton>
          <EditorIconButton
            label="Увеличить масштаб"
            onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
          >
            <ZoomIn />
          </EditorIconButton>
          <span>{Math.round(zoom * 100)}%</span>
          <EditorIconButton
            label="Полноэкранный предпросмотр"
            onClick={toggleFullscreen}
          >
            <Maximize2 />
          </EditorIconButton>
        </div>
      </div>
      <div className="ce-preview-stage__content">{children}</div>
    </section>
  );
}
