# Vende247 — Estúdio de Vendas 24/7

Painel para research de nicho/concorrentes, estratégia de conteúdo e criativos viralizantes — com publicação no Instagram.

Produto da **FabriaIA**. Contas Instagram **N por usuário**, agente comentário→Direct **interno** (webhook Meta), página Integrações, MCP Claude por conta. Skill de análise: `.cursor/skills/instagram-growth-tilli`.

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

## Processo (não misturar)

1. **Usuário** (login) → 2. **Conta Instagram** (token) → 3. **Campanha** → 4. **Agente** (opcional) → 5. **MCP Claude** (opcional)

Guia passo a passo: [docs/PROCESSO-SETUP.md](docs/PROCESSO-SETUP.md) · no painel: **Integrações**

## Fluxo do produto

1. **Onboarding** — nicho, produto, oferta, CTA, concorrentes
2. **Research** — coleta posts/ads → relatório
3. **Estratégia** — plano 7–14 dias
4. **Criativos** — gerar → aprovar → publicar (conta IG **ativa**)

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
