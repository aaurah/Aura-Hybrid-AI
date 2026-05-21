import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Cpu, MessageSquare, Box, Database, Wrench, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const navItems = [
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/sessions", label: "Sessions", icon: Box },
    { href: "/models", label: "Models", icon: Cpu },
    { href: "/rag", label: "Knowledge", icon: Database },
    { href: "/tools", label: "Tools", icon: Wrench },
    { href: "/admin", label: "Admin", icon: Activity },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 border-r border-sidebar-border bg-sidebar flex flex-col items-center md:items-stretch py-4 shrink-0 transition-all duration-300">
        <div className="flex items-center justify-center md:justify-start px-4 mb-8">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
            A
          </div>
          <span className="hidden md:block ml-3 font-semibold tracking-tight text-lg">AuraAI</span>
        </div>

        <nav className="flex flex-col gap-2 px-2 w-full">
          {navItems.map((item) => {
            const isActive = location === item.href || (location === "/" && item.href === "/chat");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={cn(
                    "flex items-center justify-center md:justify-start gap-3 p-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="hidden md:block">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-2">
          <div className="flex items-center justify-center md:justify-start gap-3 p-2 rounded-md transition-colors text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer text-sm font-medium">
            <Settings className="w-5 h-5 shrink-0" />
            <span className="hidden md:block">Settings</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background opacity-50"></div>
        <div className="relative z-10 flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
