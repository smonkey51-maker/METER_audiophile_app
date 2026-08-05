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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F6" },
    { media: "(prefers-color-scheme: dark)", color: "#101012" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${GeistSans.variable} ${GeistMono.variable} ${serif.variable}`}>
      <body>
        {/* La rifrazione del vetro: un solo <defs> per tutta la pagina.
            Il fractalNoise fa da mappa, il displacement piega ciò che sta
            dietro la superficie — è la differenza fra una lastra opaca
            sfocata e del vetro vero. Due intensità: una per le superfici
            grandi, una più fitta per capsule e bottoni, dove uno
            spostamento largo si leggerebbe come una sbavatura. */}
        <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <filter id="lg-refract" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
              <feGaussianBlur in="noise" stdDeviation="2" result="map" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id="lg-refract-fine" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.022 0.022" numOctaves="2" seed="41" result="noise" />
              <feGaussianBlur in="noise" stdDeviation="1.2" result="map" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale="9" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
