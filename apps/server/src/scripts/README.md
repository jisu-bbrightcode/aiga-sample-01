# Database Scripts

This directory contains database seeding and utility scripts for the Atlas Server.

## Available Scripts

### Bootstrap Super Admin

Creates the first super-admin account (idempotent) and grants admin access via a
Better Auth organization `owner` membership, then verifies login.

```bash
pnpm --filter server db:bootstrap:super-admin
```

Defaults to `first@super.local` / `q1w2e3r4t5!$` (overridable via `PRODUCT_BUILDER_SEED_*`).
Production handover (rotate / deactivate / transfer) procedure: `doc/admin-super-account-bootstrap.md`.

### Seed Roles & Permissions

Seeds the database with system roles and permissions.

```bash
pnpm tsx src/scripts/seed-roles-permissions.ts
```

**What it does:**
- Creates 5 system roles: super-admin, admin, moderator, user, guest
- Creates ~30 permissions across categories: posts, comments, users, roles, files, admin

**When to run:**
- After initial database migration
- After adding new permissions or roles to the seed data
- To reset roles and permissions to default state

## Creating New Scripts

When creating new scripts:

1. Use NestJS application context to access services
2. Handle errors gracefully
3. Provide clear console output
4. Close the app context when done

Example:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Your script logic here
    const service = app.get(SomeService);
    await service.doSomething();
  } finally {
    await app.close();
  }
}

bootstrap();
```
