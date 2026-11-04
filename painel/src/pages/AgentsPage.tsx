import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, InstagramAccount } from "../api/client";

export function AgentsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [defaults, setDefaults] = useState({ agent_prompt_comentarios: "", agent_prompt_direct: "" });
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState({
    agent_ativo: false,
    agent_nome: "",
    agent_prompt_comentarios: "",
    agent_prompt_direct: "",
    agent_access_token: "",
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const ig = await api.instagramAccounts.list();
    setAccounts(ig.accounts);
    setDefaults(ig.defaults);
    const id = selected ?? ig.active_instagram_account_id ?? ig.accounts[0]?.id ?? null;
    setSelected(id);
    const acc = ig.accounts.find((a) => a.id === id);
    if (acc) {
      setForm({
        agent_ativo: acc.agent_ativo,
        agent_nome: acc.agent_nome || "",
        agent_prompt_comentarios: acc.agent_prompt_comentarios || ig.defaults.agent_prompt_comentarios,
        agent_prompt_direct: acc.agent_prompt_direct || ig.defaults.agent_prompt_direct,
        agent_access_token: "",
      });
    }
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Erro"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(id: number) {
    setSelected(id);
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    setForm({
      agent_ativo: acc.agent_ativo,
      agent_nome: acc.agent_nome || "",
      agent_prompt_comentarios: acc.agent_prompt_comentarios || defaults.agent_prompt_comentarios,
      agent_prompt_direct: acc.agent_prompt_direct || defaults.agent_prompt_direct,
      agent_access_token: "",
    });
  }

  async function save() {
    if (!selected) return;
    setError("");
    setMsg("");
    try {
      const body: Record<string, unknown> = {
        agent_ativo: form.agent_ativo,
        agent_nome: form.agent_nome,
        agent_prompt_comentarios: form.agent_prompt_comentarios,
        agent_prompt_direct: form.agent_prompt_direct,
      };
      if (form.agent_access_token.trim()) body.agent_access_token = form.agent_access_token.trim();
      await api.instagramAccounts.update(selected, body);
      await reload();
      setMsg("Agente salvo nesta conta.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <div className="animate-rise max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Agentes</h1>
        <p className="text-white/55 mt-1">
          Comentário → Direct interno (sem n8n). Runtime na API + webhook Meta em{" "}
          <Link className="text-signal underline" to="/integracoes">
            Integrações
          </Link>
          .
        </p>
      </div>

      {accounts.length === 0 ? (
        <p className="text-white/50">
          Cadastre uma conta IG em <Link className="text-signal underline" to="/config">Conta</Link>.
        </p>
      ) : (
        <>
          <label className="block card">
            <span className="label">Conta</span>
            <select
              className="field"
              value={selected ?? ""}
              onChange={(e) => pick(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label || a.ig_username || a.id}
                </option>
              ))}
            </select>
          </label>

          <div className="card space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.agent_ativo}
                onChange={(e) => setForm((f) => ({ ...f, agent_ativo: e.target.checked }))}
              />
              Agente ativo
            </label>
            <label className="block">
              <span className="label">Nome do agente</span>
              <input
                className="field"
                value={form.agent_nome}
                onChange={(e) => setForm((f) => ({ ...f, agent_nome: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="label">Prompt comentários</span>
              <textarea
                className="field min-h-[120px]"
                value={form.agent_prompt_comentarios}
                onChange={(e) => setForm((f) => ({ ...f, agent_prompt_comentarios: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="label">Prompt Direct</span>
              <textarea
                className="field min-h-[120px]"
                value={form.agent_prompt_direct}
                onChange={(e) => setForm((f) => ({ ...f, agent_prompt_direct: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="label">Token agente (opcional — senão usa o da conta)</span>
              <input
                className="field"
                value={form.agent_access_token}
                onChange={(e) => setForm((f) => ({ ...f, agent_access_token: e.target.value }))}
                placeholder="Deixe vazio para manter"
              />
            </label>
            {error && <p className="text-coral text-sm">{error}</p>}
            {msg && <p className="text-signal text-sm">{msg}</p>}
            <button type="button" className="btn-primary" onClick={save}>
              Salvar agente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
