import { useEffect, useState } from "react";
// CreativeCard also uses useEffect
import { api, Creative } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function CreativesPage() {
  const [items, setItems] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [batching, setBatching] = useState(false);
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

  async function batch() {
    setBatching(true);
    setError("");
    setMsg("");
    try {
      const r = await api.creatives.batch();
      setItems(r.creatives);
      if (r.errors?.length) {
        setMsg(`${r.creatives.length} criados; ${r.errors.length} com erro de imagem.`);
      } else {
        setMsg(`${r.creatives.length} criativos gerados.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no lote");
    } finally {
      setBatching(false);
    }
  }

  async function regen(id: number) {
    setBusyId(id);
    setError("");
    try {
      await api.creatives.regenerate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusyId(null);
    }
  }

  async function publish(id: number) {
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

  async function saveCaption(id: number, caption: string) {
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
          <p className="text-white/55 mt-1">Lote a partir da estratégia — aprovar, regenerar ou publicar.</p>
        </div>
        <button type="button" className="btn-primary" disabled={batching} onClick={() => void batch()}>
          {batching ? "Gerando lote… (imagens)" : "Gerar lote"}
        </button>
      </div>

      {error && <p className="text-coral text-sm">{error}</p>}
      {msg && <p className="text-signal text-sm">{msg}</p>}
      {loading && <p className="text-white/50">Carregando…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((c) => (
          <CreativeCard
            key={c.id}
            c={c}
            busy={busyId === c.id}
            onRegen={() => void regen(c.id)}
            onPublish={() => void publish(c.id)}
            onSchedule={() => void schedule(c.id)}
            onSaveCaption={(cap) => void saveCaption(c.id, cap)}
          />
        ))}
      </div>

      {!loading && items.length === 0 && (
        <div className="card text-white/55">Nenhum criativo. Gere a estratégia e depois o lote.</div>
      )}
      <StyleBits />
    </div>
  );
}

function CreativeCard({
  c,
  busy,
  onRegen,
  onPublish,
  onSchedule,
  onSaveCaption,
}: {
  c: Creative;
  busy: boolean;
  onRegen: () => void;
  onPublish: () => void;
  onSchedule: () => void;
  onSaveCaption: (caption: string) => void;
}) {
  const [caption, setCaption] = useState(c.caption);
  useEffect(() => setCaption(c.caption), [c.caption]);

  return (
    <article className="card overflow-hidden p-0">
      {c.media_url ? (
        <img src={c.media_url} alt={c.hook} className="w-full aspect-[4/5] object-cover bg-ink-800" />
      ) : (
        <div className="w-full aspect-[4/5] bg-ink-800 flex items-center justify-center text-white/40 text-sm px-4 text-center">
          {c.error || "Sem mídia"}
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex justify-between gap-2 text-xs text-white/45">
          <span>
            Dia {c.day_index} · {c.format}
          </span>
          <span className="text-signal uppercase">{c.status}</span>
        </div>
        <p className="font-medium text-signal text-sm">{c.hook}</p>
        <textarea
          className="field text-sm min-h-[80px]"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-ghost" disabled={busy || caption === c.caption} onClick={() => onSaveCaption(caption)}>
            Salvar caption
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={onRegen}>
            Regenerar
          </button>
          <button type="button" className="btn-ghost" disabled={busy || !c.media_url} onClick={onPublish}>
            Publicar
          </button>
          <button type="button" className="btn-ghost" disabled={busy || !c.media_url} onClick={onSchedule}>
            Agendar
          </button>
        </div>
      </div>
    </article>
  );
}
