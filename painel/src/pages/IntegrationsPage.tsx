import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type Status = {
  webhook?: { url?: string; verify_token_configured?: boolean; note?: string };
  mcp?: { url?: string; note?: string };
  providers?: Record<string, { configured?: boolean; hint?: string | null } | string | null>;
  instagram_accounts?: Array<{
    id: number;
    ig_username: string;
    has_ig_token: boolean;
    agent_ativo: boolean;
  }>;
  active_instagram_account_id?: number | null;
};

function Badge({ ok, labelOk = "ok", labelNo = "faltando" }: { ok: boolean; labelOk?: string; labelNo?: string }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${ok ? "bg-signal/20 text-signal" : "bg-coral/20 text-coral"}`}
    >
      {ok ? labelOk : labelNo}
    </span>
  );
}

export function IntegrationsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.integrations
      .status()
      .then((s) => setStatus(s as Status))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  if (error) return <p className="text-coral">{error}</p>;
  if (!status) return <p className="text-white/50">Carregando…</p>;

  const p = status.providers || {};
  const accounts = status.instagram_accounts || [];
  const hasActive = Boolean(status.active_instagram_account_id);
  const hasToken = accounts.some((a) => a.has_ig_token);
  const agentOn = accounts.some((a) => a.agent_ativo);

  return (
    <div className="animate-rise max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Integrações</h1>
        <p className="text-white/55 mt-1">
          Mapa do que está ligado e o processo de setup. Doc:{" "}
          <code className="text-xs text-white/40">docs/PROCESSO-SETUP.md</code>
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">Processo (conta teste)</h2>
        <ol className="list-decimal list-inside space-y-3 text-sm text-white/75">
          <li>
            <strong className="text-white">Usuário do painel</strong> — tela Entrar. Primeiro cadastro sempre
            aberto. Depois: env <code className="text-xs">ALLOW_OPEN_REGISTER=true</code> na API (EasyPanel)
            para criar mais logins. Não é “admin Meta”; é só liberar cadastro.
          </li>
          <li>
            <strong className="text-white">Conta Instagram</strong> — em{" "}
            <Link className="text-signal underline" to="/config">
              Contas Instagram
            </Link>
            : adicionar @ + IG User ID + token → <em>Ativar</em>. Editar/Excluir por conta.
            <div className="mt-1 flex gap-2 flex-wrap">
              Contas: <Badge ok={accounts.length > 0} labelOk={`${accounts.length}`} labelNo="0" /> Token:{" "}
              <Badge ok={hasToken} /> Ativa: <Badge ok={hasActive} />
            </div>
          </li>
          <li>
            <strong className="text-white">Campanha / research</strong> — usa a conta <em>ativa</em>. Se
            publicou no perfil errado, a ativa ou o token estão errados.
          </li>
          <li>
            <strong className="text-white">Agente (comentário → Direct)</strong> — interno, sem n8n. Em{" "}
            <Link className="text-signal underline" to="/agentes">
              Agentes
            </Link>
            : ligar na conta → prompts → Salvar. Meta manda webhook → API responde no Graph.
            <div className="mt-1">
              Agente ligado: <Badge ok={agentOn} /> Webhook verify env:{" "}
              <Badge ok={Boolean(status.webhook?.verify_token_configured)} />
            </div>
          </li>
          <li>
            <strong className="text-white">Claude MCP (opcional)</strong> — Contas Instagram → Claude MCP →
            colar JSON no Claude. Uma chave por @.
          </li>
        </ol>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Como o agente opera</h2>
        <p className="text-sm text-white/65">
          1) Comentário ou DM chega no Instagram → 2) Meta chama{" "}
          <code className="text-xs break-all">{status.webhook?.url}</code> → 3) Se a conta tiver agente
          ativo, a API gera resposta com LLM → 4) Responde no comentário ou Direct via Graph. Sem n8n no
          meio. n8n só se você quiser redirecionar o webhook.
        </p>
        <p className="text-xs text-white/45">{status.webhook?.note}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Claude MCP</h2>
        <p className="text-xs break-all text-white/70">{status.mcp?.url}</p>
        <p className="text-sm text-white/50">{status.mcp?.note}</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Provedores no servidor (EasyPanel)</h2>
        <p className="text-xs text-white/45">
          Você não cola Apify/OpenAI no painel — só no env da API. Aqui só o status.
        </p>
        {(
          [
            ["apify", "Apify (research)"],
            ["openai", "OpenAI"],
            ["gemini", "Gemini"],
            ["anthropic", "Anthropic"],
            ["kairogen", "Kairogen"],
          ] as const
        ).map(([key, label]) => {
          const v = p[key];
          const configured =
            typeof v === "object" && v && "configured" in v ? Boolean(v.configured) : false;
          const hint = typeof v === "object" && v && "hint" in v ? v.hint : null;
          return (
            <div key={key} className="flex justify-between text-sm gap-2">
              <span>{label}</span>
              <span className="text-white/50">
                <Badge ok={configured} /> {hint || ""}
              </span>
            </div>
          );
        })}
        <p className="text-xs text-white/40">
          LLM: {String(p.llm_provider || "openai")} · Imagem: {String(p.image_provider || "openai")}
        </p>
      </section>
    </div>
  );
}
