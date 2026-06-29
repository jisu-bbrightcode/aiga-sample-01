import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  type LogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { LogLevel, OtelConfig } from "./types";

let loggerProvider: LoggerProvider | null = null;
let configuredLogLevel: LogLevel | undefined;

export function initOtelSdk(config: OtelConfig): void {
  if (loggerProvider) return;

  const endpoint = `${config.posthogHost ?? "https://us.i.posthog.com"}/i/v1/logs`;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion ?? process.env.npm_package_version ?? "0.0.0",
    "deployment.environment.name": config.environment ?? process.env.NODE_ENV ?? "development",
  });

  const otlpExporter = new OTLPLogExporter({
    url: endpoint,
    headers: {
      Authorization: `Bearer ${config.posthogApiKey}`,
    },
  });

  const processors: LogRecordProcessor[] = [
    new BatchLogRecordProcessor(otlpExporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 15000,
    }),
  ];
  // dev 는 즉시 확인을 위해 Simple + Console 유지
  if (process.env.NODE_ENV !== "production") {
    processors.push(new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()));
  }

  loggerProvider = new LoggerProvider({
    resource,
    processors,
  });

  logs.setGlobalLoggerProvider(loggerProvider);
  configuredLogLevel = config.logLevel;
}

export function getConfiguredLogLevel(): LogLevel | undefined {
  return configuredLogLevel;
}

export async function shutdownOtelSdk(): Promise<void> {
  if (loggerProvider) {
    await loggerProvider.shutdown();
    loggerProvider = null;
  }
}
