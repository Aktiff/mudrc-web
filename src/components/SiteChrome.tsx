"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hide = pathname.startsWith("/zasadacie");
  const adminShell =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  return (
    <>
      {hide ? null : <Navbar />}
      <main className={hide || adminShell ? "min-h-[100dvh]" : undefined}>{children}</main>
      {hide || adminShell ? null : <Footer />}
    </>
  );
}
