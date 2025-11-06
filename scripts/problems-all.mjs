// scripts/problems-all.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

mkdirSync('reports', { recursive: true });

function runAllowFail(cmd, args, outfile) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));
    child.on('close', (code) => {
      if (outfile) {
        try { writeFileSync(outfile, out); } catch {}
      }
      resolve({ code, out });
    });
  });
}

(async () => {
  const tscTxt = join('reports', 'tsc.txt');
  const eslintCodeframeTxt = join('reports', 'eslint-codeframe.txt');
  const eslintJson = join('reports', 'eslint.json');

  console.log('▶ TypeScript typecheck…');
  const tsc = await runAllowFail('pnpm', ['-s', 'typecheck'], tscTxt);

  console.log('▶ ESLint (codeframe)…');
  const esCodeframe = await runAllowFail(
    'pnpm',
    ['-s', 'eslint', '.', '--ext', '.ts,.tsx,.js,.jsx', '-f', 'codeframe'],
    eslintCodeframeTxt
  );

  console.log('▶ ESLint (json report)…');
  // Questo comando scrive direttamente su reports/eslint.json
  const esJson = await runAllowFail(
    'pnpm',
    ['-s', 'eslint', '.', '--ext', '.ts,.tsx,.js,.jsx', '-f', 'json', '-o', eslintJson],
    null
  );

  // Calcola un riassunto dai risultati JSON (se il file è stato creato)
  let totalFiles = 0, totalErrors = 0, totalWarnings = 0;
  try {
    const raw = readFileSync(eslintJson, 'utf8');
    const results = JSON.parse(raw);
    totalFiles = results.length || 0;
    for (const r of results) {
      for (const m of r.messages || []) {
        if (m.severity === 2) totalErrors++;
        else if (m.severity === 1) totalWarnings++;
      }
    }
  } catch {
    // Ignora se non esiste o non è parsabile
  }

  console.log('\n================ SUMMARY ================');
  console.log(`TypeScript: ${tsc.code === 0 ? 'OK' : '❌ Issues (vedi reports/tsc.txt)'}`);
  console.log(`ESLint:     files=${totalFiles}  errors=${totalErrors}  warnings=${totalWarnings}`);
  console.log('Report salvati in:');
  console.log(' -', tscTxt);
  console.log(' -', eslintCodeframeTxt);
  console.log(' -', eslintJson);
  console.log('========================================\n');

  // Non falliamo l’intero script: scopo è generare i report.
  process.exit(0);
})().catch((err) => {
  console.error('✖ problems:all fatal:', err);
  process.exit(1);
});
