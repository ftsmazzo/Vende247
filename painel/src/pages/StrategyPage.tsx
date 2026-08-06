import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, StrategyRow } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function StrategyPage() {
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.strategy
      .latest()
      .then((r) => setStrategy(r.strategy))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const r = await api.strategy.generate(days);
      setStrategy(r.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setGenerating(false);
    }
  }

  const plan = strategy?.plan;

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Estratégia</h1>
          <p className="text-white/55 mt-1">Plano diário com brief de cada criativo.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="field w-auto"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 dias</option>
            <option value={10}>10 dias</option>
            <option value={14}>14 dias</option>
          </select>
          <button type="button" className="btn-primary" disabled={generating} onClick={() => void generate()}>
            {generating ? "Gerando…" : "Gerar plano"}
          </button>
        </div>
      </div>

      {error && <p className="text-coral text-sm">{error}</p>}
      {loading && <p className="text-white/50">Carregando…</p>}

      {plan && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-white/75 whitespace-pre-wrap">{plan.resumo}</p>
            {plan.pilares?.length > 0 && (
              <p className="mt-3 text-sm text-white/50">
                Pilares: {plan.pilares.join(" · ")}
              </p>
            )}
          </div>
          <div className="space-y-3">
            {plan.posts?.map((p) => (
              <div key={p.day} className="card">
                <div className="flex flex-wrap gap-2 items-baseline justify-between mb-2">
                  <h2 className="font-display text-lg font-semibold">
                    Dia {p.day} — {p.titulo}
                  </h2>
                  <span className="text-xs uppercase tracking-wide text-signal">
                    {p.formato === "carrossel"
                      ? `carrossel · ${p.slides?.length || "N"} slides`
                      : p.formato === "reels"
                        ? "reels · imagem (vídeo em breve)"
                        : p.formato}
                  </span>
                </div>
                <p className="text-sm text-white/45 mb-2">
                  {p.pilar} · {p.objetivo}
                </p>
                <p className="text-signal font-medium mb-1">Hook: {p.hook}</p>
                <p className="text-sm text-white/70 mb-2">{p.estrutura}</p>
                {p.formato === "carrossel" && p.slides && p.slides.length > 0 && (
                  <ol className="text-sm text-white/55 list-decimal pl-5 space-y-1 mb-2">
                    {p.slides.map((s, i) => (
                      <li key={i}>
                        <span className="text-white/80">{s.titulo || `Slide ${i + 1}`}</span>
                        {s.texto ? ` — ${s.texto}` : ""}
                      </li>
                    ))}
                  </ol>
                )}
                {p.formato === "reels" && (
                  <p className="text-xs text-white/40 mb-2">
                    Ainda não geramos vídeo; o lote criará uma imagem estilo capa.
                  </p>
                )}
                <p className="text-sm text-white/60 whitespace-pre-wrap border-t border-white/10 pt-2 mt-2">
                  {p.caption}
                  {p.cta ? `\n\n${p.cta}` : ""}
                </p>
              </div>
            ))}
          </div>
          <Link to="/criativos" className="btn-primary inline-block">
            Gerar lote de criativos →
          </Link>
        </div>
      )}
      <StyleBits />
    </div>
  );
}
