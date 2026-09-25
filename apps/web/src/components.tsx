import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clapperboard,
  FolderKanban,
  Home,
  Menu,
  Settings2,
  X,
} from "lucide-react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { statusMeta } from "./lib";
import type { Project, ProjectStatus } from "./types";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  );
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`status status-${meta.tone}`}>
      <span />
      {meta.label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success" | "error";
}) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export const projectSteps = [
  { id: "transcript", label: "Транскрипт" },
  { id: "ai-export", label: "Экспорт" },
  { id: "ai-import", label: "Импорт" },
  { id: "clips", label: "Клипы" },
  { id: "render", label: "Рендер" },
  { id: "results", label: "Результаты" },
] as const;

export function ProjectHeader({
  project,
  active,
}: {
  project: Project;
  active: string;
}) {
  const activeIndex = projectSteps.findIndex((step) => step.id === active);
  return (
    <>
      <div className="project-heading">
        <div>
          <Link className="back-link" to="/projects">
            <ArrowLeft size={16} /> Все проекты
          </Link>
          <h1>{project.name}</h1>
          <p>{project.sourceName}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <nav className="stepper" aria-label="Этапы проекта">
        {projectSteps.map((step, index) => (
          <Link
            key={step.id}
            to={`/projects/${project.id}/${step.id}`}
            className={
              active === step.id ? "active" : index < activeIndex ? "done" : ""
            }
          >
            <span>{index < activeIndex ? <Check size={14} /> : index + 1}</span>
            {step.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigation = [
    { to: "/", label: "Главная", icon: Home, end: true },
    { to: "/projects", label: "Проекты", icon: FolderKanban, end: false },
  ];
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <Clapperboard size={21} />
          </div>
          <div>
            <strong>Cutwise</strong>
            <small>Video Studio</small>
          </div>
        </div>
        <button
          className="close-menu"
          onClick={() => setOpen(false)}
          aria-label="Закрыть меню"
        >
          <X />
        </button>
        <span className="nav-label">Рабочее пространство</span>
        <nav className="main-nav">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
              <Icon size={19} />
              {label}
              <ChevronRight className="nav-chevron" size={16} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="privacy-status">
            <span className="local-dot" />
            <span>
              <strong>Локальная обработка</strong>
              <small>Данные остаются на Mac</small>
            </span>
          </div>
          <span className="sidebar-version">
            <Settings2 /> Cutwise Studio
          </span>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Закрыть меню"
        />
      )}
      <main className="main-area">
        <header className="mobile-header">
          <button onClick={() => setOpen(true)} aria-label="Открыть меню">
            <Menu />
          </button>
          <Link to="/" className="mobile-brand">
            <Clapperboard size={20} /> Cutwise
          </Link>
          <span className="local-dot" aria-label="Локальный режим" />
        </header>
        <div className="content" key={location.pathname}>
          {children}
        </div>
      </main>
    </div>
  );
}
