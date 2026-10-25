import { z } from 'zod';

/**
 * A CSP da web não tem `unsafe-eval`. O zod 4 compila validadores com
 * `new Function` (JIT) e testa se pode antes; sob CSP estrita o teste é
 * capturado, mas o navegador ainda registra `securitypolicyviolation`.
 * `jitless` pula o teste e usa o caminho interpretado, com o mesmo resultado.
 *
 * Importar antes de qualquer `parse` (o JIT é decidido no primeiro uso).
 */
z.config({ jitless: true });
