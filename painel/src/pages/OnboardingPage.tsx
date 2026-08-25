import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setCampaignId } from "../api/client";
import { StyleBits } from "../components/StyleBits";

export { StyleBits };

export function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState("produto");
  const [nicho, setNicho] = useState("");
  const [produto, setProduto] = useState("");
  const [oferta, setOferta] = useState("");
  const [cta, setCta] = useState("");
  const [tom, setTom] = useState("");
  const [concorrentes, setConcorrentes] = useState("");
  const [igUsername, setIgUsername] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [igToken, setIgToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const handles = concorrentes
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await api.workspace.onboarding({
        nicho,
        produto: produto || name,
        oferta,
        cta,
        tom_voz: tom,
        concorrentes: handles,
        ig_username: igUsername,
        ig_user_id: igUserId,
        ig_access_token: igToken,
      });
      const created = await api.campaigns.create({
        name: name || produto,
        type,
        nicho,
        produto: produto || name,
        oferta,
        cta,
        tom_voz: tom,
        concorrentes: handles,
      });
      setCampaignId(created.campaign.id);
      navigate(`/campanha/${created.campaign.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-rise max-w-xl">
      <h1 className="font-display text-3xl font-bold mb-2">Primeira campanha</h1>
      <p className="text-white/55 mb-8">
        A conta guarda Instagram e chaves. O briefing vive na campanha.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nome da campanha *" value={name} onChange={setName} required />
        <label className="block">
          <span className="label">Tipo</span>
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="produto">produto</option>
            <option value="servico">serviço</option>
            <option value="candidato">candidato</option>
            <option value="oferta">oferta</option>
          </select>
        </label>
        <Field label="Nicho" value={nicho} onChange={setNicho} />
        <Field label="Produto / oferta" value={produto} onChange={setProduto} />
        <Field label="Oferta / diferencial" value={oferta} onChange={setOferta} />
        <Field label="CTA padrão" value={cta} onChange={setCta} />
        <Field label="Tom de voz" value={tom} onChange={setTom} />
        <label className="block">
          <span className="label">Concorrentes (até 8 @handles)</span>
          <textarea
            className="field min-h-[100px]"
            placeholder={"@perfil1\n@perfil2"}
            value={concorrentes}
            onChange={(e) => setConcorrentes(e.target.value)}
          />
        </label>

        <div className="pt-4 border-t border-white/10 space-y-4">
          <p className="text-sm text-white/50">Instagram da conta (opcional)</p>
          <Field label="@username" value={igUsername} onChange={setIgUsername} />
          <Field label="IG User ID" value={igUserId} onChange={setIgUserId} />
          <Field label="Access Token" value={igToken} onChange={setIgToken} />
        </div>

        {error && <p className="text-coral text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Salvando…" : "Criar campanha"}
        </button>
      </form>
      <StyleBits />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="field"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
