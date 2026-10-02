# Fontes oficiais e validações pendentes

Consulta inicial: **01/10/2026 (America/Fortaleza)**. Revalidar em cada implementação/release que dependa de regra externa. Links podem migrar; atualizar sem usar artigo comercial como autoridade de preço.

| Fonte | Uso |
|---|---|
| https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing | Tarifas e modelo oficial |
| https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages | Atualização de preços de mensagens não-template |
| https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media | Tipos e limites de mídia |
| https://developers.facebook.com/documentation/business-messaging/whatsapp/analytics/ | Métricas e disponibilidade por conta |
| https://business.whatsapp.com/policy | Política do canal e atendimento |
| https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/ | Teto por requisição e chunks |
| https://owasp.org/www-project-application-security-verification-standard/ | Baseline ASVS |
| https://owasp.org/www-project-api-security/ | Ameaças de API |

## Limites da verificação inicial

Busca oficial indexada identifica mudança de cobrança não-template com vigência 01/10/2026. A página geral de marketing ainda pode mencionar serviço gratuito. A leitura integral da página técnica Meta ficou indisponível na consulta; por isso este repo não valida preços BRL, franquia ou regras específicas por conta e não inclui seed de tarifa real. Esses itens exigem conferência completa no portal oficial antes de usar o motor de estimativas.

A referência Cloudflare foi lida: teto Free/Pro 100 MB por requisição, ajustável para baixo na zona; uploads fragmentados precisam respeitar o teto efetivo. Os limites Meta por formato são separados e precisam ser conferidos na versão adotada.

Informações anteriores de conversa são contexto de requisitos, não evidência financeira. Webhook não é comprovante de valor monetário; conciliação depende da fonte efetivamente disponível.
