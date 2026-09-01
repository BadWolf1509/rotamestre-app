/* global console */
/**
 * Promove um versionCode JÁ enviado à Play para outra trilha.
 *
 *   npm run play:promote -- <trilha> <versionCode> [nome] [--rollout=N] [--dry-run]
 *   npm run play:promote -- internal 3025 1.12.2
 *   npm run play:promote -- production 3030 1.12.5 --rollout=10
 *   npm run play:promote -- production 3030 1.12.5 --rollout=10 --dry-run
 *
 * Por que existe: `eas submit` SEMPRE faz upload do bundle, então falha com
 * "You've already submitted this version of the app" quando aquele versionCode
 * já subiu — que é exatamente o caso de mover um build entre trilhas. Promoção
 * é operação de API, não de submit.
 *
 * `--rollout=N` faz rollout gradual (N% dos usuários). Sem a flag, publica para
 * 100%, que era o único comportamento até 31/08/2026. O `GOOGLE_PLAY_DEPLOYMENT`
 * pede rollout gradual em produção, e o script não sabia fazer — quem seguisse o
 * doc não tinha ferramenta.
 *
 * PUBLICA DE VERDADE: o edit é commitado. Confirme a trilha antes de rodar, ou
 * use `--dry-run` para ver o corpo exato da requisição sem tocar na Play.
 */
import process from 'node:process';

import {
  api,
  getAccessToken,
  loadCredentials,
  withEdit,
} from './lib/play-api.mjs';

const TRILHAS = ['internal', 'alpha', 'beta', 'production'];

const USO =
  'uso: npm run play:promote -- <trilha> <versionCode> [nome] [--rollout=N] [--dry-run]\n' +
  `trilhas: ${TRILHAS.join(', ')}\n` +
  '--rollout=N  publica para N% dos usuários (1-99). Sem a flag, 100%.\n' +
  '--dry-run    mostra o que seria enviado e sai, sem tocar na Play.';

/**
 * Monta o `release` da requisição. Isolada de propósito: é a única parte com
 * regra de negócio, e o `--dry-run` a imprime sem rede — é como se verifica
 * este script sem publicar.
 *
 * Regras da Play API, não escolhas nossas:
 *   - `userFraction` só vale com `inProgress` (ou `halted`);
 *   - `completed` NÃO pode carregar `userFraction` — a requisição é recusada;
 *   - a fração é estritamente entre 0 e 1.
 */
export function montarRelease({ versionCode, releaseName, percentual }) {
  const base = {
    versionCodes: [versionCode],
    ...(releaseName ? { name: releaseName } : {}),
  };

  if (percentual === undefined) {
    return { ...base, status: 'completed' };
  }

  return {
    ...base,
    status: 'inProgress',
    userFraction: percentual / 100,
  };
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rolloutArg = args.find((a) => a.startsWith('--rollout'));
const posicionais = args.filter((a) => !a.startsWith('--'));

const [track, versionCode, releaseName] = posicionais;

if (!track || !versionCode) {
  console.error(USO);
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

let percentual;
if (rolloutArg) {
  const bruto = rolloutArg.split('=')[1];
  if (!bruto || !/^\d+$/.test(bruto)) {
    console.error(`--rollout precisa de um inteiro: --rollout=10`);
    process.exit(1);
  }
  percentual = Number(bruto);
  // 100 é recusado em vez de traduzido para `completed` silenciosamente: as
  // duas coisas são diferentes na Play (rollout encerrado x rollout em curso a
  // 100%), e adivinhar a intenção de quem digitou 100 seria pior que perguntar.
  if (percentual < 1 || percentual > 99) {
    console.error(
      `--rollout precisa estar entre 1 e 99, recebido: ${percentual}.\n` +
        'Para publicar a 100%, omita a flag.',
    );
    process.exit(1);
  }
}

const release = montarRelease({ versionCode, releaseName, percentual });
const corpo = { track, releases: [release] };

if (dryRun) {
  console.log('--dry-run: nada será enviado à Play.\n');
  console.log(`PUT .../tracks/${track}`);
  console.log(JSON.stringify(corpo, null, 2));
  process.exit(0);
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
      body: JSON.stringify(corpo),
    });
  },
  { commit: true },
);

console.log(
  `${track} agora: code ${versionCode} (status ${release.status}` +
    (percentual === undefined ? '' : `, ${percentual}% dos usuários`) +
    ')',
);
console.log('Confirme com: npm run play:status');
