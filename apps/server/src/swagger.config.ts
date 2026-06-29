import { DocumentBuilder } from "@nestjs/swagger";

/**
 * Shared Swagger/OpenAPI DocumentBuilder config.
 * Used by both main.ts (live server) and scripts/dump-openapi.ts (offline dump).
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle("Product Builder API")
    .setDescription("Product Builder Server REST API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
}
