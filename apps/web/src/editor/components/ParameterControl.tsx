import { RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function ParameterControl({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  unit = "",
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const round = (next: number) =>
    Number((Math.round(next / step) * step).toFixed(6));
  const commit = (next: number) => onChange(clamp(round(next), min, max));
  const updateFromX = (clientX: number) => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    commit(
      min + clamp((clientX - bounds.left) / bounds.width, 0, 1) * (max - min),
    );
  };
  const beginTrackDrag = (event: React.PointerEvent) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromX(event.clientX);
  };
  const beginValueScrub = (event: React.PointerEvent) => {
    if (disabled) return;
    event.preventDefault();
    const originX = event.clientX;
    const origin = value;
    const move = (next: PointerEvent) =>
      commit(
        origin + (next.clientX - originX) * step * (next.shiftKey ? 0.1 : 1),
      );
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    setDragging(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };
  const percent = ((value - min) / (max - min)) * 100;
  const marker = ((defaultValue - min) / (max - min)) * 100;
  return (
    <div className={`ce-parameter ${disabled ? "is-disabled" : ""}`}>
      <div className="ce-parameter__header">
        <span>{label}</span>
        <label
          onPointerDown={beginValueScrub}
          onDoubleClick={() => commit(defaultValue)}
          title="Перетащите значение · Shift для точной настройки"
        >
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(event) => commit(Number(event.target.value))}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              commit(
                value +
                  (event.key === "ArrowUp" ? 1 : -1) *
                    step *
                    (event.shiftKey ? 0.1 : 1),
              );
            }}
          />
          <em>{unit}</em>
        </label>
        <button
          disabled={disabled || value === defaultValue}
          onClick={() => commit(defaultValue)}
          title="Сбросить"
        >
          <RotateCcw />
        </button>
      </div>
      <div
        ref={trackRef}
        className="ce-parameter__track"
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={beginTrackDrag}
        onPointerMove={(event) =>
          event.currentTarget.hasPointerCapture(event.pointerId) &&
          updateFromX(event.clientX)
        }
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onDoubleClick={() => commit(defaultValue)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          commit(
            value +
              (event.key === "ArrowRight" ? 1 : -1) *
                step *
                (event.shiftKey ? 0.1 : 1),
          );
        }}
      >
        <i className="ce-parameter__fill" style={{ width: `${percent}%` }} />
        <i className="ce-parameter__default" style={{ left: `${marker}%` }} />
        <b className="ce-parameter__thumb" style={{ left: `${percent}%` }} />
        {dragging && (
          <output style={{ left: `${percent}%` }}>
            {value}
            {unit}
          </output>
        )}
      </div>
    </div>
  );
}
