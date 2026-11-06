import { query } from "../db/index.js";

export type WorkspaceProduct = {
  id: number;
  workspace_id: number;
  nome: string;
  descricao: string;
  beneficios: string;
  preco_hint: string;
  para_quem: string;
  cta: string;
  objecoes: string;
  ativo: boolean;
  sort_order: number;
};

export type WorkspaceKnowledgeItem = {
  id: number;
  workspace_id: number;
  category: string;
  title: string;
  body: string;
  ativo: boolean;
  sort_order: number;
};

export type CompanyProfile = {
  workspace_id: number;
  marca: string;
  nicho: string;
  produto: string;
  oferta: string;
  cta: string;
  tom_voz: string;
  missao: string;
  publico_alvo: string;
  diferenciais: string;
  objecoes: string;
  prova_social: string;
  politicas: string;
};

export type CompanyBriefing = CompanyProfile & {
  products: WorkspaceProduct[];
  knowledge: WorkspaceKnowledgeItem[];
  /** Texto pronto para o system/user do agente. */
  agent_brief: string;
};

export async function getCompanyProfile(workspaceId: number): Promise<CompanyProfile | null> {
  const r = await query<{
    id: number;
    name: string;
    nicho: string | null;
    produto: string | null;
    oferta: string | null;
    cta: string | null;
    tom_voz: string | null;
    missao: string | null;
    publico_alvo: string | null;
    diferenciais: string | null;
    objecoes: string | null;
    prova_social: string | null;
    politicas: string | null;
  }>(
    `SELECT id, name, nicho, produto, oferta, cta, tom_voz,
            missao, publico_alvo, diferenciais, objecoes, prova_social, politicas
     FROM workspaces WHERE id = $1`,
    [workspaceId]
  );
  const w = r.rows[0];
  if (!w) return null;
  return {
    workspace_id: w.id,
    marca: (w.name || "").trim() || "nossa empresa",
    nicho: (w.nicho || "").trim(),
    produto: (w.produto || "").trim(),
    oferta: (w.oferta || "").trim(),
    cta: (w.cta || "").trim(),
    tom_voz: (w.tom_voz || "").trim(),
    missao: (w.missao || "").trim(),
    publico_alvo: (w.publico_alvo || "").trim(),
    diferenciais: (w.diferenciais || "").trim(),
    objecoes: (w.objecoes || "").trim(),
    prova_social: (w.prova_social || "").trim(),
    politicas: (w.politicas || "").trim(),
  };
}

export async function updateCompanyProfile(
  workspaceId: number,
  patch: Partial<{
    name: string;
    nicho: string;
    produto: string;
    oferta: string;
    cta: string;
    tom_voz: string;
    missao: string;
    publico_alvo: string;
    diferenciais: string;
    objecoes: string;
    prova_social: string;
    politicas: string;
  }>
): Promise<CompanyProfile | null> {
  await query(
    `UPDATE workspaces SET
       name = COALESCE($2, name),
       nicho = COALESCE($3, nicho),
       produto = COALESCE($4, produto),
       oferta = COALESCE($5, oferta),
       cta = COALESCE($6, cta),
       tom_voz = COALESCE($7, tom_voz),
       missao = COALESCE($8, missao),
       publico_alvo = COALESCE($9, publico_alvo),
       diferenciais = COALESCE($10, diferenciais),
       objecoes = COALESCE($11, objecoes),
       prova_social = COALESCE($12, prova_social),
       politicas = COALESCE($13, politicas),
       updated_at = NOW()
     WHERE id = $1`,
    [
      workspaceId,
      patch.name ?? null,
      patch.nicho ?? null,
      patch.produto ?? null,
      patch.oferta ?? null,
      patch.cta ?? null,
      patch.tom_voz ?? null,
      patch.missao ?? null,
      patch.publico_alvo ?? null,
      patch.diferenciais ?? null,
      patch.objecoes ?? null,
      patch.prova_social ?? null,
      patch.politicas ?? null,
    ]
  );
  return getCompanyProfile(workspaceId);
}

export async function listProducts(workspaceId: number, onlyActive = false): Promise<WorkspaceProduct[]> {
  const r = await query<WorkspaceProduct>(
    `SELECT id, workspace_id, nome, descricao, beneficios, preco_hint, para_quem, cta, objecoes, ativo, sort_order
     FROM workspace_products
     WHERE workspace_id = $1 ${onlyActive ? "AND ativo = TRUE" : ""}
     ORDER BY sort_order ASC, id ASC`,
    [workspaceId]
  );
  return r.rows;
}

