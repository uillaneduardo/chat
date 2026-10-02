# Operação no homelab

> Especificação do produto completo. O estado de implementação da beta está em [Status das funcionalidades](15-feature-status.md); requisitos deste documento podem estar pendentes.

Este é um runbook de requisitos; Dockerfiles/Compose ainda não existem. Não alterar os serviços atuais do homelab nesta fase.

## Topologia alvo

Cloudflare Tunnel → proxy web/API → API/worker → MariaDB/Redis privados. API escuta rede interna; nenhuma porta de banco exposta ao host público. UI e API na mesma origem com TLS. Webhooks Meta acessíveis sem challenge de navegador. Excluir dados autenticados do cache CDN. Storage privado montado somente nos serviços necessários.

## Antes de implantação

Medir RAM/CPU/disco e upload disponíveis com os demais containers ativos; não assumir que i3/8 GB suportará todas as cargas. Definir image tags/digests, limites de CPU/RAM, health/readiness, restart e usuário sem root. Remover capabilities, filesystem read-only onde possível, tmpfs/volumes específicos, sem Docker socket e sem privileged.

Validar segredos obrigatórios, migration lock e backup pré-migração. Não fazer migração destrutiva automática no startup. Deployment primeiro em staging com dados sintéticos e número de teste autorizado.

## Configuração

`.env.example` é catálogo inicial. Nunca contém token real. STORAGE_ROOT é caminho dentro do container; mapear explicitamente para disco do host. Keys de cifragem ficam fora do banco e backups de dados, com recuperação separada e segura. Diretório local não muda por simples ação do tenant.

## Backup e restauração

Backup consistente de MariaDB, arquivos/metadados, configurações e trilha; estratégia coordenada evita referência sem objeto. Manter cópia cifrada fora do host, rotação e checksums. Chave de recuperação separada, acesso mínimo. Redis é reconstruível, mas jobs pendentes dependem de outbox durável.

Proposta de objetivo inicial a validar: RPO 24h e RTO 4h. Testar restauração isolada antes de atender clientes: restaurar DB/arquivos, validar contagens e amostra de hashes/ACLs, reconstruir filas, impedir envio de jobs antigos à Meta, validar janela e reconciliar pendências. Só habilitar saída depois de conferência explícita operacional. Registrar duração e resultado.

## Monitoramento

Uptime, falhas/latência de webhook, fila/outbox atrasada, dead-letter, envio uncertain, erros Meta, disco livre, uploads temporários, quota reservada, custos não precificados e divergência de conciliação. Logs JSON com correlação e retenção; métricas sem números de telefone/conteúdo como labels.

## Mudanças e rollback

Tags SemVer após incrementos funcionais; changelog e artefatos reproduzíveis. Migração compatível em expand/contract, rollback de app testado. Restauração de banco só com plano que considere mensagens recebidas após backup e deduplicação. A fundação documental não tem release funcional ou deploy.
