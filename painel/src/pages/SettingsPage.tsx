import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, InstagramAccount, Workspace } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function SettingsPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [igToken, setIgToken] = useState("");
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [editToken, setEditToken] = useState("");
  const [mcpBlock, setMcpBlock] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [w, ig] = await Promise.all([api.workspace.get(), api.instagramAccounts.list()]);
    setWs(w);
    setAccounts(ig.accounts);
    setActiveId(ig.active_instagram_account_id);
  }

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api.instagramAccounts.create({
        label: label || igUsername,
        ig_user_id: igUserId,
        ig_username: igUsername,
        ig_access_token: igToken || undefined,
      });
      setLabel("");
      setIgUsername("");
      setIgUserId("");
      setIgToken("");
      await reload();
      setMsg("Conta Instagram adicionada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  async function saveToken(id: number) {
    setError("");
    setMsg("");
    try {
      await api.instagramAccounts.update(id, { ig_access_token: editToken });
      setEditId(null);
      setEditToken("");
      await reload();
      setMsg("Token atualizado nesta conta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  async function activate(id: number) {
    setError("");
    try {
      const res = await api.instagramAccounts.activate(id);
      setActiveId(res.active_instagram_account_id);
      await reload();
      setMsg(`Conta ativa: @${res.account.ig_username || res.account.label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  async function genMcp(id: number) {
    setError("");
    try {
      const res = await api.instagramAccounts.mcpKey(id);
      setMcpBlock(JSON.stringify(res.mcp.claude_desktop, null, 2));
      setMsg(`MCP URL: ${res.mcp.url} — key gerada (cole no Claude).`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  if (loading) return <p className="text-white/50">Carregando…</p>;

  return (
    <div className="animate-rise max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Conta</h1>
        <p className="text-white/55 mt-1">
          Várias contas Instagram por usuário. Ative a conta do estúdio e troque o token só dela.
        </p>
        <p className="text-sm text-white/40 mt-2">
          Também em <Link className="text-signal underline" to="/integracoes">Integrações</Link> e{" "}
          <Link className="text-signal underline" to="/agentes">Agentes</Link>.
        </p>
      </div>

      {ws?.brand_warning && (
        <div className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
          {ws.brand_warning}
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">Contas Instagram</h2>
        {accounts.length === 0 && (
          <p className="text-sm text-white/50">Nenhuma conta ainda — adicione abaixo.</p>
        )}
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-lg border border-white/10 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p className="font-medium">
                    {a.label || a.ig_username || a.ig_user_id}
                    {activeId === a.id && (
                      <span className="ml-2 text-xs text-signal">ativa</span>
                    )}
                  </p>
                  <p className="text-xs text-white/45">
                    @{a.ig_username || "—"} · ID {a.ig_user_id} · token{" "}
                    {a.has_ig_token ? "ok" : "faltando"} · agente{" "}
                    {a.agent_ativo ? "ligado" : "off"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeId !== a.id && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => activate(a.id)}>
                      Ativar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      setEditId(a.id);
                      setEditToken("");
                    }}
                  >
                    Trocar token
                  </button>
                  <button type="button" className="btn-ghost text-xs" onClick={() => genMcp(a.id)}>
                    Claude MCP
                  </button>
                </div>
              </div>
              {editId === a.id && (
                <div className="flex gap-2">
                  <input
                    className="field flex-1"
                    value={editToken}
                    onChange={(e) => setEditToken(e.target.value)}
                    placeholder="Novo IGAA/EAA…"
                  />
                  <button type="button" className="btn-primary" onClick={() => saveToken(a.id)}>
                    Salvar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onCreate} className="space-y-3 card">
        <h2 className="font-display text-lg font-semibold">Adicionar conta</h2>
        <label className="block">
          <span className="label">Label</span>
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Fábrica dos Dados" />
        </label>
        <label className="block">
          <span className="label">@Instagram</span>
          <input className="field" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">IG User ID</span>
          <input className="field" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label">Access Token</span>
          <input className="field" value={igToken} onChange={(e) => setIgToken(e.target.value)} placeholder="IGAA… ou EAA…" />
        </label>
        {error && <p className="text-coral text-sm">{error}</p>}
        {msg && <p className="text-signal text-sm">{msg}</p>}
        <button type="submit" className="btn-primary">
          Adicionar
        </button>
      </form>

      {mcpBlock && (
        <section className="card space-y-2">
          <h2 className="font-display text-lg font-semibold">Config Claude Desktop</h2>
          <pre className="text-xs overflow-auto max-h-64 bg-black/40 p-3 rounded-lg whitespace-pre-wrap">
            {mcpBlock}
          </pre>
        </section>
      )}

      <StyleBits />
    </div>
  );
}
