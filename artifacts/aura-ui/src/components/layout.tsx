import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Cpu, MessageSquare, Box, Database, Wrench, Settings,
  Activity, LogOut, User, Menu, X, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { Badge } from "@/components/ui/badge";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  dev: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  user: "bg-primary/10 text-primary border-primary/20",
  viewer: "bg-muted text-muted-foreground border-border",
};

const NAV_ITEMS = [
  { href: "/chat",     label: "Chat",      icon: MessageSquare },
  { href: "/sessions", label: "Sessions",  icon: Box           },
  { href: "/models",   label: "Models",    icon: Cpu           },
  { href: "/rag",      label: "Knowledge", icon: Database      },
  { href: "/tools",    label: "Tools",     icon: Wrench        },
  { href: "/admin",    label: "Admin",     icon: Activity      },
];

// Bottom-tab items (max 5 for mobile)
const BOTTOM_TABS = [
  { href: "/chat",     label: "Chat",     icon: MessageSquare },
  { href: "/sessions", label: "Sessions", icon: Box           },
  { href: "/rag",      label: "Knowledge",icon: Database      },
  { href: "/tools",    label: "Tools",    icon: Wrench        },
  { href: "/admin",    label: "Admin",    icon: Activity      },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  const isActive = (href: string) =>
    location === href || (location === "/" && href === "/chat");

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden font-sans">

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────── */}
      <aside className="hidden md:flex w-64 border-r border-sidebar-border bg-sidebar flex-col py-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center px-4 mb-8 gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">A</div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight text-lg leading-none">AuraAI</span>
            <span className="text-[10px] font-mono text-muted-foreground">Hybrid Platform</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-2 flex-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 p-2.5 rounded-md transition-colors cursor-pointer text-sm font-medium",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
              </div>
            </Link>
          ))}
        </nav>

        {/* User / footer */}
        <div className="px-2 flex flex-col gap-1">
          {user && (
            <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-muted/40 mb-1">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.username}</p>
                <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 mt-0.5 ${ROLE_COLORS[user.role] ?? ROLE_COLORS["viewer"]}`}>
                  {user.role}
                </Badge>
              </div>
            </div>
          )}
          <Link href="/settings">
            <div className="flex items-center gap-3 p-2.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer text-sm font-medium transition-colors">
              <Settings className="w-5 h-5 shrink-0" />
              Settings
            </div>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 p-2.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer text-sm font-medium transition-colors w-full"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE DRAWER OVERLAY ───────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          {/* drawer */}
          <aside className="relative z-10 w-72 bg-sidebar border-r border-sidebar-border flex flex-col py-6 px-4 h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">A</div>
                <span className="font-semibold text-lg">AuraAI</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 flex-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-md transition-colors cursor-pointer text-sm font-medium",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  )}>
                    <item.icon className="w-5 h-5 shrink-0" />
                    {item.label}
                  </div>
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-1 mt-4 pt-4 border-t border-border">
              {user && (
                <div className="flex items-center gap-2 px-2 py-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-3 p-3 rounded-md text-muted-foreground hover:text-destructive cursor-pointer text-sm font-medium transition-colors w-full"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0">

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-background shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">A</div>
            <span className="font-semibold text-base">AuraAI</span>
          </div>
          <div className="w-9" /> {/* spacer */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-background relative">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background opacity-50" />
          <div className="relative z-10 h-full">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden flex items-center border-t border-border bg-background shrink-0 safe-area-bottom">
          {BOTTOM_TABS.map((item) => (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] transition-colors",
                isActive(item.href) ? "text-primary" : "text-muted-foreground"
              )}>
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
