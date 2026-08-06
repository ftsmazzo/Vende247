# Fluxo do MVP Vende247

1. **Cadastro / Login** → JWT
2. **Onboarding** (`POST /api/workspace/onboarding`)
   - nicho, produto, oferta, CTA, tom, concorrentes, IG opcional
3. **Research** (`POST /api/research/run`)
   - Apify (perfis) + Meta Ad Library + LLM → relatório JSON
4. **Estratégia** (`POST /api/strategy/generate`)
   - plano 7–14 dias com briefs
5. **Criativos** (`POST /api/creatives/batch`)
   - gera imagem por brief → review → publicar / agendar
6. **Cron** — a cada 1 min publica `status=scheduled` vencidos

## Fase 2

Agente comentário → Direct → WhatsApp (referência: Agente-Instagram).
