import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EditorPresetCreateInput,
  EditorSaveInput,
} from "@studio/contracts";
import {
  createEditorPreset,
  deleteEditorPreset,
  getEditorState,
  saveEditorState,
  uploadEditorMusic,
} from "../api/editor";
import { clipKeys } from "./clips";
import { projectKeys } from "./projects";

export const editorKeys = {
  detail: (projectId: string, clipId: string) =>
    ["projects", projectId, "clips", clipId, "editor"] as const,
};

export function useEditorQuery(projectId?: string, clipId?: string) {
  return useQuery({
    queryKey: editorKeys.detail(projectId ?? "missing", clipId ?? "missing"),
    queryFn: () => getEditorState(projectId!, clipId!),
    enabled: Boolean(projectId && clipId),
  });
}

export function useUploadEditorMusicMutation(
  projectId: string,
  clipId: string,
) {
  return useMutation({
    mutationFn: (file: File) => uploadEditorMusic(projectId, clipId, file),
  });
}

export function useCreateEditorPresetMutation(
  projectId: string,
  clipId: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: EditorPresetCreateInput) => createEditorPreset(input),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: editorKeys.detail(projectId, clipId),
      }),
  });
}

export function useDeleteEditorPresetMutation(
  projectId: string,
  clipId: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteEditorPreset,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: editorKeys.detail(projectId, clipId),
      }),
  });
}

export function useSaveEditorMutation(projectId: string, clipId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: EditorSaveInput) =>
      saveEditorState(projectId, clipId, input),
    onSuccess: (state) => {
      client.setQueryData(editorKeys.detail(projectId, clipId), state);
      void client.invalidateQueries({ queryKey: clipKeys.all(projectId) });
      void client.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
    },
  });
}
