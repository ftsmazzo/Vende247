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
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pipe = campaign?.pipeline;
  const canGenerate = Boolean(pipe?.research && pipe?.strategy);

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

  async function generate() {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      await api.campaigns.generateIdentity(campaignId, notes || undefined);
      setMsg("Identidade gerada a partir de research + estratégia.");
      const r = await api.campaigns.identity(campaignId);
      setActive(r.active);
      if (r.active?.model) setJsonText(JSON.stringify(r.active.model, null, 2));
      if (r.active?.css) setCssText(r.active.css);
      const c = await api.campaigns.get(campaignId);
      setCampaign(c.campaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  async function importJson(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const model = JSON.parse(jsonText);
      await api.campaigns.importIdentity(campaignId, { model, css: cssText });
      setMsg("Contrato JSON importado e ativado.");
      const r = await api.campaigns.identity(campaignId);
      setActive(r.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON inválido");
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
        {campaign?.name}. Ordem: pesquisa → estratégia → <strong className="text-white/80">esta etapa</strong> →
        landing/criativos. Não usa cores da Conta.
      </p>
      {!canGenerate && (
        <p className="text-sm text-coral">
          Complete research e estratégia nesta campanha para gerar identidade.
        </p>
      )}
      {active && (
        <p className="text-sm text-white/60">
          Ativa: v{active.version} · {active.source} · {active.confidence || "sem confiança"}
        </p>
      )}
      {error && <p className="text-coral text-sm">{error}</p>}
      {msg && <p className="text-signal text-sm">{msg}</p>}

      <div className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">Gerar desta campanha</h2>
        <p className="text-sm text-white/50">
          Usa o relatório de research e o plano de estratégia. Cole notas de peças, site de referência
          ou mood (opcional).
        </p>
        <textarea
          className="field min-h-[80px]"
          placeholder="Ex.: site de referência, cores que gosto, PDF do brandbook…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="button" className="btn-primary" disabled={loading || !canGenerate} onClick={() => void generate()}>
          {loading ? "Gerando…" : "Gerar identidade (research + estratégia)"}
        </button>
      </div>

      <form onSubmit={importJson} className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Ou importar contrato pronto</h2>
        <p className="text-xs text-white/40">
          Só use JSON de OUTRA marca se esta campanha for realmente essa marca (ex.: brandbook Flávio
          numa campanha Flávio — não no Planner).
        </p>
        <label className="block">
          <span className="label">Modelo JSON</span>
          <textarea
            className="field min-h-[180px] font-mono text-xs"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Tokens CSS (opcional)</span>
          <textarea className="field min-h-[80px] font-mono text-xs" value={cssText} onChange={(e) => setCssText(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary" disabled={loading || !jsonText.trim()}>
          Ativar este JSON
        </button>
      </form>
    </div>
  );
}
