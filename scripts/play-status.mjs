/* global console */
/**
 * Mostra o que cada trilha da Play está servindo. Somente leitura.
 *
 *   npm run play:status
 *
 * Responde a pergunta que o Play Console demora a mostrar e que o `eas` não
 * sabe: qual versionCode está em interno, fechado, aberto e produção. Útil
 * antes de publicar (para não repetir versionCode) e depois (para confirmar
 * que a submissão chegou).
 *
 * Lembre da precedência: a Play serve a trilha de MAIOR prioridade a que a
 * conta tem direito — interno > fechado > aberto > produção. Trilha interna
 * desatualizada sequestra o testador interno. Ver docs/GOOGLE_PLAY_DEPLOYMENT.md.
 */
import process from 'node:process';

import {
  api,
  getAccessToken,
  loadCredentials,
  withEdit,
} from './lib/play-api.mjs';

const credentials = await loadCredentials();
const token = await getAccessToken(credentials);

const tracks = await withEdit(token, async (_editId, base) =>
  api(token, `${base}/tracks`),
);

const ordem = ['internal', 'alpha', 'beta', 'production'];
const rotulos = {
  internal: 'teste interno',
  alpha: 'teste fechado',
  beta: 'teste aberto',
  production: 'produção',
};

const encontradas = tracks.tracks ?? [];
const ordenadas = [...encontradas].sort(
  (a, b) => ordem.indexOf(a.track) - ordem.indexOf(b.track),
);

for (const track of ordenadas) {
  const nome = rotulos[track.track] ?? track.track;
  const releases = track.releases ?? [];
  if (releases.length === 0) {
    console.log(`${track.track.padEnd(11)} ${nome.padEnd(14)} sem releases`);
    continue;
  }
  for (const release of releases) {
    const codes = (release.versionCodes ?? []).join(', ');
    console.log(
      `${track.track.padEnd(11)} ${nome.padEnd(14)} ` +
        `code ${codes} · "${release.name ?? '-'}" · ${release.status}`,
    );
  }
}

if (encontradas.length === 0) {
  console.log('Nenhuma trilha retornada.');
  process.exitCode = 1;
}
