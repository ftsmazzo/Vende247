import { useEffect, useState } from "react";
import { api, Creative } from "../api/client";
import { StyleBits } from "./OnboardingPage";

export function CreativesPage() {
  const [items, setItems] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [batching, setBatching] = useState(false);
  const [clearing, setClearing] = useState(false);
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

  const locked = batching || clearing || busyId !== null;

  async function batch() {
    if (locked) return;
    setBatching(true);
    setError("");
    setMsg("Gerando lote com Gemini… isso pode levar 1–3 min. Não clique de novo.");
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
            Um lote por vez. Regenerar espera a imagem — não clique várias vezes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled={locked || items.length === 0} onClick={() => void clearLote()}>
            {clearing ? "Limpando…" : "Limpar lote"}
          </button>
          <button type="button" className="btn-primary" disabled={locked} onClick={() => void batch()}>
            {batching ? "Gerando lote… aguarde" : "Gerar lote novo"}
          </button>
        </div>
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
            locked={locked}
            onRegen={() => void regen(c.id)}
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
  onPublish,
  onSchedule,
  onSaveCaption,
}: {
  c: Creative;
  busy: boolean;
  locked: boolean;
  onRegen: () => void;
  onPublish: () => void;
  onSchedule: () => void;
  onSaveCaption: (caption: string) => void;
}) {
  const [caption, setCaption] = useState(c.caption);
  useEffect(() => setCaption(c.caption), [c.caption]);

  const generating = busy || c.status === "generating";

  return (
    <article className="card overflow-hidden p-0">
      {generating ? (
        <div className="w-full aspect-[4/5] bg-ink-800 flex items-center justify-center text-signal text-sm px-4 text-center">
          Gerando imagem… aguarde (não clique de novo)
        </div>
      ) : c.media_url ? (
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
          <span className="text-signal uppercase">{generating ? "generating" : c.status}</span>
        </div>
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
            {busy ? "Regenerando…" : "Regenerar"}
          </button>
          <button type="button" className="btn-ghost" disabled={locked || !c.media_url} onClick={onPublish}>
            Publicar
          </button>
          <button type="button" className="btn-ghost" disabled={locked || !c.media_url} onClick={onSchedule}>
            Agendar
          </button>
        </div>
      </div>
    </article>
  );
}
