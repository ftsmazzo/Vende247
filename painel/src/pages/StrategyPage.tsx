import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type StrategyPlan, type StrategyRow } from "../api/client";
import { StyleBits } from "../components/StyleBits";

function asText(v: unknown, fallback = ""): string {
  try {
    if (v == null) return fallback;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      return v.map((x) => asText(x)).filter(Boolean).join(" · ");
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      const bits = [o.titulo, o.texto, o.body, o.caption, o.hook, o.name]
        .map((x) => asText(x))
        .filter(Boolean);
      if (bits.length) return bits.join(" — ");
      return JSON.stringify(v);
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asText(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

type SlideView = { titulo: string; texto: string };
type PostView = {
  day: number;
  titulo: string;
  formato: string;
  pilar: string;
  objetivo: string;
  hook: string;
  estrutura: string;
  caption: string;
  cta: string;
  slides: SlideView[];
};

function asSlides(v: unknown): SlideView[] {
  if (!Array.isArray(v)) return [];
  return v.map((raw, i) => {
    if (typeof raw === "string") return { titulo: `Slide ${i + 1}`, texto: raw };
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      return {
        titulo: asText(o.titulo, `Slide ${i + 1}`),
        texto: asText(o.texto ?? o.body ?? o.caption),
      };
    }
    return { titulo: `Slide ${i + 1}`, texto: "" };
  });
}

/** Normaliza qualquer lixo da LLM/Postgres para um plano renderizável. */
export function normalizePlan(raw: unknown): StrategyPlan | null {
  if (raw == null) return null;
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { resumo: raw, dias: 0, pilares: [], posts: [] };
    }
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const postsIn = Array.isArray(o.posts) ? o.posts : [];
  const posts = postsIn
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const p = item as Record<string, unknown>;
      const dayNum = Number(p.day);
      return {
        day: Number.isFinite(dayNum) && dayNum > 0 ? dayNum : idx + 1,
        titulo: asText(p.titulo, `Dia ${idx + 1}`),
        pilar: asText(p.pilar),
        objetivo: asText(p.objetivo),
        formato: asText(p.formato, "feed").toLowerCase(),
        hook: asText(p.hook),
        estrutura: asText(p.estrutura),
        caption: asText(p.caption),
        cta: asText(p.cta),
        visual_prompt: asText(p.visual_prompt),
        slides: asSlides(p.slides),
      };
    })
    .filter(Boolean) as StrategyPlan["posts"];

  return {
    resumo: asText(o.resumo),
    dias: Number(o.dias) || posts.length || 0,
    pilares: asStringList(o.pilares),
    posts,
  };
}

function toPostViews(plan: StrategyPlan): PostView[] {
  return (plan.posts || []).map((p, idx) => ({
    day: typeof p.day === "number" ? p.day : idx + 1,
    titulo: asText(p.titulo, "Post"),
    formato: asText(p.formato, "feed").toLowerCase(),
    pilar: asText(p.pilar),
    objetivo: asText(p.objetivo),
    hook: asText(p.hook),
    estrutura: asText(p.estrutura),
    caption: asText(p.caption),
    cta: asText(p.cta),
    slides: asSlides(p.slides),
  }));
}

export function StrategyPage() {
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  function applyStrategy(row: StrategyRow | null) {
    if (!row) {
      setStrategy(null);
      return;
    }
    const plan = normalizePlan(row.plan);
    setStrategy({ ...row, plan: plan || { resumo: "", dias: 0, pilares: [], posts: [] } });
  }

  useEffect(() => {
    let cancelled = false;
    api.strategy
      .latest()
      .then((r) => {
        if (!cancelled) applyStrategy(r.strategy);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const r = await api.strategy.generate(days);
      applyStrategy(r.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setGenerating(false);
    }
  }

  const plan = strategy?.plan ?? null;
  const pilares = useMemo(() => asStringList(plan?.pilares), [plan]);
  const posts = useMemo(() => (plan ? toPostViews(plan) : []), [plan]);

  return (
    <div className="space-y-6">
      <StyleBits />
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

          {posts.length === 0 && (
            <div className="card text-white/55">
              Plano sem posts legíveis. Clique em “Gerar plano” de novo.
            </div>
          )}

          <div className="space-y-3">
            {posts.map((p, idx) => (
              <div key={`day-${p.day}-${idx}`} className="card">
                <div className="flex flex-wrap gap-2 items-baseline justify-between mb-2">
                  <h2 className="font-display text-lg font-semibold">
                    Dia {p.day} — {p.titulo}
                  </h2>
                  <span className="text-xs uppercase tracking-wide text-signal">
                    {p.formato === "carrossel"
                      ? `carrossel · ${p.slides.length || "N"} slides`
                      : p.formato === "reels"
                        ? "reels · imagem (vídeo em breve)"
                        : p.formato || "feed"}
                  </span>
                </div>
                <p className="text-sm text-white/45 mb-2">
                  {p.pilar} · {p.objetivo}
                </p>
                <p className="text-signal font-medium mb-1">Hook: {p.hook}</p>
                <p className="text-sm text-white/70 mb-2 whitespace-pre-wrap">{p.estrutura}</p>
                {p.formato === "carrossel" && p.slides.length > 0 && (
                  <ol className="text-sm text-white/55 list-decimal pl-5 space-y-1 mb-2">
                    {p.slides.map((s, i) => (
                      <li key={i}>
                        <span className="text-white/80">{s.titulo}</span>
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
    </div>
  );
}
