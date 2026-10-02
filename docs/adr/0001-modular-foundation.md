# ADR 0001 — Monorepo e monólito modular

Status: aceito como direção; bibliotecas e versões pendentes de M1.

Contexto: homelab com recursos limitados e necessidade de crescer para multiempresa.

Decisão: React/TypeScript/Vite; Node/Fastify, worker separado, MariaDB/Prisma, Redis; domínio compartilhado independente de frameworks. Preferir um runtime e uma base modular a microserviços.

Consequências: implantação simples; tenant e autorização devem existir desde M1. Redis só coordena jobs; banco mantém fonte durável.

Validação: build, isolamento, migrations e recuperação da fila antes de produção.
