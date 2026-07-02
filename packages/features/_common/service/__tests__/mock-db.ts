/**
 * Minimal chainable drizzle mock for pure-unit service tests (no live PG).
 *
 * - `select().from().where().orderBy().limit()` (any order) is thenable and
 *   resolves to the next queued result set.
 * - `insert(table).values(v)` records `{ table, values: v }` into `inserts`
 *   and resolves to undefined.
 * - `update(table).set(v).where(c)` records `{ table, set: v }` into `updates`
 *   and resolves to undefined.
 * - `delete(table).where(c).returning(...)` records `{ table }` into `deletes`
 *   and resolves to the next queued `deleteResults` set (default `[]`).
 */
export interface MockDb {
  // biome-ignore lint/suspicious/noExplicitAny: test double mirrors drizzle's loose chain types.
  select: (...args: any[]) => any;
  // biome-ignore lint/suspicious/noExplicitAny: test double.
  insert: (...args: any[]) => any;
  // biome-ignore lint/suspicious/noExplicitAny: test double.
  update: (...args: any[]) => any;
  // biome-ignore lint/suspicious/noExplicitAny: test double.
  delete: (...args: any[]) => any;
  inserts: Array<{ table: unknown; values: unknown }>;
  updates: Array<{ table: unknown; set: unknown }>;
  deletes: Array<{ table: unknown }>;
}

// biome-ignore lint/suspicious/noExplicitAny: test double.
export function makeMockDb(selectResults: any[][] = [], deleteResults: any[][] = []): MockDb {
  const queue = [...selectResults];
  const deleteQueue = [...deleteResults];
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; set: unknown }> = [];
  const deletes: Array<{ table: unknown }> = [];

  function selectChain() {
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      limit: () => chain,
      offset: () => chain,
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of drizzle's awaitable query builder.
      // biome-ignore lint/suspicious/noExplicitAny: thenable.
      then: (resolve: (v: any) => any, reject?: (e: unknown) => any) =>
        Promise.resolve(queue.shift() ?? []).then(resolve, reject),
    };
    return chain;
  }

  function deleteChain(table: unknown) {
    const chain = {
      where: () => chain,
      returning: () => {
        deletes.push({ table });
        return Promise.resolve(deleteQueue.shift() ?? []);
      },
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for `.delete().where()` with no returning.
      // biome-ignore lint/suspicious/noExplicitAny: thenable.
      then: (resolve: (v: any) => any, reject?: (e: unknown) => any) => {
        deletes.push({ table });
        return Promise.resolve(deleteQueue.shift() ?? []).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    inserts,
    updates,
    deletes,
    select: () => selectChain(),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (set: unknown) => ({
        where: () => {
          updates.push({ table, set });
          return Promise.resolve();
        },
      }),
    }),
    delete: (table: unknown) => deleteChain(table),
  };
}
