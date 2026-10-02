# Transferência e visibilidade

## Princípio

A conversa real e a janela operacional do WhatsApp permanecem. Uma nova sessão/atribuição modifica a perspectiva interna do atendente. Não apaga mensagens e não reinicia a janela de 24 horas.

| Modo | Regra |
|---|---|
| Completo | Todas as mensagens autorizadas dessa conversa |
| A partir de mensagem | Sequência selecionada inclusiva; seleção precisa ser autorizada |
| Somente futuras | Sequência maior que a fronteira capturada na transação de transferência |
| Últimas N e futuras | Snapshot das últimas N mensagens liberadas na transferência + mensagens futuras |

A fronteira usa `local_sequence` monotônica por conversa, não um ID global ou relógio. Mensagem antiga importada posteriormente mantém classificação histórica e não entra como futura apenas porque o job atrasou. Definir a sequência de ingresso antes de processamento assíncrono.

## Operação atômica

1. Validar ator, tenant, destino ativo, autorização para transferir e concessões solicitadas.
2. Bloquear/versionar conversa; calcular fronteira e snapshot; capturar eventos recebidos já persistidos.
3. Encerrar atribuição anterior, abrir sessão se solicitado, criar atribuição e transferência.
4. Persistir audit event e outbox; commit; invalidar acessos/realtime imediatamente.

Duas transferências concorrentes: uma vence, outra recebe 409. Idempotency-Key repete o mesmo resultado. Política padrão: antigo atendente perde acesso ao transferir; preservação excepcional exige permissão explícita.

## Contexto novo

Esconder mensagens, mídias, notas, eventos e identidade de atendentes anteriores. Mostrar dados básicos de contato e resumo manual somente se liberados. Não oferecer resumo automático de dados ocultos sem autorização específica.

Flags de anexos/notas são restrições adicionais, nunca autorização para liberar dados de mensagem oculta implicitamente. Caso seja necessário compartilhar um arquivo anterior sem a mensagem, criar concessão explícita e auditada ao arquivo. Notas têm fronteira própria e política separada.

## Superfícies obrigatórias

Listagem, contagem, pesquisa, snippets da inbox, citações/respostas, encaminhamento, previews, thumbnail, download, Range, exportação, notificações, realtime, caches e links compartilhados verificam a mesma política no backend. Referência a mensagem oculta devolve marcador neutro sem conteúdo, nome de arquivo ou URL.

Conhecer um ID não permite acesso. Não emitir URLs públicas permanentes. Links externos anteriores não desaparecem só porque a UI esconde histórico: política de transferência deve permitir revogar links ativos; links são concessões independentes e precisam ser listados na confirmação do gestor.

## Aceite

Atendente novo não recebe nenhum conteúdo anterior em modo futuras; supervisor autorizado mantém acesso. Testar duas empresas, URLs diretas, reconexão, download parcial, exportação e uma mensagem em trânsito no instante da transferência.
