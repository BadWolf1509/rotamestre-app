#!/usr/bin/env node
/**
 * Autoteste da varredura de código morto.
 *
 * POR QUE ISTO EXISTE. Varredura que não acha nada é indistinguível de projeto
 * limpo: as duas devolvem lista vazia. Enquanto sobravam arquivos mortos
 * conhecidos, a própria lista servia de canário — se ela esvaziasse sem alguém
 * ter apagado nada, era sinal de config quebrada. Ao zerar a lista, esse
 * canário acabou, e a instrução que ficou no lugar ("plante um arquivo órfão
 * para reconferir") é manual, e instrução manual não é executada.
 *
 * Este comando é aquele plantio, automatizado: cria um arquivo que ninguém
 * importa, exige que o knip o encontre, e apaga. Se a varredura tiver
 * emburrecido — `project` deixando de casar, resolver quebrado, config
 * apontando para o vazio — ele falha aqui, ruidosamente, em vez de devolver
 * "nenhum arquivo morto" e parecer uma boa notícia.
 *
 * Fora do CI de propósito: gasta duas execuções do knip (~1 min) e serve para
 * quem for CONFIAR num resultado vazio, não para todo push.
 *
 * NÃO COLOQUE A ISCA NO .gitignore. O knip respeita o gitignore, então uma
 * isca ignorada fica invisível para ele e este autoteste passa a acusar
 * cegueira que não existe — foi exatamente o que aconteceu na primeira versão
 * daqui, onde a entrada tinha sido adicionada justamente para "proteger" o
 * repositório de uma execução interrompida. Medido: com a entrada, o knip
 * reporta a isca 0 vez; sem ela, 1.
 *
 * A proteção contra execução interrompida é outra, e melhor: o `finally`
 * abaixo apaga a isca, e a checagem de existência no início recusa rodar se
 * ela tiver sobrado. Arquivo órfão VISÍVEL no `git status` é preferível a
 * arquivo órfão escondido.
 *
 * Uso: npm run scan:morto:autoteste
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const RELATIVO = 'src/lib/__isca-da-varredura.ts';
const ISCA = path.join(RAIZ, RELATIVO);

// Precisa ser TypeScript válido e estar dentro de `project` do knip, mas fora
// de `entry` — por isso `src/lib/`, e não `app/` nem `.web.ts`.
const CONTEUDO = `// Arquivo temporário do autoteste da varredura (scripts/autoteste-varredura.js).
// Se ele sobreviveu a uma execução, o autoteste foi interrompido: pode apagar.
export const ISCA_DA_VARREDURA = 'nada importa este arquivo, e esse é o ponto';
`;

/** knip sai != 0 quando ACHA problema — que aqui é o resultado esperado. */
function varrerArquivos() {
  try {
    return execSync('npx knip --include files --no-progress', {
      cwd: RAIZ,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (erro) {
    return `${erro.stdout || ''}${erro.stderr || ''}`;
  }
}

function limpar() {
  if (fs.existsSync(ISCA)) fs.unlinkSync(ISCA);
}

function main() {
  if (fs.existsSync(ISCA)) {
    console.error(`✗ ${RELATIVO} já existe — sobra de execução interrompida.`);
    console.error('  Apague o arquivo e rode de novo.');
    process.exit(1);
  }

  let saidaComIsca = '';
  try {
    fs.writeFileSync(ISCA, CONTEUDO, 'utf-8');
    saidaComIsca = varrerArquivos();
  } finally {
    limpar();
  }

  if (!saidaComIsca.includes(RELATIVO)) {
    console.error('✗ A VARREDURA ESTÁ CEGA.');
    console.error(`  Plantei ${RELATIVO}, que ninguém importa, e o knip não o`);
    console.error('  reportou como arquivo morto. Enquanto isso não for');
    console.error('  corrigido, um resultado vazio de `npm run scan:morto` NÃO');
    console.error('  significa projeto limpo.');
    console.error('  Suspeite, nesta ordem: os globs de `project` no knip.jsonc,');
    console.error('  o resolver nativo (@unrs/resolver-binding-*), e um `entry`');
    console.error('  largo demais que esteja alcançando src/lib/.');
    process.exit(1);
  }

  // A segunda varredura prova que a limpeza funcionou — isca esquecida vira
  // falso positivo permanente na lista de todo mundo.
  const saidaSemIsca = varrerArquivos();
  if (saidaSemIsca.includes(RELATIVO)) {
    console.error(`✗ ${RELATIVO} continua sendo reportado após a remoção.`);
    console.error('  Confira se o arquivo sumiu do disco.');
    process.exit(1);
  }

  console.log('✓ A varredura enxerga: a isca foi plantada, encontrada e removida.');
  console.log('  Resultado vazio de `npm run scan:morto` pode ser lido como projeto limpo.');
}

main();
