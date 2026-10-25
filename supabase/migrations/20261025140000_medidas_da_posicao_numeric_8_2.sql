-- ============================================================================
-- Migration 60: medidas da posição (velocidade, precisão, heading) em
-- numeric(8,2)
-- Date: 2026-10-25
-- Author: Wellinton Ribeiro
-- Purpose:
--   `motorista_locations.velocidade`, `.precisao` e `.heading` nasceram
--   `numeric(5,2)` (Migration 007), com teto de 999,99. Medido no aparelho em
--   25/10/2026: logo depois de abrir o app em ambiente fechado, o GPS entregou
--   `coords.accuracy` de 1000 m ou mais, e o insert foi recusado com 22003 ("A
--   field with precision 5, scale 2 must round to an absolute value less than
--   10^3"). Com rede, a posição se perdia; sem rede, ela entrava na fila do
--   aparelho e prendia o lote da rota inteira no reenvio
--   (`src/lib/motorista/filaPosicoes.ts`). A precisão ruim é justamente a
--   informação de que a posição é ruim, e o trajeto precisa dela.
--
--   Esta migration alarga as três colunas para `numeric(8,2)` (teto
--   999.999,99). O app passa a sanear as medidas antes de gravar
--   (`sanearPosicao`, mesmo arquivo): não finito, negativo, heading fora de
--   [0, 360) e valor acima do teto do tipo novo viram null, e a posição em si
--   nunca é descartada. A guarda estática confere que o teto do app
--   (`TETO_MEDIDA_POSICAO`) é o maior valor deste tipo.
--
--   Sem reescrita da tabela: aumentar a precisão de um numeric mantendo a
--   escala é conversão binária compatível (o valor guardado não muda), e o
--   Postgres só troca o catálogo. Nenhum índice inclui estas colunas (os de
--   `motorista_locations` são de motorista_id, rota_id, timestamp e fonte),
--   então nenhum índice é refeito. O ALTER ainda pede ACCESS EXCLUSIVE por um
--   instante; `lock_timeout` de 5 s evita que ele fique na fila do lock
--   bloqueando os inserts de posição que chegam a cada poucos segundos — se
--   estourar, a migration falha inteira e é só rodar de novo.
--
--   Dependências conferidas no repositório (25/10/2026): nenhuma view, função,
--   gatilho ou policy usa estas colunas. As policies de `motorista_locations`
--   leem `motorista_id` e `rota_id`; a retenção de 90 dias (Migration 37 e a
--   Edge Function `expire-routes`) apaga por `timestamp`; o realtime publica a
--   linha inteira e não depende do tipo. Se o banco tivesse uma view sobre a
--   coluna, o ALTER recusaria (e a transação desfaria tudo).
--
--   Alternativas consideradas:
--     (a) numeric(8,2) (escolhida): cobre qualquer accuracy/velocidade que um
--         GPS entrega (o pior caso real é a precisão por célula/Wi-Fi, de
--         alguns km), mantém a escala e o arredondamento, sem reescrita.
--     (b) numeric sem typmod: sem teto nenhum, o que tira a referência do
--         saneamento do app, e mudar o typmod para "sem limite" também é só
--         catálogo — mas qualquer lixo do sensor passaria a ser gravado.
--     (c) real/double precision: muda o tipo que o PostgREST devolve e o
--         arredondamento que o gestor vê, e exige reescrita da tabela.
--     (d) só limitar no app ao teto antigo (999,99): gravaria uma precisão
--         falsa justamente nas posições ruins, sem migration.
--     (e) CHECK com teto menor: recusaria a linha de novo (23514), que é o
--         defeito que se quer fechar.
--
--   App: `sanearPosicao` e a recusa 22003 tratada como recusa de dado em
--   `src/lib/motorista/filaPosicoes.ts`. Tipos do cliente (`Posicao`) já
--   são `number | null`; nada a mudar.
--
--   Verificação: guarda estática
--   `database/__tests__/migration60-medidas-da-posicao-numeric-8-2.test.ts`;
--   sonda `database/sondas/20261025140000_sonda_migration60.sql` (FALHOU
--   antes, 100% OK depois; termina em RAISE).
-- ============================================================================

BEGIN;

-- Não esperar na fila do lock atrás de um insert de posição longo: os inserts
-- que chegassem depois ficariam presos atrás do ALTER.
SET LOCAL lock_timeout = '5s';

-- 1. Schema: só a precisão aumenta (5 → 8); a escala (2) fica.
ALTER TABLE public.motorista_locations
  ALTER COLUMN velocidade TYPE numeric(8,2),
  ALTER COLUMN precisao TYPE numeric(8,2),
  ALTER COLUMN heading TYPE numeric(8,2);

-- 2. Documentação
COMMENT ON COLUMN public.motorista_locations.velocidade IS
  'Velocidade em km/h (speed do GPS x 3,6). Null: sem medida. O app saneia antes de gravar (sanearPosicao).';
COMMENT ON COLUMN public.motorista_locations.precisao IS
  'Raio de precisão do GPS em metros (accuracy). Pode passar de 1000 m em ambiente fechado. Null: sem medida.';
COMMENT ON COLUMN public.motorista_locations.heading IS
  'Direção em graus, [0, 360). Null: sem medida (parado ou sem bússola).';

COMMIT;

-- ROLLBACK:
-- Voltar a numeric(5,2) recusa (22003) se já houver linha acima de 999.99, e
-- reescreve a tabela (diminuir a precisão exige conferir cada valor). Antes,
-- anule os valores que não cabem (perde a medida, não a posição):
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- UPDATE public.motorista_locations SET velocidade = NULL WHERE abs(velocidade) > 999.99;
-- UPDATE public.motorista_locations SET precisao = NULL WHERE abs(precisao) > 999.99;
-- UPDATE public.motorista_locations SET heading = NULL WHERE abs(heading) > 999.99;
-- ALTER TABLE public.motorista_locations
--   ALTER COLUMN velocidade TYPE numeric(5,2),
--   ALTER COLUMN precisao TYPE numeric(5,2),
--   ALTER COLUMN heading TYPE numeric(5,2);
-- COMMENT ON COLUMN public.motorista_locations.velocidade IS NULL;
-- COMMENT ON COLUMN public.motorista_locations.precisao IS NULL;
-- COMMENT ON COLUMN public.motorista_locations.heading IS NULL;
-- COMMIT;
