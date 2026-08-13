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
  // La barra del browser segue la preferenza del sistema: non è legata
  // al toggle dentro l'app (che parte da scuro), solo un'approssimazione
  // ragionevole prima che React monti.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDF7EE" },
    { media: "(prefers-color-scheme: dark)", color: "#100E09" },
  ],
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
