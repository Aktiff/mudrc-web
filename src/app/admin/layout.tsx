"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Armchair, Calendar, ClipboardList, LayoutDashboard, LogOut, MonitorPlay } from "lucide-react";

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
  {
    href: "/admin/zasadacie",
    label: "Zasadacie",
    icon: Armchair,
    exact: false,
    isActive: (pathname: string) => pathname.startsWith("/admin/zasadacie"),
  },
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
    `flex items-center gap-2 lg:gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
      active
        ? "bg-brand-orange text-brand-btn-fg shadow-sm"
        : "text-brand-muted hover:bg-brand-hover hover:text-brand-text"
    }`;

  return (
    <div className="min-h-screen bg-brand-bg overflow-x-clip">
      <aside className="hidden lg:flex w-56 bg-brand-card border-r border-brand-border flex-col fixed top-16 bottom-0 left-0 z-40">
        <div className="px-5 py-5 border-b border-brand-border">
          <Link href="/" className="font-display text-xl text-brand-text tracking-wider">
            MUDRC{" "}
            <span className="bg-gradient-to-r from-brand-orange to-orange-400 bg-clip-text text-transparent">
              ADMIN
            </span>
          </Link>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1.5">
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
        <div className="px-4 py-4 border-t border-brand-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-brand-muted hover:bg-brand-hover hover:text-brand-text w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Odhlásiť sa
          </button>
        </div>
      </aside>

      <nav className="lg:hidden fixed top-16 inset-x-0 z-30 bg-brand-card/95 backdrop-blur border-b border-brand-border px-4 py-2.5 overflow-x-auto">
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

      <div className="lg:pl-56 min-w-0">
        <main
          className={`box-border min-w-0 w-full overflow-x-clip mt-16 pt-14 lg:pt-0 px-4 sm:px-6 lg:px-8 xl:px-10 ${
            pathname.startsWith("/admin/zasadacie/") && pathname !== "/admin/zasadacie"
              ? "py-4 lg:py-6 pb-10"
              : "py-6 lg:py-10 pb-12"
          }`}
        >
          <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
