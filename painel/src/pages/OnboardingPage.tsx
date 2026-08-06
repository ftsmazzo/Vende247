import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [nicho, setNicho] = useState("");
  const [produto, setProduto] = useState("");
  const [oferta, setOferta] = useState("");
  const [cta, setCta] = useState("Chama no Direct");
  const [tom, setTom] = useState("direto, confiante, sem enrolação");
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
        produto,
        oferta,
        cta,
        tom_voz: tom,
        concorrentes: handles,
        ig_username: igUsername,
        ig_user_id: igUserId,
        ig_access_token: igToken,
      });
      navigate("/research", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-rise max-w-xl">
      <h1 className="font-display text-3xl font-bold mb-2">Onboarding</h1>
      <p className="text-white/55 mb-8">
        Perfil vazio? Sem problema. Informe o nicho, o produto e quem já vende bem — o research faz o resto.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nicho *" value={nicho} onChange={setNicho} placeholder="Ex.: imóveis luxo Curitiba" required />
        <Field label="Produto / oferta *" value={produto} onChange={setProduto} placeholder="O que você vende" required />
        <Field label="Oferta / diferencial" value={oferta} onChange={setOferta} placeholder="Ex.: consultoria gratuita" />
        <Field label="CTA padrão" value={cta} onChange={setCta} />
        <Field label="Tom de voz" value={tom} onChange={setTom} />
        <label className="block">
          <span className="label">Concorrentes (até 8 @handles) *</span>
          <textarea
            className="field min-h-[100px]"
            required
            placeholder={"@concorrente1\n@concorrente2\n@concorrente3"}
            value={concorrentes}
            onChange={(e) => setConcorrentes(e.target.value)}
          />
          <p className="text-xs text-white/40 mt-1">
            Quanto mais perfis relevantes, melhor a pesquisa. Pode editar depois em Configurações.
          </p>
        </label>

        <div className="pt-4 border-t border-white/10 space-y-4">
          <p className="text-sm text-white/50">Instagram (opcional agora — necessário para publicar)</p>
          <Field label="@username" value={igUsername} onChange={setIgUsername} placeholder="seu_perfil" />
          <Field label="IG User ID" value={igUserId} onChange={setIgUserId} />
          <Field label="Access Token" value={igToken} onChange={setIgToken} />
        </div>

        {error && <p className="text-coral text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Salvando…" : "Salvar e ir ao Research"}
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

export function StyleBits() {
  return (
    <style>{`
      .label { display:block; font-size:0.75rem; color:rgba(255,255,255,0.5); margin-bottom:0.35rem; }
      .field { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:0.75rem; padding:0.7rem 1rem; color:white; outline:none; }
      .field:focus { border-color: rgba(232,255,71,0.5); }
      .btn-primary { background:#e8ff47; color:#0a0c0f; font-weight:600; border-radius:0.75rem; padding:0.7rem 1.25rem; }
      .btn-primary:disabled { opacity:0.6; }
      .btn-ghost { border:1px solid rgba(255,255,255,0.15); border-radius:0.75rem; padding:0.55rem 1rem; color:white; font-size:0.875rem; }
      .btn-ghost:hover { background:rgba(255,255,255,0.05); }
      .btn-ghost:disabled { opacity:0.5; }
      .card { background:rgba(26,31,39,0.85); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem; }
    `}</style>
  );
}
