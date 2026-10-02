# Arquitetura

## Decisão de base

Monólito modular com API e worker separados operacionalmente. Domain não importa React, Fastify ou Prisma. API/worker dependem de domain e adapters. Contracts contém schemas de entrada/saída e eventos sanitizados. Database encapsula transações, filtros por tenant e migrações.

Node.js em versão LTS suportada na implementação; TypeScript estrito, React/Vite, Fastify, Prisma com conector MySQL validado para MariaDB, Redis e biblioteca de filas escolhida em ADR. Fixar versões e lockfile antes de CI de aplicação. Evitar microserviços e abstrações sem caso concreto.

## Módulos

Identity, Tenancy, Contacts, Inbox, Assignments, Notes, WhatsApp, Media, Usage, Pricing, Audit e Settings. Cada módulo declara casos de uso, repositório, regras de permissão e eventos publicados.

## Confiabilidade

- Persistir webhook validado antes de ACK; se banco indisponível, retornar erro recuperável.
- Evento recebido vira inbox durável; outbox transacional publica jobs após commit.
- Redis não é fonte única de mensagens ou custos; reconstruir jobs do banco após falha.
- Processamento pelo menos uma vez: consumidores idempotentes, retry com backoff/jitter e dead-letter.
- ACK rápido não depende de download de mídia ou envio à Meta.
- Status pode chegar duplicado, atrasado ou antes do registro local de envio. Guardar evento e associar depois.
- Não reenviar cegamente após timeout ambíguo da Meta; marcar envio incerto, reconciliar e exigir decisão controlada.

## Realtime

Salas por empresa não bastam: assinatura e payload filtrados por conversa e atribuição vigente. Revalidar no reconnect e antes de publicar. Transferência invalida caches, remove inscrições e revoga acesso do anterior conforme política. Nunca transmitir payload oculto para o navegador.

## Tempo e identidade

UTC no banco; fuso IANA apenas para apresentação e períodos explicitamente definidos. IDs opacos em APIs não substituem autorização. Timestamps do provedor não definem sozinhos a fronteira de acesso; sequência transacional local por conversa define ordem de visibilidade.
