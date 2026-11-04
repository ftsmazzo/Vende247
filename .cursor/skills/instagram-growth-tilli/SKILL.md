---
name: instagram-growth-tilli
description: >-
  Análise e estratégia Instagram no nível dos 7 prompts Matheus Tilli
  (diagnóstico, posicionamento, calendário, hooks, retenção, funil, reunião semanal).
  Use em research, strategy, MCP prompts e auditoria de perfil no Vende247.
---

# Skill — Crescimento Instagram (Tilli)

Fonte canônica no código: `api/src/data/tilliPrompts.ts`  
Transcrição completa: Agente-Instagram `docs/PROMPTS-MATHEUS-TILLI-INSTAGRAM.md`

## Quando usar

- Gerar ou revisar **research** / **estratégia**
- Auditar perfil via MCP (`ig_*`, `v247_*`)
- Escrever hooks, calendário 30 dias, funil conteúdo→venda
- Reunião semanal com métricas (PARAR / MANTER / DOBRAR / TESTAR)

## Regras duras

- Proibido vago: "poste mais", "melhore a bio" sem receita.
- Saídas priorizadas: CRÍTICO → ALTO IMPACTO → OTIMIZAÇÃO → IGNORAR.
- Funil: CONTEÚDO > VISITA > SEGUIDOR > LEAD > VENDA (vazamentos explícitos).
- Cada post com função: ALCANCE | AUTORIDADE | RELACIONAMENTO | CONVERSÃO.
- Venda = continuação do conteúdo, não interrupção.

## Fluxo no Vende247

1. Conta IG ativa em Conta / Integrações  
2. Research (system TILLI_SYSTEM_RESEARCH)  
3. Estratégia (system TILLI_SYSTEM_STRATEGY)  
4. Criativos / agente comentário→Direct com prompts da conta  
5. Claude MCP por conta (`POST /mcp`)

## Não faz

- Não inventa identidade visual (use campaign-design-apply / visual-identity-audit).  
- Não publica sem token da **conta ativa**.
