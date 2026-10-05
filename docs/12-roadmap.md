# Roadmap e progresso

| Marco | Situação na beta 0.1.1 | Restante |
|---|---|---|
| M0 — documentação | Concluído | Manutenção contínua |
| M1 — fundação executável | Parcial avançado | Membership múltiplo, recuperação de senha/MFA e hardening |
| M2 — WhatsApp texto | Implementado em código, piloto real pendente | Validação com credenciais Meta; diagnóstico/gestão candidatos à 0.1.2 |
| M3 — atendimento | Parcial | Filas/departamentos/tags, sessões formais e realtime socket |
| M4 — mídia e arquivos | Parcial | Mídia nativa Meta, scanner na imagem, retenção/dedup e recovery completo |
| M5 — consumo | Parcial | Franquias/faixas, ledger financeiro, reservas de orçamento e conciliação |
| M6 — operação | Parcial com CI Docker e piloto Demo | Inspeção direta do host, restore, carga e revisão independente |
| M7 — MVP integral | Pendente | Aceite de todos os gates e piloto com conta autorizada |

A beta é utilizável antes da conclusão do MVP integral: login, inbox demo persistida, transferência, arquivos e adapter de texto. Veja [histórico detalhado](15-feature-status.md) e [instalação](14-installation.md).

## Próximos incrementos

1. **Piloto Meta real e gestão de contas (prioridade imediata):**
   - código de diagnóstico persistente, UI e gestão de contas entregue nesta proposta; concluir validação MariaDB/Docker e investigação do 500 real antes de promover 0.1.2;
   - validar recebimento e envio com o número de teste da Meta;
   - validar diagnóstico de webhook que diferencie tentativa recebida, rejeição por assinatura, payload inválido, WABA divergente, Phone Number ID divergente e processamento concluído;
   - registrar `lastWebhookAttempt`, `lastWebhookSuccess` e último erro sanitizado fora da transação principal, para que uma falha de processamento não apague a evidência de que a Meta alcançou o endpoint;
   - validar desativação e exclusão de contas WhatsApp pela UI/API, incluindo a conta Demo, com confirmação explícita, auditoria e regras de integridade para conversas/eventos existentes;
   - quando `ENABLE_DEMO=false`, não criar nem exibir automaticamente conta Demo nova; uma conta Demo existente deve poder ser removida administrativamente;
   - validar ação local de diagnóstico da conta Meta sem revelar token ou App Secret.
2. Configurar scanner, implementar mídia Meta e recuperação robusta disco/banco.
3. Completar filas/tags, sessões, paginação visual e realtime com reautorização.
4. Motor de pricing oficial, regras de gratuidade/faixas, ledger e conciliação.
5. MFA/reset, observabilidade, backup/restore e revisão de segurança antes de ampliar uso.

Licença permanece pendente. Toda entrega atualiza CHANGELOG e a matriz; nenhum requisito se torna pronto só por existir documentação.
