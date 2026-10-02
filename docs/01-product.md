# Escopo e jornadas

## Objetivo

Operar atendimento humano em um número WhatsApp compartilhado, começar no homelab e preservar uma base multiempresa para evolução SaaS. Este projeto é separado do painel de infraestrutura WappHub; eventual integração futura não justifica compartilhar credenciais ou bancos sem contrato.

## Perfis

| Perfil por empresa | Capacidade planejada |
|---|---|
| Owner | Administração da empresa, delegação e orçamento |
| Administrador | Configuração técnica autorizada, sem acesso automático a segredos em texto |
| Supervisor | Filas, transferências e histórico completo quando autorizado |
| Atendente | Atendimento e somente os dados liberados para sua atribuição |

Papéis são conjuntos de permissões, não atalhos para ignorar `company_id`. Operação da plataforma deve ter perfil separado e acesso excepcional auditado, nunca acesso universal implícito.

## MVP

Login, membros, contas/números, contatos, inbox, texto e mídia compatível, notas, atribuição e transferência, templates aprovados, estado de janela de atendimento, consumo estimado, diagnóstico e armazenamento privado. Upload retomável e bloqueio de histórico são requisitos do primeiro MVP utilizável.

## Jornadas

1. Gestor conecta conta e valida credenciais, webhook e permissões.
2. Cliente envia mensagem; ingresso persiste evento e worker cria/atualiza contato e conversa.
3. Atendente autorizado assume e responde; outbox rastreia o envio.
4. Gestor transfere, escolhe recorte e resumo; novo atendente vê apenas contexto liberado.
5. Painel agrega consumo e mostra pendências de preço/conciliação, sem inventar zero.
6. Arquivo grande é armazenado internamente; envio ao WhatsApp respeita limites do canal ou usa link explícito.

## Fora do MVP

Campanhas em massa, chatbot visual, IA, cobrança de assinatura, onboarding SaaS automatizado e integração ERP. Não enviar mensagens nem criar contas Meta ao preparar documentação.

## Configurações

Por empresa: moeda de exibição, fuso de relatórios, limites/orçamentos, quotas, tipos permitidos, retenção e política de compartilhamento. Operador: raiz de storage, chaves, endpoints e limites de infraestrutura. Alteração da raiz de storage exige migração operacional, não campo editável por tenant.
