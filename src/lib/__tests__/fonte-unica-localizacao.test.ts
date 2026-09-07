/**
 * Guarda de fonte única para localização e permissões.
 *
 * POR QUE EXISTE. Cinco arquivos criavam `watchPositionAsync` com a mesma
 * corrida (assinatura atribuída depois de um `await`, cleanup lendo `null`) e
 * dez pediam permissão descartando o `canAskAgain`. Corrigir as instâncias sem
 * fechar a porta só adia: o próximo call site nasce com o mesmo defeito, e
 * nada em CI reclama.
 *
 * O QUE ELA NÃO PEGA: se `useLocationWatcher` ou `permissoes.ts` quebrarem por
 * dentro, esta guarda segue verde. Quem cobre isso é
 * `src/hooks/__tests__/useLocationWatcher.test.ts` — em particular o teste que
 * desmonta durante o `await`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { sync as glob } from 'glob';

const RAIZ = join(__dirname, '..', '..', '..');

const FONTE_DO_WATCHER = 'src/hooks/useLocationWatcher.ts';
const FONTE_DAS_PERMISSOES = 'src/lib/permissoes.ts';

/**
 * `useDriverLocationBroadcast` usa `navigator.geolocation.watchPosition` no
 * ramo web — API do navegador, não `expo-location`, e sem a corrida que o hook
 * resolve. Fica de fora por natureza, não por dívida.
 */
const EXCECOES_DO_WATCHER: string[] = [];

const EXCECOES_DAS_PERMISSOES = [
  // Já implementa o comportamento correto — o `openSettings` da linha 182 foi
  // a referência de onde `permissoes.ts` saiu. Migrá-lo é refatoração sem
  // ganho de comportamento; fica de fora com o motivo escrito.
  'src/components/motorista/home/PreRouteChecklist.tsx',
];

function arquivosDeProducao(): string[] {
  return (
    glob('{src,app}/**/*.{ts,tsx}', { cwd: RAIZ })
      // No Windows o `glob` devolve `\` como separador. As constantes acima (e
      // a lista de exceções) são escritas com `/` — sem normalizar aqui, a
      // comparação de string falha e o PRÓPRIO `useLocationWatcher.ts` (e a
      // exceção nomeada) aparecem como infratores. Descoberto rodando a guarda
      // de verdade neste repo, num Windows, não deduzido.
      .map((caminho) => caminho.split('\\').join('/'))
      .filter((caminho) => !caminho.includes('__tests__'))
      .filter((caminho) => !caminho.endsWith('.test.ts'))
      .filter((caminho) => !caminho.endsWith('.test.tsx'))
  );
}

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Verdadeiro só quando um `status` desestruturado vem DIRETO do retorno de
 * `request(Foreground|Background|Camera|MediaLibrary)PermissionsAsync` — não
 * de qualquer `const { status … }` do arquivo.
 *
 * POR QUE NÃO UM REGEX SÓ. A primeira versão testava duas condições
 * independentes no arquivo inteiro ("tem `request...PermissionsAsync`" E "tem
 * `const { status`") sem exigir que fosse a MESMA atribuição. Isso acusou
 * `TurnByTurnNavigation.tsx`, cujo `const { status: offRouteStatus, … } =
 * useOffRouteDetection(...)` não tem nenhuma relação com permissão — só
 * coincide o nome do campo. E teria acusado `unifiedLocationTracking.ts` pelo
 * `const { status } = await Location.getForegroundPermissionsAsync()`
 * legítimo, mesmo depois de corrigido o `request` real do mesmo arquivo. A
 * janela depois do `=` (limitada, para não custar performance nem cruzar
 * várias instruções) confirma que quem seguia o destructuring era mesmo um
 * `await …request…PermissionsAsync(`.
 */
function statusVemDeUmPedidoDireto(fonte: string): boolean {
  const JANELA = 150;
  const destructures = fonte.matchAll(/const\s*\{[^}]*\bstatus\b[^}]*\}\s*=/g);

  for (const match of destructures) {
    const inicioDoRhs = (match.index ?? 0) + match[0].length;
    const janela = fonte.slice(inicioDoRhs, inicioDoRhs + JANELA);
    if (
      /^\s*await\s+(Location|ImagePicker)\.request(Foreground|Background|Camera|MediaLibrary)PermissionsAsync\b/.test(
        janela,
      )
    ) {
      return true;
    }
  }

  return false;
}

describe('fonte única do watcher de localização', () => {
  it('só o hook chama Location.watchPositionAsync', () => {
    const infratores = arquivosDeProducao()
      .filter(
        (caminho) =>
          caminho !== FONTE_DO_WATCHER &&
          !EXCECOES_DO_WATCHER.includes(caminho),
      )
      .filter((caminho) =>
        /\bwatchPositionAsync\b/.test(
          semComentarios(readFileSync(join(RAIZ, caminho), 'utf8')),
        ),
      );

    expect(infratores).toEqual([]);
  });

  it('o hook realmente chama, para a guarda não passar por ausência', () => {
    const fonte = readFileSync(join(RAIZ, FONTE_DO_WATCHER), 'utf8');
    expect(fonte).toContain('Location.watchPositionAsync');
  });
});

describe('fonte única do pedido de permissão', () => {
  it('nenhum call site pede permissão direto à lib', () => {
    const infratores = arquivosDeProducao()
      .filter((caminho) => !EXCECOES_DAS_PERMISSOES.includes(caminho))
      .filter((caminho) =>
        /\brequest(Foreground|Background|Camera|MediaLibrary)PermissionsAsync\b/.test(
          semComentarios(readFileSync(join(RAIZ, caminho), 'utf8')),
        ),
      )
      // Os call sites legítimos passam a função a `pedirPermissao`, então
      // mencionam o nome. O que a guarda proíbe é consumir o `status` direto
      // — e "direto" significa o destructuring ser a MESMA atribuição do
      // `request...PermissionsAsync`, não qualquer `status` do arquivo (ver
      // `statusVemDeUmPedidoDireto`).
      .filter((caminho) =>
        statusVemDeUmPedidoDireto(
          semComentarios(readFileSync(join(RAIZ, caminho), 'utf8')),
        ),
      );

    expect(infratores).toEqual([]);
  });

  it('permissoes.ts expõe a saída para as Configurações', () => {
    const fonte = readFileSync(join(RAIZ, FONTE_DAS_PERMISSOES), 'utf8');
    expect(fonte).toContain('export function abrirConfiguracoesDoApp');
    expect(fonte).toContain('canAskAgain');
  });
});
