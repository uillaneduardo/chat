# Evolução arquitetural incremental

> Documento de direção para a evolução pós-beta 0.1.2. Não autoriza migração destrutiva, mudança de schema em produção ou refatoração ampla em um único commit.

## Objetivo

O WappHub Chat já possui uma base coerente de monólito modular: React/Vite, Fastify, Prisma/MariaDB, worker, contratos Zod, regras de domínio e isolamento por empresa. O próximo passo não é reescrever o sistema nem migrar para microserviços, e sim reduzir acoplamento e duplicação antes de acrescentar novos canais e funcionalidades.

A direção adotada é monólito modular em camadas, combinando organização Controller/Service/Repository com princípios de Clean Architecture somente onde houver benefício concreto. O domínio não deve depender de Fastify, React, Prisma ou detalhes da Meta.

Fluxo alvo:

    HTTP/Webhook
        |
    Routes / Controllers
        |
    Application Use Cases
        |
    Domain Policies
        |
    Ports
       / \
    Repositories   Provider adapters
       |                |
    Prisma/MariaDB   Meta Cloud API

A arquitetura continua sendo um único produto implantável. Não introduzir microserviços, message broker externo ou abstrações sem caso de uso real.

## Princípios

1. Compatibilidade antes de elegância: refatorações de organização não mudam comportamento observável nem schema por padrão.
2. Migrações aditivas: mudanças de persistência devem adicionar campos/tabelas com defaults ou nullabilidade compatíveis. Não renomear/apagar colunas existentes na mesma etapa da refatoração.
3. Domínio independente: regras como janela de atendimento, visibilidade, transição de status e autorização não pertencem a módulos de criptografia nem a handlers HTTP.
4. Infraestrutura atrás de adapters: chamadas Graph API ficam centralizadas em provider Meta; acesso Prisma fica encapsulado onde houver risco de repetição ou isolamento multi-tenant.
5. Erros como contrato interno: erros técnicos e de negócio usam códigos estáveis e metadados seguros.
6. Auditoria não é log: eventos de governança são separados de observabilidade operacional.
7. Outbox evolui sem quebrar mensagens existentes: o estado de Message continua sendo fonte do domínio enquanto uma fila genérica é introduzida de forma incremental.
8. Sem dados sensíveis em logs: tokens, segredos, cookies, Authorization, payload integral e conteúdo de mensagens não são logados.
9. Tenant por construção: consultas sensíveis devem exigir companyId ou contexto tenant confiável; não depender da memória do desenvolvedor.

## Estrutura alvo

    apps/
      api/src/routes/
      api/src/controllers/
      api/src/middleware/
      worker/
      web/src/features/
      web/src/components/
      web/src/hooks/
      web/src/lib/

    packages/
      application/
      domain/
      providers/meta/
      database/
      contracts/
      observability/
      audit/
      config/

Não é necessário mover tudo imediatamente. Arquivos existentes podem delegar para os novos módulos até serem reduzidos.

## Refatorações prioritárias

### 1. Erros tipados e ErrorMapper

Introduzir AppError ou equivalente com code estável, httpStatus, categoria, retryable, mensagem pública segura e causa técnica opcional não serializada ao cliente.

Exemplos de códigos:

    META_WEBHOOK_SIGNATURE_INVALID
    META_WEBHOOK_PAYLOAD_INVALID
    META_WABA_MISMATCH
    META_PHONE_NUMBER_MISMATCH
    META_TOKEN_INVALID
    META_PERMISSION_DENIED
    META_TIMEOUT
    DB_CONFLICT
    DB_FOREIGN_KEY
    DB_TIMEOUT
    MESSAGE_PERSIST_FAILED
    AUTH_SESSION_INVALID
    AUTH_CSRF_INVALID

O handler global mapeia erros conhecidos, sanitiza a resposta e gera log estruturado. Erros Prisma conhecidos devem ser mapeados centralmente em vez de repetidos em cada rota.