export async function upsertProduct(
  workspaceId: number,
  input: Partial<WorkspaceProduct> & { id?: number }
): Promise<WorkspaceProduct> {
  if (input.id) {
    const r = await query<WorkspaceProduct>(
      `UPDATE workspace_products SET
         nome = COALESCE($3, nome),
         descricao = COALESCE($4, descricao),
         beneficios = COALESCE($5, beneficios),
         preco_hint = COALESCE($6, preco_hint),
         para_quem = COALESCE($7, para_quem),
         cta = COALESCE($8, cta),
         objecoes = COALESCE($9, objecoes),
         ativo = COALESCE($10, ativo),
         sort_order = COALESCE($11, sort_order),
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, workspace_id, nome, descricao, beneficios, preco_hint, para_quem, cta, objecoes, ativo, sort_order`,
      [
        input.id,
        workspaceId,
        input.nome ?? null,
        input.descricao ?? null,
        input.beneficios ?? null,
        input.preco_hint ?? null,
        input.para_quem ?? null,
        input.cta ?? null,
        input.objecoes ?? null,
        typeof input.ativo === "boolean" ? input.ativo : null,
        typeof input.sort_order === "number" ? input.sort_order : null,
      ]
    );
    if (!r.rows[0]) throw new Error("Produto não encontrado.");
    return r.rows[0];
  }
  const r = await query<WorkspaceProduct>(
    `INSERT INTO workspace_products (
       workspace_id, nome, descricao, beneficios, preco_hint, para_quem, cta, objecoes, ativo, sort_order
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,TRUE),COALESCE($10,0))
     RETURNING id, workspace_id, nome, descricao, beneficios, preco_hint, para_quem, cta, objecoes, ativo, sort_order`,
    [
      workspaceId,
      (input.nome || "").trim() || "Produto",
      input.descricao || "",
      input.beneficios || "",
      input.preco_hint || "",
      input.para_quem || "",
      input.cta || "",
      input.objecoes || "",
      typeof input.ativo === "boolean" ? input.ativo : true,
      typeof input.sort_order === "number" ? input.sort_order : 0,
    ]
  );
  return r.rows[0];
}

export async function deleteProduct(workspaceId: number, id: number): Promise<boolean> {
  const r = await query(`DELETE FROM workspace_products WHERE id = $1 AND workspace_id = $2`, [
    id,
    workspaceId,
  ]);
  return (r.rowCount || 0) > 0;
}

export async function listKnowledge(
  workspaceId: number,
  onlyActive = false
): Promise<WorkspaceKnowledgeItem[]> {
  const r = await query<WorkspaceKnowledgeItem>(
    `SELECT id, workspace_id, category, title, body, ativo, sort_order
     FROM workspace_knowledge
     WHERE workspace_id = $1 ${onlyActive ? "AND ativo = TRUE" : ""}
     ORDER BY sort_order ASC, id ASC`,
    [workspaceId]
  );
  return r.rows;
}

export async function upsertKnowledge(
  workspaceId: number,
  input: Partial<WorkspaceKnowledgeItem> & { id?: number }
): Promise<WorkspaceKnowledgeItem> {
  if (input.id) {
    const r = await query<WorkspaceKnowledgeItem>(
      `UPDATE workspace_knowledge SET
         category = COALESCE($3, category),
         title = COALESCE($4, title),
         body = COALESCE($5, body),
         ativo = COALESCE($6, ativo),
         sort_order = COALESCE($7, sort_order),
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2
       RETURNING id, workspace_id, category, title, body, ativo, sort_order`,
      [
        input.id,
        workspaceId,
        input.category ?? null,
        input.title ?? null,
        input.body ?? null,
        typeof input.ativo === "boolean" ? input.ativo : null,
        typeof input.sort_order === "number" ? input.sort_order : null,
      ]
    );
    if (!r.rows[0]) throw new Error("Item não encontrado.");
    return r.rows[0];
  }
  const r = await query<WorkspaceKnowledgeItem>(
    `INSERT INTO workspace_knowledge (workspace_id, category, title, body, ativo, sort_order)
     VALUES ($1,$2,$3,$4,COALESCE($5,TRUE),COALESCE($6,0))
     RETURNING id, workspace_id, category, title, body, ativo, sort_order`,
    [
      workspaceId,
      (input.category || "geral").trim() || "geral",
      (input.title || "").trim() || "Nota",
      input.body || "",
      typeof input.ativo === "boolean" ? input.ativo : true,
      typeof input.sort_order === "number" ? input.sort_order : 0,
    ]
  );
  return r.rows[0];
}

export async function deleteKnowledge(workspaceId: number, id: number): Promise<boolean> {
  const r = await query(`DELETE FROM workspace_knowledge WHERE id = $1 AND workspace_id = $2`, [
    id,
    workspaceId,
  ]);
  return (r.rowCount || 0) > 0;
}

