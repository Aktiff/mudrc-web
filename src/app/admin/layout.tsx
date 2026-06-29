"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, LayoutDashboard, LogOut, ClipboardList } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Prehľad", icon: LayoutDashboard, exact: true },
  { href: "/admin/udalosti", label: "Udalosti", icon: Calendar, exact: false },
  { href: "/admin/registracie", label: "Registrácie", icon: ClipboardList, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col fixed top-16 bottom-0 left-0 z-40">
        <div className="p-5 border-b border-stone-200">
          <Link href="/" className="font-display text-xl text-brand-text tracking-wider">
            MUDRC <span className="bg-gradient-to-r from-brand-orange to-orange-400 bg-clip-text text-transparent">ADMIN</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-100 text-brand-orange"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-stone-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Odhlásiť sa
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-56 mt-16 p-8">{children}</main>
    </div>
  );
}
