import { DynamicModule, Global, type InjectionToken, Module } from "@nestjs/common";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type Schema, schema } from "./schema-registry";

export const DRIZZLE = Symbol("DRIZZLE");

export interface DatabaseModuleOptions {
  connectionString: string;
  schema?: Record<string, unknown>;
}

// Neon serverless / pgbouncer-pooler 호환 옵션.
//
// 측정 결과 (2026-04-26):
//   non-pooled `.../neondb?sslmode=require` 사용 시 매 요청 ~1.1-1.5초.
//   원인: 옵션 없는 기본 postgres.js 가 prepare:true 로 매 connection 에서 protocol-prepared
//   statement 사용 — Neon pooler / pgbouncer 와 충돌하고 cold reconnect 비용 노출.
//
// 권고: `.env.local` DATABASE_URL 을 `-pooler` endpoint 로 (필요 시) 교체하면 ms 단위.
const POOL_OPTIONS = {
  max: 10,
  // prepared statement disable — Neon pooler/pgbouncer transaction-mode 호환 + 측정상
  // prepare:true 가 오히려 미세하게 더 느림 (cycle 6 측정 결과 1198 vs 1049ms).
  // production us-east-2 ↔ vercel us-east-2 에서는 RTT 무시할 수 있어 차이 없음.
  prepare: false,
  // 영속 connection 유지 (idle_timeout=0 무한, max_lifetime=null 무한 default).
  idle_timeout: 0,
  connect_timeout: 10,
} as const;

@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (forRoot/forRootAsync)
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    const client = postgres(options.connectionString, POOL_OPTIONS);
    const db = drizzle(client, { schema: options.schema || schema });

    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DRIZZLE,
          useValue: db,
        },
      ],
      exports: [DRIZZLE],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
    inject?: InjectionToken[];
  }): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DRIZZLE,
          useFactory: async (...args: unknown[]) => {
            const config = await options.useFactory(...args);
            const client = postgres(config.connectionString, POOL_OPTIONS);
            return drizzle(client, { schema: config.schema || schema });
          },
          inject: options.inject || [],
        },
      ],
      exports: [DRIZZLE],
    };
  }
}

export type DrizzleDB = PostgresJsDatabase<Schema>;

// Aliases for backwards compatibility
export { DatabaseModule as DrizzleModule, DRIZZLE as DRIZZLE_TOKEN };