### 2. Observabilidade

Criar módulo único para logs estruturados e correlation/request IDs. Campos mínimos: timestamp, level, service, requestId, event, method, route, companyId quando seguro, resourceId quando seguro, errorCode e durationMs.

Separar log técnico, OperationalEvent e AuditEvent. Nunca registrar conteúdo integral de mensagens ou credenciais.

### 3. AuditService

Centralizar gravação de auditoria para evitar chamadas db.audit.create espalhadas. A tabela Audit atual pode continuar sendo usada inicialmente. O serviço deve padronizar companyId, actorId ou sistema, action, resourceId, result, correlationId e details allowlisted.

### 4. OperationalEvent

Não usar Audit como depósito de todos os erros. Criar entidade própria somente quando houver necessidade operacional real, com campos como id, companyId opcional, accountId opcional, event, level, result, errorCode, requestId, occurredAt e metadata sanitizado.

Essa tabela é aditiva e não substitui WebhookEvent.

### 5. MetaProvider / MetaClient

Centralizar Graph API em packages/providers/meta. Interface de alto nível sugerida: validateCredentials, getBusinessAccount, listPhoneNumbers, listTemplates, sendText, sendTemplate e downloadMedia.

Nenhum controller deve construir URLs Graph diretamente. Benefícios: versionamento concentrado, timeout e retry consistentes, sanitização de erro única, testes com adapter fake e onboarding assistido.

### 6. Application Use Cases

Extrair dos handlers operações como CreateConversation, SendMessage, TransferConversation, ProcessMetaWebhook, DisableAccount, DeleteAccount e DiagnoseMetaAccount.

O controller deve apenas interpretar request, obter actor/context, executar use case e mapear resposta.

### 7. Domain reorganizado

O arquivo packages/domain/src/security.ts mistura criptografia, autorização e regras de mensageria. Separar gradualmente em security/crypto, security/password, security/token, authorization/visibility, messaging/window e messaging/status.

Manter exports de compatibilidade temporários para não quebrar imports existentes durante a transição.

### 8. Repositórios com tenant explícito

Não criar Repository apenas para espelhar Prisma. Criar abstrações onde houver ganho concreto, principalmente em recursos multi-tenant e operações repetidas. Métodos que acessam recursos de tenant devem receber o contexto tenant explicitamente.

### 9. Frontend por feature

apps/web/src/main.tsx deve ser reduzido incrementalmente em features/auth, inbox, team, whatsapp, audit, usage e settings. Criar clientes de API tipados por módulo e ampliar packages/contracts para DTOs, respostas e códigos compartilhados quando apropriado.

## Compatibilidade com a persistência atual

A refatoração arquitetural é majoritariamente compatível sem alteração de banco, pois mover regras, adapters, handlers e frontend não exige mudar as tabelas existentes.

Mudanças que exigem migration devem ser aditivas.

### Account

Para ativação/desativação, preferir active Boolean NOT NULL DEFAULT true ou um status com default compatível, mas não ambos sem necessidade. Uma migration com active DEFAULT true preserva todas as contas atuais como ativas.

Campos de diagnóstico de webhook podem ser adicionados como nullable:

    lastWebhookAttempt DateTime?
    lastWebhookSuccess DateTime?
    lastWebhookStatus String?
    lastWebhookErrorCode String?
    lastWebhookRequestId String?

Manter lastWebhook durante uma versão de transição. Depois de todos os consumidores migrarem, decidir em ADR separado se ele vira legado ou pode ser removido. Não remover nesta refatoração.

### Audit

A tabela atual continua válida. Não alterar semanticamente registros antigos. Se forem necessários result, correlationId ou eventType, adicionar campos nullable/default ou manter temporariamente em details.

### WebhookEvent

Manter deduplicação existente accountId + digest. Não transformar WebhookEvent em log genérico. Ele continua sendo evidência de envelope processado/deduplicado.

