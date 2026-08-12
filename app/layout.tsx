import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";

// Riservato al pensiero di Jessica: citazioni, non dati. Il resto
// dell'interfaccia resta Geist.
const serif = Instrument_Serif({
  subsets: ["latin"], weight: "400", style: ["normal", "italic"],
  variable: "--font-serif", display: "swap",
});

export const metadata: Metadata = {
  title: "METER",
  description: "Curatore musicale con memoria che si consolida nel tempo",
};

export const viewport: Viewport = {
  // Un solo tema, chiaro: la barra del browser prende la stessa
  // superficie M3 della pagina, non più due varianti per preferenza OS.
  themeColor: "#FFF8F3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${GeistSans.variable} ${GeistMono.variable} ${serif.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
