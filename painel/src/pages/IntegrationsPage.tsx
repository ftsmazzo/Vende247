import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type Status = {
  webhook?: { url?: string; verify_token_configured?: boolean; note?: string };
  mcp?: { url?: string; note?: string };
  providers?: Record<string, { configured?: boolean; hint?: string | null } | string | null>;
  instagram_accounts?: Array<{ id: number; ig_username: string; has_ig_token: boolean; agent_ativo: boolean }>;
  active_instagram_account_id?: number | null;
};

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${ok ? "bg-signal/20 text-signal" : "bg-coral/20 text-coral"}`}>
      {ok ? "ok" : "faltando"}
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

  return (
    <div className="animate-rise max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Integrações</h1>
        <p className="text-white/55 mt-1">
          Status claro do que está conectado. Secrets de servidor ficam no EasyPanel; tokens IG em{" "}
          <Link className="text-signal underline" to="/config">
            Conta
          </Link>
          .
        </p>
      </div>

      <section className="card space-y-2">
        <h2 className="font-semibold">Instagram</h2>
        <p className="text-sm text-white/50">
          Conta ativa: {status.active_instagram_account_id ?? "nenhuma"} ·{" "}
          {(status.instagram_accounts || []).length} cadastrada(s)
        </p>
        <ul className="text-sm space-y-1">
          {(status.instagram_accounts || []).map((a) => (
            <li key={a.id}>
              @{a.ig_username || a.id} — token <Badge ok={a.has_ig_token} /> — agente{" "}
              <Badge ok={a.agent_ativo} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Claude MCP</h2>
        <p className="text-xs break-all text-white/70">{status.mcp?.url}</p>
        <p className="text-sm text-white/50">{status.mcp?.note}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Webhook Meta (agente)</h2>
        <p className="text-xs break-all text-white/70">{status.webhook?.url}</p>
        <p className="text-sm">
          Verify token env: <Badge ok={Boolean(status.webhook?.verify_token_configured)} />
        </p>
        <p className="text-sm text-white/50">{status.webhook?.note}</p>
        <Link className="text-signal text-sm underline" to="/agentes">
          Configurar prompts do agente →
        </Link>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Provedores (servidor)</h2>
        {(
          [
            ["apify", "Apify (research)"],
            ["openai", "OpenAI"],
            ["gemini", "Gemini"],
            ["anthropic", "Anthropic"],
            ["kairogen", "Kairogen (imagem hub)"],
          ] as const
        ).map(([key, label]) => {
          const v = p[key];
          const configured = typeof v === "object" && v && "configured" in v ? Boolean(v.configured) : false;
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
          LLM: {String(p.llm_provider || "openai")} · Imagem: {String(p.image_provider || "openai")} ·
          Vídeo: {String(p.video_provider || "não configurado")}
        </p>
      </section>
    </div>
  );
}
