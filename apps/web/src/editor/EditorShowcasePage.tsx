import {
  AlertTriangle,
  Check,
  Copy,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import "./editor.css";
import {
  Badge,
  ColorControl,
  ContextMenu,
  Divider,
  EditorButton,
  EditorCheckbox,
  EditorEmptyState,
  EditorIconButton,
  EditorInput,
  EditorSelect,
  EditorToggle,
  PanelHeader,
  SectionHeader,
  SegmentedControl,
  Tabs,
} from "./components/EditorControls";
import { ParameterControl } from "./components/ParameterControl";
import { TimecodeInput } from "./components/TimecodeInput";

export function EditorShowcasePage() {
  const [tab, setTab] = useState("video");
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [parameter, setParameter] = useState(42);
  const [time, setTime] = useState(72.48);
  const [color, setColor] = useState("#ff6b19");

  return (
    <main className="ce-showcase">
      <header className="ce-showcase__header">
        <div>
          <span>DEV · VISUAL REGRESSION</span>
          <h1>Компоненты редактора</h1>
        </div>
        <Badge tone="success">
          <Check /> Система активна
        </Badge>
      </header>

      <section className="ce-showcase__grid">
        <article className="ce-showcase__panel">
          <PanelHeader title="Кнопки" meta="Все состояния" />
          <div className="ce-showcase__body">
            <SectionHeader title="Варианты" />
            <div className="ce-showcase__row">
              <EditorButton variant="primary">
                <Play /> Основная
              </EditorButton>
              <EditorButton variant="secondary">
                <Save /> Вторичная
              </EditorButton>
              <EditorButton variant="ghost" className="is-hover-preview">
                Наведение
              </EditorButton>
              <EditorButton variant="danger">
                <Trash2 /> Удалить
              </EditorButton>
            </div>
            <div className="ce-showcase__row">
              <EditorButton loading>Загрузка</EditorButton>
              <EditorButton disabled>Недоступно</EditorButton>
              <EditorButton size="medium">
                <Plus /> Средняя
              </EditorButton>
              <EditorIconButton label="Дополнительные действия">
                <MoreHorizontal />
              </EditorIconButton>
            </div>
            <Divider />
            <SectionHeader title="Статусы" />
            <div className="ce-showcase__row">
              <Badge>Черновик</Badge>
              <Badge tone="accent">Выбрано</Badge>
              <Badge tone="success">Сохранено</Badge>
              <Badge tone="warning">Внимание</Badge>
              <Badge tone="danger">Ошибка</Badge>
            </div>
          </div>
        </article>

        <article className="ce-showcase__panel">
          <PanelHeader title="Поля и выбор" meta="32 px" />
          <div className="ce-showcase__body">
            <EditorInput
              label="Название · focus"
              className="is-focus-preview"
              defaultValue="Новый клип"
            />
            <EditorInput
              label="Ошибка"
              defaultValue="Неверное значение"
              aria-invalid="true"
            />
            <EditorSelect label="Переход" defaultValue="smooth">
              <option value="linear">Линейный</option>
              <option value="smooth">Плавный</option>
            </EditorSelect>
            <TimecodeInput
              label="Таймкод"
              value={time}
              max={300}
              onChange={setTime}
            />
            <ColorControl label="Акцент" value={color} onChange={setColor} />
            <EditorCheckbox
              label="Нормализовать звук"
              checked={checked}
              onChange={setChecked}
            />
            <EditorToggle
              label="Показывать слой"
              checked={enabled}
              onChange={setEnabled}
            />
          </div>
        </article>

        <article className="ce-showcase__panel">
          <PanelHeader title="Параметры" meta="Клавиатура + указатель" />
          <div className="ce-showcase__body">
            <ParameterControl
              label="Интенсивность"
              value={parameter}
              min={0}
              max={100}
              step={1}
              defaultValue={50}
              unit="%"
              onChange={setParameter}
            />
            <ParameterControl
              label="Недоступный параметр"
              value={20}
              min={0}
              max={100}
              step={1}
              defaultValue={20}
              unit="%"
              disabled
              onChange={() => undefined}
            />
            <SegmentedControl label="Режим кадрирования">
              {[
                ["fill", "Заполнить"],
                ["fit", "Вписать"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={value === "fill" ? "is-selected" : ""}
                >
                  {label}
                </button>
              ))}
            </SegmentedControl>
            <Tabs label="Раздел редактора" className="ce-showcase__tabs">
              {["video", "text", "audio"].map((value) => (
                <button
                  role="tab"
                  aria-selected={tab === value}
                  key={value}
                  onClick={() => setTab(value)}
                >
                  {{ video: "Видео", text: "Текст", audio: "Звук" }[value]}
                </button>
              ))}
            </Tabs>
          </div>
        </article>

        <article className="ce-showcase__panel">
          <PanelHeader title="Монтажная шкала" meta="Выбранный элемент" />
          <div className="ce-showcase__body">
            <div className="ce-showcase__timeline">
              <div className="is-ruler">00:00 · 00:05 · 00:10 · 00:15</div>
              <div className="is-track">
                <span>ВИДЕО</span>
                <button className="is-selected">Диапазон 1</button>
              </div>
              <div className="is-track">
                <span>МАСКИ</span>
                <button className="is-mask">Размытие ◆</button>
              </div>
              <div className="is-track">
                <span>МУЗЫКА</span>
                <button className="is-wave">▁▃▆▄▂▅▇▅▃▂▆▄▁</button>
              </div>
              <i className="is-playhead" />
            </div>
          </div>
        </article>

        <article className="ce-showcase__panel">
          <PanelHeader
            title="Служебные состояния"
            meta="Всплывающие элементы"
          />
          <div className="ce-showcase__body ce-showcase__overlay-states">
            <EditorIconButton label="Копировать" tooltipOpen>
              <Copy />
            </EditorIconButton>
            <ContextMenu>
              <button role="menuitem">
                <Copy /> Дублировать
              </button>
              <button role="menuitem" className="is-danger">
                <Trash2 /> Удалить
              </button>
            </ContextMenu>
            <div
              className="ce-showcase__select-menu"
              role="listbox"
              aria-label="Открытый список переходов"
            >
              <button role="option" aria-selected="true">
                Плавный
              </button>
              <button role="option" aria-selected="false">
                Линейный
              </button>
              <button role="option" aria-selected="false">
                Без интерполяции
              </button>
            </div>
            <div className="ce-showcase__modal">
              <Badge tone="warning">
                <AlertTriangle /> Несохранённые изменения
              </Badge>
              <strong>Закрыть редактор?</strong>
              <span>Изменения останутся в локальном черновике.</span>
              <div>
                <EditorButton variant="ghost">Отмена</EditorButton>
                <EditorButton variant="primary">Продолжить</EditorButton>
              </div>
            </div>
          </div>
        </article>

        <article className="ce-showcase__panel">
          <PanelHeader title="Пустое состояние" />
          <div className="ce-showcase__body">
            <EditorEmptyState
              title="Слой не выбран"
              description="Выберите элемент на холсте или монтажной шкале."
              action={
                <EditorButton variant="secondary">
                  <Plus /> Добавить слой
                </EditorButton>
              }
            />
          </div>
        </article>
      </section>
    </main>
  );
}
