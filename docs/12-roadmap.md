# Roadmap e progresso

| Marco | Situação na beta 0.1.1 | Restante |
|---|---|---|
| M0 — documentação | Concluído | Manutenção contínua |
| M1 — fundação executável | Parcial avançado | Membership múltiplo, recuperação de senha/MFA e hardening |
| M2 — WhatsApp texto | Implementado em código, piloto real pendente | Validação com credenciais Meta e diagnóstico avançado |
| M3 — atendimento | Parcial | Filas/departamentos/tags, sessões formais e realtime socket |
| M4 — mídia e arquivos | Parcial | Mídia nativa Meta, scanner na imagem, retenção/dedup e recovery completo |
| M5 — consumo | Parcial | Franquias/faixas, ledger financeiro, reservas de orçamento e conciliação |
| M6 — operação | Parcial com CI Docker | Validação no host, restore, carga e revisão independente |
| M7 — MVP integral | Pendente | Aceite de todos os gates e piloto com conta autorizada |

A beta é utilizável antes da conclusão do MVP integral: login, inbox demo persistida, transferência, arquivos e adapter de texto. Veja [histórico detalhado](15-feature-status.md) e [instalação](14-installation.md).

## Próximos incrementos

1. Instalar no homelab em staging e validar conta Meta autorizada, sem campanhas.
2. Configurar scanner, implementar mídia Meta e recuperação robusta disco/banco.
3. Completar filas/tags, sessões, paginação visual e realtime com reautorização.
4. Motor de pricing oficial, regras de gratuidade/faixas, ledger e conciliação.
5. MFA/reset, observabilidade, backup/restore e revisão de segurança antes de ampliar uso.

Licença permanece pendente. Toda entrega atualiza CHANGELOG e a matriz; nenhum requisito se torna pronto só por existir documentação.
