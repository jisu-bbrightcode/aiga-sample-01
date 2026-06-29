# Product Builder Base

Product Builder Base is a pnpm/Turborepo workspace for the Product Builder app, server, and shared packages.

## Data Policy

Product Builder is server-authoritative. Product architecture should use server APIs and server DB validation as the source of truth.

The current policy reference is:

- `docs/reference/product-builder-data-runtime-policy.md`

## Common Commands

```bash
pnpm install
pnpm dev
pnpm check-types
pnpm i18n:verify
```

## Tech Stack

| Area | Technology |
| :--- | :--- |
| Monorepo | pnpm + Turborepo |
| Backend | NestJS + Fastify |
| Frontend | React + TanStack Router + Vite |
| Database | Drizzle ORM + PostgreSQL |
| UI | shadcn/ui + Tailwind CSS |
