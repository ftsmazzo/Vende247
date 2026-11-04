# MCP Claude — Vende247

Endpoint na API: `POST /mcp`  
Auth: `Authorization: Bearer <mcp_api_key>` da **conta Instagram** (não do workspace).

## Como gerar

1. Painel → **Conta** → conta IG → **Claude MCP**  
2. Ou `POST /api/instagram-accounts/:id/mcp-key` (JWT logado)  
3. Cole o JSON no Claude Desktop / Cursor

URL produção: `https://vendas247-api.kxryyk.easypanel.host/mcp`

## Tools

- `v247_get_account`, `v247_list_campaigns`, `v247_get_strategy`, `v247_list_creatives`, `v247_publish_creative`
- `ig_get_profile`, `ig_list_media`
- Prompts Tilli: `diagnostico-100k`, `novo-posicionamento`, …

## Webhook agente

`GET/POST /api/webhooks/instagram`  
Env EasyPanel: `META_WEBHOOK_VERIFY_TOKEN` (ou `IG_WEBHOOK_VERIFY_TOKEN`)  
`PUBLIC_API_URL` = URL pública da API (para montar links no painel)
