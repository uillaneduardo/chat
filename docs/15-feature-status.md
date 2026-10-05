# Histórico de funcionalidades

Versão **0.1.1**, beta para piloto. Atualizado em 02/10/2026, America/Fortaleza. “Implementado” significa código presente e verificações descritas; não implica auditoria independente ou validação com credenciais Meta reais.

| Funcionalidade | Estado | O que funciona / limitação |
|---|---|---|
| Build e execução | Implementado | Node/Fastify, React/Vite e Prisma/MariaDB; lockfile e migration inicial |
| Login e logout | Implementado | Senha scrypt, cookie HttpOnly, CSRF, sessão 8h e revogação |
| Empresas e usuários | Implementado parcial | Bootstrap por empresa, usuários admin/supervisor/agent e desativação. Um usuário pertence a uma empresa; membership múltiplo pendente |
| Contatos e conversas | Implementado | Cadastro manual e inbound Meta; inbox com filtro/busca por nome/número e fechamento/reabertura |
| Filas/departamentos/tags | Pendente | Existe lista de não atribuídas para gestores; sem filas departamentais ou tags |
| Texto e notas | Implementado | Texto, notas internas e demo; outbox durável no banco |
| Transferência | Implementado | Completo, futuras, a partir de sequência ou últimas N; resumo e notas dentro do recorte |
| Sessões formais de atendimento | Parcial | Transferência/atribuição atual e eventos históricos; entidade/protocolo de sessão completo pendente |
| Bloqueio de histórico | Implementado | API filtra histórico, mídia e acesso direto; antigo atendente perde acesso. Gestores possuem visão completa |
| Atualização de tela | Implementado | Polling 3–4s; Socket.IO/WebSocket e invalidação instantânea pendentes |
| Contas e credenciais Meta | Implementado parcial | Cadastro/edição, segredo AES-GCM, verify token hash, URL webhook e data do último evento. Exclusão/desativação de conta pela UI/API ainda não existe; conta Demo existente também não pode ser removida pela interface. |
| Webhook | Implementado parcial | HMAC raw body, WABA/número, dedup, texto persistido antes de ACK e status tardio. Diagnóstico operacional é insuficiente: `lastWebhook` é atualizado dentro da transação de processamento e pode voltar a `null`/valor anterior em rollback, ocultando tentativas que chegaram mas foram rejeitadas. |
| Envio texto Meta | Implementado, validação externa pendente | Adapter HTTP, janela e status accepted/uncertain; testes usam payloads sintéticos, sem conta real |
| Templates | Parcial | Valida aprovação na API e envia template sem parâmetros. Catálogo/sync e parâmetros pendentes |
| Mídia nativa Meta | Pendente | Tipo e metadata recebidos preservados; placeholder na conversa. Download automático/envio nativo não disponíveis |
| Arquivos internos grandes | Implementado | Stream, offset retomável por 8 MiB, máximo configurável até 2 GiB (testado), SHA-256 e quota reservada |
| Retomada de upload | Parcial | Pause/continue e recuperação de offset na mesma janela; retomada após fechar/recarregar exige cliente API, sem assistente na UI |
| Download e links | Implementado | ACL server-side, Range simples, link hash/expiração/revogação; recorte revoga shares anteriores |
| Scanner/quarentena | Parcial | Invoca clamscan configurado; fail closed. Imagem padrão sem scanner; tipo detectado/allowlist/dedup pendentes |
| Quotas | Implementado | Tamanho por arquivo e quota por empresa, reservas atômicas e limpeza de temporários expirados |
| Retenção automática/dedup | Pendente | Exclusão explícita disponível; políticas e deduplicação ainda não |
| Consumo | Parcial | Enviadas/status, pendências e totais separados por moeda, demo sem custo externo |
| Tarifas | Parcial | Cadastro manual BR, vigência e snapshot por mensagem entregue/faturável. Sem franquias, faixas ou recálculo retroativo |
| Orçamento | Parcial | Campo de referência; sem aviso automático/bloqueio ou reservas de custo |
| Conciliação financeira | Pendente | Sem custo “confirmado”; não usa webhook como fatura |
| Auditoria | Implementado parcial | Ações administrativas, transferência, criação e download. Sem cópia externa/imutabilidade e sem histórico completo de todas as falhas |
| Exportação e pesquisa de mensagens | Pendente | Busca da inbox só contato; não existe exportação |
| Docker e operação | Parcial | Dockerfile/Compose/runbook presentes; Deploy assistido, configuração privada e CI Docker; jornada Demo validada no homelab pela interface; restore e inspeção direta do host pendentes |
| Segurança avançada | Pendente | MFA/reset, CSP refinada, SAST/SBOM, scanning de imagem e revisão independente |

## Entregas

- **M0:** base documental publicada, sem código executável.
- **0.1.0:** primeira beta executável, com jornada demo persistida, transferência, arquivos internos e adapter de texto Meta.
- **0.1.1:** instalação assistida, bootstrap repetível, isolamento ingress e verificação Docker na CI.
- **Validação no homelab (02/10):** jornada Demo, persistência e upload com quarentena conferidos; [evidências e limites](16-homelab-validation.md).
- **Próxima entrega:** validar piloto Meta real; implementar diagnóstico persistente de webhook (tentativa/sucesso/erro), gestão de exclusão/desativação de contas inclusive Demo, scanner e mídia Meta; melhorar concorrência/recovery e navegação de histórico.

Atualizar esta matriz junto com código e CHANGELOG; não promover marco inteiro por existir parte de seu código.
