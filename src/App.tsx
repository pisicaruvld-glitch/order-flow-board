import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppConfig } from "@/lib/types";
import { loadConfig } from "@/lib/appConfig";
import { checkHealth } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { Layout } from "@/components/Layout";
import { LoadingSpinner } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import OrdersPage from "./pages/Orders";
import WarehousePage from "./pages/Warehouse";
import ProductionPage from "./pages/Production";
import LogisticsPage from "./pages/Logistics";
import DeliveryPreparationPage from "./pages/DeliveryPreparation";
import AdminPage from "./pages/Admin";
import ProductTypeRulesPage from "./pages/ProductTypeRules";
import ErrorsPage from "./pages/Errors";
import WarehouseIssuesPage from "./pages/WarehouseIssues";
import TvDashboardPage from "./pages/TvDashboard";
import HistoryPage from "./pages/History";
import TransportsPage from "./pages/Transports";
import WarehouseComplaintsPage from "./pages/WarehouseComplaints";
import StockCheckRequestsPage from "./pages/StockCheckRequests";
import WorkCenterPage from "./pages/WorkCenter";
import ReportsPage from "./pages/Reports";
import ReportsWarehousePage from "./pages/ReportsWarehouse";
import RulesPage from "./pages/Rules";
import GanttPage from "./pages/Gantt";
import ReceivingIssuesPage from "./pages/ReceivingIssues";
import ActionPlanPage from "./pages/ActionPlan";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function BackendConnectionBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner label="Checking session…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const { user } = useAuth();

  // Derive effective config role from auth user
  const effectiveConfig: AppConfig = {
    ...config,
    userRole: user?.role === 'admin' ? 'admin' : 'user',
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route path="/*" element={
        <AuthGate>
          <Layout config={effectiveConfig}>
            <Routes>
              <Route path="/" element={<Dashboard config={effectiveConfig} />} />
              <Route path="/orders" element={<OrdersPage config={effectiveConfig} />} />
              <Route path="/warehouse" element={<WarehousePage config={effectiveConfig} />} />
              <Route path="/production" element={<ProductionPage config={effectiveConfig} />} />
              <Route path="/logistics" element={<LogisticsPage config={effectiveConfig} />} />
              <Route path="/logistics/delivery-preparation" element={<DeliveryPreparationPage />} />
              <Route path="/errors" element={<ErrorsPage config={effectiveConfig} />} />
              <Route path="/warehouse-issues" element={<WarehouseIssuesPage config={effectiveConfig} />} />
              <Route path="/admin" element={<AdminPage config={effectiveConfig} onConfigChange={setConfig} />} />
              <Route path="/admin/product-type-rules" element={<ProductTypeRulesPage config={effectiveConfig} />} />
              <Route path="/history" element={<HistoryPage config={effectiveConfig} />} />
              <Route path="/logistics/transports" element={<TransportsPage />} />
              <Route path="/warehouse-complaints" element={<WarehouseComplaintsPage />} />
              <Route path="/tv" element={<TvDashboardPage />} />
              <Route path="/stock-checks" element={<StockCheckRequestsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/warehouse" element={<ReportsWarehousePage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/gantt" element={<GanttPage />} />
              <Route path="/receiving-issues" element={<ReceivingIssuesPage />} />
              <Route path="/action-plan" element={<ActionPlanPage />} />
              <Route path="/work-center" element={<WorkCenterPage />} />
              <Route path="/inbox" element={<Navigate to="/work-center" replace />} />
              <Route path="/tasks" element={<Navigate to="/work-center" replace />} />
              <Route path="/notifications" element={<Navigate to="/work-center" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </AuthGate>
      } />
    </Routes>
  );
}

const App = () => {
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    const config = loadConfig();
    if (config.mode === 'DEMO') {
      setBackendError(null);
      return;
    }

    let active = true;

    checkHealth()
      .then((result) => {
        if (!active) return;
        setBackendError(result.ok ? null : 'Backend connection failed. Check FE proxy / backend server.');
      })
      .catch((error) => {
        console.error('[App] Backend health check failed:', error);
        if (!active) return;
        setBackendError('Backend connection failed. Check FE proxy / backend server.');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BackendConnectionBanner message={backendError} />
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
