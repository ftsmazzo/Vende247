---
name: visual-identity-audit
description: >-
  Gera ou consolida identidade visual DEPOIS de research e estratégia da campanha.
  Contrato: identity_signature, design_tokens, landing_page_style_spec,
  generation_prompt, negative_prompt. Não rode na etapa de pesquisa.
---

# Skill A — Identidade visual (depois de research + estratégia)

No produto Vende247 a ordem é: **Campanha → Research → Estratégia → Identidade → LP/criativos**.

Não injete identidade na pesquisa. A pesquisa descreve o mercado; a identidade nasce do briefing + research + estratégia (+ peças/JSON se houver).

## Gerar (API)

`POST /api/campaigns/:id/identity/generate` — exige research `done` e uma strategy.

## Importar

JSON já pronto só se for DESTA marca (ex. brandbook Flávio numa campanha Flávio).

## Saída

Mesmo schema: identity_signature, design_tokens.colors[].value, landing_page_style_spec, generation_prompt, negative_prompt, do/dont.
