import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, StrategyRow } from "../api/client";
import { StyleBits } from "./OnboardingPage";

/** Evita crash React quando a LLM manda objeto/array no lugar de string. */
function asText(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((x) => asText(x))
      .filter(Boolean)
      .join(" · ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.titulo === "string" || typeof o.texto === "string") {
      return [o.titulo, o.texto].map((x) => asText(x)).filter(Boolean).join(" — ");
    }
    try {
      return JSON.stringify(v);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) {
    if (typeof v === "string" && v.trim()) return [v.trim()];
    return [];
  }
  return v.map((x) => asText(x)).filter(Boolean);
}

type SlideView = { titulo: string; texto: string };

function asSlides(v: unknown): SlideView[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw, i) => {
    if (typeof raw === "string") return { titulo: `Slide ${i + 1}`, texto: raw };
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      return {
        titulo: asText(o.titulo, `Slide ${i + 1}`),
        texto: asText(o.texto || o.body || o.caption),
      };
    }
    return { titulo: `Slide ${i + 1}`, texto: "" };
  });
}

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
  const pilares = asStringList(plan?.pilares);
  const posts = Array.isArray(plan?.posts) ? plan!.posts : [];

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
      {!loading && !plan && !error && (
        <div className="card text-white/55">Nenhuma estratégia ainda. Gere o plano após o research.</div>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-white/75 whitespace-pre-wrap">{asText(plan.resumo, "Sem resumo.")}</p>
            {pilares.length > 0 && (
              <p className="mt-3 text-sm text-white/50">Pilares: {pilares.join(" · ")}</p>
            )}
          </div>
          <div className="space-y-3">
            {posts.map((p, idx) => {
              const formato = asText(p.formato, "feed").toLowerCase();
              const slides = asSlides(p.slides);
              const day = typeof p.day === "number" ? p.day : idx + 1;
              return (
                <div key={`day-${day}-${idx}`} className="card">
                  <div className="flex flex-wrap gap-2 items-baseline justify-between mb-2">
                    <h2 className="font-display text-lg font-semibold">
                      Dia {day} — {asText(p.titulo, "Post")}
                    </h2>
                    <span className="text-xs uppercase tracking-wide text-signal">
                      {formato === "carrossel"
                        ? `carrossel · ${slides.length || "N"} slides`
                        : formato === "reels"
                          ? "reels · imagem (vídeo em breve)"
                          : formato || "feed"}
                    </span>
                  </div>
                  <p className="text-sm text-white/45 mb-2">
                    {asText(p.pilar)} · {asText(p.objetivo)}
                  </p>
                  <p className="text-signal font-medium mb-1">Hook: {asText(p.hook)}</p>
                  <p className="text-sm text-white/70 mb-2 whitespace-pre-wrap">{asText(p.estrutura)}</p>
                  {formato === "carrossel" && slides.length > 0 && (
                    <ol className="text-sm text-white/55 list-decimal pl-5 space-y-1 mb-2">
                      {slides.map((s, i) => (
                        <li key={i}>
                          <span className="text-white/80">{s.titulo}</span>
                          {s.texto ? ` — ${s.texto}` : ""}
                        </li>
                      ))}
                    </ol>
                  )}
                  {formato === "reels" && (
                    <p className="text-xs text-white/40 mb-2">
                      Ainda não geramos vídeo; o lote criará uma imagem estilo capa.
                    </p>
                  )}
                  <p className="text-sm text-white/60 whitespace-pre-wrap border-t border-white/10 pt-2 mt-2">
                    {asText(p.caption)}
                    {asText(p.cta) ? `\n\n${asText(p.cta)}` : ""}
                  </p>
                </div>
              );
            })}
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
