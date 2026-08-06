import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, Workspace } from "../api/client";
import { BRAND } from "../config/brand";
import { StyleBits } from "./OnboardingPage";

export function HomePage() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth
      .me()
      .then((m) => setWs(m.workspace))
      .catch(() => setWs(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-white/50">Carregando…</p>;
  if (ws && !ws.onboarding_done) return <Navigate to="/onboarding" replace />;

  return (
    <div className="animate-rise space-y-8">
      <div>
        <p className="text-signal text-sm font-medium mb-1">{BRAND.name}</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
          Research → Estratégia → Criativos
        </h1>
        <p className="text-white/55 mt-2 max-w-xl">
          {ws?.nicho ? (
            <>
              Nicho: <span className="text-white">{ws.nicho}</span> · Produto:{" "}
              <span className="text-white">{ws.produto}</span>
            </>
          ) : (
            BRAND.description
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StepCard n="1" title="Research" to="/research" desc="Concorrentes + ads → padrões" />
        <StepCard n="2" title="Estratégia" to="/estrategia" desc="Plano 7–14 dias com briefs" />
        <StepCard n="3" title="Criativos" to="/criativos" desc="Lote viral → aprovar → postar" />
      </div>

      {ws && (
        <div className="card text-sm text-white/60">
          <p>
            Concorrentes:{" "}
            {(ws.concorrentes || []).map((c) => `@${c}`).join(", ") || "—"}
          </p>
          <p className="mt-1">
            Instagram: {ws.ig_username ? `@${ws.ig_username}` : "não conectado"}{" "}
            {ws.has_ig_token ? "· token ok" : "· sem token (só gera, não publica)"}
          </p>
          <Link to="/config" className="inline-block mt-3 text-signal text-sm">
            Editar config →
          </Link>
        </div>
      )}
      <StyleBits />
    </div>
  );
}

function StepCard({ n, title, to, desc }: { n: string; title: string; to: string; desc: string }) {
  return (
    <Link to={to} className="card block hover:border-signal/40 transition group">
      <span className="text-signal font-display text-2xl font-bold">{n}</span>
      <h2 className="font-display text-xl font-semibold mt-1 group-hover:text-signal">{title}</h2>
      <p className="text-sm text-white/50 mt-1">{desc}</p>
    </Link>
  );
}
