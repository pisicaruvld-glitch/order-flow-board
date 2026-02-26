import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppConfig } from '@/lib/types';
import {
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Factory,
  Truck,
  Settings,
  Radio,
  Server,
  ChevronRight,
  RefreshCw,
  AlertOctagon,
  Tv,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
  config: AppConfig;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/warehouse', label: 'Warehouse', icon: Warehouse },
  { path: '/production', label: 'Production', icon: Factory },
  { path: '/logistics', label: 'Logistics', icon: Truck },
  { path: '/errors', label: 'Errors', icon: AlertOctagon },
];

export function Layout({ children, config }: LayoutProps) {
  const location = useLocation();
  const isAdmin = config.userRole === 'admin';

  return (
    <div className="flex flex-col min-h-screen">
      {/* Global Mode Banner */}
      <ModeBanner config={config} />

      {/* Top Navigation */}
      <header className="bg-nav-bg border-b border-[hsl(222_40%_18%)] sticky top-0 z-40">
        <div className="flex items-center h-14 px-6 gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs tracking-wider">VS</span>
            </div>
            <span className="text-nav-fg font-semibold text-sm tracking-wide">VSRO Dashboard</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const active = path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-nav-fg hover:bg-nav-hover hover:text-[hsl(210_50%_98%)]'
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
            <div className="flex items-center gap-1 ml-auto">
              <a
                href="/tv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors text-nav-fg hover:bg-nav-hover hover:text-[hsl(210_50%_98%)]"
              >
                <Tv size={15} />
                TV View
              </a>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors',
                    location.pathname.startsWith('/admin')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-nav-fg hover:bg-nav-hover hover:text-[hsl(210_50%_98%)]'
                  )}
                >
                  <Settings size={15} />
                  Admin
                </Link>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function ModeBanner({ config }: { config: AppConfig }) {
  const isDemo = config.mode === 'DEMO';
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium',
        isDemo
          ? 'bg-[hsl(var(--banner-demo))] text-[hsl(var(--banner-demo-fg))]'
          : 'bg-[hsl(var(--banner-live))] text-[hsl(var(--banner-live-fg))]'
      )}
    >
      {isDemo ? (
        <>
          <Radio size={12} className="animate-pulse" />
          Connected to <strong>DEMO MODE</strong> — data is simulated and changes are not persisted
        </>
      ) : (
        <>
          <Server size={12} />
          Connected to <strong>LIVE</strong>
          <ChevronRight size={12} />
          <code className="font-mono text-xs opacity-90">{config.apiBaseUrl}</code>
        </>
      )}
    </div>
  );
}

// ============================================================
// Shared Page Layout Helpers
// ============================================================
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('p-6 max-w-[1600px] mx-auto', className)}>
      {children}
    </div>
  );
}

export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <RefreshCw size={24} className="animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="text-destructive text-sm font-medium">⚠ {message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-primary underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
