import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";

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
            <p className="text-black/80 dark:text-brand-muted text-sm mt-3 leading-relaxed max-w-xs">
              Vedomostné kvízy vo vašom obľúbenom podniku. Zábava, humor a súťaž v jednom.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-brand-text mb-4">Navigácia</h4>
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-black/80 hover:text-black dark:text-brand-muted dark:hover:text-brand-orange-readable text-sm transition-colors font-medium">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-brand-text mb-4">Kontakt</h4>
            <a href="mailto:kontakt@mudrc.sk" className="text-black/80 hover:text-black dark:text-brand-muted dark:hover:text-brand-orange-readable text-sm transition-colors font-medium block mb-4">
              kontakt@mudrc.sk
            </a>
            <SocialLinks />
          </div>
        </div>
        <div className="border-t border-black/10 dark:border-brand-border mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-black/65 dark:text-brand-muted-light text-xs">© 2026 Mudrc Kvíz. Všetky práva vyhradené.</p>
          <p className="text-black/65 dark:text-brand-muted-light text-xs">Vytvorené s láskou ku kvízom</p>
        </div>
      </div>
    </footer>
  );
}
