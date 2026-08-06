# Vende247 — Estúdio de Vendas 24/7

Painel para research de nicho/concorrentes, estratégia de conteúdo e criativos viralizantes — com publicação no Instagram.

Produto da **FabriaIA**. O agente comentário → Direct → WhatsApp entra na fase 2 (referência: Agente-Instagram / Vende24).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| Backend | Node.js + Fastify |
| Banco | PostgreSQL |
| IA | OpenAI / Gemini (texto + imagem) |
| Research | Apify (perfis IG) + Meta Ad Library |
| Deploy | Docker + EasyPanel |

## Estrutura

```
Vende247/
├── painel/     # Frontend
├── api/        # API REST
├── docs/       # Guias
└── Dockerfile  # Build do painel
```

## Fluxo do MVP

1. **Onboarding** — nicho, produto, oferta, CTA, 3–5 concorrentes, conta IG
2. **Research** — coleta posts/ads → relatório de padrões
3. **Estratégia** — plano 7–14 dias com briefs
4. **Criativos** — lote de mídias → aprovar → publicar/agendar

## Como rodar local

**API:**
```bash
cd api
cp .env.example .env   # preencha as chaves
npm install
npm run dev
```

**Painel:**
```bash
cd painel
npm install
# painel/.env → VITE_API_URL=http://localhost:3000
npm run dev
```

## Deploy (EasyPanel)

Comece **pela API** (passo a passo completo):

→ [docs/DEPLOY-EASYPANEL.md](docs/DEPLOY-EASYPANEL.md)

Variáveis: [docs/ENV.md](docs/ENV.md).

**Repo:** `ftsmazzo/Vende247` — não usar `instaragm-tools`.
