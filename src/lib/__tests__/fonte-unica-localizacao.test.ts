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
 * desmonta durante o `await`. Também não pega um import de namespace
 * renomeado (`import * as ExpoLocation from 'expo-location'` escaparia do
 * literal `Location`/`ImagePicker` que os regexes procuram) nem `let` no
 * lugar de `const` na forma com destructuring — `statusVemDeUmPedidoDireto`
 * só reconhece `const {...} =`.
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

/**
 * Substitui o CONTEÚDO de strings e template literals por `#`, preservando
 * aspas/crases e quebras de linha. Roda ANTES de tirar comentários: um `//`
 * dentro de uma URL (`'https://api.example.com'`) é indistinguível de início
 * de comentário para o replace de linha em `semComentarios`, que apagava tudo
 * que vem depois na mesma linha física — inclusive uma violação real.
 * Reproduzido: `const apiUrl = 'https://...'; const { status } = await
 * Location.requestForegroundPermissionsAsync();` virava `const apiUrl =
 * 'https:` e a segunda metade da linha sumia antes de qualquer regex de
 * detecção rodar.
 *
 * Heurística por regex, não um parser de verdade: não resolve `${...}`
 * aninhado dentro de template literals nem literais de regex com `/`.
 * Suficiente para o que os call sites deste repo escrevem.
 */
function comStringsNeutralizadas(fonte: string): string {
  return fonte.replace(
    /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
    (literal) =>
      literal[0] +
      literal.slice(1, -1).replace(/[^\n]/g, '#') +
      literal[literal.length - 1],
  );
}

