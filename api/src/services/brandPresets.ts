import type { BrandKit } from "./brandFromUrl.js";

/** Briefing + identidade visual sem precisar de site (MVP digital). */
export type ProductPreset = {
  id: string;
  label: string;
  nicho: string;
  produto: string;
  oferta: string;
  cta: string;
  tom_voz: string;
  concorrentes: string[];
  brand_kit: BrandKit;
};

/** Identidade inicial — Planner Mulher Cristã (sem logo ainda). */
export const PLANNER_MULHER_PRESET: ProductPreset = {
  id: "planner-mulher",
  label: "Planner Mulher Cristã",
  nicho: "conteúdo cristão para mulheres — organização, fé e rotina diária",
  produto:
    "Planner Mulher Cristã digital (PDF mensal) — oração, gratidão, leitura bíblica, tarefas e reflexão",
  oferta:
    "Planner completo do mês + páginas de oração, gratidão e estudo bíblico — acesso imediato após a compra (PDF)",
  cta: "Quero o planner no Direct",
  tom_voz: "acolhedor, inspirador, feminino, caloroso — sem piegas nem linguagem de igreja formal",
  concorrentes: [
    "belafebiblia",
    "viviandoliveira",
    "saratorres",
    "anatamanhooficial",
    "aminhabibliaelinda",
  ],
  brand_kit: {
    colors: ["#C4A484", "#8B5E4B", "#F7F1EA", "#5C4033", "#E8D5C4"],
    visual_summary:
      "Estética soft editorial feminina: bege areia, terracotta suave, off-white e marrom café. Mood calmo, luminoso, acolhedor — café da manhã, Bíblia aberta, planner manuscrito, luz natural de janela. Tipografia clean sans com toque serif em títulos. Sem visual industrial, sem neon, sem estética tech B2B.",
    product_ui_notes:
      "Cenas: mulher em quiet time com planner e caneca; close de páginas com versículo; mesa com flores secas e Bíblia; rotina matinal acolhedora; gratidão escrita à mão. Evitar mockup de celular e dashboards.",
    source: "preset",
    extracted_at: new Date().toISOString(),
  },
};

const PRESETS: Record<string, ProductPreset> = {
  [PLANNER_MULHER_PRESET.id]: PLANNER_MULHER_PRESET,
};

export function getProductPreset(id: string): ProductPreset | null {
  return PRESETS[id] ?? null;
}

export function listProductPresets(): Array<{ id: string; label: string }> {
  return Object.values(PRESETS).map((p) => ({ id: p.id, label: p.label }));
}
