import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, Campaign, setCampaignId } from "../api/client";
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
          <button
            key={c.id}
            type="button"
            className="card text-left hover:border-signal/40 transition"
            onClick={() => openCampaign(c)}
          >
            <p className="text-xs text-signal uppercase tracking-wide">{c.type}</p>
            <h2 className="font-display text-xl font-semibold mt-1">{c.name}</h2>
            <p className="text-sm text-white/50 mt-1">
              {c.nicho || "sem nicho"} · identidade {c.has_active_identity ? "ativa" : "pendente"}
            </p>
          </button>
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
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="produto">produto</option>
            <option value="servico">serviço</option>
            <option value="candidato">candidato</option>
            <option value="oferta">oferta</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Nicho</span>
          <input className="field" value={nicho} onChange={(e) => setNicho(e.target.value)} />
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