function semComentarios(fonte: string): string {
  return comStringsNeutralizadas(fonte)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * Verdadeiro quando um `status` chega DIRETO do retorno de
 * `request(Foreground|Background|Camera|MediaLibrary)PermissionsAsync` — por
 * destructuring, por acesso de propriedade inline (`(await ...).status`) ou
 * por uma variável intermediária (`const r = await ...; ...r.status...`). Não
 * conta qualquer `status` do arquivo que não venha dessa chamada.
 *
 * POR QUE NÃO UM REGEX SÓ. A primeira versão testava duas condições
 * independentes no arquivo inteiro ("tem `request...PermissionsAsync`" E "tem
 * `const { status`") sem exigir que fosse a MESMA atribuição. Isso acusou
 * `TurnByTurnNavigation.tsx`, cujo `const { status: offRouteStatus, … } =
 * useOffRouteDetection(...)` não tem nenhuma relação com permissão — só
 * coincide o nome do campo. E teria acusado `unifiedLocationTracking.ts` pelo
 * `const { status: foregroundStatus } = await
 * Location.getForegroundPermissionsAsync()` legítimo, mesmo depois de
 * corrigido o `request` real do mesmo arquivo. A janela depois do `=`
 * (limitada, para não custar performance nem cruzar várias instruções)
 * confirma que quem seguia o destructuring era mesmo um `await
 * …request…PermissionsAsync(`.
 *
 * TRÊS FORMAS PARA O MESMO DEFEITO. Destructuring nunca foi a única forma de
 * descartar o `canAskAgain`. Antes da Task 8, `unifiedLocationTracking.ts`
 * tinha literalmente `: (await
 * Location.requestForegroundPermissionsAsync()).status` — acesso de
 * propriedade inline, zero destructuring — e um regex que só olhasse
 * `const {...status...}` nunca teria acusado. A variável intermediária
 * (`const r = await ImagePicker.requestCameraPermissionsAsync(); if
 * (r.status …)`) é a mesma fuga por um caminho diferente. As três convergem
 * para o mesmo `canAskAgain` perdido, então levam o mesmo veto. Em ambas as
 * formas novas, exigir literalmente `request...PermissionsAsync` (nunca
 * `get...`) é o que mantém `checkLocationPermissions` (`unifiedLocationTracking.ts`)
 * e `useRevalidarPermissaoDeLocalizacao.ts` fora, do mesmo jeito que a Forma 1
 * já fazia.
 */
function statusVemDeUmPedidoDireto(fonte: string): boolean {
  const JANELA = 150;

  // Forma 1 — destructuring: `const { status, ... } = await Location.request...()`.
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

  // Forma 2 — propriedade lida inline, sem destructuring nenhum:
  // `(await Location.request...()).status`. Era a forma real do defeito em
  // `unifiedLocationTracking.ts` antes da Task 8.
  if (
    /\(\s*await\s+(Location|ImagePicker)\.request(Foreground|Background|Camera|MediaLibrary)PermissionsAsync\s*\([^)]*\)\s*\)\s*\.\s*status\b/.test(
      fonte,
    )
  ) {
    return true;
  }

  // Forma 3 — variável intermediária: `const r = await
  // Location.request...();` e, um pouco mais adiante — raramente na mesma
  // expressão, por isso a janela maior que a da Forma 1 — `r.status`.
  const JANELA_VARIAVEL = 200;
  const atribuicoes = fonte.matchAll(
    /\b(?:const|let)\s+(\w+)\s*=\s*await\s+(?:Location|ImagePicker)\.request(?:Foreground|Background|Camera|MediaLibrary)PermissionsAsync\s*\([^)]*\)/g,
  );
  for (const match of atribuicoes) {
    const nomeDaVariavel = match[1];
    const inicioDoResto = (match.index ?? 0) + match[0].length;
    const resto = fonte.slice(inicioDoResto, inicioDoResto + JANELA_VARIAVEL);
    // `nomeDaVariavel` só pode conter [A-Za-z0-9_] (vem de `\w+`), então não
    // há risco de injeção ao montar o regex dinamicamente aqui.
    if (new RegExp(`\\b${nomeDaVariavel}\\.status\\b`).test(resto)) {
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

// FIX ROUND 1 — os dois testes abaixo provam dois buracos na própria guarda
// (não no repo escaneado). Escritos para rodar contra os helpers ANTES da
// correção e falhar (RED); ver task-8-report.md § Fix round 1 para a saída
// verbatim das duas rodadas.
describe('fix round 1 — buracos da guarda fechados', () => {
  describe('status lido sem destructuring evadia statusVemDeUmPedidoDireto', () => {
    it('acesso de propriedade inline `(await ...).status` é detectado', () => {
      const fixture = `
        const granted = (await Location.requestForegroundPermissionsAsync()).status === 'granted';
      `;
      expect(statusVemDeUmPedidoDireto(fixture)).toBe(true);
    });

    it('status lido de uma variável intermediária é detectado', () => {
      const fixture = `
        const r = await ImagePicker.requestCameraPermissionsAsync();
        if (r.status !== 'granted') return;
      `;
      expect(statusVemDeUmPedidoDireto(fixture)).toBe(true);
    });

    it('a forma destructuring com alias em duas linhas continua detectada (PreRouteChecklist)', () => {
      const fixture = `
        const { status: permStatus } =
          await Location.requestForegroundPermissionsAsync();
      `;
      expect(statusVemDeUmPedidoDireto(fixture)).toBe(true);
    });

    it('o get* legítimo continua fora, mesmo por variável intermediária (unifiedLocationTracking)', () => {
      const fixture = `
        const currentForeground = await Location.getForegroundPermissionsAsync();
        let foregroundGranted = currentForeground.status === 'granted';
      `;
      expect(statusVemDeUmPedidoDireto(fixture)).toBe(false);
    });
  });

  describe('URL com // na mesma linha de uma violação real evadia semComentarios', () => {
    it('semComentarios preserva a violação depois da URL, em vez de apagar o resto da linha', () => {
      const linha =
        "const apiUrl = 'https://api.example.com'; const { status } = await Location.requestForegroundPermissionsAsync();";

      const limpo = semComentarios(linha);

      expect(limpo).toContain(
        'await Location.requestForegroundPermissionsAsync()',
      );
      // Sobreviver ao replace não basta sozinho: o predicado que decide
      // "infrator ou não" também precisa reconhecer o que sobrou.
      expect(statusVemDeUmPedidoDireto(limpo)).toBe(true);
    });
  });
});
