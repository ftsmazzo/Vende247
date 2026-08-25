import { FormEvent, useEffect, useState } from "react";
import { api, Workspace } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function SettingsPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [igUsername, setIgUsername] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [igToken, setIgToken] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.workspace
      .get()
      .then((w) => {
        setWs(w);
        setIgUsername(w.ig_username);
        setIgUserId(w.ig_user_id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const updated = await api.workspace.update({
        ig_username: igUsername,
        ig_user_id: igUserId,
        ig_access_token: igToken || undefined,
        onboarding_done: true,
      });
      setWs(updated);
      setMsg("Conta salva.");
      setIgToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  if (loading) return <p className="text-white/50">Carregando…</p>;

  return (
    <div className="animate-rise max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Conta</h1>
        <p className="text-white/55 mt-1">
          Instagram da conta. Identidade visual nasce na campanha depois de research e estratégia.
        </p>
      </div>

      {ws?.brand_warning && (
        <div className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
          {ws.brand_warning} — ignore cores da conta; use a identidade ativa da campanha.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3 card">
        <label className="block">
          <span className="label">@Instagram</span>
          <input className="field" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">IG User ID</span>
          <input className="field" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">
            Access Token {ws?.has_ig_token ? "(já salvo — deixe vazio para manter)" : ""}
          </span>
          <input
            className="field"
            value={igToken}
            onChange={(e) => setIgToken(e.target.value)}
            placeholder="Cole novo token se quiser trocar"
          />
        </label>
        {error && <p className="text-coral text-sm">{error}</p>}
        {msg && <p className="text-signal text-sm">{msg}</p>}
        <button type="submit" className="btn-primary">
          Salvar
        </button>
      </form>
      <StyleBits />
    </div>
  );
}
