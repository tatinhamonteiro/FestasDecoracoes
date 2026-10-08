# 🎈 Festas & Decorações

Gestão de fachadas e decorações para festas: catálogo com fotos, orçamentos pelo WhatsApp,
aprovação e pagamento (sinal + restante) pelo cliente, agenda de eventos e financeiro.

- A loja cadastra **produtos com foto** (fachadas, painéis, temas, mesas…).
- Monta o orçamento em 3 passos: **dados da festa → produtos → resumo** (entrega/montagem, desconto, % de sinal).
- Envia pelo **WhatsApp** com um link. O cliente vê as fotos, **aprova**, escolhe pagar **o sinal ou tudo** por **PIX**,
  envia o comprovante e volta para a conversa da loja.
- A loja confere o comprovante, acompanha o status (**Pendente → Aprovado → Em andamento → Finalizado**)
  e vê na **agenda** se a mesma fachada foi reservada para duas festas no mesmo dia.

Site estático (pasta `docs/`, publicado pelo GitHub Pages) + banco **Supabase** (gratuito).

---

## Publicar (uma vez só, ~15 minutos)

### 1. Supabase — banco, login e fotos

1. Em <https://supabase.com> → **New project** (região *South America (São Paulo)*).
2. **SQL Editor → New query** → cole todo o [`docs/supabase/schema.sql`](docs/supabase/schema.sql) → **Run**.
   O aviso *"destructive operations"* é esperado (são os `drop policy if exists`) — pode confirmar.
3. **Authentication → Sign In / Providers → Email**: desligue **Confirm email** (para criar a conta e já entrar).
4. **Authentication → URL Configuration → Site URL**: `https://<seu-usuario>.github.io/FestasDecoracoes/`
5. **Project Settings (⚙️) → API Keys → aba _Legacy API Keys_**: copie a chave **anon** (começa com `eyJ`).
   O **Project URL** aparece no botão verde **Connect**.

### 2. Configurar o site

Edite [`docs/js/config.js`](docs/js/config.js):

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',
};
```

> A chave **anon** é pública por natureza. A proteção dos dados está nas regras do `schema.sql`.
> **Nunca** use a chave `service_role`.

### 3. GitHub Pages

1. Crie o repositório **FestasDecoracoes** e envie a pasta `docs` e este `README.md`
   (*Add file → Upload files*, arraste e clique em *Commit changes*).
2. **Settings → Pages** → Branch **main**, pasta **/docs** → **Save**.
3. Em 1–2 minutos: `https://<seu-usuario>.github.io/FestasDecoracoes/`

### 4. Primeiro acesso

1. Abra o link → **Cadastrar**. **A primeira conta criada vira a dona da loja**; contas criadas depois não entram.
2. **Mais → Configurações**: nome da loja, **WhatsApp da loja**, **chave PIX** e **% do sinal**.
3. **Produtos → ＋**: cadastre as fachadas/painéis com foto e preço.
4. **＋ Novo Orçamento** e pronto.

---

## Dúvidas comuns

- **O orçamento saiu pelo WhatsApp errado:** o botão abre o WhatsApp que está conectado no aparelho
  (WhatsApp Web/Desktop no computador). O campo *WhatsApp da loja* é para onde o **cliente volta** depois de pagar.
- **Mudei o `config.js` e o site não atualizou:** confira no GitHub se o arquivo novo tem a chave; depois
  espere 1–2 minutos e recarregue com **Ctrl + F5**.
- **Outra pessoa da loja:** ela cria a conta; no Supabase → *Authentication → Users* copie o *UID* dela e rode:
  ```sql
  insert into public.membros (user_id, email) values ('UID-AQUI', 'email@dela.com');
  ```
- **Esqueci a senha:** na tela de login, digite o e-mail e toque em **Esqueci a senha**.
- **Produto removido** continua aparecendo nos orçamentos antigos (só sai do catálogo).
