# Instruções para agentes e colaboradores

Leia README, CONTRIBUTING, SECURITY e docs do módulo antes de alterar. O estado atual é beta 0.1.1. Consulte docs/15-feature-status.md antes de declarar um recurso implementado. Respeite o requisito do usuário acima de orientações locais.

- Documentação PT-BR; código/identificadores em inglês.
- Preservar tenant, autorização server-side e fronteiras de histórico em todas as superfícies.
- Não inserir tarifas reais sem evidência oficial vigente; distinguir estimativa de conciliação.
- Segredos nunca no repositório/log. Somente fixtures sintéticas.
- Mudança de domínio/arquitetura exige doc e ADR quando relevante.
- Não aplicar deploy, migration ou envio Meta incidentalmente ao editar docs.
- Verificação: `python3 scripts/check_repository.py`, `npm run build`, `npm test`, `npm audit`. Integração exige TEST_DATABASE_URL dedicado terminado em _test; testes apagam somente esse banco.
- Atualizar CHANGELOG, matriz de funcionalidades e roadmap junto ao código. Informar testes realizados e gates pendentes; nunca acionar Meta real incidentalmente.
