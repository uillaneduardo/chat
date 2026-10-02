# Instruções para agentes e colaboradores

Leia README, CONTRIBUTING, SECURITY e docs do módulo antes de alterar. O estado atual é documental: não declare implementação existente. Respeite o requisito do usuário acima de orientações locais.

- Documentação PT-BR; código/identificadores em inglês.
- Preservar tenant, autorização server-side e fronteiras de histórico em todas as superfícies.
- Não inserir tarifas reais sem evidência oficial vigente; distinguir estimativa de conciliação.
- Segredos nunca no repositório/log. Somente fixtures sintéticas.
- Mudança de domínio/arquitetura exige doc e ADR quando relevante.
- Não aplicar deploy, migration ou envio Meta incidentalmente ao editar docs.
- Verificação atual: `python3 scripts/check_repository.py`.
- Não criar release funcional enquanto só houver scaffold; informar limites e resultados reais.
