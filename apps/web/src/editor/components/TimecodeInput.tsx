import { useRef } from "react";

function parts(value: number) {
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe % 1) * 1000);
  return { minutes, seconds, milliseconds };
}

export function TimecodeInput({
  label,
  value,
  min = 0,
  max,
  sourceTime,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  sourceTime?: number;
  onChange: (value: number) => void;
}) {
  const current = parts(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const commit = (next: number) =>
    onChange(Math.min(max, Math.max(min, Math.round(next * 1000) / 1000)));
  const update = (key: keyof ReturnType<typeof parts>, next: number) => {
    const result = { ...current, [key]: next };
    commit(result.minutes * 60 + result.seconds + result.milliseconds / 1000);
  };
  const scrub = (event: React.PointerEvent, multiplier: number) => {
    event.preventDefault();
    const originX = event.clientX;
    const origin = valueRef.current;
    const move = (next: PointerEvent) =>
      commit(
        origin +
          (next.clientX - originX) * multiplier * (next.shiftKey ? 10 : 1),
      );
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };
  return (
    <label className="ce-timecode">
      <span>{label}</span>
      <div>
        <input
          aria-label={`${label}: минуты`}
          value={String(current.minutes).padStart(2, "0")}
          onPointerDown={(event) => scrub(event, 0.1)}
          onChange={(event) => update("minutes", Number(event.target.value))}
        />
        <i>:</i>
        <input
          aria-label={`${label}: секунды`}
          value={String(current.seconds).padStart(2, "0")}
          onPointerDown={(event) => scrub(event, 0.01)}
          onChange={(event) => update("seconds", Number(event.target.value))}
        />
        <i>.</i>
        <input
          className="is-ms"
          aria-label={`${label}: миллисекунды`}
          value={String(current.milliseconds).padStart(3, "0")}
          onPointerDown={(event) => scrub(event, 0.001)}
          onChange={(event) =>
            update("milliseconds", Number(event.target.value))
          }
        />
      </div>
      {sourceTime !== undefined && (
        <small>
          Источник {parts(sourceTime).minutes}:
          {String(parts(sourceTime).seconds).padStart(2, "0")}.
          {String(parts(sourceTime).milliseconds).padStart(3, "0")}
        </small>
      )}
    </label>
  );
}
