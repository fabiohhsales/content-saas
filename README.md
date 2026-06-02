# Content SaaS

Monorepo da fundacao do SaaS de automacao de conteudo com IA.

## Apps

- `apps/web`: Next.js App Router com Supabase Auth, onboarding, marcas e biblioteca de assets.
- `apps/orchestrator`: API e worker BullMQ para jobs assincronos.
- `apps/render`: render service Playwright HTML/CSS para PNG/JPG.

## Packages

- `packages/contracts`: contratos Zod compartilhados.
- `packages/supabase`: clients e helpers de Supabase.

## Setup

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm run test
npm run build
```

O fluxo novo usa Supabase para Auth/Postgres/Storage e Redis/BullMQ para jobs.
Os repositorios legados `content-automation` e `healthgrow-render-service` permanecem intactos.
