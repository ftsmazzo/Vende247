---
name: campaign-design-apply
description: >-
  Aplica a identidade visual ATIVA da campanha em landing e criativos. Não gera
  identidade nova. Use ao escrever prompts de LP, HTML/CSS tokens e imagens IG.
---

# Skill B — Aplicar identidade

Você **não** cria brand. Lê o contrato ativo (`identity_versions.model` + `css`) e aplica.

## Landing

- Cores da LP vêm de `identityPickColors` (tema claro/escuro com contraste). Não injete CSS bruto que sobrescreva `--ink`/`--surface`.
- Cores: `design_tokens.colors` (`brand_yellow`, `brand_blue`, `ink`, `surface`).
- Copy e seções alinhadas a `landing_page_style_spec` e listas `do` / `dont`.
- Proibido contradizer paleta, tipografia ou mood do contrato.

## Criativos (imagem)

- Concatenar `generation_prompt` (positivo) e `negative_prompt`.
- Manter lock de nicho (`nicheVisual`) sem paleta de outra campanha.
- Overlay de logo só se o contrato/brand_kit tiver logo.

## Research / estratégia

Não usam esta skill. Pesquisa e plano vêm antes da identidade.

## Geração (LP / criativos)

Só depois da identidade ativa. Sem `brand_kit` da conta.
