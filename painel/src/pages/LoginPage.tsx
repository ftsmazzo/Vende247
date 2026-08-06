import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken, getToken } from "../api/client";
import { BRAND } from "../config/brand";

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [canRegister, setCanRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) navigate("/", { replace: true });
    api.auth.status().then((s) => setCanRegister(s.canRegister)).catch(() => setCanRegister(false));
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await api.auth.login(email, password)
          : await api.auth.register(email, password, name);
      setToken(res.token);
      const me = await api.auth.me();
      navigate(me.workspace?.onboarding_done ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto animate-rise">
        <p className="font-display text-5xl font-extrabold tracking-tight text-signal mb-2">{BRAND.name}</p>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white leading-tight mb-2">
          {BRAND.headline}
        </h1>
        <p className="text-white/55 mb-8">{BRAND.description}</p>

        <form onSubmit={onSubmit} className="space-y-3 animate-rise-delay">
          {mode === "register" && (
            <input
              className="field"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="field"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            required
            minLength={6}
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-coral text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-sm text-white/45">
          {mode === "login" ? (
            canRegister ? (
              <>
                Novo aqui?{" "}
                <button type="button" className="text-signal underline" onClick={() => setMode("register")}>
                  Criar conta
                </button>
              </>
            ) : (
              "Cadastro fechado — peça acesso ao admin."
            )
          ) : (
            <>
              Já tem conta?{" "}
              <button type="button" className="text-signal underline" onClick={() => setMode("login")}>
                Entrar
              </button>
            </>
          )}
        </p>
        <p className="mt-8 text-xs text-white/30">{BRAND.parent}</p>
      </div>
      <style>{`
        .field { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:0.75rem; padding:0.75rem 1rem; color:white; outline:none; }
        .field:focus { border-color: rgba(232,255,71,0.5); }
        .btn-primary { background:#e8ff47; color:#0a0c0f; font-weight:600; border-radius:0.75rem; padding:0.75rem 1rem; }
        .btn-primary:disabled { opacity:0.6; }
      `}</style>
    </div>
  );
}
