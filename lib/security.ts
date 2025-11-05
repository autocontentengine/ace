// lib/security.ts
export function sanitizeUserInput(s: string) {
  return s
    .replace(/<\s*script[^>]*>.*?<\s*\/\s*script>/gis, '')
    .replace(/on[a-z]+\s*=\s*['"][^'"]*['"]/gi, '')
}

export function normalizeBrief(b: string) {
  return b.toLowerCase().replace(/\s+/g, ' ').slice(0, 500)
}
