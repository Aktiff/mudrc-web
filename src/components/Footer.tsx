import Link from "next/link";

const FacebookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const links = [
  { href: "/#kvizy", label: "Kvízy" },
  { href: "/#ako-to-funguje", label: "Ako to funguje?" },
  { href: "/podniky", label: "Pre podniky" },
  { href: "/#kariera", label: "Kariéra" },
];

export default function Footer() {
  return (
    <footer className="bg-brand-footer-bg border-t border-black/10 dark:border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <Link href="/" className="font-display text-2xl text-brand-text tracking-wider">
              MUDRC<span className="text-orange-600 dark:bg-gradient-to-r dark:from-brand-orange dark:to-orange-400 dark:bg-clip-text dark:text-transparent"> KVÍZ</span>
            </Link>
            <p className="text-brand-muted text-sm mt-3 leading-relaxed max-w-xs">
              Vedomostné kvízy vo vašom obľúbenom podniku. Zábava, humor a súťaž v jednom.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-brand-text mb-4">Navigácia</h4>
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-brand-muted hover:text-brand-orange-readable text-sm transition-colors font-medium">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-brand-text mb-4">Kontakt</h4>
            <a href="mailto:kontakt@mudrc.sk" className="text-brand-muted hover:text-brand-orange-readable text-sm transition-colors font-medium block mb-4">
              kontakt@mudrc.sk
            </a>
            <div className="flex gap-3">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white/70 dark:bg-brand-surface border border-black/10 dark:border-brand-border flex items-center justify-center text-brand-muted hover:bg-brand-text hover:text-brand-footer-bg hover:border-brand-text dark:hover:bg-brand-orange dark:hover:text-brand-btn-fg dark:hover:border-brand-orange transition-colors">
                <FacebookIcon />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-white/70 dark:bg-brand-surface border border-black/10 dark:border-brand-border flex items-center justify-center text-brand-muted hover:bg-brand-text hover:text-brand-footer-bg hover:border-brand-text dark:hover:bg-brand-orange dark:hover:text-brand-btn-fg dark:hover:border-brand-orange transition-colors">
                <InstagramIcon />
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-black/10 dark:border-brand-border mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-brand-muted-light text-xs">© 2026 Mudrc Kvíz. Všetky práva vyhradené.</p>
          <p className="text-brand-muted-light text-xs">Vytvorené s láskou ku kvízom</p>
        </div>
      </div>
    </footer>
  );
}
