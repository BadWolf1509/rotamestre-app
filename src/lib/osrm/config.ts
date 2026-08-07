/**
 * OSRM - Endpoint
 *
 * Fonte única da URL base do OSRM. Antes a constante estava duplicada em
 * `api.ts` e `table.ts`, e trocar de servidor exigia lembrar dos dois.
 */

import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

/**
 * Servidor self-hosted (extrato do Nordeste/BR). É o endpoint de produção.
 *
 * O openresty à frente dele responde com
 * `Access-Control-Allow-Origin: https://app.rotamestre.tec.br` — uma origem
 * fixa. O navegador então recusa a resposta quando a página é servida de
 * `localhost`, e o otimizador cai no fallback Haversine (linha reta × 1.3)
 * sem nenhum erro visível. Nativo não passa por CORS e não é afetado.
 */
const OSRM_SELF_HOSTED = 'https://osrm.rotamestre.tec.br';

/**
 * Servidor demo público do projeto OSRM. Responde
 * `Access-Control-Allow-Origin: *`, então funciona a partir de `localhost`.
 *
 * Só para desenvolvimento web: é rate-limited, o próprio projeto desaconselha
 * uso pesado, e cobre o planeta inteiro em vez do extrato do Nordeste — as
 * distâncias podem divergir um pouco das de produção.
 */
const OSRM_DEMO_PUBLICO = 'https://router.project-osrm.org';

/**
 * URL base do OSRM em uso.
 *
 * Precedência:
 * 1. `EXPO_PUBLIC_OSRM_URL`, quando definida (vale em qualquer plataforma)
 * 2. demo público, apenas em dev **web** — onde o CORS bloqueia o self-hosted
 * 3. self-hosted
 *
 * Produção e desenvolvimento nativo ficam no self-hosted, como sempre
 * estiveram: só o dev web muda de endereço, e é exatamente onde o CORS morde.
 */
export const OSRM_BASE_URL: string =
  process.env.EXPO_PUBLIC_OSRM_URL ||
  (__DEV__ && Platform.OS === 'web' ? OSRM_DEMO_PUBLICO : OSRM_SELF_HOSTED);

// Rodar contra um roteador diferente do de produção não pode ser silencioso:
// o extrato e o snapshot do OSM não são os mesmos, então as distâncias daqui
// não conferem exatamente com as de produção.
if (OSRM_BASE_URL !== OSRM_SELF_HOSTED) {
  logger.info('[OSRM] Usando endpoint alternativo', { url: OSRM_BASE_URL });
}

export { OSRM_SELF_HOSTED, OSRM_DEMO_PUBLICO };
