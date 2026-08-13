import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Unbounded, Plus_Jakarta_Sans, Lora } from "next/font/google";

const unbounded = Unbounded({
  subsets: ["latin"], weight: ["700", "900"],
  variable: "--font-unbounded", display: "swap",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"], weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta", display: "swap",
});
// Riservato al pensiero di Jessica: citazioni, non dati. Il resto
// dell'interfaccia resta Jakarta.
const lora = Lora({
  subsets: ["latin"], weight: ["400", "500"], style: ["italic"],
  variable: "--font-lora", display: "swap",
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
    { media: "(prefers-color-scheme: light)", color: "#fff8f0" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${unbounded.variable} ${jakarta.variable} ${lora.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
