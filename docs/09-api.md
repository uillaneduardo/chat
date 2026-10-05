# Contrato de API proposto

> Especificação do produto completo. O estado de implementação da beta está em [Status das funcionalidades](15-feature-status.md); requisitos deste documento podem estar pendentes.

Rotas são planejamento, não endpoints disponíveis. Implementação publicará OpenAPI e schemas compartilhados em packages/contracts.

## Convenções

Prefixo `/api/v1`, JSON UTF-8, timestamps ISO UTC, dinheiro string decimal com currency, IDs opacos e paginação cursor estável por sequência/data+id. Tenant resolvido da sessão e membership selecionado validado. Erros sanitizados: code, message, correlation_id e fields seguros.

401 sem autenticação, 403 ação negada, 404 recurso ausente/fora do escopo, 409 conflito de versão/idempotência, 413 request grande, 422 entrada inválida e 429 limite com Retry-After. Validar server-side, limites de paginação e filtros allowlist.

| Método/rota | Finalidade e controle |
|---|---|
| POST /auth/login; POST /auth/logout | Sessão, rate limit, CSRF quando aplicável |
| GET /me | Membership e permissões efetivas |
| GET /conversations | Inbox com snippets filtrados |
| GET /conversations/:id/messages | Histórico pela atribuição/policy |
| POST /conversations/:id/messages | Outbox, janela, orçamento e Idempotency-Key |
| POST /conversations/:id/transfers | Destino, mode, boundary, grants, resumo e expected_version |
| POST /conversations/:id/notes | Nota interna autorizada |
| GET /whatsapp/accounts; POST /whatsapp/accounts | Leitura/gestão por permissão |
| POST /whatsapp/accounts/:id/credentials | Rotação write-only, nunca devolver segredo |
| GET /whatsapp/templates | Templates por conta e idioma |
| GET /whatsapp/diagnostics | Metadados sanitizados e restritos |
| GET /usage; GET /usage/events | Agregados/detalhes autorizados |
| POST /pricing/rate-cards | Registro validado com fonte e vigência |
| PUT /usage/budgets/:id | Reserva/bloqueio/política com audit |
| POST /uploads; GET /uploads/:id | Sessão retomável e reserva |
| PUT /uploads/:id/parts/:part | Stream limitado, checksum e retry idempotente |
| POST /uploads/:id/complete; DELETE /uploads/:id | Finalização/cancelamento |
| GET /files/:id | Stream/Range privado com autorização |
| POST /files/:id/shares; DELETE /shares/:id | Criar/revogar concessão externa |
| GET /audit-events | Trilha com permissão específica |

Webhook separado: GET/POST `/webhooks/meta/:integration_id`, autenticação challenge/HMAC, não cookies. Compartilhamento externo: GET `/files/share/:token`, não exige sessão por definição, mas exige concessão válida e controles próprios.

## Realtime e idempotência

Evento contém event_id, tipo, resource_id, version e dados mínimos permitidos; nunca payload bruto Meta. Reconnect refaz autorização e busca incremental. Idempotency-Key é escopada por tenant/ator/operação, hash do request e TTL; mesma chave com conteúdo diferente retorna 409. Resposta de transferência não devolve histórico oculto. Downloads e exportações não contornam policy por serem rotas distintas.

## Rotas executáveis candidatas à 0.1.2

- `PATCH /api/accounts/:id`: `{active:boolean}`, owner/admin, tenant e CSRF.
- `DELETE /api/accounts/:id`: `{confirm:true}`, owner/admin, tenant e CSRF; 409 para conta ativa ou histórico existente.
- `POST /api/accounts/:id/diagnostics`: diagnóstico local seguro, owner/admin, tenant e CSRF.
- `GET /api/accounts`: inclui active, canDelete e metadados de tentativa/sucesso/erro; nenhuma credencial salva é retornada.
