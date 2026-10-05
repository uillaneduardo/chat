# Integração oficial WhatsApp

> Especificação do produto completo. O estado de implementação da beta está em [Status das funcionalidades](15-feature-status.md); requisitos deste documento podem estar pendentes.

## Conta e credenciais

Cloud API direta da Meta, sem dependência obrigatória de BSP. Gerenciar WABA e números como recursos diferentes. Cadastrar referências a token, app secret e verify token; cifrar segredos com chave externa ao banco, controle de acesso e rotação. UI mostra presença/última rotação, nunca valor salvo.

Versionar Graph API por configuração validada. Determinar versão suportada, scopes e procedimentos de token na implementação usando documentação oficial. Gestão na plataforma abrange diagnóstico e configuração permitida; pagamentos, verificações e aprovações que exigem Meta permanecem no ambiente Meta. Nunca coletar cartão no Chat.

## Webhook

GET: validar verify token em comparação segura e retornar challenge somente em verificação válida. POST: validar `X-Hub-Signature-256` HMAC-SHA256 sobre bytes exatos do corpo com app secret antes de parsear/persistir. O verify token não autentica POST.

### Diagnóstico operacional obrigatório

Implementação candidata à 0.1.2: `lastWebhookAttempt` registra POST HTTP de conta Meta conhecida fora da transação de domínio. Não comprova origem Meta. `lastWebhookStatus=untrusted` indica assinatura inválida; `attempt`, tentativa em andamento; `error`, rejeição/falha; `success`, processamento concluído, inclusive retry deduplicado. `lastWebhookSuccess` é atualizado somente após commit. `lastWebhook` permanece como compatibilidade para sucesso. GET challenge não atualiza estes campos.

Códigos seguros: `SIGNATURE_INVALID`, `PAYLOAD_INVALID`, `WABA_MISMATCH`, `PHONE_MISMATCH`, `ACCOUNT_INACTIVE`, `CREDENTIAL_ERROR`, `INTERNAL_ERROR` ou código Prisma como `P2002`. Correlation ID interno UUID aparece na UI e no log como `webhookRequestId`; `requestId` identifica o HTTP. Conclusão de tentativa antiga não substitui o status de uma tentativa mais recente. Tentativas públicas podem atualizar a última observação, sem afirmar autenticação; banco indisponível ou rejeição antes do handler (tamanho/content-type/rate limit) não permite registrar tentativa.

Logs usam rota sem query, tipo/código allowlisted e mensagem fixa. Não serializam Error.message/meta/cause/stack, mesmo em desenvolvimento, pois Prisma pode incluir argumentos privados. Falha ao persistir diagnóstico tem log próprio. A ação **Diagnosticar integração** é administrativa e local: presença das credenciais, formato de IDs/versão e HTTPS. Não verifica validade do token, permissões, inscrição WABA, alcance público ou versão Graph suportada; não chama Graph nem envia mensagens.

Parser tolera campos extras; limita campos persistidos e timestamps antes do Prisma. Texto, contato/perfil e status seguem o [referencial de payloads mantido pela Meta](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference). WABA e Phone Number ID continuam obrigatoriamente conferidos antes da dedup; HMAC usa bytes exatos. Não guardar payload bruto de mídia em texto claro: nesta beta somente tipo e placeholder, até implementar storage cifrado/retido.

Endpoint público específico para Meta; não colocar tela de login/Cloudflare Access nele. Limitar tamanho, taxa e duração sem bloquear retries legítimos. Mapear WABA/phone_number_id por cadastro confiável; tenant nunca vem de parâmetro fornecido livremente pelo cliente.

Persistir envelope e dividir itens: mensagens, status e atualizações. Deduplicar semanticamente itens por IDs do provedor, tipo/status/timestamp quando aplicáveis; hash do corpo é apenas ajuda para envelopes idênticos, não chave única para todo processamento. Evitar suprimir atualização legítima usando só message_id.

Não regredir estado read para sent; guardar sequência de eventos e timestamps, aceitar associação tardia. Raw payload fica cifrado, restrito e sujeito à retenção; logs comuns só metadados sanitizados.

## Gestão de contas

Administradores podem **desativar/reativar** pela UI e `PATCH /api/accounts/:id` com `{active:boolean}`, preservando histórico. Exclusão exige confirmação explícita, auditoria e tratamento claro de dependências (conversas, mensagens e eventos). Se houver histórico associado, preferir desativação/arquivamento ou exigir política explícita de retenção em vez de cascade silencioso.

`DELETE /api/accounts/:id` exige `{confirm:true}`, conta desativada e ausência de conversas, WebhookEvents, ProviderStatuses e tentativas registradas. Dependências retornam 409, orientando manter desativada. Auditoria é preservada; nenhum cascade destrutivo. UI só oferece Excluir quando estas condições são conhecidas, e servidor revalida sob lock.

Desativada: bloqueia novos atendimentos, mensagens e simulação; permite notas internas e acesso histórico pelas ACLs existentes. POST webhook responde 403 `ACCOUNT_INACTIVE`, registra tentativa e não cria domínio. Meta pode repetir entregas: desinscrever a integração no portal quando apropriado. Dispatcher revalida antes de enviar; chamada já em trânsito não pode ser cancelada retroativamente.

A conta Demo segue as mesmas regras administrativas. `ENABLE_DEMO=false` impede a criação/uso de novas contas Demo, mas não deve ser tratado como mecanismo de exclusão de registros já persistidos. A UI precisa permitir remover/arquivar uma Demo existente quando o piloto passar a usar somente uma conta Meta real.

## Envio

Outbox durável e estados created, queued, sending, accepted, sent, delivered, read, failed ou uncertain. HTTP 200 de envio significa aceitação, não entrega/custo. Proibir reenvio automático em resultado incerto sem estratégia segura. Validar tenant, atribuição, janela, template, tamanho/tipo e orçamento no backend imediatamente antes do envio.

Janela de atendimento é baseada na última mensagem recebida aplicável do cliente, segundo regras oficiais vigentes. Transferência não altera essa janela. Fora dela, usar template aprovado quando exigido. Consentimento e opt-out registrados; marketing em massa fora do MVP.

## Templates e diagnóstico

Sincronizar id, idioma, categoria, status e componentes. Mostrar versão/categoria atuais e recalcular previsão quando houver mudança. Diagnóstico: request_id/correlation_id, duração, códigos de erro sanitizados, tentativas e status de webhooks; não expor tokens ou dados ocultos.

## Mídia

Baixar mídia prontamente em worker com credencial server-side; URLs Meta temporárias não são storage definitivo. Streaming, timeout, limite por tipo e verificação de bytes/checksum. Permitir apenas hosts/endpoints esperados para downloads; bloquear SSRF em redirects e IPs privados. Falhas de mídia não eliminam a mensagem; status próprio e retry controlado.
