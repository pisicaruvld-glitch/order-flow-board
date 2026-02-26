import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { AppConfig } from "@/lib/types";
import { loadConfig } from "@/lib/appConfig";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import OrdersPage from "./pages/Orders";
import WarehousePage from "./pages/Warehouse";
import ProductionPage from "./pages/Production";
import LogisticsPage from "./pages/Logistics";
import AdminPage from "./pages/Admin";
import ProductTypeRulesPage from "./pages/ProductTypeRules";
import ErrorsPage from "./pages/Errors";
import TvDashboardPage from "./pages/TvDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [config, setConfig] = useState<AppConfig>(loadConfig);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout config={config}>
            <Routes>
              <Route path="/" element={<Dashboard config={config} />} />
              <Route path="/orders" element={<OrdersPage config={config} />} />
              <Route path="/warehouse" element={<WarehousePage config={config} />} />
              <Route path="/production" element={<ProductionPage config={config} />} />
              <Route path="/logistics" element={<LogisticsPage config={config} />} />
              <Route path="/errors" element={<ErrorsPage config={config} />} />
              <Route path="/admin" element={<AdminPage config={config} onConfigChange={setConfig} />} />
              <Route path="/admin/product-type-rules" element={<ProductTypeRulesPage config={config} />} />
              <Route path="/tv" element={<TvDashboardPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
