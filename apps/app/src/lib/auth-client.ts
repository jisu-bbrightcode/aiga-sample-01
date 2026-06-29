import { initAuthClient } from "@repo/core/auth";
import { env } from "./env";

const API_URL = env.VITE_API_URL ?? "";

// 기본 web client — 모듈 import 시점에 인스턴스 보장 (export 즉시 사용 가능).
export const authClient = initAuthClient(API_URL);
