import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RenderRequest } from "@studio/contracts";
import { getRenderResults, startRender } from "../api/render";
import { clipKeys } from "./clips";
import { projectKeys } from "./projects";

export const renderKeys = {
  results: (projectId: string) =>
    ["projects", projectId, "render-results"] as const,
};

export function useRenderResultsQuery(projectId: string) {
  return useQuery({
    queryKey: renderKeys.results(projectId),
    queryFn: () => getRenderResults(projectId),
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      return status === "queued" || status === "running" ? 1_000 : false;
    },
  });
}

export function useStartRenderMutation(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RenderRequest = {}) => startRender(projectId, input),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: renderKeys.results(projectId),
      });
      void client.invalidateQueries({ queryKey: clipKeys.all(projectId) });
      void client.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      void client.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
