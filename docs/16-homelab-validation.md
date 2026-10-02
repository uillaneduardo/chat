# Validação do piloto no homelab — 02/10/2026

Teste pela interface publicada, após o proprietário autenticar a sessão. Horário observado: aproximadamente 00:30–00:36, America/Fortaleza. Referência de código: beta 0.1.1, commit `6546404`; versão exata da imagem no servidor não foi inspecionada diretamente.

Foram utilizados exclusivamente conta Demo e dados sintéticos. Não houve envio pela Meta, alteração de tarifas, troca de credenciais ou mudança das configurações da empresa.

| Teste | Resultado observado |
|---|---|
| Acesso HTTPS e sessão autenticada | Tela e dados do proprietário carregaram; sessão preservada após recarregar |
| Novo atendimento | Conversa sintética criada e exibida na inbox |
| Recebimento Demo | Mensagem simulada exibida com status received |
| Resposta Demo | Resposta persistida com status delivered |
| Nota interna | Nota salva e recuperada após recarregar |
| Busca | Busca pelo nome sintético filtrou a inbox |
| Finalização | Conversa saiu da lista de abertas e exibiu opção de reabrir |
| Reabertura | Conversa voltou à lista de abertas e pôde receber novas ações |
| Persistência | Mensagem recebida, resposta e nota continuaram visíveis após recarregar e selecionar a conversa |
| Consumo | Resposta registrada como simulação sem custo Meta |
| Auditoria | Eventos de criação, mensagens, fechamento e reabertura exibidos |
| Configurações | Quota de 10 GiB e limite por arquivo de 2 GiB exibidos; parâmetros preservados |
| Upload interno | Arquivo TXT sintético de 73 bytes chegou a 100% e estado quarantine |
| Proteção sem scanner | Interface informou quarentena e indisponibilidade de download; nenhum link foi gerado |
| Transferência | Modal abriu com os quatro modos de histórico; somente proprietário disponível como destino. Transferência entre atendentes não executada |

## Dados mantidos para conferência

A conversa `QA Codex · 02/10 · sintético` contém mensagem recebida, resposta Demo e nota. Foi mantida aberta após validar a reabertura. O arquivo `chat-qa-upload.txt` foi mantido em quarentena, sem anexo à nota e sem compartilhamento. Nenhum dado existente do usuário foi apagado.

## Limites do aceite

Este teste confirma a jornada Demo na interface publicada. Não substitui teste de ACL com sessões distintas, validação de assinatura/webhook e envio com conta Meta real, teste de carga, restore de backup ou revisão de segurança independente.

A CI já cobre integração de tenant/ACL e instalação Docker com reinício. No homelab continuam pendentes:

1. Criar dois atendentes de teste e conferir transferência/recorte com sessões separadas.
2. Configurar scanner e validar arquivo liberado, download e links; conservar quarentena até essa etapa.
3. Ensaiar restauração coordenada de banco, mídia e chave em instalação separada.
4. Validar conta Meta autorizada e webhook sem campanhas.
5. Conferir saúde, imagem e volumes diretamente no servidor; não houve acesso SSH nesta validação.
