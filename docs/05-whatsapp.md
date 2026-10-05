# Integração oficial WhatsApp

> Especificação do produto completo. O estado de implementação da beta está em [Status das funcionalidades](15-feature-status.md); requisitos deste documento podem estar pendentes.

## Conta e credenciais

Cloud API direta da Meta, sem dependência obrigatória de BSP. Gerenciar WABA e números como recursos diferentes. Cadastrar referências a token, app secret e verify token; cifrar segredos com chave externa ao banco, controle de acesso e rotação. UI mostra presença/última rotação, nunca valor salvo.

Versionar Graph API por configuração validada. Determinar versão suportada, scopes e procedimentos de token na implementação usando documentação oficial. Gestão na plataforma abrange diagnóstico e configuração permitida; pagamentos, verificações e aprovações que exigem Meta permanecem no ambiente Meta. Nunca coletar cartão no Chat.

## Webhook

GET: validar verify token em comparação segura e retornar challenge somente em verificação válida. POST: validar `X-Hub-Signature-256` HMAC-SHA256 sobre bytes exatos do corpo com app secret antes de parsear/persistir. O verify token não autentica POST.

### Diagnóstico operacional obrigatório

A próxima implementação deve separar **recebimento do HTTP** de **processamento bem-sucedido**. Registrar de forma persistente e sanitizada, fora da transação que pode sofrer rollback: instante da última tentativa (`lastWebhookAttempt`), último sucesso (`lastWebhookSuccess`), classe/status do último erro e um correlation/request ID quando disponível. A UI deve distinguir pelo menos: nunca chamado, assinatura inválida, JSON/schema inválido, WABA divergente, Phone Number ID divergente, erro interno e processado com sucesso. Nunca registrar token, App Secret, Verify Token ou conteúdo sensível integral.

A tela da conta deve oferecer uma ação de diagnóstico/teste que permita confirmar configuração e mostrar os IDs esperados sem expor segredos.

Endpoint público específico para Meta; não colocar tela de login/Cloudflare Access nele. Limitar tamanho, taxa e duração sem bloquear retries legítimos. Mapear WABA/phone_number_id por cadastro confiável; tenant nunca vem de parâmetro fornecido livremente pelo cliente.

Persistir envelope e dividir itens: mensagens, status e atualizações. Deduplicar semanticamente itens por IDs do provedor, tipo/status/timestamp quando aplicáveis; hash do corpo é apenas ajuda para envelopes idênticos, não chave única para todo processamento. Evitar suprimir atualização legítima usando só message_id.

Não regredir estado read para sent; guardar sequência de eventos e timestamps, aceitar associação tardia. Raw payload fica cifrado, restrito e sujeito à retenção; logs comuns só metadados sanitizados.

## Gestão de contas

Administradores devem poder **desativar** uma conta sem apagar histórico e **excluir** uma conta quando for seguro. Exclusão exige confirmação explícita, auditoria e tratamento claro de dependências (conversas, mensagens e eventos). Se houver histórico associado, preferir desativação/arquivamento ou exigir política explícita de retenção em vez de cascade silencioso.

A conta Demo deve seguir as mesmas regras administrativas. `ENABLE_DEMO=false` impede a criação/uso de novas contas Demo, mas não deve ser tratado como mecanismo de exclusão de registros já persistidos. A UI precisa permitir remover/arquivar uma Demo existente quando o piloto passar a usar somente uma conta Meta real.

## Envio

Outbox durável e estados created, queued, sending, accepted, sent, delivered, read, failed ou uncertain. HTTP 200 de envio significa aceitação, não entrega/custo. Proibir reenvio automático em resultado incerto sem estratégia segura. Validar tenant, atribuição, janela, template, tamanho/tipo e orçamento no backend imediatamente antes do envio.

Janela de atendimento é baseada na última mensagem recebida aplicável do cliente, segundo regras oficiais vigentes. Transferência não altera essa janela. Fora dela, usar template aprovado quando exigido. Consentimento e opt-out registrados; marketing em massa fora do MVP.

## Templates e diagnóstico

Sincronizar id, idioma, categoria, status e componentes. Mostrar versão/categoria atuais e recalcular previsão quando houver mudança. Diagnóstico: request_id/correlation_id, duração, códigos de erro sanitizados, tentativas e status de webhooks; não expor tokens ou dados ocultos.

## Mídia

Baixar mídia prontamente em worker com credencial server-side; URLs Meta temporárias não são storage definitivo. Streaming, timeout, limite por tipo e verificação de bytes/checksum. Permitir apenas hosts/endpoints esperados para downloads; bloquear SSRF em redirects e IPs privados. Falhas de mídia não eliminam a mensagem; status próprio e retry controlado.
