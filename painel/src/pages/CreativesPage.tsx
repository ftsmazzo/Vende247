import { useEffect, useState } from "react";
import { api, Creative } from "../api/client";
import { StyleBits } from "./OnboardingPage";

function formatBadge(format: string, slideCount: number): string {
  if (format === "carrossel") {
    return slideCount > 1 ? `carrossel · ${slideCount} slides` : "carrossel";
  }
  if (format === "reels") return "reels · imagem (vídeo em breve)";
  return format || "feed";
}

export function CreativesPage() {
  const [items, setItems] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [batching, setBatching] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState<
    Array<{ model: string; url?: string; error?: string; ms: number }>
  >([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await api.creatives.list();
      setItems(r.creatives);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const locked = batching || clearing || comparing || busyId !== null;

  async function batch() {
    if (locked) return;
    setBatching(true);
    setError("");
    setMsg("Gerando lote (carrosséis = várias imagens)… pode levar vários minutos.");
    try {
      const r = await api.creatives.batch();
      if (r.errors?.length) {
        setMsg(`${r.creatives.length} criados; ${r.errors.length} com erro de imagem.`);
      } else {
        setMsg(`${r.creatives.length} criativos gerados. Revise um a um.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no lote");
      setMsg("");
    } finally {
      setBatching(false);
    }
  }

  async function clearLote() {
    if (locked) return;
    if (!window.confirm("Apagar todos os criativos deste lote (exceto publicados/agendados)?")) return;
    setClearing(true);
    setError("");
    setMsg("");
    try {
      const r = await api.creatives.clear();
      setMsg(`${r.deleted} criativo(s) removido(s).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao limpar");
    } finally {
      setClearing(false);
    }
  }

  async function regen(id: number) {
    if (locked) return;
    setBusyId(id);
    setError("");
    setMsg(`Regenerando criativo #${id}… aguarde.`);
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "generating", error: null } : c))
    );
    try {
      await api.creatives.regenerate(id);
      setMsg(`Criativo #${id} atualizado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
      setMsg("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function regenSlide(id: number, slideIndex: number) {
    if (locked) return;
    setBusyId(id);
    setError("");
    setMsg(`Regenerando slide ${slideIndex + 1}…`);
    try {
      await api.creatives.regenerateSlide(id, slideIndex);
      setMsg(`Slide ${slideIndex + 1} atualizado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
      setMsg("");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(id: number) {
    if (locked) return;
    setBusyId(id);
    setError("");
    try {
      await api.creatives.publish(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar");
    } finally {
      setBusyId(null);
    }
  }

  async function schedule(id: number) {
    if (locked) return;
    const raw = window.prompt("Agendar para (ISO local ou YYYY-MM-DDTHH:mm)", "");
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      setError("Data inválida");
      return;
    }
    setBusyId(id);
    try {
      await api.creatives.schedule(id, d.toISOString());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusyId(null);
    }
  }

  async function compareModels() {
    if (locked) return;
    setComparing(true);
    setError("");
    setMsg("Testando 4 modelos OpenRouter (~$0,15 no total)…");
    setCompareResults([]);
    try {
      const r = await api.creatives.compareModels();
      setCompareResults(r.results);
      const ok = r.results.filter((x) => x.url).length;
      setMsg(`${ok}/${r.results.length} gerados. Escolha o melhor e configure no EasyPanel. ${r.hint}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no compare");
      setMsg("");
    } finally {
      setComparing(false);
    }
  }

  async function saveCaption(id: number, caption: string) {
    if (locked) return;
    setBusyId(id);
    try {
      await api.creatives.patch(id, { caption });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Criativos</h1>
          <p className="text-white/55 mt-1">
            Carrossel gera vários slides e publica como carrossel no IG. Reels ainda é imagem.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled={locked} onClick={() => void compareModels()}>
            {comparing ? "Testando modelos…" : "Testar modelos (custo)"}
          </button>
          <button type="button" className="btn-ghost" disabled={locked || items.length === 0} onClick={() => void clearLote()}>
            {clearing ? "Limpando…" : "Limpar lote"}
          </button>
          <button type="button" className="btn-primary" disabled={locked} onClick={() => void batch()}>
            {batching ? "Gerando lote… aguarde" : "Gerar lote novo"}
          </button>
        </div>
      </div>

      {compareResults.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-display text-lg font-semibold">A/B modelos OpenRouter</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {compareResults.map((r) => (
              <div key={r.model} className="space-y-2">
                <p className="text-xs text-white/50 break-all">{r.model}</p>
                <p className="text-[11px] text-white/35">{(r.ms / 1000).toFixed(1)}s</p>
                {r.url ? (
                  <img src={r.url} alt={r.model} className="w-full rounded-lg aspect-[4/5] object-cover" />
                ) : (
                  <p className="text-coral text-xs">{r.error || "erro"}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-coral text-sm">{error}</p>}
      {msg && <p className="text-signal text-sm">{msg}</p>}
      {loading && <p className="text-white/50">Carregando…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((c) => (
          <CreativeCard
            key={c.id}
            c={c}
            busy={busyId === c.id}
            locked={locked}
            onRegen={() => void regen(c.id)}
            onRegenSlide={(i) => void regenSlide(c.id, i)}
            onPublish={() => void publish(c.id)}
            onSchedule={() => void schedule(c.id)}
            onSaveCaption={(cap) => void saveCaption(c.id, cap)}
          />
        ))}
      </div>

      {!loading && items.length === 0 && (
        <div className="card text-white/55">Nenhum criativo. Clique em “Gerar lote novo”.</div>
      )}
      <StyleBits />
    </div>
  );
}

function CreativeCard({
  c,
  busy,
  locked,
  onRegen,
  onRegenSlide,
  onPublish,
  onSchedule,
  onSaveCaption,
}: {
  c: Creative;
  busy: boolean;
  locked: boolean;
  onRegen: () => void;
  onRegenSlide: (index: number) => void;
  onPublish: () => void;
  onSchedule: () => void;
  onSaveCaption: (caption: string) => void;
}) {
  const [caption, setCaption] = useState(c.caption);
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => setCaption(c.caption), [c.caption]);
  useEffect(() => setSlideIdx(0), [c.id, c.media_url]);

  const generating = busy || c.status === "generating";
  const slides = (c.media_urls?.length ? c.media_urls : c.media_url ? [c.media_url] : []).filter(Boolean);
  const active = slides[slideIdx] || c.media_url;
  const isCarousel = c.format === "carrossel" && slides.length > 1;

  return (
    <article className="card overflow-hidden p-0">
      {generating ? (
        <div className="w-full aspect-[4/5] bg-ink-800 flex items-center justify-center text-signal text-sm px-4 text-center">
          Gerando imagem… aguarde (não clique de novo)
        </div>
      ) : active ? (
        <div className="relative">
          <img src={active} alt={c.hook} className="w-full aspect-[4/5] object-cover bg-ink-800" />
          {isCarousel && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 px-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`h-2 w-2 rounded-full ${i === slideIdx ? "bg-signal" : "bg-white/40"}`}
                  onClick={() => setSlideIdx(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-[4/5] bg-ink-800 flex items-center justify-center text-white/40 text-sm px-4 text-center">
          {c.error || "Sem mídia"}
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex justify-between gap-2 text-xs text-white/45">
          <span>Dia {c.day_index} · {formatBadge(c.format, slides.length)}</span>
          <span className="text-signal uppercase">{generating ? "generating" : c.status}</span>
        </div>
        {c.format === "reels" && (
          <p className="text-[11px] text-white/40">Reels: capa estática. Vídeo ~8s ainda não disponível.</p>
        )}
        {isCarousel && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                className={`shrink-0 w-14 h-14 rounded overflow-hidden border ${i === slideIdx ? "border-signal" : "border-white/15"}`}
                onClick={() => setSlideIdx(i)}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <p className="font-medium text-signal text-sm">{c.hook}</p>
        <textarea
          className="field text-sm min-h-[80px]"
          value={caption}
          disabled={locked}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="btn-ghost"
            disabled={locked || caption === c.caption}
            onClick={() => onSaveCaption(caption)}
          >
            Salvar caption
          </button>
          <button type="button" className="btn-ghost" disabled={locked} onClick={onRegen}>
            {busy ? "Regenerando…" : isCarousel ? "Regenerar todos" : "Regenerar"}
          </button>
          {isCarousel && (
            <button type="button" className="btn-ghost" disabled={locked} onClick={() => onRegenSlide(slideIdx)}>
              Regenerar slide {slideIdx + 1}
            </button>
          )}
          <button type="button" className="btn-ghost" disabled={locked || !c.media_url} onClick={onPublish}>
            {isCarousel ? "Publicar carrossel" : "Publicar"}
          </button>
          <button type="button" className="btn-ghost" disabled={locked || !c.media_url} onClick={onSchedule}>
            Agendar
          </button>
        </div>
      </div>
    </article>
  );
}
