import { join } from 'path';

/**
 * Sessões salvas pelo projeto `setup` (`e2e/auth.setup.ts`) e reusadas por
 * todo teste autenticado via `test.use({ storageState: SESSAO_GESTOR })`.
 *
 * POR QUE EXISTE. Cada teste da suíte fazia login do zero. Medido em
 * 07/09/2026: **5.979 ms por login**, 121 testes — praticamente todo o tempo
 * de execução da suíte era digitar e-mail e senha. Era também a única fonte de
 * instabilidade que restava: o `waitForURL` do `beforeEach` estourava 30s de
 * vez em quando, e o app ainda mantém um limitador de tentativas por e-mail
 * (`@rotamestre/login_limit_<email>` no localStorage), contra o qual 121
 * logins por execução correm sem necessidade.
 *
 * ONDE MORA A SESSÃO. Na web o `secureAuthStorage` cai no AsyncStorage, que é
 * `localStorage` — a chave `sb-<projeto>-auth-token`. O `storageState` do
 * Playwright captura `localStorage` por origem, então a sessão viaja inteira.
 *
 * ESTES ARQUIVOS CONTÊM TOKEN DE ACESSO REAL de conta de PRODUÇÃO. Ficam em
 * `e2e/.auth/`, que está no `.gitignore` — nunca versione, nunca anexe a
 * relatório de CI.
 */
const DIRETORIO = join('e2e', '.auth');

export const SESSAO_GESTOR = join(DIRETORIO, 'gestor.json');
export const SESSAO_MOTORISTA = join(DIRETORIO, 'motorista.json');

/**
 * Estado explicitamente DESLOGADO.
 *
 * Necessário porque o `storageState` de um `describe` não é o padrão do
 * arquivo: um teste que precisa da tela de login (o próprio `auth.e2e.ts`, as
 * telas públicas do visual) tem de dizer que quer sessão vazia, senão herda a
 * do projeto quando alguém a mover para lá.
 */
export const SEM_SESSAO = { cookies: [], origins: [] };
