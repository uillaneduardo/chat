# ADR 0003 — Razão de consumo e storage privado

Status: aceito como direção.

Contexto: controlar consumo Meta e suportar arquivos internos maiores que limites do canal.

Decisão: separar eventos de uso, tarifas/regras versionadas e conciliação; usar DECIMAL e moeda explícita. Arquivos no filesystem privado via streaming, metadados no banco e uploads retomáveis; storage adapter preparado para evolução.

Consequências: estimativas não são faturas; tarifas desconhecidas ficam null. Consistência disco/banco exige recovery. Deduplicação opcional apenas por tenant.

Validação: ledger idempotente, quotas concorrentes, crash recovery e upload grande com memória medida.
