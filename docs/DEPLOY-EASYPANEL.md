# Deploy EasyPanel — Vende247

Dois apps (recomendado):

## 1. API

- Root / Dockerfile: `api/Dockerfile`
- Porta: `3000`
- Variáveis (mínimo):
  - `DATABASE_URL` — Postgres dedicado
  - `JWT_SECRET`
  - `OPENAI_API_KEY` (ou `GEMINI_API_KEY` + `LLM_PROVIDER=gemini`)
  - `APIFY_TOKEN` — research de concorrentes
  - `META_ACCESS_TOKEN` — Ad Library (opcional)
  - `STORAGE=cloudinary` + `CLOUDINARY_*` **ou** `STORAGE=local` + `MEDIA_BASE_URL=https://sua-api...`
  - Volume em `data/` se storage local

## 2. Painel

- Dockerfile na raiz do repo
- Build arg: `VITE_API_URL=https://sua-api.easypanel.host`
- Porta 80

## Checklist pós-deploy

1. Abrir painel → criar primeira conta (register aberto só no 1º user)
2. Onboarding: nicho, produto, 3–5 concorrentes, token IG
3. Research → Estratégia → Criativos → Publicar/Agendar
4. Sem `APIFY_TOKEN`, research roda em modo degradado (ainda gera padrões)

## Fase 2 (não neste MVP)

Agente comentário/Direct/WhatsApp — portar do Agente-Instagram.
