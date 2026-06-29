import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveVideoLectureAsset,
  createVideoLectureUpload,
  listVideoLectureAssets,
  videoLectureQueryKeys,
} from "../api";

export function useVideoLectureAssets(status?: string) {
  return useQuery({
    queryKey: videoLectureQueryKeys.assets(status),
    queryFn: () => listVideoLectureAssets(status),
  });
}

export function useCreateVideoLectureUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVideoLectureUpload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "video-lecture"] });
    },
  });
}

export function useArchiveVideoLectureAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveVideoLectureAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "video-lecture"] });
    },
  });
}
