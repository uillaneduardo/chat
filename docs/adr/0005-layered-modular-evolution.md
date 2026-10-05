# ADR 0005 — Monólito modular em camadas e evolução compatível

**Status:** Proposto para implementação incremental após estabilização da 0.1.2.

## Contexto

A beta já possui separação em web, API, worker, domain, contracts e database, porém alguns handlers acumulam transporte HTTP, regras de negócio, persistência, integração Meta e auditoria. O crescimento dessa forma aumentaria acoplamento e duplicação.

Ao mesmo tempo, o sistema já possui dados persistidos e fluxos sensíveis de tenant, histórico, idempotência e webhook. Uma reescrita ou troca de arquitetura em bloco elevaria o risco sem benefício proporcional.

## Decisão

Adotar evolução incremental para um monólito modular em camadas.

- Routes/controllers cuidam de transporte.
- Application use cases orquestram operações.
- Domain concentra regras independentes.
- Database e provider Meta são adapters de infraestrutura.
- Observabilidade, auditoria e erros são serviços transversais.
- Não adotar microserviços nesta etapa.
- Não exigir Repository genérico sobre todo Prisma; usar abstrações somente onde protegem tenant, invariantes ou reduzem repetição.

A refatoração deve manter contratos públicos e persistência existentes sempre que possível.

Mudanças de banco são somente aditivas durante a transição. Colunas/tabelas legadas permanecem até uma release posterior e um ADR específico autorizar remoção.

## Consequências positivas

- chamadas Meta centralizadas;
- testes de regras sem framework;
- menor duplicação;
- diagnóstico padronizado;
- menor risco de consulta cross-tenant;
- frontend mais modular;
- caminho seguro para outbox/retry/dead-letter;
- menor custo de adicionar funcionalidades e canais.

## Custos

- aumento moderado de arquivos/módulos;
- período temporário com adapters e exports de compatibilidade;
- necessidade de disciplina para não criar abstrações sem valor;
- algumas melhorias de diagnóstico e gestão exigirão migrations aditivas.

## Compatibilidade

A reorganização de código não exige alterar o schema atual.

Quando necessárias, migrations devem preservar dados existentes. Em particular:

- Account pode receber active DEFAULT true e campos nullable de diagnóstico;
- lastWebhook não deve ser removido na mesma release;
- Message mantém os status atuais;
- Audit atual permanece válida;
- WebhookEvent continua responsável por deduplicação;
- OutboxJob, se introduzido, coexistirá inicialmente com o mecanismo atual baseado em Message.status.

Detalhes e gates: docs/17-architecture-evolution.md.

## Alternativas rejeitadas

### MVC clássico rígido

Melhora a organização da API, mas não modela tão bem worker, webhook, provider externo, outbox e eventos. Os conceitos de controller/service/repository podem ser usados sem limitar o produto ao MVC tradicional.

### Microserviços

Complexidade operacional desnecessária para o estágio atual.

### Reescrita total

Risco elevado de regressão em ACL, persistência, deduplicação e idempotência sem benefício que justifique a interrupção do piloto.
