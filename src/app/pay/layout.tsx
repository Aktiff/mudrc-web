import type { Metadata } from "next";
import PayBanner from "@/components/pay/PayBanner";

export const metadata: Metadata = {
  title: "Mudrc · mock platby (staging)",
  description: "Testovací checkout a rezervácie miest pre mudrc.sk — bez skutočnej platobnej brány.",
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-brand-bg">
      <PayBanner />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12 flex flex-col items-stretch">
        {children}
      </div>
    </div>
  );
}
