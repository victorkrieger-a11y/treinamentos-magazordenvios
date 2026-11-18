import type { Metadata, Viewport } from "next";
import { Blinker, Montserrat } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Axiforma (fonte principal do manual) não está disponível nos arquivos do
// projeto: Montserrat é o substituto indicado. Blinker é a fonte complementar.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], display: "swap" });
const blinker = Blinker({ variable: "--font-blinker", subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Treinamentos Magazord Envios", template: "%s · Treinamentos Magazord Envios" },
  description: "Capacitação, avaliação e acompanhamento de desempenho da equipe de suporte Magazord Envios.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#e52944" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} ${blinker.variable}`}>
      <body className="font-sans antialiased">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
