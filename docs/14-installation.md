# Instalação da beta 0.1.0

Esta versão é utilizável para piloto: conta demo completa e atendimento de texto com Cloud API configurada. Não é o MVP integral M7. Veja a [matriz real de funcionalidades](15-feature-status.md) antes de usar com clientes.

## Docker Compose no homelab

Pré-requisitos: Docker com Compose v2, recursos livres, porta local 8300 livre e backup. A aplicação roda em uma instância; não escale replicas nesta beta. Banco não é exposto em porta do host.

```bash
git clone https://github.com/uillaneduardo/chat.git
cd chat
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Se Node não estiver no host, gere a chave com `openssl rand -hex 32`. Edite `.env`:

- `ENCRYPTION_KEY`: chave gerada; guardar fora do banco e proteger permissões do arquivo.
- `MARIADB_PASSWORD` e `MARIADB_ROOT_PASSWORD`: senhas alfanuméricas longas e distintas (evitam escape na URL Compose).
- `PUBLIC_BASE_URL=http://localhost:8300` para testar localmente no host. Para acesso LAN use o hostname/IP real da origem; para o domínio, `https://chat.wapphub.com.br`.
- `NODE_ENV=development` para piloto local; `production` exige origem HTTPS.
- `ENABLE_DEMO=true` cria conta demo no bootstrap. Pode ser desativado depois; contas demo existentes não enviam à Meta.
- Preencha BOOTSTRAP_COMPANY, BOOTSTRAP_NAME, BOOTSTRAP_EMAIL e BOOTSTRAP_PASSWORD (mínimo 12 caracteres).
- `ALLOW_UNSCANNED_FILES=false`: arquivos sem scanner ficam em quarentena. Apenas para laboratório confiável, `true` libera arquivos sem antivírus. O container padrão não inclui ClamAV; para liberar arquivos de clientes configure imagem/serviço de varredura adequado antes do piloto.

```bash
docker compose build
docker compose up -d db
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run bootstrap
# Remova BOOTSTRAP_PASSWORD do .env após criar a conta.
docker compose up -d app
docker compose logs --tail=100 app
```

Abra `http://localhost:8300` no host. Se estiver pelo notebook, use encaminhamento SSH local ou configure túnel para o domínio. Não há senha padrão nem instalador web público. Bootstrap cria empresa nova, não altera usuário existente; e-mail deve ser exclusivo.

Migrations são executadas explicitamente, nunca pelo startup. Volumes `database` e `media` preservam dados. **Não use `docker compose down -v` para atualizar:** remove os volumes.

## Cloudflare Tunnel

Origem local sugerida: `http://localhost:8300` quando cloudflared roda no host. Se cloudflared está em outro container, `localhost` é o próprio container: conecte à rede Docker adequada e use `http://app:3000`. Não expose MariaDB ou Docker socket.

Atualize PUBLIC_BASE_URL e reinicie app. Webhook `/webhooks/meta/<account_id>` deve ficar acessível à Meta sem login/challenge. UI/API autenticadas não devem ser cacheadas publicamente. Limites por request devem admitir chunks de 8 MiB. Transferir sem histórico não reinicia a janela Meta.

## Executar sem Docker

Node 22 ou 24, npm e MariaDB 10.11/11.4. Crie banco e usuário exclusivo, defina DATABASE_URL, ENCRYPTION_KEY e bootstrap no `.env`.

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run bootstrap
npm run build
npm start
```

Acesse a origem definida (padrão porta 3000). Desenvolvimento separado: `npm run dev`, web em `http://localhost:5173`; API 3000. A origem deve usar exatamente o hostname escolhido, pois cookies são restritos à origem. O banco e STORAGEROOT precisam ser persistentes e privados.

## Roteiro de validação demo

1. Entre como proprietário, crie dois atendentes em Equipe.
2. Inbox → novo atendimento → conta Demo e número sintético (somente dígitos).
3. Simule mensagem do cliente, responda e adicione uma nota interna.
4. Transfira para um atendente com histórico completo; entre em outra sessão/navegador para conferir.
5. Transfira para o segundo em modo futuras; confira que o primeiro perde acesso e o segundo só vê novas mensagens/resumo liberado.
6. Teste arquivo interno em laboratório: inicie, pause/continue, anexe à nota, baixe e gere link. Não feche a janela de upload antes de concluir.
7. Veja Consumo (demo sem cobrança externa), Configurações e Auditoria.

## Conta Meta real

Cadastre nome, phone number ID, WABA ID, versão Graph suportada, access token com permissões adequadas, app secret e verify token de pelo menos 24 caracteres. A plataforma mostra a URL do webhook; use-a no app Meta e assine os eventos necessários segundo a documentação oficial. Cadastro de pagamento/verificação empresarial e aprovação de templates são feitos na Meta.

Credenciais salvas são cifradas e não retornam ao browser. Conta real não usa mensagens simuladas. Envio de texto depende da janela; template aprovado sem parâmetros permite contato conforme política. Templates com parâmetros e mídia nativa ainda estão pendentes. Envios reais **não foram realizados** na validação deste commit.

## Atualização

Backup coordenado do banco/arquivos e cópia segura da chave antes de atualizar. `git pull`, build, migração explícita, reinício e healthcheck. Migração inicial validada com MariaDB 10.11; Compose/11.4 devem ser conferidos no seu host, pois Docker não estava disponível no ambiente de desenvolvimento. Restauração completa e carga de produção ainda são gates pendentes.
