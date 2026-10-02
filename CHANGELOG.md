# Changelog

## 0.1.1 — 2026-10-02

- Configuração interativa com segredos aleatórios, arquivos privados e proteção contra sobrescrita.
- Deploy Compose com migrations explícitas, healthchecks e preservação dos volumes.
- Bootstrap separado do ambiente permanente e repetível sem redefinir senhas.
- Cloudflare ingress com alias `wapphub-chat`; MariaDB permanece privado.
- CI de imagem Docker, instalação, login, frontend, rede compartilhada e reinício.
- Runbook de instalação/atualização e backup; restore, scanner e piloto Meta real permanecem pendentes.


Formato inspirado em Keep a Changelog. SemVer para versões executáveis.

## Unreleased

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
