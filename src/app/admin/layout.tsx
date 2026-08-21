"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, ClipboardList, LayoutDashboard, LogOut, MonitorPlay } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Prehľad", icon: LayoutDashboard, exact: true },
  {
    href: "/admin/udalosti",
    label: "Udalosti",
    icon: Calendar,
    exact: false,
    isActive: (pathname: string) =>
      pathname.startsWith("/admin/udalosti") && !pathname.includes("/prezentacia-kvizu"),
  },
  {
    href: "/admin/hotove-kvizy",
    label: "Hotové kvízy",
    icon: MonitorPlay,
    exact: false,
    isActive: (pathname: string) => pathname.startsWith("/admin/hotove-kvizy"),
  },
  { href: "/admin/registracie", label: "Registrácie", icon: ClipboardList, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isFullscreen =
    pathname.includes("/prezentacia") || /\/hotove-kvizy\/[^/]+\/prehrat$/.test(pathname);

  if (isFullscreen) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
  };

  const linkClass = (active: boolean) =>
    `flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
      active
        ? "bg-brand-orange text-brand-btn-fg shadow-sm"
        : "text-brand-muted hover:bg-brand-hover hover:text-brand-text"
    }`;

  return (
    <div className="min-h-screen bg-brand-bg">
      <aside className="hidden lg:flex w-56 bg-brand-card border-r border-brand-border flex-col fixed top-16 bottom-0 left-0 z-40">
        <div className="p-5 border-b border-brand-border">
          <Link href="/" className="font-display text-xl text-brand-text tracking-wider">
            MUDRC{" "}
            <span className="bg-gradient-to-r from-brand-orange to-orange-400 bg-clip-text text-transparent">
              ADMIN
            </span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = item.isActive
              ? item.isActive(pathname)
              : item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={linkClass(active)}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-brand-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-brand-muted hover:bg-brand-hover hover:text-brand-text w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Odhlásiť sa
          </button>
        </div>
      </aside>

      <nav className="lg:hidden fixed top-16 inset-x-0 z-30 bg-brand-card/95 backdrop-blur border-b border-brand-border px-3 py-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {navItems.map((item) => {
            const active = item.isActive
              ? item.isActive(pathname)
              : item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={linkClass(active)}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-brand-muted hover:bg-brand-hover hover:text-brand-text shrink-0"
          >
            <LogOut className="w-4 h-4" />
            Odhlás
          </button>
        </div>
      </nav>

      <main className="w-full min-w-0 lg:ml-56 mt-16 pt-14 lg:pt-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="w-full max-w-6xl 2xl:max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
