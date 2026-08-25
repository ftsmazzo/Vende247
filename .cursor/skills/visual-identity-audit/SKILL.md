---
name: visual-identity-audit
description: >-
  Consolida identidade visual (imagens, PDF, URL ou JSON) no contrato Flávio:
  identity_signature, design_tokens, landing_page_style_spec, generation_prompt,
  negative_prompt, acceptance_criteria. Use ao auditar ou importar brand para o Vende247.
---

# Skill A — Identidade visual

Não invente uma marca nova se houver evidência. Separe `observed` (visto nas peças) de `recommended` (só se o rigor permitir).

## Entrada

- JSON já pronto (modo import / validação)
- URL de site (extração)
- Peças (imagens, PDF) — consolidar depois

## Saída (contrato único)

JSON com no mínimo:

- `identity_signature` (summary, personality)
- `design_tokens.colors` (cada cor com `value` hex)
- `landing_page_style_spec` (layout, type, components)
- `generation_prompt` / `negative_prompt`
- `do` / `dont` / `acceptance_criteria`
- `overall_confidence`

Opcional: CSS de tokens (`:root { --brand-blue: … }`).

## Regras

- Uma identidade por campanha; não misture paleta de outro cliente.
- Político: não invente fato; só visual e tom observados.
- Gaps e conflitos entram no modelo, não são omitidos.

O painel importa este JSON via `POST /api/campaigns/:id/identity/import`. A API persiste em `identity_versions` (`status=active`).
