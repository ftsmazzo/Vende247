# Variáveis de ambiente — API Vende247

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `DATABASE_URL` | sim (prod) | Postgres |
| `JWT_SECRET` | sim | Auth |
| `OPENAI_API_KEY` | sim* | Texto + imagem (default) |
| `GEMINI_API_KEY` | alt | LLM/imagem se provider=gemini |
| `LLM_PROVIDER` | não | `openai` \| `gemini` |
| `LLM_MODEL` | não | default `gpt-4o-mini` |
| `IMAGE_PROVIDER` | não | `openai` \| `gemini` |
| `OPENAI_IMAGE_MODEL` | não | `dall-e-3` ou `gpt-image-1` |
| `APIFY_TOKEN` | recomendado | Scrape de concorrentes |
| `APIFY_IG_ACTOR` | não | default `apify/instagram-profile-scraper` |
| `META_ACCESS_TOKEN` | opcional | Meta Ad Library |
| `STORAGE` | não | `local` \| `cloudinary` |
| `MEDIA_BASE_URL` | se local | URL pública da API |
| `CLOUDINARY_CLOUD_NAME` | se cloudinary | |
| `CLOUDINARY_UPLOAD_PRESET` | se cloudinary | unsigned |
| `ALLOW_OPEN_REGISTER` | não | `true` para mais cadastros |

\* Sem chave de IA, research/estratégia/criativos falham.
