import { FormEvent, useEffect, useState } from "react";
import { api, BrandKit, Workspace } from "../api/client";
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
  const [siteUrl, setSiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [extracting, setExtracting] = useState(false);
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
        setBrand(w.brand_kit || null);
        setSiteUrl(w.brand_kit?.site_url || "");
        setLogoUrl(w.brand_kit?.logo_url || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const kit = {
        ...(brand || {}),
        site_url: siteUrl || brand?.site_url,
        logo_url: logoUrl || brand?.logo_url,
      };
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
        brand_kit: kit,
        onboarding_done: true,
      });
      setWs(updated);
      setBrand(updated.brand_kit || kit);
      setMsg("Salvo.");
      setIgToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    }
  }

  async function extractBrand() {
    setExtracting(true);
    setError("");
    setMsg("");
    try {
      const r = await api.workspace.brandFromUrl(siteUrl, logoUrl || undefined);
      setWs(r.workspace);
      setBrand(r.brand_kit);
      if (r.brand_kit.logo_url) setLogoUrl(r.brand_kit.logo_url);
      setMsg("Identidade visual extraída. Gere o lote de criativos de novo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler o site");
    } finally {
      setExtracting(false);
    }
  }

  if (loading) return <p className="text-white/50">Carregando…</p>;

  return (
    <div className="animate-rise max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Config</h1>
        <p className="text-white/55 mt-1">Nicho, identidade visual do produto e Instagram.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">Identidade visual (landing)</h2>
        <p className="text-sm text-white/50">
          Use uma URL <strong className="text-white/70">pública</strong> (marketing). Dashboard logado não funciona.
          O sistema lê logo/cores/estilo e aplica nos criativos + cola o logo na arte.
        </p>
        <label className="block">
          <span className="label">URL do site / landing</span>
          <input
            className="field"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://seusite.com.br"
          />
        </label>
        <label className="block">
          <span className="label">URL do logo (opcional — sobrescreve o detectado)</span>
          <input
            className="field"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://.../logo.png"
          />
        </label>
        <button type="button" className="btn-primary" disabled={extracting || !siteUrl.trim()} onClick={() => void extractBrand()}>
          {extracting ? "Extraindo…" : "Extrair identidade do site"}
        </button>
        {brand?.visual_summary && (
          <div className="text-sm text-white/70 space-y-2 border-t border-white/10 pt-3">
            <p>
              <span className="text-white/40">Resumo: </span>
              {brand.visual_summary}
            </p>
            {brand.product_ui_notes && (
              <p>
                <span className="text-white/40">UI: </span>
                {brand.product_ui_notes}
              </p>
            )}
            {brand.colors?.length ? (
              <p>
                <span className="text-white/40">Cores: </span>
                {brand.colors.join(" · ")}
              </p>
            ) : null}
            {(brand.logo_url || brand.og_image_url) && (
              <img
                src={brand.logo_url || brand.og_image_url}
                alt="Logo"
                className="h-12 object-contain bg-white/5 rounded p-1"
              />
            )}
          </div>
        )}
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
