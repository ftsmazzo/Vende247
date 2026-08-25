import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Campaign, IdentityActive, setCampaignId } from "../api/client";

export function IdentityPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [active, setActive] = useState<IdentityActive | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [cssText, setCssText] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    setCampaignId(campaignId);
    api.campaigns.get(campaignId).then((r) => setCampaign(r.campaign)).catch(() => {});
    api.campaigns
      .identity(campaignId)
      .then((r) => {
        setActive(r.active);
        if (r.active?.model) setJsonText(JSON.stringify(r.active.model, null, 2));
        if (r.active?.css) setCssText(r.active.css);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"));
  }, [campaignId]);

  async function importJson(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const model = JSON.parse(jsonText);
      await api.campaigns.importIdentity(campaignId, { model, css: cssText, seed: undefined });
      setMsg("Identidade importada e ativada.");
      const r = await api.campaigns.identity(campaignId);
      setActive(r.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON inválido");
    } finally {
      setLoading(false);
    }
  }

  async function seedFlavio() {
    setLoading(true);
    setError("");
    try {
      await api.campaigns.importIdentity(campaignId, { seed: "flavio" });
      setMsg("Seed Flávio ativado.");
      const r = await api.campaigns.identity(campaignId);
      setActive(r.active);
      if (r.active?.model) setJsonText(JSON.stringify(r.active.model, null, 2));
      if (r.active?.css) setCssText(r.active.css);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-rise space-y-6 max-w-3xl">
      <Link to={`/campanha/${campaignId}`} className="text-sm text-white/45 hover:text-white">
        ← Pipeline
      </Link>
      <h1 className="font-display text-3xl font-bold">Identidade</h1>
      <p className="text-white/55">
        {campaign?.name} · skill visual-identity-audit (import). Versão ativa alimenta LP e criativos.
      </p>
      {active && (
        <p className="text-sm text-white/60">
          Ativa: v{active.version} · {active.source} · {active.confidence || "sem confiança"}
        </p>
      )}
      {error && <p className="text-coral text-sm">{error}</p>}
      {msg && <p className="text-signal text-sm">{msg}</p>}

      <button type="button" className="btn-primary" disabled={loading} onClick={() => void seedFlavio()}>
        {loading ? "Importando…" : "Importar seed Flávio (JSON + CSS do repo)"}
      </button>

      <form onSubmit={importJson} className="space-y-3">
        <label className="block">
          <span className="label">Modelo JSON</span>
          <textarea
            className="field min-h-[220px] font-mono text-xs"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='Cole o identity_signature / design_tokens…'
          />
        </label>
        <label className="block">
          <span className="label">Tokens CSS (opcional)</span>
          <textarea
            className="field min-h-[120px] font-mono text-xs"
            value={cssText}
            onChange={(e) => setCssText(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={loading || !jsonText.trim()}>
          Ativar este JSON
        </button>
      </form>
    </div>
  );
}
