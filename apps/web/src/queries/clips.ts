import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClipDto, ClipUpdateInput } from "@studio/contracts";
import {
  downloadAiPackage,
  getAiPrompt,
  importClips,
  listClips,
  updateClip,
  validateClips,
} from "../api/clips";
import { projectKeys } from "./projects";

export const clipKeys = {
  all: (projectId: string) => ["projects", projectId, "clips"] as const,
  prompt: (projectId: string) => ["projects", projectId, "ai-prompt"] as const,
};

export function useAiPromptQuery(projectId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: clipKeys.prompt(projectId),
    queryFn: async () => {
      const result = await getAiPrompt(projectId);
      void client.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      return result;
    },
  });
}

export function useDownloadAiPackageMutation(projectId: string) {
  return useMutation({ mutationFn: () => downloadAiPackage(projectId) });
}

export function useValidateClipsMutation(projectId: string) {
  return useMutation({
    mutationFn: (content: string) => validateClips(projectId, content),
  });
}

export function useImportClipsMutation(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => importClips(projectId, content),
    onSuccess: (clips) => {
      client.setQueryData(clipKeys.all(projectId), clips);
      void client.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
      void client.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useClipsQuery(projectId: string) {
  return useQuery({
    queryKey: clipKeys.all(projectId),
    queryFn: () => listClips(projectId),
  });
}

export function useUpdateClipMutation(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      clipId,
      patch,
    }: {
      clipId: string;
      patch: ClipUpdateInput;
    }) => updateClip(projectId, clipId, patch),
    onMutate: async ({ clipId, patch }) => {
      await client.cancelQueries({ queryKey: clipKeys.all(projectId) });
      const previous = client.getQueryData<ClipDto[]>(clipKeys.all(projectId));
      client.setQueryData<ClipDto[]>(clipKeys.all(projectId), (current) =>
        current?.map((clip) =>
          clip.id === clipId ? { ...clip, ...patch } : clip,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous)
        client.setQueryData(clipKeys.all(projectId), context.previous);
    },
    onSuccess: (updated) => {
      client.setQueryData<ClipDto[]>(clipKeys.all(projectId), (current) =>
        current?.map((clip) => (clip.id === updated.id ? updated : clip)),
      );
    },
  });
}
