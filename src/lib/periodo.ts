/**
 * Período de datas das telas com filtro (atalhos + personalizado).
 *
 * Todas as datas são `'AAAA-MM-DD'` do calendário local (colunas `date`, como
 * `rotas.data`). A aritmética trabalha nos componentes numéricos, com
 * `Date.UTC`/`getUTCDay`, que não sofrem com o fuso do aparelho: nunca
 * `new Date('AAAA-MM-DD')` (meia-noite UTC) nem o dia tirado de um ISO em UTC.
 * "Hoje" é o dia local (`getTodayISO`); o banco nunca o calcula.
 */
import { getTodayISO } from '@/lib/dateUtils';

export type AtalhoPeriodo =
  | 'hoje'
  | 'ontem'
  | 'esta_semana'
  | 'semana_passada'
  | 'este_mes'
  | 'mes_passado'
  | 'todo';

export type Periodo =
  { tipo: AtalhoPeriodo } | { tipo: 'personalizado'; de: string; ate: string };

export interface IntervaloDatas {
  de: string | null;
  ate: string | null;
}

/** Ordem da UI, sem 'personalizado' (a tela o insere entre os atalhos). */
export const ATALHOS_PERIODO: readonly AtalhoPeriodo[] = [
  'hoje',
  'ontem',
  'esta_semana',
  'semana_passada',
  'este_mes',
  'mes_passado',
  'todo',
];

export const ROTULO_PERIODO: Record<AtalhoPeriodo | 'personalizado', string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  esta_semana: 'Esta semana',
  semana_passada: 'Semana passada',
  este_mes: 'Este mês',
  mes_passado: 'Mês passado',
  personalizado: 'Personalizado',
  todo: 'Todo o período',
};

export const PERIODO_PADRAO: Periodo = { tipo: 'este_mes' };

const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Componentes {
  ano: number;
  mes: number; // 1-12
  dia: number;
}

function ler(iso: string): Componentes | null {
  const m = FORMATO_ISO.exec(iso);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const t = new Date(Date.UTC(ano, mes - 1, dia));
  // Data impossível (30/02) rola para o mês seguinte: não bate de volta.
  if (
    t.getUTCFullYear() !== ano ||
    t.getUTCMonth() !== mes - 1 ||
    t.getUTCDate() !== dia
  ) {
    return null;
  }
  return { ano, mes, dia };
}

