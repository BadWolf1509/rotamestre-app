-- Migration: c3_bucket_fotos_entrega_privado
-- C3 Fase 1: torna o bucket de fotos privado.
-- Signed URLs passam a ser gerados on-read (ver src/hooks/storage/useSignedUrl).
-- As policies de storage.objects permanecem (necessarias p/ usuarios
-- autenticados gerarem signed URL); privar o bucket fecha o advisor
-- public_bucket_allows_listing.
--
-- ATENCAO ROLLOUT: aplicar SOMENTE apos o codigo (util/hook/sites/uploads)
-- estar deployado no web. Builds nativos antigos usam URL publica e terao as
-- fotos quebradas ate atualizarem o app. Ver
-- docs/superpowers/plans/2026-06-23-c3-bucket-privado.md (secao Rollout).

update storage.buckets set public = false where id = 'fotos-entrega';
