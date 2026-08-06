import { useEffect, useState } from "react";
import { api, Landing } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function LandingPage() {
  const [landing, setLanding] = useState<Landing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.landing
      .latest()
      .then((r) => setLanding(r.landing))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError("");
    setMsg("Gerando landing (copy + hero)… 1–2 min.");
    try {
      const r = await api.landing.generate(true);
      setLanding(r.landing);
      setMsg("Landing pronta — revise o preview e baixe o HTML.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
      setMsg("");
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!landing?.html) return;
    const blob = new Blob([landing.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `landing-${landing.meta?.brand_name || "vende247"}.html`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyHtml() {
    if (!landing?.html) return;
    try {
      await navigator.clipboard.writeText(landing.html);
      setMsg("HTML copiado.");
    } catch {
      setError("Não foi possível copiar.");
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Landing</h1>
          <p className="text-white/55 mt-1 max-w-xl">
            LP viral com glass, ícones e CTAs fortes. Use research + brand kit. Gere de novo se a anterior ficou fraca.
          </p>
        </div>
        <button type="button" className="btn-primary" disabled={generating} onClick={() => void generate()}>
          {generating ? "Gerando…" : landing ? "Gerar de novo" : "Gerar landing"}
        </button>
      </div>

      {error && <p className="text-coral text-sm">{error}</p>}
      {msg && <p className="text-signal text-sm">{msg}</p>}
      {loading && <p className="text-white/50">Carregando…</p>}

      {!loading && !landing && !generating && (
        <div className="card text-white/55">Nenhuma landing ainda. Rode research (opcional) e gere.</div>
      )}

      {landing && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={download}>
              Baixar HTML
            </button>
            <button type="button" className="btn-ghost" onClick={() => void copyHtml()}>
              Copiar HTML
            </button>
          </div>
          {landing.meta?.headline && (
            <div className="card text-sm text-white/70">
              <p className="text-signal font-medium">{landing.meta.brand_name}</p>
              <p className="mt-1 whitespace-pre-wrap">{landing.meta.headline}</p>
            </div>
          )}
          <div className="rounded-lg overflow-hidden border border-white/10 bg-ink-900" style={{ height: "70vh" }}>
            <iframe
              title="Preview landing"
              srcDoc={landing.html}
              className="w-full h-full bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
      <StyleBits />
    </div>
  );
}
