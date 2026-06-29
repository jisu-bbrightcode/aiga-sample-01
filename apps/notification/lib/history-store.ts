/**
 * Send-history store (PB-NOTI-001, acceptance #3 — the history half).
 *
 * Port: {@link NotificationHistoryStore} in types.ts. This module ships an
 * in-memory implementation for tests/dev; the production Drizzle table is
 * defined in schema.ts and wired in nest/. The record shape generalizes
 * product-builder-base `email_logs` (status / providerMessageId / retryCount /
 * error) to every channel.
 */

import {
  type Channel,
  type NotificationHistoryStore,
  type NotificationLogRecord,
} from './types.ts';

/** Simple in-memory history store. Not for production (no persistence). */
export class InMemoryHistoryStore implements NotificationHistoryStore {
  readonly #byId = new Map<string, NotificationLogRecord>();
  /** `${idempotencyKey}::${channel}` → id, for idempotent re-send lookup. */
  readonly #byIdem = new Map<string, string>();

  async findByIdempotencyKey(
    key: string,
    channel: Channel,
  ): Promise<NotificationLogRecord | null> {
    const id = this.#byIdem.get(idemKey(key, channel));
    if (!id) return null;
    const record = this.#byId.get(id);
    return record ? clone(record) : null;
  }

  async create(record: NotificationLogRecord): Promise<void> {
    if (this.#byId.has(record.id)) {
      throw new Error(`history record already exists: ${record.id}`);
    }
    this.#byId.set(record.id, clone(record));
    if (record.idempotencyKey) {
      this.#byIdem.set(idemKey(record.idempotencyKey, record.channel), record.id);
    }
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        NotificationLogRecord,
        'status' | 'retryCount' | 'providerMessageId' | 'error' | 'updatedAt'
      >
    >,
  ): Promise<void> {
    const existing = this.#byId.get(id);
    if (!existing) {
      throw new Error(`history record not found: ${id}`);
    }
    // Immutable update — replace the stored record with a new object.
    this.#byId.set(id, { ...existing, ...patch });
  }

  async listByCorrelation(
    correlationId: string,
  ): Promise<NotificationLogRecord[]> {
    return [...this.#byId.values()]
      .filter((r) => r.correlationId === correlationId)
      .map(clone)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Test/diagnostic helper: every stored record. */
  all(): NotificationLogRecord[] {
    return [...this.#byId.values()].map(clone);
  }
}

function idemKey(key: string, channel: Channel): string {
  return `${key}::${channel}`;
}

function clone(record: NotificationLogRecord): NotificationLogRecord {
  return { ...record };
}
