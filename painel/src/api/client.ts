const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN_KEY = "vende247_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; message?: string };
    throw new Error(d.error && d.error !== "Not Found" ? d.error : d.message || d.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export type BrandKit = {
  site_url?: string;
  logo_url?: string;
  og_image_url?: string;
  colors?: string[];
  visual_summary?: string;
  product_ui_notes?: string;
  extracted_at?: string;
  source?: "url" | "generated" | "preset" | "manual";
};

export type Workspace = {
  id: number;
  name: string;
  nicho: string;
  produto: string;
  oferta: string;
  cta: string;
  tom_voz: string;
  concorrentes: string[];
  ig_user_id: string;
  ig_username: string;
  has_ig_token: boolean;
  onboarding_done: boolean;
  brand_kit?: BrandKit;
  brand_warning?: string | null;
};

export const api = {
  auth: {
    status: () => request<{ db: boolean; canRegister: boolean }>("/api/auth/status"),
    login: (email: string, password: string) =>
      request<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name?: string) =>
      request<{ token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      }),
    me: () =>
      request<{ user: { id: number; email: string; name: string | null }; workspace: Workspace | null }>(
        "/api/auth/me"
      ),
  },
  workspace: {
    get: () => request<Workspace>("/api/workspace"),
    onboarding: (body: Record<string, unknown>) =>
      request<Workspace>("/api/workspace/onboarding", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (body: Record<string, unknown>) =>
      request<Workspace>("/api/workspace", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    brandFromUrl: (url: string, logo_url?: string) =>
      request<{ workspace: Workspace; brand_kit: BrandKit }>("/api/workspace/brand-from-url", {
        method: "POST",
        body: JSON.stringify({ url, logo_url }),
      }),
    applyPreset: (preset_id = "planner-mulher") =>
      request<{ workspace: Workspace; preset: { id: string; label: string } }>(
        "/api/workspace/apply-preset",
        {
          method: "POST",
          body: JSON.stringify({ preset_id }),
        }
      ),
    generateBrand: (keep_logo = true) =>
      request<{ workspace: Workspace; brand_kit: BrandKit }>("/api/workspace/generate-brand", {
        method: "POST",
        body: JSON.stringify({ keep_logo }),
      }),
  },
  research: {
    latest: () => request<{ run: ResearchRun | null }>("/api/research/latest"),
    run: () => request<{ run: { id: number; status: string; report: ResearchReport } }>("/api/research/run", { method: "POST" }),
  },
  strategy: {
    latest: () => request<{ strategy: StrategyRow | null }>("/api/strategy/latest"),
    generate: (days = 7) =>
      request<{ strategy: StrategyRow }>("/api/strategy/generate", {
        method: "POST",
        body: JSON.stringify({ days }),
      }),
  },
  creatives: {
    list: () => request<{ creatives: Creative[] }>("/api/creatives"),
    batch: (strategy_id?: number) =>
      request<{ creatives: Creative[]; errors: Array<{ day: number; error: string }> }>("/api/creatives/batch", {
        method: "POST",
        body: JSON.stringify({ strategy_id }),
      }),
    regenerate: (id: number) =>
      request<{ creative: Creative }>(`/api/creatives/${id}/regenerate`, { method: "POST" }),
    publish: (id: number) =>
      request<{ creative: Creative }>(`/api/creatives/${id}/publish`, { method: "POST" }),
    schedule: (id: number, scheduled_at: string) =>
      request<{ creative: Creative }>(`/api/creatives/${id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduled_at }),
      }),
    patch: (id: number, body: { caption?: string; hook?: string; status?: string }) =>
      request<{ creative: Creative }>(`/api/creatives/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    approveAll: () => request<{ approved: number }>("/api/creatives/approve-all-ready", { method: "POST" }),
    clear: () => request<{ deleted: number }>("/api/creatives/clear", { method: "POST" }),
    regenerateSlide: (id: number, slide_index: number) =>
      request<{ creative: Creative }>(`/api/creatives/${id}/regenerate-slide`, {
        method: "POST",
        body: JSON.stringify({ slide_index }),
      }),
    compareModels: (body?: { prompt?: string; models?: string[]; hook?: string }) =>
      request<{
        prompt_preview: string;
        results: Array<{ model: string; url?: string; error?: string; ms: number }>;
        hint: string;
      }>("/api/creatives/compare-models", {
        method: "POST",
        body: JSON.stringify(body || {}),
      }),
  },
  landing: {
    latest: () => request<{ landing: Landing | null }>("/api/landing/latest"),
    generate: (with_hero_image = true) =>
      request<{ landing: Landing }>("/api/landing/generate", {
        method: "POST",
        body: JSON.stringify({ with_hero_image }),
      }),
  },
};

export type ResearchReport = {
  resumo: string;
  o_que_concorrentes_fazem_bem?: string[];
  oportunidades_unicas?: string[];
  formatos_que_performam: string[];
  hooks_vencedores: string[];
  ctas_comuns: string[];
  pilares_conteudo: string[];
  direcao_visual?: string[];
  padrao_perfil_engajador: {
    bio_sugerida: string;
    destaques: string[];
    ritmo_posts_semana: number;
    mix_formatos: { feed: number; carrossel: number; reels: number };
  };
  gaps_do_seu_perfil: string[];
  insights_ads: string[];
  fontes: { apify: boolean; ad_library: boolean; modo_degradado: boolean };
};

export type ResearchRun = {
  id: number;
  status: string;
  report?: ResearchReport;
  error?: string;
  created_at?: string;
};

export type StrategyPlan = {
  resumo: string;
  dias: number;
  pilares: string[];
  posts: Array<{
    day: number;
    titulo: string;
    pilar: string;
    objetivo: string;
    formato: string;
    hook: string;
    estrutura: string;
    caption: string;
    cta: string;
    visual_prompt: string;
    slides?: Array<{ titulo?: string; texto?: string; visual_prompt?: string }>;
  }>;
};

export type StrategyRow = {
  id: number;
  research_id?: number;
  days: number;
  plan: StrategyPlan;
  created_at?: string;
};

export type Creative = {
  id: number;
  strategy_id: number | null;
  day_index: number;
  format: string;
  hook: string;
  caption: string;
  visual_prompt: string;
  media_url: string;
  media_urls?: string[];
  status: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  error?: string | null;
};

export type Landing = {
  id: number;
  html: string;
  meta: {
    brand_name?: string;
    headline?: string;
    hero_image_url?: string;
    colors?: string[];
  };
  created_at?: string;
};
