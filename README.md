# � ACE - Automated Content Engine

Automated content generation from brief to publishable assets (copy + carousel/pack) in < 10 min.

## �️ Roadmap Completa

### � North Star & Vincoli
**Obiettivo**: da brief a asset pubblicabile in < 10 min, qualità ≥ 8/10, costo ≤ €0,05/asset.

**Budget iniziale**: €20 (cap assoluto finché non arriva revenue).

### � Timeline - Day 0 → Week 8

#### ✅ **Day 0 - Ven 31 Ott 2025** - COMPLETATO
- Setup baseline, cap €20 attivo, schema base applicato

#### ✅ **Week 1 - 3-9 Nov 2025** - COMPLETATO
- Foundation: sicurezza, rate limit, audit, SSE progress, cache light, referral light

#### � **Week 2 - 10-16 Nov 2025** - IN CORSO
- MVP Core: generare asset reali end-to-end
- `/api/generate/copy`, `/api/carousel`, batch generate, analytics, upsell

#### � **Week 3 - 17-23 Nov 2025** - PROSSIMO
- Prodotti & Media: Prompt Pack ZIP, Guide PDF, TTS+SRT+merge, Affiliate 30%

#### � **Week 4 - 24-30 Nov 2025**
- Qualità & Go-Live: export avanzati, test, landing, checkout, go-live MVP

#### � **Week 5 - 1-7 Dic 2025**
- Enterprise P0: API v2, circuit breaker, cost breakdown

#### ⚙️ **Week 6 - 8-14 Dic 2025**
- Strategiche P1: feature flags, migrazioni, pre-warm template, TTS premium

#### � **Week 7 - 15-21 Dic 2025**
- Security & Ops: CSP hardening, BI dashboard, feedback loop, runbook

#### � **Week 8 - 22-28 Dic 2025**
- Handover & Closure: load testing, documentazione, formazione, hypercare

## �️ Stack Tecnologico
- **Frontend**: Next.js 16, React, TypeScript, Tailwind
- **Backend**: Next.js API Routes, Supabase (DB/Auth)
- **Deploy**: Vercel
- **AI/ML**: Groq API, LLM integration
- **Media**: Satori, @vercel/og, resvg, React PDF

## � Getting Started

```bash
# Sviluppo locale
pnpm dev

# Build produzione
pnpm build

# Avvia produzione
pnpm start
```

## � Link Utili
- **Repository**: https://github.com/autocontentengine/ace
- **Deploy**: https://ace-six-gules.vercel.app
- **Supabase**: https://tviotogxrdjhkrrfwxgq.supabase.co
