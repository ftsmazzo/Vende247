# Variáveis de ambiente — API Vende247

Use junto com [DEPLOY-EASYPANEL.md](./DEPLOY-EASYPANEL.md).  
Cole no EasyPanel (app da API), não no painel.

## Bloco mínimo (copiar e preencher)

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_INTERNO:5432/vende247
JWT_SECRET=
OPENAI_API_KEY=
STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_UPLOAD_PRESET=
APIFY_TOKEN=
```

## Referência completa

| Variável | Obrigatória | Default | Para que serve |
|----------|-------------|---------|----------------|
| `PORT` | sim | `3000` | Porta HTTP da API |
| `HOST` | não | `0.0.0.0` | Bind |
| `NODE_ENV` | não | — | Use `production` |
| `DATABASE_URL` | sim | — | Postgres; tabelas criadas no boot |
| `JWT_SECRET` | sim | fraco em dev | Assina login |
| `OPENAI_API_KEY` | sim* | — | Imagem (gpt-image) e/ou texto se `LLM_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | alt | — | Se `LLM_PROVIDER=anthropic` (Claude) |
| `GEMINI_API_KEY` | alt | — | Se `LLM_PROVIDER=gemini` ou `IMAGE_PROVIDER=gemini` |
| `LLM_PROVIDER` | não | `openai` | `openai`, `gemini` ou `anthropic` |
| `LLM_MODEL` | não | depende | Ex.: `gpt-4o-mini`, `claude-sonnet-4-6` |
| `IMAGE_PROVIDER` | não | `openai` | Padrão `openai` (gpt-image-2). Opções: `gemini`, `openrouter`, `kairogen` (hub opcional) |
| `OPENAI_IMAGE_MODEL` | não | `gpt-image-2` | Preferir `gpt-image-2` (4:5 nativo). Alt: `gpt-image-1.5` |
| `OPENROUTER_API_KEY` | alt | — | Obrigatória se `IMAGE_PROVIDER=openrouter` |
| `OR_MODEL_VOLUME` | não | `qwen/qwen-image-3` | Slides / volume (~$0,03) — texto PT |
| `OR_MODEL_COVER` | não | `qwen/qwen-image-3-pro` | Feed / capa (~$0,04) |
| `OR_MODEL_PHOTO` | não | `krea/krea-2-large` | Hero landing (~$0,06) fotoreal |
| `OR_MODEL_DRAFT` | não | `krea/krea-2-medium-turbo` | Rascunhos (~$0,015) |
| `OR_COMPARE_MODELS` | não | (4 modelos acima) | A/B em Criativos → “Testar modelos” |
| `GEMINI_IMAGE_MODEL` | não | `gemini-3.1-flash-image` | Nano Banana 2; ou `imagen-4.0-generate-001` |
| `KAIROGEN_ACCESS_TOKEN` | alt | — | Só se `IMAGE_PROVIDER=kairogen` (hub Flux/Banana/vídeo — opcional) |
| `KAIROGEN_REFRESH_TOKEN` | alt | — | Renova o access; persistido em `app_secrets` |
| `KAIROGEN_IMAGE_MODEL` | não | `gpt-image-2` | Modelo default no hub |
| `KAIROGEN_MODEL_PHOTO` | não | `flux-2-pro` | Hero LP via Kairogen |
| `KAIROGEN_MODEL_COVER` | não | `gpt-image-2` | Criativo feed via Kairogen |
| `KAIROGEN_MODEL_VOLUME` | não | `gpt-image-2` | Lote/slides |
| `KAIROGEN_USE_IMAGE_REFS` | não | off | `true` = edit com banco (nano-banana-pro) |
| `KAIROGEN_API_BASE` | não | `https://api.kairogen.ai` | Override |
| `APIFY_TOKEN` | recomendado | — | Scrape de perfis IG + Ad Library comercial |
| `APIFY_IG_ACTOR` | não | `apify/instagram-profile-scraper` | Actor Instagram |
| `APIFY_AD_LIBRARY_ACTOR` | não | `viralanalyzer/facebook-ads-library` | Ads comerciais BR (substitui Graph Meta) |
| `META_ACCESS_TOKEN` | não | — | Fallback Graph; limitado no BR |
| `STORAGE` | não | `local` | `local` ou `cloudinary` |
| `MEDIA_BASE_URL` | se local | — | URL pública da API (HTTPS) |
| `CLOUDINARY_CLOUD_NAME` | se cloudinary | — | Conta Cloudinary |
| `CLOUDINARY_UPLOAD_PRESET` | se cloudinary | — | Preset **unsigned** |
| `ALLOW_OPEN_REGISTER` | não | fechado após 1º user | `true` libera novos cadastros |

\* Sem chave de IA, research / estratégia / criativos falham.
