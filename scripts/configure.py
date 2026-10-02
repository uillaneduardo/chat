"""Create a private homelab configuration without printing credentials."""
import getpass
import os
from pathlib import Path
import secrets
from urllib.parse import urlsplit


def quote(value):
    if any(c in value for c in "'\\\r\n"):
        raise ValueError("Não use aspas simples, barras invertidas ou quebras de linha.")
    return "'" + value + "'"


def write_private(path, values):
    content = "\n".join(f"{key}={quote(value)}" for key, value in values.items()) + "\n"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write(content)


def main():
    os.chdir(Path(__file__).resolve().parent.parent)
    if Path('.env').exists() or Path('.env.bootstrap').exists():
        raise ValueError("Configuração existente: preservada. Consulte docs/14-installation.md para atualizar.")
    automated = os.environ.get('SETUP_NON_INTERACTIVE') == 'true'
    def ask(key, prompt, default=''):
        return os.environ.get(key, default) if automated else (input(f'{prompt} [{default}]: ').strip() or default)
    url = ask('SETUP_URL', 'URL pública', 'https://chat.wapphub.com.br').rstrip('/')
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise ValueError('Informe uma origem HTTP/HTTPS sem caminho, credenciais ou parâmetros.')
    company = ask('SETUP_COMPANY', 'Empresa', 'WappHub')
    name = ask('SETUP_NAME', 'Nome do proprietário')
    email = ask('SETUP_EMAIL', 'E-mail do proprietário').lower()
    password = os.environ.get('SETUP_PASSWORD', '') if automated else getpass.getpass('Senha inicial (12–200 caracteres): ')
    if not automated and password != getpass.getpass('Confirme a senha: '):
        raise ValueError('As senhas não coincidem.')
    if not company or len(company) > 100 or not name or len(name) > 100 or '@' not in email or not 12 <= len(password) <= 200:
        raise ValueError('Empresa, nome, e-mail e senha válidos são obrigatórios.')
    bootstrap = dict(BOOTSTRAP_COMPANY=company, BOOTSTRAP_NAME=name, BOOTSTRAP_EMAIL=email, BOOTSTRAP_PASSWORD=password)
    for value in bootstrap.values():
        quote(value)
    write_private('.env', dict(PUBLIC_BASE_URL=url, NODE_ENV='production' if parsed.scheme == 'https' else 'development', ENCRYPTION_KEY=secrets.token_hex(32), MARIADB_PASSWORD=secrets.token_hex(32), MARIADB_ROOT_PASSWORD=secrets.token_hex(32), ENABLE_DEMO='true', ALLOW_UNSCANNED_FILES='false'))
    write_private('.env.bootstrap', bootstrap)
    print('Configuração criada com permissão 600. Guarde uma cópia segura de .env; execute bash scripts/deploy.sh.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, EOFError, KeyboardInterrupt) as error:
        raise SystemExit(str(error) or 'Configuração cancelada.')
