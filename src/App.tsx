import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AppConfig } from "@/lib/types";
import { loadConfig } from "@/lib/appConfig";
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
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
