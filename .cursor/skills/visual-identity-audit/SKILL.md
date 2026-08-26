---
name: visual-identity-audit
description: >-
  Agente de identidade: cruza research + estratégia + qualquer referência
  (sites, imagens, notas, brandbook). Saída = contrato rico (schema operacional).
  Não copia outra campanha. Ponto de partida cego se não houver peça.
---

# Skill A — Agente de identidade

Ordem no Vende247: **Campanha → Research → Estratégia → Identidade → LP/criativos**.

Identidade **não** é importar um JSON de outra marca. Identidade é o agente cruzar:

1. Briefing da campanha
2. Research (mercado, concorrentes, direção visual observada no setor)
3. Estratégia (pilares, hooks, formatos)
4. Qualquer referência solta: URLs de site, URLs de imagem, notas, trechos de PDF

## Referências de site = captura de design system

URLs coladas em `reference_urls` passam por `siteCapture` (fetch HTML/CSS):
cores, fontes, radii, shadows, padrões de hero/CTA, glass/motion.

A saída é um `DesignSystemCapture` — **peças abstratas**, não scrape raso de 3 cores
e não HTML clonado. O agente **seleciona e funde** o que serve ao briefing;
proibido copiar nome/logo/copy do site alheio.

O contrato inclui `landing_system` (tema, tokens, hero_recipe, section_order,
effects, tipografia, density, cta_style) para a LP **compor** variantes — não
carimbar um template único.

## Síntese

O contrato é **síntese**: decisões visuais no schema operacional, curto.
Não é ensaio nem dump do research. Shape: `identity_signature`, `design_tokens`,
`landing_system`, `generation_prompt`, `negative_prompt`, `do`/`dont`.

Um JSON muito rico que alguém já gerou (ex.: GPT com gigabytes de material de *uma* campanha)
é **exemplo de qualidade de schema**, não carimbo para outras campanhas. Só reaplicar JSON se
for output do agente **desta** marca.

## Ponto de partida cego

Sem peça oficial: criar sistema visual `recommended`, alinhado a produto, tom e cenas do research.
Não recusar. Não inventar conflito com outra marca.

## API

`POST /api/campaigns/:id/identity/generate` com `{ notes, reference_urls, image_urls }`.
Exige research `done` e uma strategy.

Preview de captura: `POST /api/tools/capture-site` `{ url }`.

## Importar JSON

Só reaplicar contrato já gerado para **esta** campanha.
