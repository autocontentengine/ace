import { sha256 } from 'crypto-hash';

export async function generateAPIKey(): Promise<{ apiKey: string; hashedKey: string }> {
  // Genera una API key casuale
  const apiKey = 'ace_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Hash della API key per storage sicuro
  const hashedKey = await sha256(apiKey);
  
  return { apiKey, hashedKey };
}

export async function hashAPIKey(apiKey: string): Promise<string> {
  return await sha256(apiKey);
}
