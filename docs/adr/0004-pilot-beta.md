# ADR 0004 — Entrega incremental da beta executável

Status: aceito na implementação 0.1.0.

Contexto: entregar jornada utilizável e testada sem afirmar que todos os gates do MVP estão concluídos.

Decisão: manter Node/Fastify, React e Prisma/MariaDB. Worker é módulo executado no processo da API com polling de outbox no banco; UI usa polling. Uma réplica por instalação. Redis, worker isolado e sockets ficam futuros. Prisma 6.19.0 escolhido para migration/client estáveis; overrides de effect/deepmerge-ts corrigem advisories e foram validados por generate/migrate/test. Static 10.1.5 corrige advisories do static anterior.

Senha usa scrypt N=32768/r=8/p=1/salt 16 bytes, em vez de Argon2id nesta beta; reset/MFA seguem pendentes. Cada usuário pertence a uma empresa; membership múltiplo será migração futura. Transferência tem registro histórico e fronteira atual, mas sessões/protocolos completos ainda não estão implementados.

Consumo usa snapshot decimal por mensagem e tarifa manual BR apenas com evidência billable; não possui ledger/ajuste/conciliação oficial. Nenhum preço real seedado. Arquivos usam offset sequencial, não multipart paralelo; finalização tolera retry após rename, mas reconciliação completa de órfãos continua pendente.

Consequências: instalação simples e requisitos de produção ainda explícitos; sem escalar replicas ou tratar a beta como SaaS pronto. Não acionar envios reais nos testes. Nunca retornar segredo cifrado/decifrado na API de contas.

Validação: build/typecheck, migration MariaDB, API com dados sintéticos, isolamento, ACL de arquivos/histórico, HMAC/dedup, status tardio, decimal, chunks e audit npm. Build Docker/piloto Meta/restore são gates pendentes.
