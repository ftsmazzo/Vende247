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
| `OPENAI_API_KEY` | sim* | — | Texto (research/estratégia) + imagem |
| `GEMINI_API_KEY` | alt | — | Se `LLM_PROVIDER=gemini` ou `IMAGE_PROVIDER=gemini` |
| `LLM_PROVIDER` | não | `openai` | `openai` ou `gemini` |
| `LLM_MODEL` | não | `gpt-4o-mini` | Modelo de texto |
| `IMAGE_PROVIDER` | não | `openai` | `openai` ou `gemini` |
| `OPENAI_IMAGE_MODEL` | não | `gpt-image-1.5` | Ex.: `gpt-image-1.5` |
| `GEMINI_IMAGE_MODEL` | não | `gemini-3.1-flash-image` | Nano Banana 2; ou `imagen-4.0-generate-001` |
| `APIFY_TOKEN` | recomendado | — | Scrape de perfis concorrentes |
| `APIFY_IG_ACTOR` | não | `apify/instagram-profile-scraper` | Actor Apify |
| `META_ACCESS_TOKEN` | não | — | Meta Ad Library |
| `META_AD_LIBRARY_SEARCH_COUNTRY` | não | `BR` | País da busca de ads |
| `STORAGE` | não | `local` | `local` ou `cloudinary` |
| `MEDIA_BASE_URL` | se local | — | URL pública da API (HTTPS) |
| `CLOUDINARY_CLOUD_NAME` | se cloudinary | — | Conta Cloudinary |
| `CLOUDINARY_UPLOAD_PRESET` | se cloudinary | — | Preset **unsigned** |
| `ALLOW_OPEN_REGISTER` | não | fechado após 1º user | `true` libera novos cadastros |

\* Sem chave de IA, research / estratégia / criativos falham.
