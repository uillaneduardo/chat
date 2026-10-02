# Política de segurança

A versão 0.1.0 é uma beta para piloto, sem garantia de produção ou revisão independente. Controles implementados e pendentes estão em docs/15-feature-status.md. Configure scanner e valide backup/restore antes de lidar com arquivos de clientes.

Não publique vulnerabilidades com dados pessoais, tokens ou payloads reais em issues. Use reporte privado de vulnerabilidade do GitHub se o mantenedor habilitar esse recurso; caso indisponível, solicite um canal privado ao mantenedor sem divulgar detalhes exploráveis publicamente. Nenhum canal privado ou prazo de resposta está garantido nesta etapa.

Forneça versão/commit, impacto, passos mínimos com dados sintéticos e evidência sanitizada. Segredo exposto deve ser revogado na origem; remover do último commit não elimina o histórico.

Consulte [requisitos de segurança e auditoria](docs/08-security-audit.md). Antes de produção: revisar isolamento, histórico, assinatura webhook, compartilhamento, dependências e restauração.
