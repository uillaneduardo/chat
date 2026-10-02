# Segurança e auditoria

> Especificação do produto completo. O estado de implementação da beta está em [Status das funcionalidades](15-feature-status.md); requisitos deste documento podem estar pendentes.

Baseline proposta: OWASP ASVS nível 2 e princípios de OWASP API Security; não é certificação nem atestado de conformidade. Requisitos ainda devem ser implementados e testados.

## Ameaças e controles

| Ameaça | Controle e evidência de aceite |
|---|---|
| IDOR entre empresas | Contexto tenant confiável + FK composta + teste de leitura/escrita/exportação cruzada |
| Vazamento de histórico | Policy única no backend; testes de API, realtime, busca, citações e mídia |
| Webhook falso/replay | HMAC do raw body, mapeamento confiável, deduplicação por item e teste de retry |
| Roubo de sessão | Cookies HttpOnly/Secure/SameSite, CSRF, expiração e revogação; MFA administrativa planejada |
| Credenciais expostas | Cifragem autenticada com key version, secret externo, sanitização e rotação |
| Upload/SSRF/path traversal | Allowlist, quarentena, limites, host validation, redirects controlados e caminhos gerados |
| XSS em mensagem/nota | Sanitização allowlist, CSP e renderização sem HTML arbitrário |
| Custo/DoS | Rate limit por tenant/usuário, filas limitadas, reservas de quota/orçamento e monitoramento |
| Supply chain | Dependências fixadas, lockfile, revisão, scanning e Actions fixadas por SHA |
| Backup vazado | Backup cifrado, credenciais separadas e restauração testada |

## Identidade e privilégio

Senha com Argon2id parametrizado após benchmark, proteção contra brute force e enumeração, reset com token curto de uso único, invalidação de sessões e MFA para papéis sensíveis. Tenant vem do membership autenticado, nunca da confiança em body/header. Deny by default. Permissões distintas para transferência, conceder histórico, ler custos, configurar tokens, reprocessar webhook e criar link externo.

Tokens Meta ficam somente no servidor. Não logar Authorization, cookies, corpo de mensagem, documentos ou query com segredo. Sanitizar erros do provedor antes de retornar. App secret e verify token não usam a mesma chave de cifragem/token.

## Trilha de auditoria

AuditEvent: company, ator humano/sistema, ação, recurso, resultado, razão, correlation_id e UTC; antes/depois somente de campos permitidos, sem segredos e sem conteúdo integral. Registrar login/revogação, alteração de permissão, transferência/policy, credenciais rotacionadas, acesso excepcional, download/share, tarifas/limites, ajustes financeiros, expurgo e reprocessamento.

Aplicação não permite editar/apagar audit events pela API comum. Conta de banco e exportação de auditoria com privilégio mínimo; planejamento de cópia externa com integridade para reduzir adulteração por administrador do host. Log append-only no app sozinho não é garantia de imutabilidade. Retenção por classe e acesso de auditor segregado.

## Privacidade

Minimização, inventário de dados, finalidades, solicitação de acesso/retificação/eliminação, contrato entre operador e empresas, retenção documentada e política de backup. Conversas podem conter dados sensíveis; evitar seeds reais. Requisitos legais deverão ser validados antes de produção; esta documentação não declara conformidade LGPD.

## Incidentes

Conter (revogar sessões/tokens/shares), preservar evidência restrita, delimitar tenants afetados, corrigir, restaurar e registrar revisão. Divulgação segue SECURITY.md, sem publicar dumps ou credenciais em issues.
