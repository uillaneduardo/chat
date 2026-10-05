# Changelog

## 0.1.1 — 2026-10-02

- Configuração interativa com segredos aleatórios, arquivos privados e proteção contra sobrescrita.
- Deploy Compose com migrations explícitas, healthchecks e preservação dos volumes.
- Bootstrap separado do ambiente permanente e repetível sem redefinir senhas.
- Cloudflare ingress com alias `wapphub-chat`; MariaDB permanece privado.
- CI de imagem Docker, instalação, login, frontend, rede compartilhada e reinício.
- Runbook de instalação/atualização e backup; restore, scanner e piloto Meta real permanecem pendentes.


Formato inspirado em Keep a Changelog. SemVer para versões executáveis.

## Unreleased — preparação 0.1.2 (Meta Pilot & Account Management)

- Diagnóstico de POST persistido antes da transação: tentativa HTTP, sucesso, status, erro sanitizado e correlation ID. Assinatura inválida é marcada como tentativa não autenticada.
- Logs estruturados com método, rota, tipo e código Prisma; mensagens são descrições fixas, sem input, stack, meta, tokens ou payload.
- Limites de IDs/tipos/categoria e timestamps compatíveis com DATETIME MariaDB; validação de identidade antes da deduplicação; colisão de providerId entre contas não é tratada como duplicata legítima.
- Payload bruto de mídia deixa de ser persistido em texto claro; tipo e placeholder continuam disponíveis, download Meta permanece pendente.
- Gestão administrativa de contas: desativação/reativação auditada, exclusão confirmada apenas de contas desativadas sem dependências/tentativas; Demo segue a mesma política. API, inbox e dispatcher bloqueiam contas indisponíveis.
- Diagnóstico local da integração e datas tentativa/sucesso na UI. Migration nova `20261005000000_account_diagnostics`, sem alterar migration inicial.
- Testes HTTP com banco simulado e ampliação da suíte MariaDB para rollback P2002, histórico, autorização, CSRF, exclusão confirmada e bloqueio de dispatcher.
- Causa concreta do 500 do homelab ainda não comprovada: o log antigo não contém exceção. Corrigido o defeito confirmado de diagnóstico perdido por rollback; não atribuir o incidente a P2002 sem nova evidência.
- Versão permanece 0.1.1 até os gates MariaDB/Docker/piloto real. Nenhuma release/tag criada.

- Documentada a validação pela interface no homelab: atendimento Demo, notas, busca, fechamento/reabertura, persistência, consumo, auditoria e upload em quarentena. ACL entre atendentes e scanner seguem pendentes no host.

Veja [roadmap](docs/12-roadmap.md) e [matriz de funcionalidades](docs/15-feature-status.md) para itens a implementar.

## 0.1.0 — 2026-10-01

Primeira beta executável para piloto; não representa conclusão do MVP integral.

### Added

- React/Vite com inbox responsiva, equipe, contas, consumo, configurações e auditoria.
- Fastify/TypeScript, Prisma/MariaDB, migration inicial, bootstrap sem senha padrão e lockfile.
- Login/logout, hash scrypt, cookies HttpOnly, CSRF, rate limit e autorização por empresa.
- Cadastro de contatos/conversas, notas, demo persistida e fechamento/reabertura.
- Transferência com quatro modos de histórico, resumo, política de notas e revogação de links anteriores.
- Contas Meta com segredos cifrados, webhook HMAC, dedup e persistência antes de ACK.
- Outbox de texto/template sem parâmetros, status tardio e estado incerto sem reenvio cego.
- Upload streaming retomável, SHA-256, quota com reserva, quarentena, download Range e shares revogáveis.
- Consumo com preços desconhecidos explícitos, totais por moeda e tarifas manuais BR versionadas.
- Trilha administrativa, testes de domínio/API/MariaDB e CI de build/testes/auditoria de dependências.
- Dockerfile/Compose e instruções de instalação, além de matriz real de funcionalidades.

### Changed

- Worker e fila durável no banco no mesmo processo, com uma instância; Redis/worker separado permanecem futuros.
- Usuário vinculado a uma empresa nesta beta; membership múltiplo pendente.
- CSP, segredos e autorização presentes, sem alegação de conformidade/certificação.

### Limitations

- Meta real não foi acionada nos testes. Sem mídia nativa Meta ou templates com parâmetros.
- Sem franquias/faixas, bloqueio de orçamento ou conciliação oficial; estimativa não é fatura.
- Docker indisponível no ambiente de desenvolvimento; validação de imagem/Compose/restore no host ainda necessária.

## Fundação documental — 2026-10-01

- README, monorepo reservado, escopo, arquitetura, domínio, segurança, auditoria, storage, custos, contratos e ADRs.
- Verificador documental, padrões de contribuição e plano até o piloto.
- Sem aplicativo executável nesta entrega inicial.
