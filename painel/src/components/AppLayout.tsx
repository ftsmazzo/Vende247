import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BRAND } from "../config/brand";
import { setToken } from "../api/client";

const links = [
  { to: "/", label: "Início", end: true },
  { to: "/research", label: "Research" },
  { to: "/estrategia", label: "Estratégia" },
  { to: "/criativos", label: "Criativos" },
  { to: "/landing", label: "Landing" },
  { to: "/config", label: "Config" },
];

export function AppLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-56 border-b md:border-b-0 md:border-r border-white/10 bg-ink-900/80 backdrop-blur px-4 py-5 shrink-0">
        <div className="mb-8">
          <p className="font-display text-2xl font-extrabold tracking-tight text-signal">{BRAND.name}</p>
          <p className="text-xs text-white/45 mt-1">{BRAND.tagline}</p>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  isActive ? "bg-signal text-ink-950" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="mt-8 text-xs text-white/40 hover:text-white/70"
          onClick={() => {
            setToken(null);
            navigate("/login");
          }}
        >
          Sair
        </button>
        <p className="hidden md:block mt-auto pt-10 text-[10px] text-white/25">{BRAND.parent}</p>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
