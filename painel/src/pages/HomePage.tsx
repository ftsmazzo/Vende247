import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Campaign, getCampaignId, setCampaignId } from "../api/client";
import { CampaignTypePicker, NICHO_HINT } from "../components/CampaignTypePicker";
import { BRAND } from "../config/brand";

export function HomePage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("produto");
  const [nicho, setNicho] = useState("");
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  function load() {
    api.campaigns
      .list()
      .then((r) => setCampaigns(r.campaigns))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCampaign(c: Campaign) {
    setCampaignId(c.id);
    navigate(`/campanha/${c.id}`);
  }

  async function removeCampaign(e: MouseEvent, c: Campaign) {
    e.stopPropagation();
    if (!window.confirm(`Excluir a campanha “${c.name}”?`)) return;
    setRemovingId(c.id);
    setError("");
    try {
      await api.campaigns.remove(c.id);
      if (getCampaignId() === c.id) setCampaignId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir");
    } finally {
      setRemovingId(null);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const r = await api.campaigns.create({
        name,
        type,
        nicho,
        produto: name,
      });
      setCampaignId(r.campaign.id);
      navigate(`/campanha/${r.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="text-white/50">Carregando…</p>;

  return (
    <div className="animate-rise space-y-8">
      <div>
        <p className="text-signal text-sm font-medium mb-1">{BRAND.name}</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">Campanhas</h1>
        <p className="text-white/55 mt-2 max-w-xl">
          Pesquisa e estratégia primeiro. Depois o agente de identidade cria o visual desta campanha —
          do zero ou com as referências que você tiver.
        </p>
      </div>

      {error && <p className="text-coral text-sm">{error}</p>}

      <div className="grid gap-3">
        {campaigns.map((c) => (
          <div key={c.id} className="card flex items-start justify-between gap-3 hover:border-signal/40 transition">
            <button type="button" className="text-left flex-1 min-w-0" onClick={() => openCampaign(c)}>
              <p className="text-xs text-signal uppercase tracking-wide">{c.type}</p>
              <h2 className="font-display text-xl font-semibold mt-1">{c.name}</h2>
              <p className="text-sm text-white/50 mt-1">
                {c.nicho || "sem nicho"} · identidade {c.has_active_identity ? "ativa" : "pendente"}
              </p>
            </button>
            <button
              type="button"
              className="text-sm text-coral shrink-0"
              disabled={removingId === c.id}
              onClick={(e) => void removeCampaign(e, c)}
            >
              {removingId === c.id ? "…" : "Excluir"}
            </button>
          </div>
        ))}
        {!campaigns.length && (
          <p className="text-white/45 text-sm">Nenhuma campanha ainda. Crie uma e rode o pipeline.</p>
        )}
      </div>

      <form onSubmit={onCreate} className="card space-y-3">
        <h2 className="font-display text-lg font-semibold">Nova campanha</h2>
        <label className="block">
          <span className="label">Nome</span>
          <input className="field" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Tipo</span>
          <CampaignTypePicker value={type} onChange={setType} />
        </label>
        <label className="block">
          <span className="label">Nicho</span>
          <input
            className="field"
            placeholder="Ex.: EPI para construtoras; nutrição para mulheres 30+"
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
          />
          <p className="text-xs text-white/40 mt-1.5 leading-relaxed">{NICHO_HINT}</p>
        </label>
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? "Criando…" : "Criar"}
        </button>
      </form>

      <Link to="/config" className="text-signal text-sm">
        Conta / Instagram →
      </Link>
    </div>
  );
}
