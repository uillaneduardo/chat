# Roadmap

| Marco | Entrega | Critério de conclusão |
|---|---|---|
| M0 — atual | Documentação, módulos, padrões e verificador | Links/configurações válidos e commit publicado |
| M1 | Workspace executável, lockfile, login/tenant, migrations e CI | App inicia localmente; isolamento e sessões testados |
| M2 | Contas e webhook durável, outbox e mensagens texto | HMAC, dedup, status fora de ordem e uncertain verificados |
| M3 | Inbox, filas, sessões e transferência | Policy testada em todas as superfícies, inclusive realtime |
| M4 | Mídia local, upload retomável, quotas e shares | Carga 2 GiB, recovery, quarentena e ACL aprovados |
| M5 | Tarifas, consumo, reservas e conciliação | Sem dupla cobrança; null e evidências corretos |
| M6 | Deploy staging/homelab, backups e hardening | Restauração testada, carga e revisão de segurança |
| M7 | Piloto do MVP com conta autorizada | Jornada completa, monitoramento e aceite operacional |

M2 depende de M1; M3 usa M2; M4 e M5 integram com M3 antes do piloto. Nenhuma funcionalidade está marcada pronta por existir documentação. Não prometer prazo sem dimensionar equipe e conta Meta.

## Pendências de decisão

Licença, autenticação/recuperação, bibliotecas de fila/realtime, tus versus protocolo de chunks, scanner, retenção, moeda real da conta, tarifário/franquias aplicáveis, fonte de conciliação e recursos disponíveis no homelab. Registrar decisões em ADR e congelar versões na implementação.
