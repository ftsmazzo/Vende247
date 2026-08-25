import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Campaign, setCampaignId } from "../api/client";

const STEPS: Array<{ key: keyof NonNullable<Campaign["pipeline"]>; n: string; title: string; to: string; desc: string }> = [
  { key: "briefing", n: "1", title: "Campanha", to: ".", desc: "Briefing" },
  { key: "research", n: "2", title: "Research", to: "/research", desc: "Mercado e concorrentes" },
  { key: "strategy", n: "3", title: "Estratégia", to: "/estrategia", desc: "Plano de conteúdo" },
  { key: "identity", n: "4", title: "Identidade", to: "identidade", desc: "Gerar a partir de research + estratégia" },
  { key: "landing", n: "5", title: "Geração", to: "/landing", desc: "LP + criativos" },
];

export function CampaignPipelinePage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    setCampaignId(campaignId);
    api.campaigns
      .get(campaignId)
      .then((r) => setCampaign(r.campaign))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"));
  }, [campaignId]);

  async function saveBrief(e: FormEvent) {
    e.preventDefault();
    if (!campaign) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.campaigns.update(campaign.id, {
        name: campaign.name,
        type: campaign.type,
        nicho: campaign.nicho,
        produto: campaign.produto,
        oferta: campaign.oferta,
        cta: campaign.cta,
        tom_voz: campaign.tom_voz,
        concorrentes: campaign.concorrentes,
      });
      setCampaign(r.campaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  if (!campaign && !error) return <p className="text-white/50">Carregando…</p>;
  if (!campaign) return <p className="text-coral">{error}</p>;

  const pipe = campaign.pipeline;

  return (
    <div className="animate-rise space-y-8">
      <div>
        <Link to="/" className="text-sm text-white/45 hover:text-white">
          ← Campanhas
        </Link>
        <h1 className="font-display text-3xl font-bold mt-2">{campaign.name}</h1>
        <p className="text-white/50 mt-1">
          Ordem: briefing → research → estratégia → identidade → LP/criativos
        </p>
      </div>
      {error && <p className="text-coral text-sm">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s) => {
          const done = pipe ? Boolean(pipe[s.key]) : s.key === "briefing";
          const to = s.to.startsWith("/") ? s.to : `/campanha/${campaign.id}/${s.to === "." ? "" : s.to}`;
          return (
            <Link key={s.n} to={to.replace(/\/$/, "")} className="card block hover:border-signal/40">
              <span className="text-signal font-display text-2xl font-bold">{s.n}</span>
              <h2 className="font-display text-lg font-semibold mt-1">{s.title}</h2>
              <p className="text-xs text-white/45 mt-1">{s.desc}</p>
              <p className="text-xs mt-2">{done ? "pronta" : "pendente"}</p>
            </Link>
          );
        })}
      </div>
      <p className="text-sm text-white/50">
        Criativos:{" "}
        <Link to="/criativos" className="text-signal">
          abrir geração de imagens
        </Link>
      </p>

      <form onSubmit={saveBrief} className="card space-y-3 max-w-xl">
        <h2 className="font-display text-lg font-semibold">Briefing</h2>
        <Field label="Nome" value={campaign.name} onChange={(v) => setCampaign({ ...campaign, name: v })} />
        <Field label="Nicho" value={campaign.nicho} onChange={(v) => setCampaign({ ...campaign, nicho: v })} />
        <Field
          label="Produto / oferta"
          value={campaign.produto}
          onChange={(v) => setCampaign({ ...campaign, produto: v })}
        />
        <Field label="Oferta" value={campaign.oferta} onChange={(v) => setCampaign({ ...campaign, oferta: v })} />
        <Field label="CTA" value={campaign.cta} onChange={(v) => setCampaign({ ...campaign, cta: v })} />
        <Field label="Tom" value={campaign.tom_voz} onChange={(v) => setCampaign({ ...campaign, tom_voz: v })} />
        <label className="block">
          <span className="label">Concorrentes (@)</span>
          <textarea
            className="field min-h-[80px]"
            value={(campaign.concorrentes || []).map((c) => `@${c}`).join("\n")}
            onChange={(e) =>
              setCampaign({
                ...campaign,
                concorrentes: e.target.value
                  .split(/[\n,]+/)
                  .map((s) => s.replace(/^@/, "").trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Salvando…" : "Salvar briefing"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
