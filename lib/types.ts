export type Verdict = "keep" | "maybe" | "drop";

export type Axis = {
  claim: string;
  confidence: number;   // 0–0.95, mai 1: un gusto non chiude mai del tutto una porta
  evidence: number;
  trace: string[];
};

export type Model = {
  axes: Axis[];
  rules: string[];
  summary: string;
  identity: string;
  eras: { n: number; summary: string }[];
  changelog: string[];
  cycles: number;
  taste: string[];
  updatedAt?: string;
};

export type Listen = {
  id?: number;
  artist: string;
  track: string;
  album?: string;
  spotify_url?: string;
  verdict: Verdict | null;
  dims: string[];
  rig?: string;
  meter?: string;
  dynamics?: string;
  production?: string;
  era?: string;
  bridge?: string;
  source: "rec" | "manual" | "spotify" | "import";
  plays: number;
  consolidated: boolean;
  played_at?: string;
};

export type Rec = {
  artist: string; track: string; album?: string;
  meter?: string; dynamics?: string; production?: string; era?: string;
  bridge?: string; why: string; learned?: string;
  url?: string; uri?: string;
};

export const EMPTY_MODEL: Model = {
  axes: [], rules: [], summary: "", identity: "", eras: [], changelog: [], cycles: 0, taste: [],
};

export const MAX_AXES = 8;
export const MAX_RULES = 5;
export const META_EVERY = 4;

export const VERDICTS = [
  { key: "keep",  label: "Tenuto",    hint: "Spingi oltre su questa linea" },
  { key: "maybe", label: "In dubbio", hint: "Direzione giusta, brano sbagliato" },
  { key: "drop",  label: "Scartato",  hint: "Non riproporre questa direzione" },
] as const;

export const DIMS = [
  "Produzione", "Arrangiamento", "Esecuzione", "Timbro", "Dinamica", "Metrica", "Scrittura",
] as const;

export const RIGS = [
  { key: "aperte",    label: "Cuffie aperte" },
  { key: "iem",       label: "IEM" },
  { key: "diffusori", label: "Diffusori" },
  { key: "auto",      label: "Auto" },
  { key: "laptop",    label: "Laptop / telefono" },
] as const;
