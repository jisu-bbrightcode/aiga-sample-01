/**
 * @design-ref none - no approved video lecture admin screen spec exists yet.
 */
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Switch } from "@repo/ui/shadcn/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { Archive, Cloud, RefreshCw, Upload } from "lucide-react";
import { useState } from "react";
import { VideoLectureStatusBadge } from "../components/status-badge";
import {
  useArchiveVideoLectureAsset,
  useCreateVideoLectureUpload,
  useVideoLectureAssets,
} from "../hooks/use-video-lecture";
import type { VideoLectureAsset } from "../types";

export function VideoLectureAdminPage() {
  const [status, setStatus] = useState<string>("all");
  const assets = useVideoLectureAssets(status === "all" ? undefined : status);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">영상 강의</h1>
          <p className="text-sm text-muted-foreground">
            Cloudflare Stream 업로드, 처리 상태, 공개 범위와 진행률을 관리합니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => assets.refetch()}>
          <RefreshCw className="size-4" />
          새로고침
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <UploadSessionCard />
        <Card className="rounded-md">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">영상 목록</CardTitle>
            <Select value={status} onValueChange={(value) => value && setStatus(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="uploading">업로드 중</SelectItem>
                <SelectItem value="processing">처리 중</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
                <SelectItem value="archived">보관</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <VideoLectureAssetTable assets={assets.data ?? []} isLoading={assets.isLoading} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function UploadSessionCard() {
  const createUpload = useCreateVideoLectureUpload();
  const [method, setMethod] = useState<"direct" | "tus">("direct");
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(3600);
  const [uploadLength, setUploadLength] = useState(0);
  const [requireSignedUrls, setRequireSignedUrls] = useState(true);
  const [lastUploadUrl, setLastUploadUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    setLastUploadUrl(null);
    const result = await createUpload.mutateAsync({
      method,
      maxDurationSeconds,
      uploadLength: method === "tus" ? uploadLength : undefined,
      requireSignedUrls,
      visibility: "protected",
      entitlementRequirement: "purchase",
    });
    setLastUploadUrl(result.uploadUrl);
  };

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="size-4" />
          업로드 세션
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>업로드 방식</Label>
          <Select
            value={method}
            onValueChange={(value) => {
              if (value === "direct" || value === "tus") setMethod(value);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct POST</SelectItem>
              <SelectItem value="tus">tus resumable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>최대 길이(초)</Label>
          <Input
            value={maxDurationSeconds}
            onChange={(event) => setMaxDurationSeconds(Number(event.target.value))}
          />
        </div>
        {method === "tus" ? (
          <div className="space-y-2">
            <Label>파일 크기(bytes)</Label>
            <Input
              value={uploadLength}
              onChange={(event) => setUploadLength(Number(event.target.value))}
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <Label>Signed playback 필요</Label>
          <Switch checked={requireSignedUrls} onCheckedChange={setRequireSignedUrls} />
        </div>
        <Button className="w-full" onClick={handleCreate} disabled={createUpload.isPending}>
          <Upload className="size-4" />
          세션 생성
        </Button>
        {createUpload.isError ? (
          <p className="text-sm text-destructive">
            업로드 세션을 만들 수 없어요. 설정을 확인해 주세요.
          </p>
        ) : null}
        {lastUploadUrl ? (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground break-all">
            {lastUploadUrl}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VideoLectureAssetTable({
  assets,
  isLoading,
}: {
  assets: VideoLectureAsset[];
  isLoading: boolean;
}) {
  const archiveAsset = useArchiveVideoLectureAsset();

  if (isLoading)
    return <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  if (assets.length === 0)
    return <div className="py-8 text-center text-sm text-muted-foreground">영상이 없습니다.</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider ID</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>공개 범위</TableHead>
            <TableHead>권한</TableHead>
            <TableHead>길이</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="max-w-[220px] truncate font-mono text-xs">
                {asset.providerAssetId}
              </TableCell>
              <TableCell>
                <VideoLectureStatusBadge status={asset.status} />
              </TableCell>
              <TableCell>{asset.visibility}</TableCell>
              <TableCell>{asset.entitlementRequirement}</TableCell>
              <TableCell>{asset.durationSeconds ? `${asset.durationSeconds}s` : "-"}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archiveAsset.mutate(asset.id)}
                  disabled={archiveAsset.isPending}
                >
                  <Archive className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
