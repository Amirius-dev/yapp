import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getProjectJobs,
  getTranscript,
  regenerateTranscription,
  startTranscription,
} from "../api/transcription";
import { projectKeys } from "./projects";

export const transcriptionKeys = {
  jobs: (id: string) => ["projects", id, "jobs"] as const,
  transcript: (id: string) => ["projects", id, "transcript"] as const,
};

export function useJobsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: transcriptionKeys.jobs(projectId ?? "missing"),
    queryFn: () => getProjectJobs(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) =>
      query.state.data?.some(
        (job) => job.status === "queued" || job.status === "running",
      )
        ? 1000
        : false,
  });
}

export function useTranscriptQuery(
  projectId: string | undefined,
  active: boolean,
) {
  return useQuery({
    queryKey: transcriptionKeys.transcript(projectId ?? "missing"),
    queryFn: () => getTranscript(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: active ? 1000 : false,
  });
}

export function useStartTranscriptionMutation(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => startTranscription(projectId),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: transcriptionKeys.jobs(projectId),
      });
      void client.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
    },
  });
}

export function useRegenerateTranscriptionMutation(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateTranscription(projectId),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: transcriptionKeys.jobs(projectId),
      });
      void client.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
    },
  });
}
