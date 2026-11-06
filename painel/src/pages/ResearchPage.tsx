import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ResearchReport, ResearchRun } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function ResearchPage() {
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await api.research.latest();
      setRun(r.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runResearch() {
    setRunning(true);
    setError("");
    try {
      const r = await api.research.run();
      setRun(r.run as ResearchRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no research");
    } finally {
      setRunning(false);
    }
  }

  const report = run?.report as ResearchReport | undefined;

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Research</h1>
          <p className="text-white/55 mt-1 max-w-xl">
            Diagnóstico, posicionamento e funil desta campanha, com a base da Empresa. A skill roda aqui
            no servidor quando você clica em rodar.
          </p>
        </div>
        <button type="button" className="btn-primary" disabled={running} onClick={() => void runResearch()}>
          {running ? "Analisando… (pode levar 1–2 min)" : "Rodar research"}
        </button>
      </div>

      {error && <p className="text-coral text-sm">{error}</p>}
      {loading && <p className="text-white/50">Carregando…</p>}

      {!loading && !report && !running && (
        <div className="card text-white/55">Nenhum research ainda. Rode a primeira análise.</div>
      )}

      {report && (
        <div className="space-y-4">
          {report.fontes?.modo_degradado && (
            <div className="card border-coral/30 text-sm text-white/70">
              Modo degradado: Apify sem dados (verifique <code className="text-signal">APIFY_TOKEN</code>).
              A IA ainda gerou padrões com base no nicho e melhores práticas.
            </div>
          )}
          <div className="card">
            <h2 className="font-display text-lg font-semibold mb-2">Resumo</h2>
            <p className="text-white/75 whitespace-pre-wrap">{report.resumo}</p>
          </div>
          {report.diagnostico?.maior_impacto && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold mb-2">Maior impacto em 7 dias</h2>
              <p className="text-white/80">{report.diagnostico.maior_impacto}</p>
            </div>
          )}
          <ListCard title="Crítico" items={report.diagnostico?.critico} />
          <ListCard title="Alto impacto" items={report.diagnostico?.alto_impacto} />
          <ListCard title="3 mudanças primeiro" items={report.diagnostico?.tres_mudancas_7_dias} />
          <ListCard title="Otimização" items={report.diagnostico?.otimizacao} />
          <ListCard title="Ignorar por enquanto" items={report.diagnostico?.ignorar} />
          {report.posicionamento?.frase && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold mb-2">Posicionamento</h2>
              <p className="text-white/85">{report.posicionamento.frase}</p>
              {report.posicionamento.promessa && (
                <p className="text-white/60 mt-2">{report.posicionamento.promessa}</p>
              )}
              {report.posicionamento.bio && (
                <p className="text-sm text-white/70 whitespace-pre-wrap mt-3">{report.posicionamento.bio}</p>
              )}
            </div>
          )}
          <ListCard title="Mensagens saturadas" items={report.posicionamento?.mensagens_saturadas} />
          <ListCard title="Posts fixados" items={report.posicionamento?.posts_fixados} />
          <ListCard title="Funil" items={report.funil?.etapas} />
          <ListCard title="CTAs de Direct" items={report.funil?.ctas_direct} />
          <ListCard title="Perguntas de qualificação" items={report.funil?.perguntas_qualificacao} />
          <ListCard title="O que concorrentes fazem bem" items={report.o_que_concorrentes_fazem_bem} />
          <ListCard title="Oportunidades únicas (seu ângulo)" items={report.oportunidades_unicas} />
          <ListCard title="Direção visual (cenas)" items={report.direcao_visual} />
          <ListCard title="Formatos que performam" items={report.formatos_que_performam} />
          <ListCard title="Hooks vencedores" items={report.hooks_vencedores} />
          <ListCard title="CTAs comuns" items={report.ctas_comuns} />
          <ListCard title="Pilares de conteúdo" items={report.pilares_conteudo} />
          <ListCard title="Gaps do seu perfil" items={report.gaps_do_seu_perfil} />
          <ListCard title="Insights de ads" items={report.insights_ads} />
          {report.padrao_perfil_engajador && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold mb-2">Padrão de perfil engajador</h2>
              <p className="text-sm text-white/50 mb-1">Bio sugerida</p>
              <p className="text-white/80 mb-3">{report.padrao_perfil_engajador.bio_sugerida}</p>
              <p className="text-sm text-white/50 mb-1">Destaques</p>
              <ul className="list-disc list-inside text-white/75 mb-3">
                {(report.padrao_perfil_engajador.destaques || []).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p className="text-sm text-white/60">
                Ritmo: {report.padrao_perfil_engajador.ritmo_posts_semana} posts/semana · Mix feed/
                {report.padrao_perfil_engajador.mix_formatos?.feed}% · carrossel{" "}
                {report.padrao_perfil_engajador.mix_formatos?.carrossel}% · reels{" "}
                {report.padrao_perfil_engajador.mix_formatos?.reels}%
              </p>
            </div>
          )}
          <Link to="/estrategia" className="btn-primary inline-block">
            Gerar estratégia →
          </Link>
        </div>
      )}
      <StyleBits />
    </div>
  );
}

function ListCard({ title, items }: { title: string; items?: unknown[] }) {
  if (!Array.isArray(items) || !items.length) return null;
  const lines = items.map((item, i) => {
    if (typeof item === "string") return item;
    if (item == null) return "";
    if (typeof item === "object") {
      try {
        return JSON.stringify(item);
      } catch {
        return `item-${i}`;
      }
    }
    return String(item);
  }).filter(Boolean);
  if (!lines.length) return null;
  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold mb-2">{title}</h2>
      <ul className="space-y-1.5">
        {lines.map((item, i) => (
          <li key={`${i}-${item.slice(0, 40)}`} className="text-white/75 text-sm flex gap-2">
            <span className="text-signal shrink-0">▸</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
