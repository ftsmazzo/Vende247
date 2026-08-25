import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api/client";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { HomePage } from "./pages/HomePage";
import { ResearchPage } from "./pages/ResearchPage";
import { StrategyPage } from "./pages/StrategyPage";
import { CreativesPage } from "./pages/CreativesPage";
import { LandingPage } from "./pages/LandingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CampaignPipelinePage } from "./pages/CampaignPipelinePage";
import { IdentityPage } from "./pages/IdentityPage";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { StyleBits } from "./components/StyleBits";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Safe({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <RouteErrorBoundary label={label}>
      <StyleBits />
      {children}
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Safe label="Início"><HomePage /></Safe>} />
        <Route path="campanha/:id" element={<Safe label="Campanha"><CampaignPipelinePage /></Safe>} />
        <Route path="campanha/:id/identidade" element={<Safe label="Identidade"><IdentityPage /></Safe>} />
        <Route path="onboarding" element={<Safe label="Onboarding"><OnboardingPage /></Safe>} />
        <Route path="research" element={<Safe label="Research"><ResearchPage /></Safe>} />
        <Route path="estrategia" element={<Safe label="Estratégia"><StrategyPage /></Safe>} />
        <Route path="criativos" element={<Safe label="Criativos"><CreativesPage /></Safe>} />
        <Route path="landing" element={<Safe label="Landing"><LandingPage /></Safe>} />
        <Route path="config" element={<Safe label="Config"><SettingsPage /></Safe>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
