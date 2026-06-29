/**
 * Cross-tab sync broadcaster — 같은 origin 의 다른 탭에 mutation 결과를 즉시 알림.
 *
 * 동기화 채널: BroadcastChannel("product-builder-sync-v1")
 * 메시지: { entityKey, op, projectId, id?, ts }
 *
 * 사용:
 *   useSyncListener(qc) — provider 트리에 한 번 마운트.
 *   broadcastEntityChange(entityKey, op, projectId, id) — mutation onSuccess.
 *
 * SSR 안전: typeof window 가드.
 */
import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export type SyncOp = "create" | "update" | "delete";
export interface SyncMessage {
  entityKey: string;
  op: SyncOp;
  projectId: string;
  id?: string;
  ts: number;
  source: string;
}

const CHANNEL_NAME = "product-builder-sync-v1";
const SOURCE_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastEntityChange(
  entityKey: string,
  op: SyncOp,
  projectId: string,
  id?: string,
): void {
  const ch = getChannel();
  if (!ch) return;
  const msg: SyncMessage = {
    entityKey,
    op,
    projectId,
    id,
    ts: Date.now(),
    source: SOURCE_ID,
  };
  try {
    ch.postMessage(msg);
  } catch {
    // BroadcastChannel can throw if doc is hidden in some browsers — silent.
  }
}

/**
 * 메시지 수신 시 React Query invalidate 로 즉시 refetch / live query 깨움.
 * provider 트리에 한 번만 마운트.
 */
export function useSyncListener(qc: QueryClient): void {
  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;
    const handler = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (!msg || msg.source === SOURCE_ID) return; // skip self
      // entityKey prefix 매칭으로 list/detail 모두 갱신.
      qc.invalidateQueries({
        queryKey: ["story", msg.entityKey],
        refetchType: "active",
      });
      // detail key (singular) 도 갱신.
      const singular = msg.entityKey.replace(/s$/, "");
      if (singular !== msg.entityKey) {
        qc.invalidateQueries({
          queryKey: ["story", singular],
          refetchType: "active",
        });
      }
    };
    ch.addEventListener("message", handler);
    return () => ch.removeEventListener("message", handler);
  }, [qc]);
}
