---
name: campaign-design-apply
description: >-
  Aplica a identidade visual ATIVA da campanha em landing e criativos. Não gera
  identidade nova. Use ao escrever prompts de LP, HTML/CSS tokens e imagens IG.
---

# Skill B — Aplicar identidade

Você **não** cria brand. Lê o contrato ativo (`identity_versions.model` + `css`) e aplica.

## Landing

- Injetar CSS de tokens no HTML (`renderLandingHtml` extraCss).
- Cores: `design_tokens.colors` (`brand_yellow`, `brand_blue`, `ink`, `surface`).
- Copy e seções alinhadas a `landing_page_style_spec` e listas `do` / `dont`.
- Proibido contradizer paleta, tipografia ou mood do contrato.

## Criativos (imagem)

- Concatenar `generation_prompt` (positivo) e `negative_prompt`.
- Manter lock de nicho (`nicheVisual`) sem paleta de outra campanha.
- Overlay de logo só se o contrato/brand_kit tiver logo.

## Research / estratégia

- Injetar o JSON completo compacto (`identityContextForLlm`): paleta nomeada, recognition_cues, image_treatment, landing_page_style_spec, generation_prompt / negative_prompt, do/dont.
- `direcao_visual` e `visual_prompt` aplicam a identidade AO produto — não sugerem outra marca.
- Não usar `brand_kit` da conta (cores de site antigo) quando houver identidade ativa.
