# ADR 0002 — Visibilidade por atribuição

Status: aceito como requisito.

Contexto: transferir atendimento sem revelar histórico anterior e sem perder rastreabilidade.

Decisão: conversa persistente, sessões de atendimento e atribuições com policy snapshot e fronteira por sequência. Controle no backend em todas as superfícies. Supervisor vê histórico apenas com permissão explícita.

Consequências: complexidade de realtime, citações, exportação e anexos; timestamps sozinhos são insuficientes. Exigir invalidação e transação de transferência.

Validação: testes negativos de vazamento, concorrência e mensagens em trânsito.
