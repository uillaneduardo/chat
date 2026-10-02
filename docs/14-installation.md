# Instalação da beta 0.1.1

Esta versão é utilizável para piloto: conta demo completa e atendimento de texto com Cloud API configurada. Não é o MVP integral M7. Veja a [matriz real de funcionalidades](15-feature-status.md) antes de usar com clientes.

## Docker Compose no homelab

Pré-requisitos: Docker com Compose v2, recursos livres, porta local 8300 livre e backup. A aplicação roda em uma instância; não escale replicas nesta beta. Banco não é exposto em porta do host.

```bash
mkdir -p ~/homelab/apps
cd ~/homelab/apps
git clone https://github.com/uillaneduardo/chat.git
cd chat
python3 scripts/configure.py
bash scripts/deploy.sh --cloudflare
```

O configurador solicita URL, empresa, nome, e-mail e senha (12–200 caracteres); gera chave e senhas distintas para o banco e cria `.env` e `.env.bootstrap` com permissão 600. Não sobrescreve configuração existente. Por compatibilidade dotenv, campos não aceitam aspas simples, barras invertidas ou quebras de linha. Guarde cópia segura de `.env`: perder ENCRYPTION_KEY impede recuperar credenciais cifradas.

O deploy compila a imagem, aguarda o banco, para o worker, aplica migrations, cria o proprietário e aguarda a saúde da aplicação. Após bootstrap bem-sucedido, remove `.env.bootstrap`; credenciais iniciais não ficam no ambiente do container permanente. Repetir o bootstrap com mesmo e-mail e empresa preserva a conta e sua senha. Para recuperação de uma instalação sem proprietário, recrie somente `.env.bootstrap` com BOOTSTRAP_COMPANY, BOOTSTRAP_NAME, BOOTSTRAP_EMAIL e BOOTSTRAP_PASSWORD; use permissão 600 e não altere chaves do `.env`.

A rede `cloudflare_ingress` precisa existir e incluir o seu cloudflared. Se tiver outro nome, execute `CLOUDFLARE_NETWORK=nome bash scripts/deploy.sh --cloudflare`. Sem túnel/container compartilhado, execute sem `--cloudflare`; acesso local em `http://localhost:8300`. Para produção use `PUBLIC_BASE_URL=https://chat.wapphub.com.br` e `NODE_ENV=production`, valores padrão do configurador. A porta fica restrita a loopback; acesso pelo notebook exige túnel ou encaminhamento SSH.

`ALLOW_UNSCANNED_FILES=false`: arquivos sem scanner ficam em quarentena. A imagem padrão não inclui ClamAV. Apenas em laboratório confiável, liberar explicitamente `true` permite arquivos sem varredura. Não há senha padrão nem instalador web público.

Migrations são executadas explicitamente, nunca pelo startup. Volumes `database` e `media` preservam dados. **Não use `docker compose down -v` para atualizar:** remove os volumes.

## Cloudflare Tunnel

Origem local sugerida: `http://localhost:8300` quando cloudflared roda no host. Se cloudflared está em outro container, `localhost` é o próprio container: execute o deploy com `--cloudflare` e use `http://wapphub-chat:3000`. Não expose MariaDB ou Docker socket.

No Tunnel existente, adicione o hostname `chat.wapphub.com.br` e serviço HTTP `http://wapphub-chat:3000`. Somente a aplicação participa da rede compartilhada; o banco permanece na rede privada do projeto. Atualize PUBLIC_BASE_URL e reinicie app. Webhook `/webhooks/meta/<account_id>` deve ficar acessível à Meta sem login/challenge. UI/API autenticadas não devem ser cacheadas publicamente. Limites por request devem admitir chunks de 8 MiB. Transferir sem histórico não reinicia a janela Meta.

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

Backup coordenado do banco/arquivos e cópia segura da chave antes de atualizar:

```bash
git pull --ff-only
bash scripts/deploy.sh --cloudflare
curl -fsS http://127.0.0.1:8300/api/health
```

A CI verifica build da imagem, migrations, bootstrap, frontend, login, rede ingress e persistência após reinício. Resta validar no seu host e realizar restauração completa e carga antes de ampliar o piloto. O script não executa rollback automático de migrations: em falha preserve os volumes, examine o erro e restaure backup coordenado se necessário. Não execute instalação em paralelo.

## Backup e recuperação

Pare a aplicação para copiar banco e mídia no mesmo ponto. Com o mesmo conjunto de arquivos Compose utilizado no deploy, exporte o banco com `docker compose exec -T db sh -c 'exec mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" --single-transaction chat' > backup.sql` (a senha permanece dentro do container). Guarde o dump com permissão 600, arquive o volume de mídia e copie `.env` para armazenamento protegido separado do servidor. Reinicie a aplicação após a cópia. Não publique dumps, mídias ou chaves no Git.

Teste restore em outro projeto Compose e outra origem; nunca faça o primeiro ensaio sobre dados de produção. Importe o dump, restaure mídia com proprietário UID 1000, reutilize a chave correta e valide login, downloads e credenciais antes de considerar o backup aprovado. Ensaio de restore permanece pendente.