export function renderAgentBrief(
  profile: CompanyProfile,
  products: WorkspaceProduct[],
  knowledge: WorkspaceKnowledgeItem[]
): string {
  const lines: string[] = [
    "=== BASE DA EMPRESA (use sempre; perfil pode não ter posts) ===",
    `Marca: ${profile.marca}`,
  ];
  if (profile.nicho) lines.push(`Nicho: ${profile.nicho}`);
  if (profile.missao) lines.push(`Missão: ${profile.missao}`);
  if (profile.publico_alvo) lines.push(`Público: ${profile.publico_alvo}`);
  if (profile.diferenciais) lines.push(`Diferenciais: ${profile.diferenciais}`);
  if (profile.produto) lines.push(`Produto-resumo: ${profile.produto}`);
  if (profile.oferta) lines.push(`Oferta atual: ${profile.oferta}`);
  if (profile.cta) lines.push(`CTA preferido: ${profile.cta}`);
  if (profile.tom_voz) lines.push(`Tom de voz: ${profile.tom_voz}`);
  if (profile.objecoes) lines.push(`Objeções comuns e como tratar: ${profile.objecoes}`);
  if (profile.prova_social) lines.push(`Prova social: ${profile.prova_social}`);
  if (profile.politicas) lines.push(`Políticas (preço/prazo/garantia): ${profile.politicas}`);

  const activeProducts = products.filter((p) => p.ativo);
  if (activeProducts.length) {
    lines.push("", "=== CARTA DE PRODUTOS ===");
    activeProducts.forEach((p, i) => {
      lines.push(
        `${i + 1}. ${p.nome}` +
          (p.descricao ? ` — ${p.descricao}` : "") +
          (p.beneficios ? ` | Benefícios: ${p.beneficios}` : "") +
          (p.para_quem ? ` | Para quem: ${p.para_quem}` : "") +
          (p.preco_hint ? ` | Preço/condição: ${p.preco_hint}` : "") +
          (p.cta ? ` | CTA: ${p.cta}` : "") +
          (p.objecoes ? ` | Objeções: ${p.objecoes}` : "")
      );
    });
  } else if (profile.produto || profile.oferta) {
    lines.push(
      "",
      "=== CARTA DE PRODUTOS (derivada do resumo) ===",
      `1. ${profile.produto || profile.marca}${profile.oferta ? ` — ${profile.oferta}` : ""}`
    );
  }

  const activeKb = knowledge.filter((k) => k.ativo && (k.title || k.body));
  if (activeKb.length) {
    lines.push("", "=== CONHECIMENTO / FAQ ===");
    for (const k of activeKb.slice(0, 20)) {
      lines.push(`[${k.category}] ${k.title}: ${k.body}`.slice(0, 500));
    }
  }

  lines.push(
    "",
    "REGRAS DE USO DA BASE:",
    "- Sem post no feed: ainda assim apresente missão, produtos e valor — sem inventar o que não está aqui.",
    "- Prefira fatos desta base a genéricos. Se faltar preço/prazo, diga que confirma e pergunte WhatsApp/canal.",
    "- Alinhe cada resposta à missão e ao público."
  );
  return lines.join("\n");
}

export async function loadCompanyBriefing(workspaceId: number): Promise<CompanyBriefing | null> {
  const profile = await getCompanyProfile(workspaceId);
  if (!profile) return null;
  const [products, knowledge] = await Promise.all([
    listProducts(workspaceId, true),
    listKnowledge(workspaceId, true),
  ]);
  return {
    ...profile,
    products,
    knowledge,
    agent_brief: renderAgentBrief(profile, products, knowledge),
  };
}

export type CompanyFacts = {
  marca: string;
  missao: string;
  publico: string;
  diferenciais: string;
  objecoes: string;
  prova: string;
  politicas: string;
  produtos: Array<{
    nome: string;
    descricao: string;
    beneficios: string;
    para_quem: string;
    preco: string;
    cta: string;
    objecoes: string;
  }>;
  faq: Array<{ titulo: string; resposta: string }>;
};

/** Recorte da Empresa para research, estratégia, criativos e landing. */
export function toCompanyFacts(b: CompanyBriefing | null): CompanyFacts | null {
  if (!b) return null;
  const produtos = b.products
    .filter((p) => p.ativo && (p.nome || p.descricao))
    .slice(0, 6)
    .map((p) => ({
      nome: p.nome,
      descricao: p.descricao,
      beneficios: p.beneficios,
      para_quem: p.para_quem,
      preco: p.preco_hint,
      cta: p.cta,
      objecoes: p.objecoes,
    }));
  const faq = b.knowledge
    .filter((k) => k.ativo && (k.title || k.body))
    .slice(0, 8)
    .map((k) => ({ titulo: k.title, resposta: k.body }));
  const has =
    b.missao ||
    b.publico_alvo ||
    b.diferenciais ||
    b.objecoes ||
    b.prova_social ||
    produtos.length ||
    faq.length;
  if (!has) return null;
  return {
    marca: b.marca,
    missao: b.missao,
    publico: b.publico_alvo,
    diferenciais: b.diferenciais,
    objecoes: b.objecoes,
    prova: b.prova_social,
    politicas: b.politicas,
    produtos,
    faq,
  };
}

export function companyFactsLine(f: CompanyFacts | null): string {
  if (!f) return "";
  const p = f.produtos[0];
  return [f.marca, f.missao, p ? `${p.nome}: ${p.descricao}` : "", f.diferenciais]
    .filter(Boolean)
    .join(". ")
    .slice(0, 480);
}

export async function loadCompanyBriefingForOwner(ownerUserId: number): Promise<CompanyBriefing | null> {
  const r = await query<{ id: number }>(
    `SELECT id FROM workspaces WHERE owner_user_id = $1 ORDER BY id ASC LIMIT 1`,
    [ownerUserId]
  );
  const id = r.rows[0]?.id;
  if (!id) return null;
  return loadCompanyBriefing(id);
}
