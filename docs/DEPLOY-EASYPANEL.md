# Vende247 — Preparar e subir a API (EasyPanel)

Este guia é **só da API**. O painel vem depois, em outro app.

**Repositório correto:** [ftsmazzo/Vende247](https://github.com/ftsmazzo/Vende247)  
**Não use** o repo `instaragm-tools` / Agente-Instagram neste deploy.

---

## Visão geral (o que vamos fazer)

1. Criar um Postgres no EasyPanel (banco só do Vende247).
2. Criar um app “API” apontando para o GitHub `Vende247`.
3. Configurar build para usar a pasta `api/`.
4. Colocar as variáveis de ambiente.
5. Fazer deploy e testar `GET /health`.

Só depois disso subimos o painel (outro doc / outra seção).

---

## Parte 0 — O que você precisa ter em mãos

Antes de abrir o EasyPanel, separe estas chaves (pode deixar em um bloco de notas):

| Item | Onde pegar | Obrigatório no 1º deploy? |
|------|------------|---------------------------|
| Conta GitHub com acesso ao repo `ftsmazzo/Vende247` | GitHub | Sim |
| EasyPanel no ar | Seu servidor | Sim |
| `OPENAI_API_KEY` | platform.openai.com | Sim (para research/criativos) |
| `APIFY_TOKEN` | console.apify.com → Integrations → API token | Recomendado (sem isso o research fica “degradado”) |
| Conta Cloudinary (cloud name + upload preset **unsigned**) | cloudinary.com | Recomendado em produção |
| `META_ACCESS_TOKEN` | Meta for Developers (Ad Library) | Não (opcional) |

Gere também um segredo JWT (PowerShell):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Guarde o resultado — vai em `JWT_SECRET`.

---

## Parte 1 — Banco Postgres (faça primeiro)

1. No EasyPanel, crie um serviço **PostgreSQL** (ou use um Postgres que já exista **só se for dedicado**).
2. Crie um database chamado, por exemplo: `vende247`.
3. Anote a connection string no formato:

```text
postgresql://USUARIO:SENHA@HOST:5432/vende247
```

**Dica EasyPanel:** use o host **interno** do serviço Postgres (nome do app no painel), não o domínio público. Exemplo típico:

```text
postgresql://postgres:SUA_SENHA@vende247-postgres:5432/vende247
```

(o nome `vende247-postgres` muda conforme você nomear o serviço)

Isso vira a variável `DATABASE_URL` na API.

Na primeira subida, a API **cria as tabelas sozinha** (`users`, `workspaces`, `research_runs`, `strategies`, `creatives`).

---

## Parte 2 — Criar o app da API no EasyPanel

1. EasyPanel → **New App** / novo aplicativo.
2. Escolha **Deploy from GitHub** (Git).
3. Autorize o GitHub se pedir.
4. Selecione:
   - **Repositório:** `ftsmazzo/Vende247`
   - **Branch:** `main`
5. Confirme.

### 2.1 Configurar o Docker (atenção — não é a raiz)

A API **não** usa o `Dockerfile` da raiz (esse é do painel).

Configure assim:

| Campo no EasyPanel | Valor |
|--------------------|--------|
| **Build context** | `api` |
| **Dockerfile** | `Dockerfile` (dentro de `api/`) |

Em alguns painéis isso aparece como:

- Context: `./api` ou `api`
- Dockerfile path: `api/Dockerfile` **ou** `Dockerfile` com context `api`

Se o build pegar o Dockerfile da **raiz**, o app sobe nginx do painel — está errado. Tem que ser o de `api/`.

### 2.2 Porta

- Porta do container / serviço: **3000**
- Associe um domínio, ex.: `vende247-api.seudominio.com` (ou o subdomínio que o EasyPanel gerar)

Anote a URL pública final, ex.:

```text
https://vende247-api.XXXX.easypanel.host
```

Você vai usar essa URL depois no painel (`VITE_API_URL`) e, se storage for local, em `MEDIA_BASE_URL`.

---

## Parte 3 — Variáveis de ambiente da API

No app da API → **Environment** / variáveis. Cole o conjunto abaixo e **troque os placeholders**.

### 3.1 Obrigatórias (sem isso a API não serve)

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_INTERNO:5432/vende247
JWT_SECRET=COLE_O_SEGREDO_GERADO_NA_PARTE_0
OPENAI_API_KEY=sk-...
```

### 3.2 Research (fortemente recomendado)

```env
APIFY_TOKEN=apify_api_...
APIFY_IG_ACTOR=apify/instagram-profile-scraper
```

Sem `APIFY_TOKEN`, o research ainda roda, mas **sem posts reais dos concorrentes** (modo degradado).

### 3.3 Storage de imagens (escolha UMA opção)

**Opção A — Cloudinary (melhor em produção, sem volume):**

```env
STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_UPLOAD_PRESET=seu_preset_unsigned
```

No Cloudinary: Settings → Upload → Upload presets → crie um preset **Unsigned** e use o nome dele.

**Opção B — Local na própria API (precisa URL pública + volume):**

```env
STORAGE=local
MEDIA_BASE_URL=https://vende247-api.XXXX.easypanel.host
```

E monte um volume persistente no caminho `/app/data` (ou `data`), senão as imagens somem no próximo deploy.

### 3.4 Opcionais

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
IMAGE_PROVIDER=openai
OPENAI_IMAGE_MODEL=gpt-image-1.5
# OpenRouter (roteamento): IMAGE_PROVIDER=openrouter + OPENROUTER_API_KEY
# volume=seedream-4.5 | cover=gemini-3-pro-image | photo=flux.2-pro
META_ACCESS_TOKEN=
META_AD_LIBRARY_SEARCH_COUNTRY=BR
ALLOW_OPEN_REGISTER=false
```

- `META_ACCESS_TOKEN`: só se quiser puxar anúncios da Meta Ad Library.
- `ALLOW_OPEN_REGISTER=true`: só se quiser permitir **novos** cadastros depois do primeiro usuário. No 1º deploy pode deixar `false` — o **primeiro** usuário ainda consegue se registrar.

---

## Parte 4 — Deploy e teste

1. Salve as variáveis.
2. Clique em **Deploy** / Rebuild.
3. Espere o build terminar (Node 20, `npm install`, `tsc`).
4. Abra no navegador:

```text
https://SUA-URL-DA-API/health
```

Resposta esperada (JSON parecido com):

```json
{ "ok": true, "product": "Vende247", "ts": "..." }
```

Se `/health` não abrir:

- Conferir porta **3000** e domínio apontando para o app certo.
- Ver logs do container (erro de `DATABASE_URL` é o mais comum).
- Confirmar que o Dockerfile usado foi o de `api/`, não o da raiz.

### Teste rápido de auth (opcional)

```powershell
Invoke-RestMethod -Uri "https://SUA-URL-DA-API/api/auth/status"
```

Deve retornar algo como `{ "db": true, "canRegister": true, "users": 0 }` na primeira vez.

---

## Parte 5 — Checklist “API pronta”

Marque antes de ir para o painel:

- [ ] Repo = `ftsmazzo/Vende247` (não instaragm-tools)
- [ ] Build context = pasta `api`
- [ ] `/health` responde `ok: true`
- [ ] `/api/auth/status` com `db: true`
- [ ] `DATABASE_URL` apontando para Postgres interno
- [ ] `JWT_SECRET` forte definido
- [ ] `OPENAI_API_KEY` definida
- [ ] Storage configurado (Cloudinary **ou** local + `MEDIA_BASE_URL` + volume)
- [ ] URL pública da API anotada para o próximo passo (painel)

---

## Próximo passo (ainda não faça se a API não passou no checklist)

Subir o **painel** em **outro** app EasyPanel:

- Mesmo repo `ftsmazzo/Vende247`
- Dockerfile da **raiz**
- Build arg: `VITE_API_URL=https://SUA-URL-DA-API` (a URL que anotou acima)

Guia do painel: quando a API estiver no ar, pedimos e fechamos o passo a passo do frontend.

---

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| Site mostra tela do painel / nginx | Dockerfile da raiz no app da API | Trocar context para `api` |
| `/health` 502 / não sobe | Crash no boot | Ver logs; checar `DATABASE_URL` |
| `db: false` no `/api/auth/status` | Sem `DATABASE_URL` ou URL errada | Usar host **interno** do Postgres |
| Research fraco / sem dados de concorrente | Sem `APIFY_TOKEN` | Criar token no Apify |
| Imagem gerada mas Instagram não publica | URL da mídia inacessível | Preferir Cloudinary; se local, `MEDIA_BASE_URL` tem que ser URL **pública** HTTPS |
