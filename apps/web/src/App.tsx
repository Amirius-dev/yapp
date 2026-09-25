import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components";
import {
  AiExportPage,
  AiImportPage,
  ClipsPage,
  HomePage,
  NewProjectPage,
  NotFoundPage,
  ProjectsPage,
  RenderPage,
  ResultsPage,
  TranscriptPage,
  TimelineEditorPage,
} from "./pages";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new/long-video" element={<NewProjectPage />} />
        <Route path="/projects/:id/transcript" element={<TranscriptPage />} />
        <Route path="/projects/:id/ai-export" element={<AiExportPage />} />
        <Route path="/projects/:id/ai-import" element={<AiImportPage />} />
        <Route path="/projects/:id/clips" element={<ClipsPage />} />
        <Route
          path="/projects/:id/clips/:clipId/editor"
          element={<TimelineEditorPage />}
        />
        <Route path="/projects/:id/render" element={<RenderPage />} />
        <Route path="/projects/:id/results" element={<ResultsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
