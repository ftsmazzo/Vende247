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
  const [urls, setUrls] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [captureStats, setCaptureStats] = useState<{ ok: number; fail: number } | null>(null);

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

  function splitUrls(raw: string) {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
  }

  async function generate() {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const gen = await api.campaigns.generateIdentity(campaignId, {
        notes: notes || undefined,
        reference_urls: splitUrls(urls),
        image_urls: splitUrls(imageUrls),
      });
      const caps = gen.captures || [];
      if (caps.length) {
        const ok = caps.filter((c) => c.ok).length;
        setCaptureStats({ ok, fail: caps.length - ok });
        setMsg(
          `Agente gerou o contrato. Capturas: ${ok} ok${caps.length - ok ? `, ${caps.length - ok} falhou` : ""}.`
        );
      } else {
        setCaptureStats(null);
        setMsg("Agente gerou o contrato desta campanha.");
      }
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
      setMsg("Contrato reaplicado.");
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
      <h1 className="font-display text-3xl font-bold">Agente de identidade</h1>
      <p className="text-white/55">
        {campaign?.name}. O agente cruza <strong className="text-white/80">research + estratégia</strong> com
        qualquer referência que você tiver (site, imagens, notas). Se não tiver peça, parte do zero e
        cria o contrato. O JSON rico é a <em>saída</em> do agente — não um modelo de outra campanha.
      </p>
      {!canGenerate && (
        <p className="text-sm text-coral">Pesquisa e estratégia desta campanha precisam estar prontas.</p>
      )}
      {active && (
        <p className="text-sm text-white/60">
          Ativa: v{active.version} · {active.source} · {active.confidence || "sem confiança"}
        </p>
      )}
      {error && <p className="text-coral text-sm">{error}</p>}
      {msg && <p className="text-signal text-sm">{msg}</p>}

      <div className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">Referências (opcional)</h2>
        <p className="text-sm text-white/50">
          Cole sites que você acha bons: o sistema captura o design system (cores, fontes, densidade,
          hero/CTA) e o agente escolhe o que serve à campanha — sem copiar marca alheia. Sem nada, parte
          do zero alinhado à research.
        </p>
        <label className="block">
          <span className="label">Sites / páginas públicas</span>
          <textarea
            className="field min-h-[72px]"
            placeholder={"https://exemplo.com\nhttps://outra-referencia.com"}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />
          <span className="mt-1 block text-xs text-white/35">
            Até 3 URLs são capturadas a fundo (HTML/CSS). Útil para dark industrial, glass, tipografia,
            etc.
          </span>
          {captureStats && (
            <p className="mt-2 text-xs text-white/45">
              Última geração: {captureStats.ok} captura(s) ok
              {captureStats.fail ? ` · ${captureStats.fail} falhou` : ""}.
            </p>
          )}
        </label>
        <label className="block">
          <span className="label">URLs de imagens (mood, peça, print)</span>
          <textarea
            className="field min-h-[72px]"
            placeholder="https://…/mood.jpg"
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Notas, trechos de PDF, o que o cliente falou</span>
          <textarea
            className="field min-h-[100px]"
            placeholder="Ex.: gosto de papel, sem neon; público 25–40; evitar rosa chiclete…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button type="button" className="btn-primary" disabled={loading || !canGenerate} onClick={() => void generate()}>
          {loading ? "Agente gerando…" : "Rodar agente de identidade"}
        </button>
      </div>

      <form onSubmit={importJson} className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Reaplicar um contrato já gerado</h2>
        <p className="text-xs text-white/40">
          Cole o JSON que este (ou outro) agente já produziu para <em>esta</em> campanha. Não cole
          contrato de outra marca.
        </p>
        <label className="block">
          <span className="label">Modelo JSON</span>
          <textarea
            className="field min-h-[160px] font-mono text-xs"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">CSS</span>
          <textarea className="field min-h-[72px] font-mono text-xs" value={cssText} onChange={(e) => setCssText(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary" disabled={loading || !jsonText.trim()}>
          Ativar este JSON
        </button>
      </form>
    </div>
  );
}
