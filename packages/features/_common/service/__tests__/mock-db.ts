/**
 * Minimal chainable drizzle mock for pure-unit service tests (no live PG).
 *
 * - `select().from().where().orderBy().limit()` (any order) is thenable and
 *   resolves to the next queued result set.
 * - `insert(table).values(v)` records `{ table, values: v }` into `inserts`
 *   and resolves to undefined.
 * - `update(table).set(v).where(c)` records `{ table, set: v }` into `updates`
 *   and resolves to undefined.
 */
export interface MockDb {
  // biome-ignore lint/suspicious/noExplicitAny: test double mirrors drizzle's loose chain types.
  select: (...args: any[]) => any;
  // biome-ignore lint/suspicious/noExplicitAny: test double.
  insert: (...args: any[]) => any;
  // biome-ignore lint/suspicious/noExplicitAny: test double.
  update: (...args: any[]) => any;
  inserts: Array<{ table: unknown; values: unknown }>;
  updates: Array<{ table: unknown; set: unknown }>;
}

// biome-ignore lint/suspicious/noExplicitAny: test double.
export function makeMockDb(selectResults: any[][] = []): MockDb {
  const queue = [...selectResults];
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; set: unknown }> = [];

  function selectChain() {
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      innerJoin: () => chain,
      limit: () => chain,
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of drizzle's awaitable query builder.
      // biome-ignore lint/suspicious/noExplicitAny: thenable.
      then: (resolve: (v: any) => any, reject?: (e: unknown) => any) =>
        Promise.resolve(queue.shift() ?? []).then(resolve, reject),
    };
    return chain;
  }

  return {
    inserts,
    updates,
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
  };
}
