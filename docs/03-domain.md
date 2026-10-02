# Modelo de domínio proposto

Este documento é contrato conceitual; não é schema Prisma nem migração pronta. Implementação deverá materializar relações, índices e testes antes de armazenar dados reais.

| Entidade | Campos e relações essenciais |
|---|---|
| Company | id, nome, status, timezone, display_currency |
| User / Membership | identidade global; vínculo company/user, papéis, status |
| Role / Permission | permissões explícitas por vínculo e escopo |
| Contact | company_id, wa_id, nome, metadados mínimos |
| WhatsAppAccount | company_id, business_id, waba_id, secret_ref, app_ref, status |
| WhatsAppPhoneNumber | company_id, account_id, phone_number_id, número, qualidade |
| Conversation | company_id, phone_id, contact_id, status, last_sequence, version |
| ConversationSession | conversa, início/fim, protocolo e status do atendimento |
| ConversationAssignment | sessão, usuário, início/fim, policy_snapshot, boundary_sequence, version |
| ConversationTransfer | origem/destino, ator, motivo, resumo liberado, políticas e data |
| Message | tenant/conversa, local_sequence, provider_message_id, direction, type, status, content, timestamps |
| InternalNote | conversa/sessão, autor, local_sequence, conteúdo e visibilidade |
| FileObject | tenant, storage_key, tamanho BIGINT, MIME detectado, sha256, estado |
| MessageAttachment | message_id, file_id, origem e destino; autorização herdada |
| FileShare | file_id, hash do token, expiração, revogação, limite de acessos |
| UploadSession / UploadPart | tenant, autor, reserva, offset/partes, checksum, prazo e estado |
| StoragePolicy / StorageQuota | limites, regras de tipos, retenção, bytes usados/reservados |
| WhatsAppTemplate | tenant/account, provider_id, categoria, idioma, status e versão |
| WebhookEvent / WebhookItem | ingresso validado, payload protegido, itens deduplicáveis, processamento |
| ApiRequestLog | conta, operação, status, duração e erro sanitizado |
| RateCard / PricingRule | mercado, categoria, moeda, vigência, faixas, regras de gratuidade e fonte |
| UsageEvent | mensagem/evento, evidência, regra aplicada, quantidade, valor estimado e estado |
| Reconciliation / Adjustment | fonte financeira, agregado conciliado, divergência e ajuste auditado |
| UsageBudget / BudgetReservation | escopo, período, limite, reservas e modo de bloqueio |
| AuditEvent | tenant, ator, ação, recurso, resultado, correlação e timestamp |

## Invariantes de persistência

- Todas as entidades de tenant carregam `company_id`. FKs compostas `(company_id, resource_id)` impedem vínculos cruzados; não confiar só no ORM.
- Unicidade de provider_message_id por canal/phone conforme escopo documentado; unique de wa_id por company e de sequência por conversa.
- Consulta de conversa inclui tenant, canal e contato; não juntar todos os números de um contato automaticamente.
- Sessão agrupa atendimento; atribuição controla quem acessa. Não duplicar dono ativo em campos independentes sem regra de consistência.
- Transferência trava conversa ou usa comparação de version; encerramento da atribuição anterior e nova política ocorrem na mesma transação.
- Dinheiro em DECIMAL (proposta 20,8) e moeda ISO; valores decimais como string na API. Proibir float e somas entre moedas.
- Datas de vigência de tarifa em intervalo `[valid_from, valid_until)` sem sobreposição para a mesma chave e faixa.
- Índices previstos: tenant/conversation/sequence, tenant/phone/received_at, tenant/period/category e estado/next_retry_at.
- Custos são razão auditável; ajustes posteriores não sobrescrevem o snapshot histórico. Não usar preço vigente para recalcular passado silenciosamente.
- Soft delete não concede retenção infinita. Expurgo e anonimização seguem política própria, inclusive réplicas e backups.