### Message

Não alterar ou renomear os status atuais durante a refatoração: queued, sending, accepted, sent, delivered, read, failed e uncertain. A máquina de estados deve inicialmente encapsular esses mesmos valores.

### OutboxJob

A criação de OutboxJob é evolução futura, não pré-requisito da refatoração inicial. Quando implementada: adicionar tabela sem remover Message.status; criar Message + OutboxJob na mesma transação para novos envios; fazer o worker consumir OutboxJob; manter compatibilidade com mensagens antigas queued; só retirar o polling direto em Message depois de validação e ADR específico.

Não converter mensagens históricas destrutivamente.

## Estratégia de migração arquitetural

### Fase A — sem mudança funcional

- introduzir AppError/ErrorMapper;
- introduzir logger/observability;
- extrair MetaClient mantendo comportamento atual;
- reorganizar domain com exports de compatibilidade;
- extrair controllers/use cases progressivamente;
- modularizar frontend;
- manter schema e rotas públicas.

Gate: build, testes existentes e browser smoke devem passar sem mudança observável.

### Fase B — mudanças aditivas de persistência

- Account.active;
- diagnóstico persistente de webhook;
- campos mínimos adicionais de auditoria se justificados;
- OperationalEvent se necessário.

Gate: migration aplicada sobre cópia de banco 0.1.1/0.1.2 com todos os registros preservados.

### Fase C — mensageria confiável

- OutboxJob;
- retry/backoff;
- dead-letter;
- reconciliação de mensagens uncertain;
- readiness operacional.

Gate: nenhuma duplicação de envio e recovery após restart comprovado em teste.

## Requisitos de compatibilidade

Toda PR/refatoração desta arquitetura deve provar:

1. nenhuma migration histórica foi editada;
2. migrations novas são forward-only e documentadas;
3. banco existente pode ser atualizado sem apagar entidades atuais;
4. IDs existentes permanecem válidos;
5. URLs públicas e contratos de API continuam compatíveis, salvo mudança explicitamente versionada;
6. isolamento companyId continua aplicado;
7. limites de histórico/ACL continuam server-side;
8. webhook HMAC e raw body continuam intactos;
9. idempotência de mensagens continua funcionando;
10. worker não reenvia mensagens uncertain automaticamente;
11. rollback documentado antes de deploy;
12. backup antes de migration em homelab.

## Testes obrigatórios durante a refatoração

- regressão de login/sessão/CSRF;
- isolamento tenant em leitura e escrita;
- inbound webhook válido e inválido;
- WABA/Phone Number divergentes;
- dedup de webhook;
- idempotência de envio;
- mensagem uncertain após falha ambígua;
- transferência e fronteira de histórico;
- conta desativada não disponível para novos atendimentos;
- conta desativada preserva histórico;
- migration sobre snapshot de banco anterior;
- worker restart/recovery;
- browser smoke das telas atuais.

## O que não fazer

- não migrar para microserviços;
- não introduzir Redis/Kafka apenas por arquitetura;
- não substituir Prisma sem problema concreto;
- não reescrever toda API de uma vez;
- não alterar IDs/chaves atuais por estética;
- não remover colunas antigas na mesma release em que a substituta é criada;
- não transformar Audit em log técnico;
- não registrar payload real para facilitar debug;
- não criar interfaces/repositories triviais que apenas duplicam cada método Prisma.

## Critério de conclusão

A evolução arquitetural é bem-sucedida quando handlers HTTP ficam pequenos e previsíveis; regras de negócio podem ser testadas sem Fastify; chamadas Meta estão concentradas em um adapter; erros têm códigos estáveis; auditoria e observabilidade são distintas; tenant é obrigatório nas operações sensíveis; o schema atual continua utilizável; migrations são aditivas e testadas; e novas funcionalidades exigem menos duplicação e menos pontos de alteração.
