/* global console */
/**
 * Promove um versionCode JÁ enviado à Play para outra trilha.
 *
 *   npm run play:promote -- <trilha> <versionCode> [nome]
 *   npm run play:promote -- internal 3025 1.12.2
 *
 * Por que existe: `eas submit` SEMPRE faz upload do bundle, então falha com
 * "You've already submitted this version of the app" quando aquele versionCode
 * já subiu — que é exatamente o caso de mover um build entre trilhas. Promoção
 * é operação de API, não de submit.
 *
 * PUBLICA DE VERDADE: o edit é commitado. Confirme a trilha antes de rodar.
 */
import process from 'node:process';

import {
  api,
  getAccessToken,
  loadCredentials,
  withEdit,
} from './lib/play-api.mjs';

const TRILHAS = ['internal', 'alpha', 'beta', 'production'];

const [track, versionCode, releaseName] = process.argv.slice(2);

if (!track || !versionCode) {
  console.error(
    'uso: npm run play:promote -- <trilha> <versionCode> [nome]\n' +
      `trilhas: ${TRILHAS.join(', ')}`,
  );
  process.exit(1);
}
if (!TRILHAS.includes(track)) {
  console.error(`Trilha inválida: ${track}. Use uma de: ${TRILHAS.join(', ')}`);
  process.exit(1);
}
if (!/^\d+$/.test(versionCode)) {
  console.error(`versionCode deve ser numérico, recebido: ${versionCode}`);
  process.exit(1);
}

const credentials = await loadCredentials();
const token = await getAccessToken(credentials);

await withEdit(
  token,
  async (_editId, base) => {
    const antes = await api(token, `${base}/tracks/${track}`);
    console.log(
      `${track} antes:`,
      JSON.stringify((antes.releases ?? []).map((r) => r.versionCodes)),
    );

    await api(token, `${base}/tracks/${track}`, {
      method: 'PUT',
      body: JSON.stringify({
        track,
        releases: [
          {
            versionCodes: [versionCode],
            status: 'completed',
            ...(releaseName ? { name: releaseName } : {}),
          },
        ],
      }),
    });
  },
  { commit: true },
);

console.log(`${track} agora: code ${versionCode} (status completed)`);
console.log('Confirme com: npm run play:status');
