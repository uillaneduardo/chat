# Qualidade e aceite

## Estratégia

Unitários para policy, precificação, janela e estados; integração real com MariaDB/Redis para isolamento, transações, deduplicação e reservas; E2E para jornada e ausência de conteúdo oculto no tráfego; carga para streaming, fila e concorrência. Fixtures sintéticas, sem números ou mensagens de clientes. Relatórios não contêm tokens.

## Casos bloqueadores do MVP

- Empresa A não acessa dados B por IDs, pesquisa, exportação, arquivo, Range ou socket.
- Transferência futuras esconde mensagens/notas/mídia/citações/previews anteriores; mensagem em trânsito segue fronteira determinística.
- Duas transferências concorrentes não criam duas atribuições ativas; repetir request não duplica sessão.
- HMAC inválido rejeitado; retry e status fora de ordem não duplicam mensagem ou custo.
- Timeout de envio vira uncertain e não provoca envio duplo cego.
- Tarifas desconhecidas aparecem null/pendentes; mudanças não alteram snapshots; moedas não somam sem conversão.
- Reservas concorrentes respeitam quota e orçamento; liberação após falha/expiração e recovery após crash.
- Upload acima do limite é rejeitado cedo; retomada não corrompe bytes; medir memória com arquivo de 2 GiB em máquina limitada.
- Conteúdo perigoso/scan indisponível permanece em quarentena; path traversal, symlink e SSRF bloqueados.
- Share expirado/revogado não baixa; usuário anterior perde ACL conforme política.
- Backup restaurado em ambiente isolado preserva objetos/ACLs e não reenvia mensagens.

## Pipeline futuro

Typecheck, lint, unit/integration, build, secret scan, dependency audit, SAST e imagem/SBOM quando existirem manifests. Bloqueio de vulnerabilidade deve considerar severidade, alcançabilidade e exceção documentada com prazo. Verificação de docs atual é somente fundação e não implementa esse pipeline completo.

Definition of Done: requisito/ADR atualizado, testes adequados, CI verde, review de permissão/segredos, changelog quando relevante, migração/recovery documentados, sem dado real em fixture. Revisão independente de segurança antes de produção.
