# Contribuição

1. Leia README, escopo e ADRs. Nunca trate requisito documentado como implementado.
2. Use branch `feat/`, `fix/`, `docs/` ou `chore/` e commit Conventional Commits.
3. Faça mudança pequena, documente comportamento e atualize changelog quando relevante.
4. Rode `python3 scripts/check_repository.py`, `npm run build`, `npm test` e `npm audit`. Integração usa somente banco dedicado *_test, com migration aplicada.
5. PR deve explicar problema, resultado, validação, implicações de tenant/ACL, migração e rollback quando houver.

TypeScript strict; entradas validadas no servidor; domínio sem framework; dinheiro decimal; datas UTC; nomenclatura de código em inglês e documentação PT-BR. Não adicionar dependência sem motivo, lockfile e versão suportada. Nenhum segredo, dump, arquivo de cliente ou .env real no Git.

Mantenedor deve configurar proteção de main, revisão e CI obrigatório quando houver colaboradores. Essas configurações não foram aplicadas por este scaffold. Actions fixadas por SHA e permissions mínimas. Releases SemVer somente após entrega verificável, com changelog; não marcar documentação como MVP funcional.

Licença pendente de decisão; não adicionar licença arbitrariamente.
