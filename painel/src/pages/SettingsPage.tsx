import { FormEvent, useEffect, useState } from "react";
import { api, Workspace } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function SettingsPage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [nicho, setNicho] = useState("");
  const [produto, setProduto] = useState("");
  const [oferta, setOferta] = useState("");
  const [cta, setCta] = useState("");
  const [tom, setTom] = useState("");
  const [concorrentes, setConcorrentes] = useState("");
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
        setNicho(w.nicho);
        setProduto(w.produto);
        setOferta(w.oferta);
        setCta(w.cta);
        setTom(w.tom_voz);
        setConcorrentes((w.concorrentes || []).map((c) => `@${c}`).join("\n"));
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
        nicho,
        produto,
        oferta,
        cta,
        tom_voz: tom,
        concorrentes: concorrentes.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
        ig_username: igUsername,
        ig_user_id: igUserId,
        ig_access_token: igToken || undefined,
        onboarding_done: true,
      });
      setWs(updated);
      setMsg("Salvo.");
      setIgToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  if (loading) return <p className="text-white/50">Carregando…</p>;

  return (
    <div className="animate-rise max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Config</h1>
        <p className="text-white/55 mt-1">Nicho, concorrentes e Instagram.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block"><span className="label">Nicho</span><input className="field" value={nicho} onChange={(e) => setNicho(e.target.value)} /></label>
        <label className="block"><span className="label">Produto</span><input className="field" value={produto} onChange={(e) => setProduto(e.target.value)} /></label>
        <label className="block"><span className="label">Oferta</span><input className="field" value={oferta} onChange={(e) => setOferta(e.target.value)} /></label>
        <label className="block"><span className="label">CTA</span><input className="field" value={cta} onChange={(e) => setCta(e.target.value)} /></label>
        <label className="block"><span className="label">Tom</span><input className="field" value={tom} onChange={(e) => setTom(e.target.value)} /></label>
        <label className="block"><span className="label">Concorrentes</span><textarea className="field min-h-[90px]" value={concorrentes} onChange={(e) => setConcorrentes(e.target.value)} /></label>
        <label className="block"><span className="label">@Instagram</span><input className="field" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} /></label>
        <label className="block"><span className="label">IG User ID</span><input className="field" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} /></label>
        <label className="block">
          <span className="label">Access Token {ws?.has_ig_token ? "(já salvo — deixe vazio para manter)" : ""}</span>
          <input className="field" value={igToken} onChange={(e) => setIgToken(e.target.value)} placeholder="Cole novo token se quiser trocar" />
        </label>
        {error && <p className="text-coral text-sm">{error}</p>}
        {msg && <p className="text-signal text-sm">{msg}</p>}
        <button type="submit" className="btn-primary">Salvar</button>
      </form>
      <StyleBits />
    </div>
  );
}
