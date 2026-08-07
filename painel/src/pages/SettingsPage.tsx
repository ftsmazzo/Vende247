import { FormEvent, useEffect, useState } from "react";
import { api, BrandKit, Workspace } from "../api/client";
import { StyleBits } from "./OnboardingPage";

function applyWorkspaceToForm(
  w: Workspace,
  setters: {
    setWs: (w: Workspace) => void;
    setNicho: (v: string) => void;
    setProduto: (v: string) => void;
    setOferta: (v: string) => void;
    setCta: (v: string) => void;
    setTom: (v: string) => void;
    setConcorrentes: (v: string) => void;
    setIgUsername: (v: string) => void;
    setIgUserId: (v: string) => void;
    setBrand: (v: BrandKit | null) => void;
    setSiteUrl: (v: string) => void;
    setLogoUrl: (v: string) => void;
  }
) {
  setters.setWs(w);
  setters.setNicho(w.nicho);
  setters.setProduto(w.produto);
  setters.setOferta(w.oferta);
  setters.setCta(w.cta);
  setters.setTom(w.tom_voz);
  setters.setConcorrentes((w.concorrentes || []).map((c) => `@${c}`).join("\n"));
  setters.setIgUsername(w.ig_username);
  setters.setIgUserId(w.ig_user_id);
  setters.setBrand(w.brand_kit || null);
  setters.setSiteUrl(w.brand_kit?.site_url || "");
  setters.setLogoUrl(w.brand_kit?.logo_url || "");
}

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
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const formSetters = {
    setWs,
    setNicho,
    setProduto,
    setOferta,
    setCta,
    setTom,
    setConcorrentes,
    setIgUsername,
    setIgUserId,
    setBrand,
    setSiteUrl,
    setLogoUrl,
  };

  useEffect(() => {
    api.workspace
      .get()
      .then((w) => applyWorkspaceToForm(w, formSetters))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      applyWorkspaceToForm(updated, formSetters);
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
      applyWorkspaceToForm(r.workspace, formSetters);
      setBrand(r.brand_kit);
      if (r.brand_kit.logo_url) setLogoUrl(r.brand_kit.logo_url);
      setMsg("Identidade visual extraída. Gere o lote de criativos de novo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler o site");
    } finally {
      setExtracting(false);
    }
  }

  async function applyPlannerPreset() {
    setApplyingPreset(true);
    setError("");
    setMsg("");
    try {
      const r = await api.workspace.applyPreset("planner-mulher");
      applyWorkspaceToForm(r.workspace, formSetters);
      setMsg(
        `Preset “${r.preset.label}” aplicado (briefing + identidade). Tokens do Instagram foram mantidos. Rode Research → Estratégia → Criativos de novo.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aplicar preset");
    } finally {
      setApplyingPreset(false);
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
        <h2 className="font-display text-lg font-semibold">Produto atual</h2>
        <p className="text-sm text-white/50">
          Sem site ainda? Aplique o preset do <strong className="text-white/70">Planner Mulher Cristã</strong>:
          preenche nicho, oferta, concorrentes e uma identidade visual soft (bege/terracotta) para
          criativos e landing — sem depender do ProntEPI.
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={applyingPreset}
          onClick={() => void applyPlannerPreset()}
        >
          {applyingPreset ? "Aplicando…" : "Aplicar Planner Mulher + identidade"}
        </button>
      </div>

      <div className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">Identidade visual</h2>
        <p className="text-sm text-white/50">
          Sem logo? O preset acima já define cores e mood. Depois você pode colar uma URL de logo
          (Canva / Drive público) ou extrair de um site quando tiver landing.
        </p>
        <label className="block">
          <span className="label">URL do site / landing (opcional)</span>
          <input
            className="field"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://seusite.com.br"
          />
        </label>
        <label className="block">
          <span className="label">URL do logo (opcional)</span>
          <input
            className="field"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://.../logo.png"
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={extracting || !siteUrl.trim()}
          onClick={() => void extractBrand()}
        >
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
                <span className="text-white/40">Cenas: </span>
                {brand.product_ui_notes}
              </p>
            )}
            {brand.colors?.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white/40">Cores:</span>
                {brand.colors.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block h-4 w-4 rounded-sm border border-white/20"
                      style={{ background: c }}
                    />
                    {c}
                  </span>
                ))}
              </div>
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
        <label className="block">
          <span className="label">Nicho</span>
          <input className="field" value={nicho} onChange={(e) => setNicho(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Produto</span>
          <input className="field" value={produto} onChange={(e) => setProduto(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Oferta</span>
          <input className="field" value={oferta} onChange={(e) => setOferta(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">CTA</span>
          <input className="field" value={cta} onChange={(e) => setCta(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Tom</span>
          <input className="field" value={tom} onChange={(e) => setTom(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Concorrentes (até 8 @handles)</span>
          <textarea
            className="field min-h-[90px]"
            value={concorrentes}
            onChange={(e) => setConcorrentes(e.target.value)}
            placeholder={"@perfil1\n@perfil2"}
          />
          <p className="text-xs text-white/40 mt-1">
            Inclua marcas do nicho. Depois rode Research de novo.
          </p>
        </label>
        <label className="block">
          <span className="label">@Instagram</span>
          <input
            className="field"
            value={igUsername}
            onChange={(e) => setIgUsername(e.target.value)}
          />
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
