# Processo claro — Vende247 (conta de teste → operação)

Três coisas diferentes (não misturar):

| Conceito | O que é | Onde |
|----------|---------|------|
| **Usuário** | Login email/senha no painel | Login / Criar conta |
| **Conta Instagram** | Perfil IG + token Graph | Conta |
| **Agente** | Responde comentário e Direct sozinho | Agentes + webhook Meta |

```
Usuário (você)
  └── Conta Instagram A (@teste)     ← token A
  └── Conta Instagram B (@cliente)   ← token B
        └── Agente ligado/desligado
        └── Chave MCP Claude (opcional)
```

Publicação e research usam a conta marcada como **ativa**.

---

## 1) Usuários (painel)

- **Primeiro usuário do banco:** qualquer um pode se cadastrar em “Criar conta” (mesmo com cadastro “fechado”).
- **Novos usuários depois disso:** só se no EasyPanel (API) existir  
  `ALLOW_OPEN_REGISTER=true`  
  Senão a tela diz “Cadastro fechado — peça acesso ao admin”.
- **Não há tela Admin de convidar usuário ainda.** Para teste: ligue `ALLOW_OPEN_REGISTER=true`, crie os logins, depois volte para `false` se quiser.

Você **não** precisa de um “admin Meta” para criar usuário do painel — só essa env.

---

## 2) Conta Instagram (obrigatório por perfil que for usar)

Para **cada** @ que for testar/operar:

1. Abra o App Meta (Máquina de Vendas / FabriaIA) → token da conta (IGAA ou EAA) + **IG User ID**.
2. Painel → **Conta** → **Adicionar conta**  
   - Label (ex.: “Conta teste”)  
   - @  
   - IG User ID  
   - Access Token  
3. Clique **Ativar** na conta que o estúdio deve usar agora.  
4. Para **trocar token** daquela conta: **Trocar token** → cola o novo → Salvar (não mexe nas outras).  
5. Para **excluir** uma conta: **Excluir** (confirma).

Se publicou no perfil errado: a conta **ativa** estava errada ou o token era de outro IG.

---

## 3) Como o agente opera (SDR, sem n8n)

Espelho do fluxo **Agente-Instagram** original:

0. Em **Empresa**, preencha missão, público, diferenciais, **carta de produtos** e FAQ. Isso alimenta o agente mesmo com **zero posts** no feed (cliente novo).  
1. Em **Agentes**, conta IG → **Agente ativo** → nome → refinamentos opcionais → Salvar.  
2. Webhook Meta: `{PUBLIC_API_URL}/api/webhooks/instagram` + verify token.  
3. **Comentário:** legenda do post (se houver) + base da empresa → reply público + **private reply** (push) → memória no Postgres.  
4. **Direct:** histórico no Postgres; se veio de comentário, retoma; se frio, usa carta de produtos/missão.  
5. LLM só via **OpenRouter** (`LLM_MODEL` / `LLM_MODEL_AGENT`).

Memória de conversa = **Postgres** (`agent_interactions`). Redis fica opcional como cache depois; a fonte da verdade já é o banco.

n8n **não** é necessário (salvo ponte de webhook).

Checklist rápido:

- [ ] Conta IG com token válido  
- [ ] Agente ativo nessa conta  
- [ ] `PUBLIC_API_URL` e `META_WEBHOOK_VERIFY_TOKEN` no EasyPanel  
- [ ] Webhook Meta inscrito em comments + messages  

---

## 4) Claude MCP (opcional)

1. Conta → conta desejada → **Claude MCP** (gera chave).  
2. Cole o JSON no Claude Desktop / Cursor.  
3. Cada @ tem a própria chave → Claude só enxerga essa conta.

---

## 5) Ordem sugerida (conta teste)

1. Deploy API + painel  
2. Env: `ALLOW_OPEN_REGISTER=true` (teste), `PUBLIC_API_URL`, `META_WEBHOOK_VERIFY_TOKEN`, LLM keys, `APIFY_TOKEN`  
3. Criar usuário no login  
4. Conta → adicionar IG teste + ativar  
5. Rodar research/estratégia numa campanha  
6. (Opcional) Agentes + webhook  
7. (Opcional) Claude MCP  
8. Fechar cadastro: `ALLOW_OPEN_REGISTER=false`

Tela **Integrações** no painel resume o status (o que está ok / faltando).
