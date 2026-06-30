import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminFilesQueryKeys,
  deleteAdminFile,
  restoreAdminFile,
  runAdminFileCleanup,
  updateAdminFileMetadata,
} from "../api";
import type { AdminFileMetadataPatch } from "../types";

/** Invalidate every admin file list query so the table reflects the mutation. */
function useInvalidateFiles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminFilesQueryKeys.prefix() });
}

/** `PATCH /admin/files/:id` — edit metadata (audited as an admin edit). */
export function useUpdateFileMetadata() {
  const invalidate = useInvalidateFiles();
  return useMutation({
    mutationFn: ({ fileAssetId, patch }: { fileAssetId: string; patch: AdminFileMetadataPatch }) =>
      updateAdminFileMetadata(fileAssetId, patch),
    onSuccess: invalidate,
  });
}

/** `DELETE /admin/files/:id` — force-delete (audited). */
export function useDeleteFile() {
  const invalidate = useInvalidateFiles();
  return useMutation({
    mutationFn: (fileAssetId: string) => deleteAdminFile(fileAssetId),
    onSuccess: invalidate,
  });
}

/** `POST /admin/files/:id/restore` — restore a soft-deleted file. */
export function useRestoreFile() {
  const invalidate = useInvalidateFiles();
  return useMutation({
    mutationFn: (fileAssetId: string) => restoreAdminFile(fileAssetId),
    onSuccess: invalidate,
  });
}

/** `POST /admin/files/cleanup` — orphan + stuck-purge sweep. */
export function useFileCleanup() {
  const invalidate = useInvalidateFiles();
  return useMutation({
    mutationFn: () => runAdminFileCleanup(),
    onSuccess: invalidate,
  });
}
