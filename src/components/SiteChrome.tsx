"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hide = pathname.startsWith("/zasadacie");
  return (
    <>
      {hide ? null : <Navbar />}
      <main>{children}</main>
      {hide ? null : <Footer />}
    </>
  );
}
