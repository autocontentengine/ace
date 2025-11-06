// lib/config.ts

// Info sito + flag visibilità sezioni "dev" (Health, Repo, Roadmap, CLI)
export const SITE = {
  name: 'ACE',
  // Usa la tua URL prod; fallback alla Vercel demo
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ace-six-gules.vercel.app',
  contactEmail: 'autocontentengine@gmail.com',
  // Metti NEXT_PUBLIC_SHOW_DEV=1 per mostrare sezioni tecniche in homepage
  showDevSections: process.env.NEXT_PUBLIC_SHOW_DEV === '1',
} as const

// Config demo pubblica (quanto generare senza API key)
export const DEMO_LIMITS = {
  hooks: 3,
  captions: 3,
  carousels: 1,
} as const

// Link utili mostrabili nel sito
export const LINKS = {
  docs: '/docs',
  pricing: '/pricing',
  health: '/api/health',
  repo: 'https://github.com/autocontentengine/ace',
} as const

// Listino piani (centralizzato qui così cambi i prezzi in un posto solo)
export const PRICING = [
  {
    id: 'free',
    name: 'Free',
    priceEur: 0,
    quota: 10, // asset/mese
    overageEurPerAsset: null as number | null,
    features: ['10 asset/mese', 'Generazione copy + caroselli (base)', 'Senza API'],
    ctaLabel: 'Provalo gratis',
  },
  {
    id: 'starter',
    name: 'Starter',
    priceEur: 9,
    quota: 300,
    overageEurPerAsset: 0.03,
    features: ['300 asset/mese', 'API base', '1 workspace', 'Export ZIP caroselli'],
    highlight: true, // evidenzia nella UI
    ctaLabel: 'Prenota Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceEur: 29,
    quota: 1500,
    overageEurPerAsset: 0.025,
    features: ['1.500 asset/mese', 'API prioritaria', '3 workspace', 'Template premium'],
    ctaLabel: 'Prenota Pro',
  },
  {
    id: 'business',
    name: 'Business',
    priceEur: 79,
    quota: 6000,
    overageEurPerAsset: 0.02,
    features: ['6.000 asset/mese', 'SLA light', 'Accessi team', 'Assistenza dedicata'],
    ctaLabel: 'Parla con noi',
  },
] as const

// Utilità piccola per formattare prezzi
export const formatEur = (n: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n)
