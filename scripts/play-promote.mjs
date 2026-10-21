/* global console */
/**
 * Promove um versionCode JÁ enviado à Play para uma ou mais trilhas.
 *
 *   npm run play:promote -- <trilha[,trilha...]> <versionCode> [nome] [--notas=<arquivo>] [--rollout=N] [--dry-run]
 *   npm run play:promote -- internal 3025 1.12.2
 *   npm run play:promote -- internal,alpha 3037 1.13.0 --notas=notas.txt
 *   npm run play:promote -- production 3030 1.12.5 --rollout=10 --notas=notas.txt --dry-run
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
 * `--notas=<arquivo>` aplica as notas da versão (pt-BR, até 500 caracteres).
 * O PUT substitui a release inteira, então promover SEM a flag apaga as notas
 * que a trilha tinha — e o `eas submit` da interna também sobe sem notas. Para
 * só reaplicar notas, rode de novo com o mesmo versionCode e a flag.
 *
 * Várias trilhas (`internal,alpha`) vão na MESMA edição, com um único commit:
 * ou todas mudam, ou nenhuma. Lembre que a Play serve a trilha de maior
 * prioridade (interno > fechado), então interna e alpha devem andar juntas.
 *
 * PUBLICA DE VERDADE: o edit é commitado. Confirme as trilhas antes de rodar, ou
 * use `--dry-run` para ver o corpo exato das requisições sem tocar na Play.
 */
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import {
  api,
  getAccessToken,
  loadCredentials,
  withEdit,
} from './lib/play-api.mjs';
import {
  TRILHAS,
  lerTrilhas,
  montarRelease,
  validarNotas,
} from './lib/play-release.js';

const USO =
  'uso: npm run play:promote -- <trilha[,trilha...]> <versionCode> [nome] [--notas=<arquivo>] [--rollout=N] [--dry-run]\n' +
  `trilhas: ${TRILHAS.join(', ')} (várias separadas por vírgula vão na mesma edição)\n` +
  '--notas=F    aplica o texto do arquivo F como notas da versão em pt-BR (até 500 caracteres).\n' +
  '             Sem a flag, a release sai SEM notas — e as que a trilha tinha somem.\n' +
  '--rollout=N  publica para N% dos usuários (1-99). Sem a flag, 100%. Só com uma trilha.\n' +
  '--dry-run    mostra o que seria enviado e sai, sem tocar na Play.';

function falhar(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rolloutArg = args.find((a) => a.startsWith('--rollout'));
const notasArg = args.find((a) => a.startsWith('--notas'));
const posicionais = args.filter((a) => !a.startsWith('--'));

const [trilhasArg, versionCode, releaseName] = posicionais;

if (!trilhasArg || !versionCode) {
  falhar(USO);
}

let trilhas;
try {
  trilhas = lerTrilhas(trilhasArg);
} catch (error) {
  falhar(error.message);
}

if (!/^\d+$/.test(versionCode)) {
  falhar(`versionCode deve ser numérico, recebido: ${versionCode}`);
}

let percentual;
if (rolloutArg) {
  const bruto = rolloutArg.split('=')[1];
  if (!bruto || !/^\d+$/.test(bruto)) {
    falhar(`--rollout precisa de um inteiro: --rollout=10`);
  }
  percentual = Number(bruto);
  // 100 é recusado em vez de traduzido para `completed` silenciosamente: as
  // duas coisas são diferentes na Play (rollout encerrado x rollout em curso a
  // 100%), e adivinhar a intenção de quem digitou 100 seria pior que perguntar.
  if (percentual < 1 || percentual > 99) {
    falhar(
      `--rollout precisa estar entre 1 e 99, recebido: ${percentual}.\n` +
        'Para publicar a 100%, omita a flag.',
    );
  }
  // Rollout gradual é coisa de produção; aplicar a mesma fração à interna ou
  // ao teste fechado junto seria acidente, não intenção.
  if (trilhas.length > 1) {
    falhar(
      '--rollout só vale com uma trilha. Promova as demais em outra chamada.',
    );
  }
}

let notas;
if (notasArg) {
  const arquivo = notasArg.split('=').slice(1).join('=');
  if (!arquivo) {
    falhar('--notas precisa de um arquivo: --notas=notas.txt');
  }
  let texto;
  try {
    texto = await readFile(arquivo, 'utf8');
  } catch {
    falhar(`Não consegui ler o arquivo de notas: ${arquivo}`);
  }
  try {
    notas = validarNotas(texto);
  } catch (error) {
    falhar(error.message);
  }
}

const release = montarRelease({ versionCode, releaseName, percentual, notas });

if (dryRun) {
  console.log('--dry-run: nada será enviado à Play.\n');
  for (const track of trilhas) {
    console.log(`PUT .../tracks/${track}`);
    console.log(JSON.stringify({ track, releases: [release] }, null, 2));
  }
  if (notas) {
    console.log(`\nNotas: ${[...notas].length} de 500 caracteres.`);
  } else {
    console.log('\nSem --notas: a release sai SEM notas da versão.');
  }
  process.exit(0);
}

const credentials = await loadCredentials();
const token = await getAccessToken(credentials);

await withEdit(
  token,
  async (_editId, base) => {
    for (const track of trilhas) {
      const antes = await api(token, `${base}/tracks/${track}`);
      console.log(
        `${track} antes:`,
        JSON.stringify((antes.releases ?? []).map((r) => r.versionCodes)),
      );

      await api(token, `${base}/tracks/${track}`, {
        method: 'PUT',
        body: JSON.stringify({ track, releases: [release] }),
      });
    }
  },
  { commit: true },
);

for (const track of trilhas) {
  console.log(
    `${track} agora: code ${versionCode} (status ${release.status}` +
      (percentual === undefined ? '' : `, ${percentual}% dos usuários`) +
      (notas ? ', com notas' : ', sem notas') +
      ')',
  );
}
console.log('Confirme com: npm run play:status');
