# ADR 0005 — Ciclo de contas e diagnóstico de ingresso

Status: aceito no código candidato à 0.1.2; validação MariaDB/piloto pendente.

Contexto: rollback do webhook apagava lastWebhook; HTTP 500 sem informação da exceção inviabilizava diagnóstico. Demo persistida não podia ser desativada.

Decisão: Account.active controla uso sem apagar histórico. Exclusão física exige conta desativada, confirmação, ausência de conversas/eventos/status/tentativas e auditoria na mesma transação. Locks de conta serializam mudança de status, criação de conversa e ingresso. ProviderStatus ainda não tem FK; sua existência é conferida explicitamente na exclusão.

Tentativa HTTP é persistida antes do HMAC/transação, sem afirmar origem. Rejeição de assinatura é untrusted; sucesso só depois de commit. Status da última tentativa usa UUID interno e compare-and-update para evitar sobrescrita por conclusão antiga; último sucesso é independente. Falha de banco/rejeição anterior ao handler não garante observação persistente. Rate limit e limite de corpo permanecem.

Logs allowlist tipo/código e usam descrição fixa; mensagens/stack/meta de Prisma podem conter argumentos privados e não são serializados. Payload bruto de mídia deixa de ser salvo em claro. Diagnóstico administrativo é local e não garante validade na Meta.

Consequências: migration aditiva, histórico preservado e estados operacionais interpretáveis. Contas inativas rejeitam POST 403; retries podem continuar na Meta até desinscrição. Dispatcher revalida antes de fetch, mas envio em trânsito não é revogável. Uma réplica por instalação continua requisito.

Validação: testes HTTP com banco simulado e suíte MariaDB ampliada. Homelab, migration real e piloto Meta continuam gates externos. Não atribuir causa do 500 original sem evidência segura da exceção.