function montar(ms: number): string {
  const t = new Date(ms);
  const ano = String(t.getUTCFullYear()).padStart(4, '0');
  const mes = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(t.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somarDias(iso: string, dias: number): string {
  const c = ler(iso);
  if (!c) return iso;
  return montar(Date.UTC(c.ano, c.mes - 1, c.dia + dias));
}

/** Dias desde a segunda-feira (segunda = 0 ... domingo = 6). */
function diasDesdeSegunda(c: Componentes): number {
  const dow = new Date(Date.UTC(c.ano, c.mes - 1, c.dia)).getUTCDay();
  return (dow + 6) % 7;
}

function mesInteiro(ano: number, mes: number): IntervaloDatas {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const aaaa = String(ano).padStart(4, '0');
  const mm = String(mes).padStart(2, '0');
  return {
    de: `${aaaa}-${mm}-01`,
    ate: `${aaaa}-${mm}-${String(ultimo).padStart(2, '0')}`,
  };
}

/**
 * Intervalo fechado do período; `todo` é `{ de: null, ate: null }`.
 * `hojeISO` inválido (só por chamada errada) devolve o mesmo que `todo`.
 */
export function resolverPeriodo(
  p: Periodo,
  hojeISO: string = getTodayISO(),
): IntervaloDatas {
  if (p.tipo === 'personalizado') return { de: p.de, ate: p.ate };
  if (p.tipo === 'todo') return { de: null, ate: null };

  const hoje = ler(hojeISO);
  if (!hoje) return { de: null, ate: null };

  switch (p.tipo) {
    case 'hoje':
      return { de: hojeISO, ate: hojeISO };
    case 'ontem': {
      const ontem = somarDias(hojeISO, -1);
      return { de: ontem, ate: ontem };
    }
    case 'esta_semana': {
      const segunda = somarDias(hojeISO, -diasDesdeSegunda(hoje));
      return { de: segunda, ate: somarDias(segunda, 6) };
    }
    case 'semana_passada': {
      const segunda = somarDias(hojeISO, -diasDesdeSegunda(hoje) - 7);
      return { de: segunda, ate: somarDias(segunda, 6) };
    }
    case 'este_mes':
      return mesInteiro(hoje.ano, hoje.mes);
    case 'mes_passado':
      return hoje.mes === 1
        ? mesInteiro(hoje.ano - 1, 12)
        : mesInteiro(hoje.ano, hoje.mes - 1);
  }
}

/**
 * Corta o fim do intervalo em hoje (Meu Desempenho e Perfil). `null` quando o
 * intervalo começa depois de hoje: a tela mostra o vazio do período.
 */
export function cortarEmHoje(
  i: IntervaloDatas,
  hojeISO: string = getTodayISO(),
): IntervaloDatas | null {
  // 'AAAA-MM-DD' ordena como texto.
  if (i.de !== null && i.de > hojeISO) return null;
  const fim = i.ate ?? hojeISO;
  return { de: i.de, ate: fim < hojeISO ? fim : hojeISO };
}

function textoDatas(de: string, ate: string, hojeISO: string): string {
  const anoCorrente = hojeISO.slice(0, 4);
  const comAno =
    de.slice(0, 4) !== anoCorrente || ate.slice(0, 4) !== anoCorrente;
  // Montado da string, sem Date: `toLocaleDateString` no Hermes sem ICU
  // devolveria en-US calado.
  const formatar = (iso: string): string => {
    const [aaaa, mm, dd] = iso.split('-');
    return comAno ? `${dd}/${mm}/${aaaa}` : `${dd}/${mm}`;
  };
  return de === ate ? formatar(de) : `${formatar(de)} a ${formatar(ate)}`;
}

/**
 * Só as datas do intervalo: "01/10 a 15/10", "10/11" quando as pontas são
 * iguais, com o ano quando alguma ponta sai do ano corrente. `''` quando
 * falta alguma ponta ("Todo o período").
 */
export function textoDatasPeriodo(
  intervalo: IntervaloDatas,
  hojeISO: string = getTodayISO(),
): string {
  const { de, ate } = intervalo;
  if (!de || !ate) return '';
  return textoDatas(de, ate, hojeISO);
}

/** "Este mês (01/11 a 30/11)"; usa `intervalo` quando a tela já o cortou. */
export function textoPeriodo(
  p: Periodo,
  intervalo?: IntervaloDatas,
  hojeISO: string = getTodayISO(),
): string {
  const rotulo = ROTULO_PERIODO[p.tipo];
  if (p.tipo === 'todo') return rotulo;
  const datas = textoDatasPeriodo(
    intervalo ?? resolverPeriodo(p, hojeISO),
    hojeISO,
  );
  return datas ? `${rotulo} (${datas})` : rotulo;
}

/**
 * Limites do intervalo como instantes ISO, para colunas `timestamptz`:
 * meia-noite local de `de` e meia-noite local do dia seguinte a `ate`
 * (o `antesDe` é exclusivo).
 */
export function limitesEmInstante(i: IntervaloDatas): {
  desde: string | null;
  antesDe: string | null;
} {
  const meiaNoite = (iso: string | null): string | null => {
    const c = iso ? ler(iso) : null;
    return c ? new Date(c.ano, c.mes - 1, c.dia).toISOString() : null;
  };
  return {
    desde: meiaNoite(i.de),
    antesDe: i.ate ? meiaNoite(somarDias(i.ate, 1)) : null,
  };
}

/** Valida o que veio do disco; `null` quando não é um período válido. */
export function lerPeriodo(valor: unknown): Periodo | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const { tipo } = valor as { tipo?: unknown };
  if (typeof tipo !== 'string') return null;
  if ((ATALHOS_PERIODO as readonly string[]).includes(tipo)) {
    return { tipo: tipo as AtalhoPeriodo };
  }
  if (tipo !== 'personalizado') return null;
  const { de, ate } = valor as { de?: unknown; ate?: unknown };
  if (typeof de !== 'string' || typeof ate !== 'string') return null;
  if (!ler(de) || !ler(ate) || de > ate) return null;
  return { tipo: 'personalizado', de, ate };
}
