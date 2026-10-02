# Consumo, preços e conciliação

> Especificação do produto completo. O estado de implementação da beta está em [Status das funcionalidades](15-feature-status.md); requisitos deste documento podem estar pendentes.

## Estados financeiros

| Estado | Significado |
|---|---|
| Sem tarifa | Classificação ou regra desconhecida; custo null, não zero |
| Projetado/reservado | Previsão antes do envio e reserva de orçamento |
| Estimado | Evento observado avaliado por tabela/regra versionada |
| Conciliado | Total comparado com evidência financeira externa no escopo disponível |
| Ajustado | Correção auditada com vínculo ao cálculo original |

Status/pricing do webhook é evidência de classificação e faturabilidade quando fornecida. Não presumir campos `price` ou `currency` monetários em todo webhook. Não chamar preço calculado localmente de cobrança confirmada. Se a fonte financeira só tiver agregados, conciliar agregado sem inventar custo confirmado por mensagem.

## Tarifas e regras

Rate card: provedor, mercado do destinatário, categoria, moeda de cobrança, preço decimal, vigência e timezone aplicável, fonte oficial, data de consulta e aprovador. PricingRule: faixas de volume, franquias, elegibilidade de janela, entrada gratuita, escopo do contador e duração. Não inferir mercado apenas por `+55` se houver regra específica da Meta.

Não embutir as tarifas em reais e a franquia citadas na conversa como fatos permanentes. Consulta oficial de 01/10/2026 aponta atualização para mensagens não-template; página geral de pricing pode ter texto desatualizado. Conferir tabela oficial, elegibilidade e escopo para cada conta antes de habilitar estimativas. Sem regra validada, mostrar pendente de precificação.

Cálculo grava snapshot da tarifa/regra, evidência recebida, instante de classificação, quantidade, moeda e versão do motor. Faturabilidade pode ser unknown/yes/no. Evento recebido ou failed não gera cobrança automática por existir. Suportar modelos de cobrança distintos e guardar modelo desconhecido para revisão.

## Idempotência e contadores

Ledger possui chave semântica única por evento financeiro, tenant, provedor e modelo. `delivered` e `read` da mesma mensagem não geram duas cobranças. Reclassificação produz ajuste, não outra mensagem faturada. Contadores de franquia/faixa são atômicos e reconstruíveis; período e escopo seguem regra oficial, não fuso de exibição.

## Orçamento

Aviso e bloqueio por conta/número/empresa são configuráveis. Reservar previsão em transação antes de enfileirar; liquidar/liberar após resultado e reconciliar atrasos. Bloqueio é local, não teto garantido na Meta: webhooks atrasados, divergências e envios externos podem ultrapassar limite. Sem tarifa confiável, política de bloqueio rígido exige decisão explícita; não assumir custo zero.

## Painel

Filtros por tenant, número, categoria e período; recebidas/enviadas/entregues, faturabilidade, pendências, gasto estimado, agregado conciliado, armazenamento e orçamento. Drill-down custo → evidência → mensagem → conversa, respeitando visibilidade. Atendente sem acesso a custos financeiros recebe somente permissões operacionais. Exportação CSV protegida contra fórmula e dados de outros tenants.

Moeda de cobrança e moeda de exibição são distintas. Câmbio tem fonte, instante, arredondamento e aviso; somar moedas apenas depois de conversão explícita. Importação de fatura/API de analytics será implementada somente após confirmar disponibilidade e permissões da fonte oficial.
