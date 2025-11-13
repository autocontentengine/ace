// lib/retrieval/wiki.ts
/**
 * Stub sicuro: restituisce brevi “snippet” fittizi utili per fare grounding
 * senza dipendenze di rete. Sostituisci poi con una vera ricerca (es. Wikipedia)
 * quando vorrai.
 */
export async function searchWikiSnippets(
  query: string,
  lang: string = 'it',
  limit: number = 4
): Promise<string[]> {
  const base = [
    `${query}: definizione sintetica (${lang})`,
    `${query}: contesto, storia e utilizzi (${lang})`,
    `${query}: best practice e riferimenti (${lang})`,
    `${query}: note su ingredienti/processi (${lang})`,
    `${query}: risultati e aspettative reali (${lang})`,
  ]
  // non lancia mai errori, non va in rete
  return base.slice(0, Math.max(1, Math.min(8, limit)))
}
