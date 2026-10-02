import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { api, setCsrf, csrfHeaders } from './api';
import './style.css';
type Me = {
  id: string;
  name: string;
  role: string;
  companyId: string;
  csrfToken: string;
  demoEnabled: boolean;
};
type User = { id: string; name: string; email: string; role: string; active: boolean };
type Account = {
  id: string;
  name: string;
  mode: string;
  webhookUrl: string;
  hasCredentials: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  graphVersion: string | null;
  lastWebhook: string | null;
};
type Conversation = {
  id: string;
  status: string;
  contact: { name: string; waId: string };
  account: { id: string; name: string; mode: string };
  assignedUserId: string | null;
  version: number;
  windowOpen: boolean;
  updatedAt: string;
};
type Message = {
  id: string;
  sequence: number;
  direction: string;
  type: string;
  body: string;
  status: string;
  createdAt: string;
  errorCode: string | null;
  file: { id: string; name: string; size: string; state: string } | null;
};
type Detail = Conversation & {
  summary: string;
  visibleFrom: number;
  lastCustomerAt: string | null;
  messages: Message[];
  nextBefore: number | null;
};
type Settings = {
  name: string;
  maxFileBytes: string;
  quotaBytes: string;
  usedBytes: string;
  reservedBytes: string;
  budget: string | null;
  unscannedAllowed: boolean;
};
const managed = (me: Me) => ['owner', 'admin', 'supervisor'].includes(me.role);
const admin = (me: Me) => ['owner', 'admin'].includes(me.role);
const date = (value: string) => new Date(value).toLocaleString('pt-BR');
const bytes = (value: string | number) => {
  const n = Number(value);
  return n >= 1073741824
    ? (n / 1073741824).toFixed(2) + ' GiB'
    : n >= 1048576
      ? (n / 1048576).toFixed(1) + ' MiB'
      : n + ' B';
};
function App() {
  const [me, setMe] = useState<Me | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [view, setView] = useState('Inbox');
  const [users, setUsers] = useState<User[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]);
  const loadMe = async () => {
    const u = await api<Me>('/me');
    setCsrf(u.csrfToken);
    setMe(u);
  };
  useEffect(() => {
    loadMe()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  async function refs() {
    if (!me || !managed(me)) return;
    const [u, a] = await Promise.all([api<User[]>('/users'), api<Account[]>('/accounts')]);
    setUsers(u);
    setAccounts(a);
  }
  useEffect(() => {
    if (me) run(refs);
  }, [me]);
  if (loading) return <div className="center">Carregando…</div>;
  if (!me) return <Login onLogin={loadMe} />;
  const menu = [
    'Inbox',
    ...(managed(me) ? ['Equipe', 'WhatsApp', 'Consumo', 'Configurações'] : []),
    ...(admin(me) ? ['Auditoria'] : []),
  ];
  return (
    <div className="app">
      <aside className="nav">
        <a className="brand" href="/">
          W<span>●</span>
          <div>
            WappHub<small>CHAT · BETA 0.1</small>
          </div>
        </a>
        <nav>
          {menu.map((v) => (
            <button
              key={v}
              className={view === v ? 'selected' : ''}
              onClick={() => {
                setView(v);
                setError('');
              }}
            >
              {v}
            </button>
          ))}
        </nav>
        <div className="identity">
          <strong>{me.name}</strong>
          <small>{me.role}</small>
          <button
            onClick={() =>
              run(async () => {
                await api('/auth/logout', 'POST');
                setMe(null);
                setCsrf('');
              })
            }
          >
            Sair
          </button>
        </div>
      </aside>
      <main>
        <header className="top">
          <div>
            <small>CENTRAL DE ATENDIMENTO</small>
            <h1>{view}</h1>
          </div>
          <span className="badge">WhatsApp oficial · piloto</span>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}
        {view === 'Inbox' && <Inbox me={me} users={users} accounts={accounts} run={run} />}
        {view === 'Equipe' && <Team me={me} users={users} refresh={refs} run={run} />}
        {view === 'WhatsApp' && <Accounts me={me} accounts={accounts} refresh={refs} run={run} />}
        {view === 'Consumo' && <Usage me={me} run={run} />}
        {view === 'Configurações' && <Configuration me={me} run={run} />}
        {view === 'Auditoria' && <Audit run={run} />}
      </main>
    </div>
  );
}
type Run = (fn: () => Promise<unknown>) => Promise<void>;
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <section>
        <div className="logo">
          W<span>●</span>
        </div>
        <small>WAPPHUB CHAT</small>
        <h1>
          Seu atendimento,
          <br />
          em um só lugar.
        </h1>
        <p>Converse com clientes, organize sua equipe e controle o acesso ao histórico.</p>
        <span className="badge">Primeira versão · piloto</span>
      </section>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api('/auth/login', 'POST', { email, password });
            await onLogin();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Entrar na plataforma</h2>
        <p>Use a conta criada pelo administrador.</p>
        <label>
          E-mail
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <small>Não há credenciais padrão. O proprietário é criado pelo comando bootstrap.</small>
      </form>
    </div>
  );
}
function Inbox({
  me,
  users,
  accounts,
  run,
}: {
  me: Me;
  users: User[];
  accounts: Account[];
  run: Run;
}) {
  const [items, setItems] = useState<Conversation[]>([]),
    [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    [newContact, setNewContact] = useState(false),
    [filter, setFilter] = useState('open');
  const refresh = async () => setItems(await api<Conversation[]>('/conversations'));
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const data = await api<Conversation[]>('/conversations');
        if (alive) setItems(data);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const filtered = items.filter(
    (c) =>
      (filter === 'all' || c.status === filter) &&
      `${c.contact.name} ${c.contact.waId}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className={'inbox ' + (selected ? 'has-thread' : '')}>
      <section className="conversations">
        <div className="list-tools">
          <div className="row">
            <h2>
              Conversas <small>{filtered.length}</small>
            </h2>
            {managed(me) && (
              <button aria-label="Novo atendimento" onClick={() => setNewContact(true)}>
                +
              </button>
            )}
          </div>
          <input
            aria-label="Buscar contato"
            placeholder="Buscar nome ou número"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Status da conversa"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="open">Em atendimento</option>
            <option value="closed">Finalizadas</option>
            <option value="all">Todas</option>
          </select>
        </div>
        {filtered.map((c) => (
          <button
            key={c.id}
            className={'contact ' + (selected === c.id ? 'active' : '')}
            onClick={() => setSelected(c.id)}
          >
            <span className="avatar">{c.contact.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{c.contact.name}</strong>
              <small>
                {c.account.name} ·{' '}
                {c.assignedUserId
                  ? (users.find((u) => u.id === c.assignedUserId)?.name ?? 'Atribuído')
                  : 'Não atribuída'}
              </small>
              <small>{c.contact.waId}</small>
            </div>
            <span className={'dot ' + (c.windowOpen ? 'green' : '')} />
          </button>
        ))}
        {!filtered.length && <p className="empty">Nenhuma conversa nesta lista.</p>}
      </section>
      {selected ? (
        <Thread
          key={selected}
          id={selected}
          me={me}
          users={users}
          onClose={() => {
            setSelected('');
            refresh();
          }}
          run={run}
        />
      ) : (
        <section className="welcome">
          <span>☏</span>
          <h2>Pronto para atender</h2>
          <p>Selecione uma conversa ou crie um atendimento.</p>
          <small>Conta demo permite simular mensagens sem usar a Meta.</small>
        </section>
      )}
      {newContact && (
        <Modal title="Novo atendimento" close={() => setNewContact(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              run(async () => {
                const c = await api<Conversation>(
                  '/conversations',
                  'POST',
                  Object.fromEntries(data),
                );
                setNewContact(false);
                await refresh();
                setSelected(c.id);
              });
            }}
          >
            <label>
              Nome
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Número WhatsApp
              <input
                name="waId"
                placeholder="5581… somente dígitos"
                pattern="[0-9]{6,20}"
                required
              />
            </label>
            <label>
              Conta
              <select name="accountId" required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary">Criar ou abrir conversa</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function Thread({
  id,
  me,
  users,
  onClose,
  run,
}: {
  id: string;
  me: Me;
  users: User[];
  onClose: () => void;
  run: Run;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [text, setText] = useState(''),
    [mode, setMode] = useState('outgoing'),
    [transfer, setTransfer] = useState(false),
    [busy, setBusy] = useState(false),
    [template, setTemplate] = useState(false),
    [name, setName] = useState(''),
    [language, setLanguage] = useState('pt_BR'),
    [attachment, setAttachment] = useState<{ id: string; name: string } | null>(null),
    [showUpload, setShowUpload] = useState(false);
  const scroll = useRef<HTMLDivElement>(null),
    pending = useRef<{ key: string; signature: string } | null>(null);
  const refresh = async () => setDetail(await api<Detail>(`/conversations/${id}`));
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const d = await api<Detail>(`/conversations/${id}`);
        if (alive) setDetail(d);
      } catch {
        if (alive) onClose();
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  useEffect(() => {
    scroll.current?.scrollTo(0, scroll.current.scrollHeight);
  }, [detail?.messages.length]);
  if (!detail) return <section className="thread empty">Carregando atendimento…</section>;
  const send = async () => {
    const b = {
      body: text || attachment?.name || name,
      direction: mode,
      ...(attachment ? { fileId: attachment.id } : {}),
      ...(template && mode === 'outgoing' ? { template: { name, language } } : {}),
    };
    const signature = JSON.stringify(b);
    if (!pending.current || pending.current.signature !== signature)
      pending.current = { key: crypto.randomUUID(), signature };
    setBusy(true);
    try {
      await api(`/conversations/${id}/messages`, 'POST', b, {
        'Idempotency-Key': pending.current.key,
      });
      pending.current = null;
      setText('');
      setAttachment(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="thread">
      <header className="thread-head">
        <button className="back" onClick={onClose}>
          ←
        </button>
        <span className="avatar">{detail.contact.name.slice(0, 2).toUpperCase()}</span>
        <div>
          <h2>{detail.contact.name}</h2>
          <small>
            {detail.contact.waId} · {detail.account.name}
          </small>
          <span className={'badge ' + (detail.windowOpen ? 'good' : '')}>
            {detail.account.mode === 'demo'
              ? 'Demonstração'
              : detail.windowOpen
                ? 'Janela de 24h aberta'
                : 'Janela encerrada · use template'}
          </span>
        </div>
        <div className="actions">
          {managed(me) && <button onClick={() => setTransfer(true)}>Transferir</button>}
          <button
            onClick={() =>
              run(async () => {
                await api(`/conversations/${id}`, 'PATCH', {
                  status: detail.status === 'open' ? 'closed' : 'open',
                });
                await refresh();
              })
            }
          >
            {detail.status === 'open' ? 'Finalizar' : 'Reabrir'}
          </button>
        </div>
      </header>
      {detail.summary && (
        <div className="summary">
          <strong>Resumo liberado para este atendimento</strong>
          <p>{detail.summary}</p>
        </div>
      )}
      <div className="messages" ref={scroll}>
        {detail.nextBefore && (
          <p className="notice">
            Mostrando as últimas 200 mensagens. Paginação disponível na API; navegação anterior
            ainda pendente na interface.
          </p>
        )}
        {detail.visibleFrom > 1 && <p className="divider">Início do contexto liberado</p>}
        {detail.messages.map((m) => (
          <article key={m.id} className={'bubble ' + m.direction}>
            <small>
              {m.direction === 'note'
                ? 'NOTA INTERNA'
                : m.direction === 'incoming'
                  ? 'CLIENTE'
                  : 'EQUIPE'}
            </small>
            <p>{m.body}</p>
            {m.file && (
              <a href={'/api/files/' + m.file.id} target="_blank" rel="noreferrer">
                ↓ {m.file.name} · {bytes(m.file.size)} · {m.file.state}
              </a>
            )}
            <footer>
              <span>{date(m.createdAt)}</span>
              <span>
                {m.status}
                {m.errorCode ? ' · ' + m.errorCode : ''}
              </span>
            </footer>
          </article>
        ))}
        {!detail.messages.length && (
          <div className="empty">Este atendimento ainda não tem mensagens visíveis.</div>
        )}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          run(send);
        }}
      >
        <div className="row">
          <select
            aria-label="Tipo de mensagem"
            disabled={busy}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setAttachment(null);
            }}
          >
            <option value="outgoing">Resposta ao cliente</option>
            <option value="note">Nota interna</option>
            {detail.account.mode === 'demo' && managed(me) && me.demoEnabled && (
              <option value="incoming">Simular cliente</option>
            )}
          </select>
          {mode === 'note' && (
            <button type="button" onClick={() => setShowUpload(true)}>
              Anexar arquivo interno
            </button>
          )}
          {detail.account.mode === 'meta' && mode === 'outgoing' && (
            <label className="check">
              <input
                type="checkbox"
                checked={template}
                onChange={(e) => setTemplate(e.target.checked)}
              />
              Template
            </label>
          )}
        </div>
        {template && mode === 'outgoing' && (
          <div className="row">
            <input
              aria-label="Nome do template"
              placeholder="Nome aprovado (sem parâmetros)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              aria-label="Idioma do template"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              required
            />
          </div>
        )}
        {attachment && (
          <div className="notice">
            Arquivo interno: {attachment.name}
            <button type="button" onClick={() => setAttachment(null)}>
              Remover
            </button>
          </div>
        )}
        <div className="row">
          <textarea
            aria-label="Mensagem"
            disabled={busy}
            placeholder={mode === 'note' ? 'Escreva uma nota para a equipe…' : 'Digite a mensagem…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4096}
            required={!attachment && !template}
          />
          <button className="primary" disabled={busy || detail.status === 'closed'}>
            {busy ? 'Enviando…' : mode === 'note' ? 'Salvar nota' : 'Enviar'}
          </button>
        </div>
        <small>
          Arquivos locais são internos. Para enviar um arquivo por WhatsApp, gere um link na janela
          de upload.
        </small>
      </form>
      {transfer && (
        <Modal title="Transferir atendimento" close={() => setTransfer(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              run(async () => {
                await api(`/conversations/${id}/transfers`, 'POST', {
                  userId: data.get('userId'),
                  mode: data.get('mode'),
                  count: Number(data.get('count')),
                  fromSequence: Number(data.get('fromSequence')) || undefined,
                  includeNotes: data.has('includeNotes'),
                  summary: data.get('summary'),
                  reason: data.get('reason'),
                  version: detail.version,
                });
                setTransfer(false);
                await refresh();
              });
            }}
          >
            <label>
              Novo atendente
              <select name="userId" required>
                {users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Histórico liberado
              <select name="mode" defaultValue="future">
                <option value="future">Somente mensagens futuras</option>
                <option value="full">Histórico completo</option>
                <option value="last">Últimas N mensagens e futuras</option>
                <option value="from">A partir de uma sequência</option>
              </select>
            </label>
            <div className="row">
              <label>
                Últimas N<input type="number" name="count" min="1" max="100" defaultValue="10" />
              </label>
              <label>
                Sequência inicial
                <input type="number" name="fromSequence" min="1" />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" name="includeNotes" />
              Liberar notas dentro do recorte
            </label>
            <label>
              Resumo a compartilhar
              <textarea name="summary" maxLength={4000} />
            </label>
            <label>
              Motivo
              <input name="reason" maxLength={500} />
            </label>
            <p className="notice">
              O histórico permanece armazenado. Atendentes anteriores perdem acesso; links externos
              anteriores são revogados nos modos com recorte. Gestores autorizados mantêm acesso
              administrativo.
            </p>
            <button className="primary">Confirmar transferência</button>
          </form>
        </Modal>
      )}
      {showUpload && (
        <Modal title="Arquivo interno" close={() => setShowUpload(false)}>
          <UploadPanel
            run={run}
            canShare={managed(me)}
            onAttach={(f) => {
              setAttachment(f);
              setShowUpload(false);
            }}
          />
        </Modal>
      )}
    </section>
  );
}
function UploadPanel({
  onAttach,
  run,
  canShare,
}: {
  onAttach: (f: { id: string; name: string }) => void;
  run: Run;
  canShare: boolean;
}) {
  const [file, setFile] = useState<File | null>(null),
    [id, setId] = useState(''),
    [progress, setProgress] = useState(0),
    [state, setState] = useState(''),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState('');
  const paused = useRef(false);
  async function upload() {
    if (!file) return;
    paused.current = false;
    setBusy(true);
    try {
      let current = id;
      if (!current) {
        const f = await api<{ id: string }>('/uploads', 'POST', {
          name: file.name,
          mime: file.type || 'application/octet-stream',
          size: String(file.size),
        });
        current = f.id;
        setId(current);
      }
      let session = await api<{ offset: string; state: string }>(`/uploads/${current}`);
      let offset = Number(session.offset);
      if (session.state !== 'pending') {
        setState(session.state);
        return;
      }
      while (offset < file.size) {
        if (paused.current) {
          setState('paused');
          return;
        }
        const response = await fetch(`/api/uploads/${current}/parts`, {
          method: 'PUT',
          headers: {
            ...csrfHeaders(),
            'Content-Type': 'application/octet-stream',
            'Upload-Offset': String(offset),
          },
          body: file.slice(offset, Math.min(offset + 8388608, file.size)),
          credentials: 'same-origin',
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message ?? 'Falha ao enviar parte');
        }
        const result = await response.json();
        offset = Number(result.offset);
        setProgress(Math.round((offset / file.size) * 100));
      }
      const result = await api<{ state: string }>(`/uploads/${current}/complete`, 'POST', {});
      setState(result.state);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="notice">
        Upload interno retomável nesta janela. Em caso de erro, clique em Continuar. Não feche a
        janela antes de concluir.
      </p>
      <input
        type="file"
        aria-label="Escolher arquivo"
        disabled={!!id || busy}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setState('');
        }}
      />
      {file && (
        <p>
          {file.name} · {bytes(file.size)}
        </p>
      )}
      <progress value={progress} max={100} />
      <p>
        {progress}% · {state || 'Aguardando'}
      </p>
      <div className="row">
        <button
          disabled={!file || busy || state === 'ready' || state === 'quarantine'}
          onClick={() => run(upload)}
        >
          {id ? 'Continuar' : 'Iniciar upload'}
        </button>
        {busy && (
          <button
            onClick={() => {
              paused.current = true;
            }}
          >
            Pausar após esta parte
          </button>
        )}
        {state === 'ready' && (
          <button className="primary" onClick={() => onAttach({ id, name: file!.name })}>
            Anexar à nota
          </button>
        )}
      </div>
      {state === 'quarantine' && (
        <p className="notice">
          Arquivo em quarentena: scanner ausente ou verificação falhou. Não está disponível para
          download.
        </p>
      )}
      {state === 'ready' && canShare && (
        <button
          onClick={() =>
            run(async () => {
              const share = await api<{ url: string }>(`/files/${id}/shares`, 'POST', {
                hours: 24,
              });
              setLink(share.url);
            })
          }
        >
          Gerar link externo de 24h
        </button>
      )}
      {link && (
        <label>
          Link externo (acesso a quem possuir a URL)
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button onClick={() => run(() => navigator.clipboard.writeText(link))}>
            Copiar link
          </button>
        </label>
      )}
      {id && !busy && (
        <button
          className="danger"
          onClick={() =>
            run(async () => {
              await api(`/uploads/${id}`, 'DELETE');
              setId('');
              setState('');
              setProgress(0);
              setLink('');
            })
          }
        >
          Excluir arquivo / cancelar upload
        </button>
      )}
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overlay">
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="row">
          <h2>{title}</h2>
          <button aria-label="Fechar" onClick={close}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Team({
  me,
  users,
  refresh,
  run,
}: {
  me: Me;
  users: User[];
  refresh: () => Promise<void>;
  run: Run;
}) {
  return (
    <div className="page">
      <section className="card">
        <h2>Equipe de atendimento</h2>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.active ? 'Ativo' : 'Desativado'}</td>
                <td>
                  {admin(me) && u.role !== 'owner' && u.id !== me.id && (
                    <button
                      onClick={() =>
                        run(async () => {
                          await api(`/users/${u.id}`, 'PATCH', { active: !u.active });
                          await refresh();
                        })
                      }
                    >
                      {u.active ? 'Desativar' : 'Ativar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {admin(me) && (
        <section className="card">
          <h2>Novo usuário</h2>
          <form
            className="grid-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              run(async () => {
                await api('/users', 'POST', Object.fromEntries(new FormData(form)));
                form.reset();
                await refresh();
              });
            }}
          >
            <label>
              Nome
              <input name="name" required maxLength={100} />
            </label>
            <label>
              E-mail
              <input name="email" type="email" required />
            </label>
            <label>
              Senha inicial
              <input
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Perfil
              <select name="role">
                <option value="agent">Atendente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <button className="primary">Criar usuário</button>
          </form>
        </section>
      )}
    </div>
  );
}
function Accounts({
  me,
  accounts,
  refresh,
  run,
}: {
  me: Me;
  accounts: Account[];
  refresh: () => Promise<void>;
  run: Run;
}) {
  const [edit, setEdit] = useState<Account | null>(null),
    [mode, setMode] = useState('demo');
  return (
    <div className="page">
      <p className="notice">
        Demo simula atendimento e não envia nada para a Meta. Para uma conta real, obtenha IDs e
        credenciais no portal Meta. Pagamento e aprovação continuam na Meta.
      </p>
      <div className="cards">
        {accounts.map((a) => (
          <section className="card" key={a.id}>
            <div className="row">
              <h2>{a.name}</h2>
              <span className="badge">{a.mode}</span>
            </div>
            <p>Número ID: {a.phoneNumberId ?? '—'}</p>
            <p>Credenciais: {a.hasCredentials ? 'Cadastradas' : 'Sem token'}</p>
            <p>Último webhook: {a.lastWebhook ? date(a.lastWebhook) : 'Não recebido'}</p>
            <label>
              Webhook
              <input readOnly value={a.webhookUrl} onFocus={(e) => e.target.select()} />
            </label>
            {admin(me) && (
              <button
                onClick={() => {
                  setEdit(a);
                  setMode(a.mode);
                }}
              >
                Editar / rotacionar credenciais
              </button>
            )}
          </section>
        ))}
      </div>
      {admin(me) && (
        <section className="card">
          <h2>{edit ? 'Editar conta' : 'Adicionar conta'}</h2>
          <form
            key={edit?.id ?? 'new'}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              run(async () => {
                const data = Object.fromEntries(new FormData(form));
                const body = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ''));
                await api(edit ? `/accounts/${edit.id}` : '/accounts', edit ? 'PUT' : 'POST', body);
                setEdit(null);
                form.reset();
                await refresh();
              });
            }}
          >
            <div className="grid-form">
              <label>
                Nome
                <input name="name" defaultValue={edit?.name} required />
              </label>
              <label>
                Modo
                <select
                  name="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  disabled={!!edit}
                >
                  <option value="demo">Demo</option>
                  <option value="meta">Meta Cloud API</option>
                </select>
                {edit && <input type="hidden" name="mode" value={mode} />}
              </label>
            </div>
            {mode === 'meta' && (
              <div className="grid-form">
                <label>
                  Phone number ID
                  <input name="phoneNumberId" defaultValue={edit?.phoneNumberId ?? ''} required />
                </label>
                <label>
                  WABA ID
                  <input name="wabaId" defaultValue={edit?.wabaId ?? ''} required />
                </label>
                <label>
                  Versão Graph API
                  <input
                    name="graphVersion"
                    defaultValue={edit?.graphVersion ?? ''}
                    placeholder="vXX.X — confirme versão vigente"
                    pattern="v[0-9]+\.[0-9]+"
                    required
                  />
                </label>
                <label>
                  Access token
                  <input
                    name="accessToken"
                    type="password"
                    minLength={20}
                    required={!edit}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  App secret
                  <input
                    name="appSecret"
                    type="password"
                    minLength={16}
                    required={!edit}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Verify token escolhido
                  <input
                    name="verifyToken"
                    type="password"
                    minLength={24}
                    required={!edit}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}
            <p>
              Ao editar, deixe os segredos vazios para preservar os atuais. Eles não são exibidos
              após salvar.
            </p>
            <button className="primary">Salvar conta</button>
            {edit && (
              <button type="button" onClick={() => setEdit(null)}>
                Cancelar edição
              </button>
            )}
          </form>
        </section>
      )}
    </div>
  );
}
function Usage({ me, run }: { me: Me; run: Run }) {
  type UsageData = {
    total: number;
    pending: number;
    demoFree: number;
    totals: Record<string, string>;
    budget: string | null;
    note: string;
    rows: {
      id: string;
      createdAt: string;
      category: string | null;
      status: string;
      cost: string | null;
      currency: string | null;
    }[];
  };
  type Tariff = {
    id: string;
    category: string;
    currency: string;
    price: string;
    validFrom: string;
    source: string;
  };
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [data, setData] = useState<UsageData | null>(null),
    [rates, setRates] = useState<Tariff[]>([]);
  async function refresh() {
    setData(await api<UsageData>(`/usage?month=${month}`));
    setRates(await api<Tariff[]>('/tariffs'));
  }
  useEffect(() => {
    run(refresh);
  }, [month]);
  return (
    <div className="page">
      <div className="row">
        <p>Mensagens enviadas e estimativas — período em UTC</p>
        <input
          aria-label="Mês de consumo"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <button onClick={() => run(refresh)}>Atualizar</button>
      </div>
      {data && (
        <>
          <div className="cards metrics">
            <section className="card">
              <small>Enviadas</small>
              <strong>{data.total}</strong>
            </section>
            <section className="card">
              <small>Sem preço conhecido</small>
              <strong>{data.pending}</strong>
            </section>
            <section className="card">
              <small>Simulações sem custo Meta</small>
              <strong>{data.demoFree}</strong>
            </section>
            <section className="card">
              <small>Custo estimado</small>
              <strong>
                {Object.entries(data.totals)
                  .map(([c, v]) => `${c} ${Number(v).toFixed(4)}`)
                  .join(' · ') || '—'}
              </strong>
              <small>Orçamento de referência: {data.budget ?? 'Não definido'}</small>
            </section>
          </div>
          <p className="notice">{data.note}</p>
          <section className="card">
            <h2>Mensagens do período</h2>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Estimativa</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((m) => (
                  <tr key={m.id}>
                    <td>{date(m.createdAt)}</td>
                    <td>{m.category ?? 'Não informada'}</td>
                    <td>{m.status}</td>
                    <td>
                      {m.cost === null
                        ? 'Pendente'
                        : m.currency
                          ? `${m.currency} ${m.cost}`
                          : 'Sem custo conhecido / demo'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      <section className="card">
        <h2>Tarifas manuais versionadas</h2>
        <p>
          Somente mercado BR e eventos explicitamente faturáveis. Não há franquias ou faixas
          automáticas nesta versão.
        </p>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Vigência</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.category}</td>
                <td>
                  {r.currency} {r.price}
                </td>
                <td>{date(r.validFrom)}</td>
                <td>
                  <a href={r.source} target="_blank" rel="noreferrer">
                    Consultar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {admin(me) && (
          <form
            className="grid-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              run(async () => {
                const d = Object.fromEntries(new FormData(form));
                await api('/tariffs', 'POST', {
                  ...d,
                  market: 'BR',
                  validFrom: new Date(String(d.validFrom)).toISOString(),
                });
                await refresh();
              });
            }}
          >
            <label>
              Categoria
              <select name="category">
                {['service', 'utility', 'authentication', 'marketing'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Moeda da conta
              <input name="currency" placeholder="BRL ou USD" pattern="[A-Z]{3}" required />
            </label>
            <label>
              Valor unitário
              <input
                name="price"
                pattern="[0-9]+(\.[0-9]{1,8})?"
                placeholder="Use ponto decimal"
                required
              />
            </label>
            <label>
              Início da vigência
              <input name="validFrom" type="datetime-local" required />
            </label>
            <label>
              Fonte oficial
              <input type="url" name="source" required />
            </label>
            <button className="primary">Registrar tarifa</button>
          </form>
        )}
      </section>
    </div>
  );
}
function Configuration({ me, run }: { me: Me; run: Run }) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [shares, setShares] = useState<
      { id: string; fileId: string; expiresAt: string; revoked: boolean }[]
    >([]);
  async function refresh() {
    setSettings(await api<Settings>('/settings'));
    setShares(await api<typeof shares>('/shares'));
  }
  useEffect(() => {
    run(refresh);
  }, []);
  if (!settings) return <p className="empty">Carregando…</p>;
  return (
    <div className="page">
      <section className="card">
        <h2>Empresa e armazenamento</h2>
        <p>
          Usado: {bytes(settings.usedBytes)} · Reservado: {bytes(settings.reservedBytes)} · Quota:{' '}
          {bytes(settings.quotaBytes)}
        </p>
        <p className="notice">
          {settings.unscannedAllowed
            ? 'Arquivos sem scanner estão liberados por configuração do operador. Use apenas em laboratório com arquivos confiáveis.'
            : 'Sem scanner configurado, uploads concluídos ficam em quarentena.'}
        </p>
        <form
          className="grid-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(async () => {
              const d = Object.fromEntries(new FormData(form));
              await api('/settings', 'PUT', { ...d, budget: d.budget || null });
              await refresh();
            });
          }}
        >
          <label>
            Nome da empresa
            <input name="name" defaultValue={settings.name} required disabled={!admin(me)} />
          </label>
          <label>
            Máximo por arquivo (bytes)
            <input
              name="maxFileBytes"
              defaultValue={settings.maxFileBytes}
              required
              disabled={!admin(me)}
            />
          </label>
          <label>
            Quota total (bytes)
            <input
              name="quotaBytes"
              defaultValue={settings.quotaBytes}
              required
              disabled={!admin(me)}
            />
          </label>
          <label>
            Orçamento de referência (sem bloqueio)
            <input name="budget" defaultValue={settings.budget ?? ''} disabled={!admin(me)} />
          </label>
          {admin(me) && <button className="primary">Salvar configurações</button>}
        </form>
      </section>
      <section className="card">
        <h2>Links externos</h2>
        <p>O token completo é exibido somente na criação do link.</p>
        <table>
          <thead>
            <tr>
              <th>Arquivo ID</th>
              <th>Expiração</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.id}>
                <td>{s.fileId.slice(0, 8)}</td>
                <td>{date(s.expiresAt)}</td>
                <td>{s.revoked ? 'Revogado' : 'Ativo até expirar'}</td>
                <td>
                  {!s.revoked && (
                    <button
                      onClick={() =>
                        run(async () => {
                          await api(`/shares/${s.id}`, 'DELETE');
                          await refresh();
                        })
                      }
                    >
                      Revogar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
function Audit({ run }: { run: Run }) {
  const [events, setEvents] = useState<
    {
      id: string;
      createdAt: string;
      action: string;
      actorId: string | null;
      resourceId: string | null;
      details: string;
    }[]
  >([]);
  useEffect(() => {
    run(async () => setEvents(await api('/audit')));
  }, []);
  return (
    <div className="page">
      <section className="card">
        <h2>Últimas 200 ações</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Ação</th>
              <th>Ator</th>
              <th>Recurso</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{date(e.createdAt)}</td>
                <td>{e.action}</td>
                <td>{e.actorId?.slice(0, 8) ?? 'Sistema'}</td>
                <td>{e.resourceId?.slice(0, 8) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Trilha administrativa no banco; proteção contra alteração por administrador do host ainda
          depende de cópia externa.
        </p>
      </section>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
