import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CompanyProfile, KnowledgeItem, ProductCard } from "../api/client";

const emptyProfile: CompanyProfile = {
  workspace_id: 0,
  marca: "",
  nicho: "",
  produto: "",
  oferta: "",
  cta: "",
  tom_voz: "",
  missao: "",
  publico_alvo: "",
  diferenciais: "",
  objecoes: "",
  prova_social: "",
  politicas: "",
};

export function KnowledgePage() {
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [productForm, setProductForm] = useState({
    nome: "",
    descricao: "",
    beneficios: "",
    preco_hint: "",
    para_quem: "",
    cta: "",
    objecoes: "",
  });
  const [kbForm, setKbForm] = useState({ category: "faq", title: "", body: "" });

  async function reload() {
    const data = await api.knowledge.get();
    setProfile({
      ...emptyProfile,
      ...data.profile,
      marca: data.profile?.marca || "",
    });
    setProducts(data.products || []);
    setKnowledge(data.knowledge || []);
    setPreview(data.agent_brief_preview || "");
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  async function saveProfile() {
    setError("");
    setMsg("");
    try {
      await api.knowledge.updateProfile({
        name: profile.marca,
        nicho: profile.nicho,
        produto: profile.produto,
        oferta: profile.oferta,
        cta: profile.cta,
        tom_voz: profile.tom_voz,
        missao: profile.missao,
        publico_alvo: profile.publico_alvo,
        diferenciais: profile.diferenciais,
        objecoes: profile.objecoes,
        prova_social: profile.prova_social,
        politicas: profile.politicas,
      });
      setMsg("Empresa salva. O agente já usa isso mesmo sem posts no feed.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function addProduct() {
    if (!productForm.nome.trim()) return;
    await api.knowledge.createProduct(productForm);
    setProductForm({
      nome: "",
      descricao: "",
      beneficios: "",
      preco_hint: "",
      para_quem: "",
      cta: "",
      objecoes: "",
    });
    await reload();
  }

  async function addKb() {
    if (!kbForm.title.trim() && !kbForm.body.trim()) return;
    await api.knowledge.createItem(kbForm);
    setKbForm({ category: "faq", title: "", body: "" });
    await reload();
  }

  return (
    <div className="animate-rise max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Empresa & conhecimento</h1>
        <p className="text-white/55 mt-1">
          Missão, carta de produtos e FAQ que o agente SDR usa — funciona com perfil zerado ou cliente
          novo. Memória de Direct fica no Postgres.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
        Depois de preencher, ligue o agente em{" "}
        <Link className="text-signal underline" to="/agentes">
          Agentes
        </Link>
        . Sem posts? Sem problema — a base abaixo é a fonte.
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">Identidade & missão</h2>
        {(
          [
            ["marca", "Nome da marca", "input"],
            ["nicho", "Nicho", "input"],
            ["missao", "Missão", "textarea"],
            ["publico_alvo", "Público-alvo", "textarea"],
            ["diferenciais", "Diferenciais", "textarea"],
            ["produto", "Produto-resumo", "input"],
            ["oferta", "Oferta atual", "input"],
            ["cta", "CTA preferido", "input"],
            ["tom_voz", "Tom de voz", "input"],
            ["objecoes", "Objeções comuns (e como responder)", "textarea"],
            ["prova_social", "Prova social", "textarea"],
            ["politicas", "Políticas (preço, prazo, garantia)", "textarea"],
          ] as const
        ).map(([key, label, kind]) => (
          <label key={key} className="block">
            <span className="label">{label}</span>
            {kind === "textarea" ? (
              <textarea
                className="field min-h-[72px]"
                value={profile[key] || ""}
                onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
              />
            ) : (
              <input
                className="field"
                value={profile[key] || ""}
                onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        {error && <p className="text-coral text-sm">{error}</p>}
        {msg && <p className="text-signal text-sm">{msg}</p>}
        <button type="button" className="btn-primary" onClick={saveProfile}>
          Salvar empresa
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">Carta de produtos</h2>
        <p className="text-xs text-white/45">Cada item vira material concreto para o Direct.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["nome", "Nome"],
              ["descricao", "Descrição"],
              ["beneficios", "Benefícios"],
              ["para_quem", "Para quem"],
              ["preco_hint", "Preço / condição"],
              ["cta", "CTA do produto"],
              ["objecoes", "Objeções"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block sm:col-span-1">
              <span className="label">{label}</span>
              <input
                className="field"
                value={productForm[key]}
                onChange={(e) => setProductForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <button type="button" className="btn-secondary" onClick={addProduct}>
          Adicionar produto
        </button>
        <ul className="space-y-2 text-sm">
          {products.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 border-b border-white/10 py-2">
              <div>
                <p className="text-white font-medium">{p.nome}</p>
                <p className="text-white/50 text-xs">{p.descricao}</p>
              </div>
              <button
                type="button"
                className="text-coral text-xs"
                onClick={() => api.knowledge.deleteProduct(p.id).then(reload)}
              >
                Excluir
              </button>
            </li>
          ))}
          {products.length === 0 && (
            <li className="text-white/40 text-xs">Nenhum produto ainda — use o resumo ou adicione itens.</li>
          )}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">Base de conhecimento / FAQ</h2>
        <label className="block">
          <span className="label">Categoria</span>
          <select
            className="field"
            value={kbForm.category}
            onChange={(e) => setKbForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="faq">FAQ</option>
            <option value="processo">Processo</option>
            <option value="politica">Política</option>
            <option value="geral">Geral</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Título</span>
          <input
            className="field"
            value={kbForm.title}
            onChange={(e) => setKbForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="label">Conteúdo</span>
          <textarea
            className="field min-h-[80px]"
            value={kbForm.body}
            onChange={(e) => setKbForm((f) => ({ ...f, body: e.target.value }))}
          />
        </label>
        <button type="button" className="btn-secondary" onClick={addKb}>
          Adicionar nota
        </button>
        <ul className="space-y-2 text-sm">
          {knowledge.map((k) => (
            <li key={k.id} className="flex justify-between gap-2 border-b border-white/10 py-2">
              <div>
                <p className="text-white/80">
                  <span className="text-xs text-white/40">[{k.category}]</span> {k.title}
                </p>
                <p className="text-white/45 text-xs">{k.body}</p>
              </div>
              <button
                type="button"
                className="text-coral text-xs"
                onClick={() => api.knowledge.deleteItem(k.id).then(reload)}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      </section>

      {preview && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Preview que o agente recebe</h2>
          <pre className="text-xs text-white/55 whitespace-pre-wrap max-h-64 overflow-auto">{preview}</pre>
        </section>
      )}
    </div>
  );
}
