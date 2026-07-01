"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/#kvizy", label: "Kvízy" },
  { href: "/liga", label: "Liga" },
  { href: "/#ako-to-funguje", label: "Ako to funguje?" },
  { href: "/podniky", label: "Pre podniky" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 20);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-[100] isolate transition-all duration-300 ${
        scrolled
          ? "nav-scrolled"
          : "bg-brand-bg/90 backdrop-blur-md border-b border-brand-border/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-display text-2xl text-brand-text tracking-wider hover:text-brand-orange transition-colors">
          MUDRC<span className="bg-gradient-to-r from-brand-orange to-orange-400 bg-clip-text text-transparent"> KVÍZ</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-brand-muted hover:text-brand-text transition-colors text-sm font-medium">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link href="/#kvizy" className="btn-primary text-sm px-5 py-2.5">
            Registruj sa
          </Link>
        </div>
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button className="p-2 text-brand-muted" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-brand-card border-t border-brand-border px-4 py-4 space-y-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-brand-muted hover:text-brand-text py-2 text-sm font-medium">
              {l.label}
            </Link>
          ))}
          <Link href="/#kvizy" onClick={() => setOpen(false)} className="btn-primary w-full justify-center text-sm py-3 inline-flex mt-2">
            Registruj sa
          </Link>
        </div>
      )}
    </nav>
  );
}
