# Qualidade e aceite

> Especificação do produto completo. O estado de implementação da beta está em [Status das funcionalidades](15-feature-status.md); requisitos deste documento podem estar pendentes.

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

## Evidência da beta 0.1.0

- TypeScript estrito e build Vite: passaram.
- Migration inicial e testes API executados com MariaDB 10.11.14: passaram.
- 4 testes automatizados (3 de domínio e 1 suíte de integração com várias verificações): sem falhas ou skips quando TEST_DATABASE_URL está configurado.
- Integração cobre isolamento, CSRF, sessão, transferência, histórico tardio, notas, anexos, share revogado, Range, idempotência, assinatura HMAC, dedup, status antes da associação e decimal.
- `npm run test:large-upload`: arquivo sintético de 2 GiB, 256 partes de 8 MiB, SHA-256 e download Range verificados; aumento máximo de RSS observado de 29,3 MiB neste teste. É medição local, não garantia sob concorrência ou no seu hardware.
- Validação Chromium/headless: login, cadastro de conversa, incoming/outgoing demo, seis páginas e viewport 390×844 passaram, sem erro de JS ou overflow horizontal.
- `npm audit`: nenhuma vulnerabilidade conhecida reportada após correções, na consulta desta entrega.

Para repetir o teste grande, forneça TEST_DATABASE_URL dedicado *_test com migration aplicada e espaço livre superior a 2 GiB. O teste cria/remove apenas seus dados sintéticos. Ele não prova retomada visual após reload ou capacidade sob múltiplos uploads concorrentes.

Docker/Compose não foram executados aqui. Meta real, ClamAV real, restauração completa e auditoria independente permanecem pendentes.

Teste de navegador reproduzível: instale Chromium com `npx playwright install chromium`, forneça SMOKE_BASE_URL/SMOKE_EMAIL/SMOKE_PASSWORD de uma instalação isolada com proprietário e conta demo, e rode `npm run test:browser`. O teste cria um contato sintético e verifica que a conta é demo antes de simular mensagens. Não use banco de clientes para testes.

## Proposta de diagnóstico e gestão de contas (05/10/2026)

Suíte `tests/webhook.test.ts` verifica HTTP/HMAC raw, payload sintético próximo da Meta com extras/emoji, assinatura inválida não autenticada, JSON/timestamp inválido, WABA/número, duplicata de envelope/item, reuso de contato/conversa, status e rollback com erro Prisma seguro. Banco simulado não prova comportamento MariaDB.

A suíte `tests/integration.test.ts` acrescenta payload realista e P2002 por conflito de sequência no MariaDB, tentativa preservada, sucesso só após commit, retry, gestão de conta por tenant/papel/CSRF, confirmação de exclusão, integridade do histórico e dispatcher sem fetch em conta inativa. Requer TEST_DATABASE_URL dedicado terminado em `_test` com migrations aplicadas; sem ele é skip explícito. Docker e piloto Meta real não foram executados neste ambiente. Não promover 0.1.2 nem afirmar causa do 500 do host sem concluir estes gates.

Verificações locais desta proposta: `npm ci`, `npm run db:generate`, `npm run build` e verificador de repositório passaram; `npm test` teve 17 aprovados, zero falhas e um skip (MariaDB não configurado). `npm audit` reportou zero vulnerabilidades. A suíte HTTP também confirma sanitização do handler global 500 e ausência de query/segredos nos logs. `docker compose build` não executou: binário Docker ausente. Nenhuma migration/deploy/envio Meta aplicado no homelab; versão mantida em 0.1.1.
