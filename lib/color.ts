/** Estrae due colori dominanti da un'immagine di copertina, campionando
 * i pixel su un canvas ridotto e raggruppandoli per somiglianza — non una
 * vera implementazione di Palette, ma abbastanza per uno sfondo che
 * riconosce il brano. Ritorna null se l'immagine non si può leggere
 * (CORS, rete, ecc.): chi chiama ricade sul gradiente statico. */
export async function extractPalette(url: string): Promise<[string, string] | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("impossibile caricare l'immagine"));
      img.src = url;
    });

    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 200) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lightness = (max + min) / 2;
      // scarta pixel quasi bianchi o quasi neri: interessano i toni con carattere
      if (lightness < 20 || lightness > 235) continue;
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b;
      buckets.set(key, bucket);
    }

    const sorted = [...buckets.values()].sort((x, y) => y.count - x.count);
    if (!sorted.length) return null;

    const toHex = (s: (typeof sorted)[number]) => {
      const r = Math.round(s.r / s.count), g = Math.round(s.g / s.count), b = Math.round(s.b / s.count);
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    };

    const first = sorted[0];
    const second = sorted.find(
      (s) => Math.abs(s.r - first.r) + Math.abs(s.g - first.g) + Math.abs(s.b - first.b) > 90
    ) ?? sorted[Math.min(1, sorted.length - 1)];

    return [toHex(first), toHex(second)];
  } catch {
    return null;
  }
}
