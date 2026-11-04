import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, InstagramAccount, Workspace } from "../api/client";

export function SettingsPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [igToken, setIgToken] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editToken, setEditToken] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [mcpBlock, setMcpBlock] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
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
      setMsg("Conta Instagram adicionada. Clique em Ativar se for a que o estúdio deve usar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  function startEdit(a: InstagramAccount) {
    setEditId(a.id);
    setEditLabel(a.label || "");
    setEditUsername(a.ig_username || "");
    setEditUserId(a.ig_user_id || "");
    setEditToken("");
  }

  async function saveEdit() {
    if (!editId) return;
    setError("");
    setMsg("");
    try {
      const body: Record<string, unknown> = {
        label: editLabel,
        ig_username: editUsername,
        ig_user_id: editUserId,
      };
      if (editToken.trim()) body.ig_access_token = editToken.trim();
      await api.instagramAccounts.update(editId, body);
      setEditId(null);
      await reload();
      setMsg("Credenciais atualizadas só nesta conta.");
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
      setMsg(`Estúdio usando agora: @${res.account.ig_username || res.account.label}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Excluir a conta "${name}"? Publicação e agente desta conta param.`)) return;
    setError("");
    try {
      await api.instagramAccounts.remove(id);
      if (editId === id) setEditId(null);
      await reload();
      setMsg("Conta excluída.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  async function genMcp(id: number) {
    setError("");
    try {
      const res = await api.instagramAccounts.mcpKey(id);
      setMcpUrl(res.mcp.url);
      setMcpBlock(JSON.stringify(res.mcp.claude_desktop, null, 2));
      setMsg("Nova chave MCP gerada — cole no Claude. A chave antiga desta conta deixa de valer.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  if (loading) return <p className="text-white/50">Carregando…</p>;

  return (
    <div className="animate-rise max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Contas Instagram</h1>
        <p className="text-white/55 mt-1">
          Aqui você cadastra os <strong className="text-white/80">perfis IG</strong> (token + ID). O login
          email/senha é outra coisa (tela Entrar). Guia completo:{" "}
          <Link className="text-signal underline" to="/integracoes">
            Integrações → processo
          </Link>
          .
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65 space-y-1">
        <p>
          <strong className="text-white/90">Ativa</strong> = onde o estúdio publica e pesquisa.
        </p>
        <p>
          <strong className="text-white/90">Editar</strong> = trocar @, IG User ID ou token desta conta
          sem afetar as outras.
        </p>
        <p>
          <strong className="text-white/90">Excluir</strong> = remove a conta do sistema.
        </p>
      </div>

      {ws?.brand_warning && (
        <div className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
          {ws.brand_warning}
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">Suas contas</h2>
        {accounts.length === 0 && (
          <p className="text-sm text-white/50">Nenhuma ainda — use o formulário abaixo.</p>
        )}
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-lg border border-white/10 p-3 space-y-2">
              <div className="flex flex-wrap items-start gap-2 justify-between">
                <div>
                  <p className="font-medium">
                    {a.label || a.ig_username || a.ig_user_id}
                    {activeId === a.id && (
                      <span className="ml-2 text-xs text-signal">● ativa no estúdio</span>
                    )}
                  </p>
                  <p className="text-xs text-white/45">
                    @{a.ig_username || "—"} · ID {a.ig_user_id || "—"} · token{" "}
                    {a.has_ig_token ? "ok" : "faltando"} · agente {a.agent_ativo ? "ligado" : "off"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeId !== a.id && (
                    <button type="button" className="btn-ghost text-xs" onClick={() => activate(a.id)}>
                      Ativar
                    </button>
                  )}
                  <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(a)}>
                    Editar credenciais
                  </button>
                  <button type="button" className="btn-ghost text-xs" onClick={() => genMcp(a.id)}>
                    Claude MCP
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs text-coral"
                    onClick={() => remove(a.id, a.label || a.ig_username || String(a.id))}
                  >
                    Excluir
                  </button>
                </div>
              </div>
              {editId === a.id && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <input
                    className="field"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Label"
                  />
                  <input
                    className="field"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="@instagram"
                  />
                  <input
                    className="field"
                    value={editUserId}
                    onChange={(e) => setEditUserId(e.target.value)}
                    placeholder="IG User ID"
                  />
                  <input
                    className="field"
                    value={editToken}
                    onChange={(e) => setEditToken(e.target.value)}
                    placeholder="Novo token (vazio = manter o atual)"
                  />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary" onClick={saveEdit}>
                      Salvar credenciais
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onCreate} className="space-y-3 card">
        <h2 className="font-display text-lg font-semibold">Adicionar conta Instagram</h2>
        <p className="text-xs text-white/45">
          Pegue IG User ID + token no App Meta (conta Business/Creator vinculada ao app).
        </p>
        <label className="block">
          <span className="label">Nome interno</span>
          <input
            className="field"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Conta teste"
          />
        </label>
        <label className="block">
          <span className="label">@Instagram</span>
          <input className="field" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">IG User ID</span>
          <input
            className="field"
            value={igUserId}
            onChange={(e) => setIgUserId(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">Access Token</span>
          <input
            className="field"
            value={igToken}
            onChange={(e) => setIgToken(e.target.value)}
            placeholder="IGAA… ou EAA…"
          />
        </label>
        {error && <p className="text-coral text-sm">{error}</p>}
        {msg && <p className="text-signal text-sm">{msg}</p>}
        <button type="submit" className="btn-primary">
          Adicionar conta
        </button>
      </form>

      {mcpBlock && (
        <section className="card space-y-2">
          <h2 className="font-display text-lg font-semibold">Claude MCP desta conta</h2>
          <p className="text-xs break-all text-white/60">URL: {mcpUrl}</p>
          <pre className="text-xs overflow-auto max-h-64 bg-black/40 p-3 rounded-lg whitespace-pre-wrap">
            {mcpBlock}
          </pre>
        </section>
      )}
    </div>
  );
}
