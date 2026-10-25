/**
 * Guarda estática (revisão da tarefa 7, C1): quem grava o PRÓPRIO perfil
 * avisa as instâncias de `useUser` por `emitProfileUpdate`.
 *
 * Por que estática: as telas de edição de perfil não têm teste de tela, e o
 * defeito era silencioso — a instância do `UnidadeAtivaProvider` da raiz
 * (que nunca desmonta) seguia com o perfil velho, e o gestor novo abria o
 * painel sem loja. A busca compartilhada já propaga qualquer busca fresca
 * entre as instâncias (a correção da classe, testada em
 * `useUnidadeAtiva.perfil.test.tsx`); o aviso aqui faz a busca acontecer
 * sem depender de outra tela buscar.
 *
 * Arquivo novo que grave o próprio perfil entra nesta lista.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..', '..');

const GRAVAM_O_PROPRIO_PERFIL = [
  'src/hooks/onboarding/useCriarUnidade.ts', // o perfil nasce na RPC
  'app/perfil/editar.tsx', // nome e telefone do gestor
  'app/motorista/perfil/editar.tsx', // nome e telefone do motorista
  'app/onboarding/first-password.tsx', // primeira_senha
];

describe('gravar o próprio perfil avisa as instâncias de useUser', () => {
  it.each(GRAVAM_O_PROPRIO_PERFIL)('%s chama emitProfileUpdate()', (arquivo) => {
    const fonte = readFileSync(join(RAIZ, arquivo), 'utf8');
    expect(fonte).toMatch(/\bemitProfileUpdate\(\)/);
  });
});
