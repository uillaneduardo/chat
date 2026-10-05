# Entrega candidata à 0.1.2 — 05/10/2026

## 1. Causa do erro 500

A causa concreta no homelab não foi comprovada. O log SERVER_ERROR antigo não traz exceção/código Prisma e não houve acesso a logs novos ou banco do host. Não atribuir o incidente a assinatura, Prisma ou formato de payload sem evidência.

Defeito confirmado e corrigido: lastWebhook era atualizado dentro da transação principal; rollback apagava a observação da tentativa. Agora tentativa HTTP é persistida separadamente; assinatura inválida fica explicitamente não autenticada e sucesso só após commit. Logs seguros tornam a próxima falha identificável. Também foram corrigidos limites de campos/timestamps antes do Prisma, conflitos de providerId entre contas e armazenamento bruto de mídia em claro. O payload de texto da referência mantida pela Meta é compatível com o parser; não foi removida nenhuma validação HMAC/WABA/número.

## 2. Arquivos alterados/criados

- API: `apps/api/src/app.ts`, `admin.ts`, `inbox.ts`, `webhook.ts`; novo `apps/api/src/diagnostics.ts`.
- UI: `apps/web/src/main.tsx`.
- Worker: `apps/worker/src/dispatcher.ts`.
- Banco: `packages/database/schema.prisma` e nova migration abaixo.
- Testes: novo `tests/webhook.test.ts` e ampliação de `tests/integration.test.ts`.
- Documentação: `README.md`, `CHANGELOG.md`, `docs/03-domain.md`, `docs/05-whatsapp.md`, `docs/09-api.md`, `docs/11-quality.md`, `docs/12-roadmap.md`, `docs/14-installation.md`, `docs/15-feature-status.md`, `docs/adr/README.md`; novos `docs/adr/0005-account-webhook-diagnostics.md` e este relatório.
- `docs/16-homelab-validation.md` permanece como evidência Demo anterior: piloto Meta não foi executado nesta entrega.

## 3. Migration

`packages/database/migrations/20261005000000_account_diagnostics/migration.sql`: adiciona active e seis campos de diagnóstico à Account. Preserva registros e converte lastWebhook anterior em tentativa/sucesso legado. Não altera a migration inicial. Não aplicada neste ambiente nem no homelab.

## 4. Testes adicionados

HTTP/Fastify com banco simulado: assinatura sobre bytes reais, assinatura inválida, primeira conversa, contato/conversa existentes, duplicata de envelope e mensagem, campos extras, emoji, WABA/número divergentes, timestamp/JSON inválidos, status próximo da Meta, rollback com código P2002, retry e conta inativa. Teste do handler global verifica método/rota/código Prisma sem query, input, segredo ou stack.

MariaDB: fixture inbound realista, conflito real de sequência P2002, tentativa preservada, sucesso não alterado no erro, retry/dedup, conta desativada, autorização por tenant/papel, CSRF, confirmação, exclusão sem dependências, histórico/auditoria preservados, dispatcher sem fetch e ENABLE_DEMO=false sem apagar dados. Esta suíte exige execução externa com banco dedicado.

## 5. Verificações executadas

| Verificação | Resultado |
|---|---|
| npm ci | Aprovado |
| npm run db:generate | Aprovado |
| npm run build | TypeScript e Vite aprovados |
| npm test | 17 aprovados, zero falhas, um skip MariaDB |
| npm audit | Zero vulnerabilidades reportadas |
| scripts/check_repository.py | Aprovado com Python empacotado equivalente a python3 |
| git diff --check | Aprovado |
| docker compose build | Não executou: Docker não instalado |

Npm 10 foi executado pelo pnpm dlx, pois npm não estava no PATH. Nenhuma dependência do projeto ou lockfile alterada. Não foi usado banco de produção, payload real, deploy ou envio Meta.

## 6. Gates e riscos

Validar migration/suíte MariaDB em TEST_DATABASE_URL terminado em `_test`, imagem/Compose/smoke isolado e primeiro inbound real. Preservar versão 0.1.1 até estes gates; nenhuma release/tag criada. Diagnóstico é local, não valida token/permissões/inscrição na Meta. Banco indisponível e rejeição anterior ao handler não garantem registro de tentativa. Tentativa sem HMAC válido nunca é prova de origem Meta. Conta inativa devolve 403 no POST e pode continuar recebendo retries; envio já em trânsito não pode ser cancelado retroativamente. Histórico e ACL permanecem.

## 7. Atualizar o homelab

Depois de revisar/publicar as alterações no ref consumido pelo homelab, concluir os gates em instalação isolada e fazer backup coordenado de banco/mídia/chave conforme [instalação](14-installation.md), executar no checkout existente do servidor:

```bash
git pull --ff-only
bash scripts/deploy.sh --cloudflare
curl -fsS http://127.0.0.1:8300/api/health
```

Deploy assistido constrói imagem, para o worker, aplica migration explicitamente e faz verificação de instalação antes de subir app. Nenhum comando acima foi executado no homelab nesta entrega. Não apagar volumes. Não aplicar rollback destrutivo automático.

## 8. Acompanhar webhook

```bash
docker compose -f compose.yml -f compose.ingress.yml logs --since=10m --follow app
```

Conferir WEBHOOK_SUCCESS ou código sanitizado de rejeição/Prisma. Correlacionar `webhookRequestId` com identificador na página WhatsApp; `requestId` correlaciona HTTP. Não compartilhar segredo/payload/dump.

## 9. Validar primeira mensagem inbound

Conferir conta ativa, Phone Number ID, WABA ID, credenciais, URL pública HTTPS e diagnóstico local. No portal Meta, conferir inscrição da WABA/campo messages. GET challenge não prova POST. Enviar uma única mensagem sintética ao número de teste. Aguardar sucesso no log, último sucesso na UI e conversa na Inbox do gestor, inclusive não atribuídas. Se falhar, usar código/correlation ID, sem publicar conteúdo de cliente. Isso ainda precisa ser feito pelo operador no homelab.

## 10. Desativar/remover Demo

WhatsApp → conta Demo → **Desativar**. Ela sai das opções de novos atendimentos e deixa de enviar/simular; histórico permanece. **Excluir** aparece somente se desativada e sem conversas/eventos/status/tentativas, exige confirmação explícita e gera auditoria. Com dependências, manter desativada. ENABLE_DEMO=false impede criação/uso/reativação, sem apagar registros existentes.
