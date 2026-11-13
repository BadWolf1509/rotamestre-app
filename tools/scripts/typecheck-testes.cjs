#!/usr/bin/env node
/**
 * `npm run typecheck:tests` — o `tsc` que olha os testes.
 *
 * O `tsconfig.json` exclui `__tests__`, `*.test.ts(x)` e `__mocks__`, então um
 * nome removido de um módulo que só um teste importa passa no `type-check` — e
 * no jest também, quando o teste só roda condicionalmente (`emSP ? it : it.skip`).
 * Este script roda o `tsc` com `tsconfig.testes.json` (que inclui os testes) e
 * reprova só os erros de **import/membro inexistente**: os testes têm centenas
 * de erros de tipagem de mock (`mockResolvedValue` etc.) que não são isso e não
 * são bloqueantes. Criado na faxina de 13/11/2026.
 */
const { spawnSync } = require('child_process');

// Membro ou módulo inexistente: o que uma remoção de export quebra.
const CODIGOS_DE_IMPORT = ['TS2305', 'TS2307', 'TS2614', 'TS2694', 'TS2724'];

/** Linhas da saída do tsc que são erro de import/membro inexistente. */
function errosDeImport(saida) {
  return saida
    .split(/\r?\n/)
    .filter((linha) =>
      CODIGOS_DE_IMPORT.some((codigo) => linha.includes(`error ${codigo}:`)),
    );
}

/**
 * O tsc rodou e checou arquivos? Exit 0, ou exit ≠ 0 com ao menos um erro
 * preso a arquivo(linha,coluna). Erro de configuração (TS5058, caminho que não
 * existe) não tem posição — e "nenhum erro de import" ali seria falso verde.
 */
function rodouDeVerdade(status, saida) {
  if (status === 0) return true;
  if (status === null) return false;
  return /\(\d+,\d+\): error TS\d+/.test(saida);
}

function main() {
  const resultado = spawnSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.testes.json', '--pretty', 'false'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const saida = `${resultado.stdout ?? ''}${resultado.stderr ?? ''}`;

  if (!rodouDeVerdade(resultado.status, saida)) {
    console.error('✖ O tsc não chegou a checar os arquivos (exit %s):', resultado.status);
    console.error(saida.slice(0, 2000));
    process.exit(2);
  }

  const erros = errosDeImport(saida);
  if (erros.length) {
    console.error(`✖ ${erros.length} import(s) de nome ou módulo que não existe nos testes:\n`);
    for (const linha of erros) console.error(`  ${linha}`);
    process.exit(1);
  }
  console.log('✓ Nenhum teste importa nome ou módulo que não existe.');
}

if (require.main === module) main();

module.exports = { errosDeImport, rodouDeVerdade, CODIGOS_DE_IMPORT };
