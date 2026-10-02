# Arquivos grandes e armazenamento

## Storage local

Arquivos fora da raiz pública em `/mnt/cloud-data/wapphub-chat/media`; temporários em diretório separado no mesmo filesystem quando necessário para rename atômico. Nome físico aleatório, company segregada, nome original somente em metadados. Banco guarda referências, não BLOB de mídia.

Raiz é configuração do operador, validada no startup. Tenants não escolhem caminhos absolutos. Storage adapter oferece put/read/range/delete/stat; migração futura para S3/MinIO preserva IDs e ACLs.

## Limites separados

| Limite | Configuração |
|---|---|
| Arquivo interno | Proposta inicial 2 GiB, ajustável conforme disco e testes |
| Chunk | Proposta inicial 8 MiB e máximo de infraestrutura validado |
| WhatsApp | Limites por tipo/MIME da API vigente; independentes do limite interno |
| Empresa/usuário | Quota em bytes incluindo reservas e temporários |
| Compartilhamento | Prazo, revogação e número de acessos opcionais |

Valores são propostas, não limites implementados. Cloudflare documenta teto por requisição conforme plano (Free/Pro: 100 MB na consulta de 01/10/2026); request chunk deve ficar abaixo do teto efetivo configurado, incluindo overhead. O arquivo total pode ser maior que cada requisição. Nginx/API/Tunnel também exigem limites/timeouts compatíveis.

## Protocolo retomável

1. POST uploads valida tamanho declarado, tipo, autor e escopo; reserva quota atomicamente.
2. PUT parte envia bytes em stream com índice/offset, comprimento e checksum; autenticar cada chamada.
3. GET sessão retorna partes confirmadas/offset e expiração sem listar uploads alheios.
4. Retry de parte idêntica é idempotente; parte divergente ou offset inválido retorna 409.
5. Complete trava sessão, verifica cobertura/tamanho/hash, montagem em streaming e inspeção; finalize via rename atômico e transação coordenada.
6. Cancelamento/expiração libera reservas e remove temporários; processo de reconciliação detecta órfãos após falha entre disco e banco.

Escolher tus ou protocolo próprio em ADR antes de codificar; rotas atuais são intenção. Limitar partes, concorrência, sessões abertas, tempo total e disco livre. Nunca carregar arquivo completo em RAM. Restringir caminho, symlinks, caracteres e descompressão automática. File size usa BIGINT; progress no browser não significa persistência confirmada.

## Validação e acesso

Detectar MIME por conteúdo, allowlist por finalidade, nome sanitizado, quarentena e varredura antimalware antes de liberar. Falha/indisponibilidade do scanner mantém quarentena. Não executar arquivos nem descompactar uploads automaticamente. Downloads autenticados, Range e thumbnails aplicam ACL da conversa/arquivo e política vigente. `Content-Disposition: attachment` para tipos arriscados, nosniff, sem cache público.

Links externos usam token criptograficamente aleatório, só hash armazenado, prazo/revogação e rate limit. Link é concessão a quem o possui; não garante identidade do destinatário. Permissão para criar link é separada da permissão de ler arquivo. Revogar ao alterar ACL se política exigir; excluir conteúdo revoga todos os links.

## Quotas e retenção

Reservas concorrentes não podem ultrapassar quota. Considerar temporários, previews e objetos em quarentena. Configurar aviso, retenção e exclusão; job usa referências e evita apagar objeto ainda usado. Deduplicação opcional apenas dentro do tenant; não revelar existência de hash entre empresas. Remoção do arquivo só após última referência autorizada e prazo de retenção.

Arquivos acima do limite WhatsApp ficam internos. Gerar e enviar link requer ação explícita, janela/template válido e aviso sobre expiração; nunca transformar upload interno em envio público automaticamente.
