import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput } from "@studio/contracts";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  uploadProjectSource,
} from "../api/projects";

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

export function useProjectsQuery() {
  return useQuery({ queryKey: projectKeys.all, queryFn: listProjects });
}

export function useProjectQuery(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? "missing"),
    queryFn: () => getProject(id!),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "transcribing" ? 1000 : false,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      file,
    }: {
      input: CreateProjectInput;
      file: File;
    }) => {
      const project = await createProject(input);
      return uploadProjectSource(project.id, file);
    },
    onSuccess: (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
