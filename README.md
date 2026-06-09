# Radio Ao Vivo

Projeto simples de radio ao vivo somente com audio usando HTML, Node.js, Socket.IO e WebRTC.

## Como rodar localmente

```bash
npm install
npm start
```

Depois abra:

- Pagina publica: http://localhost:3000
- Painel admin: http://localhost:3000/admin

Senha padrao do admin:

```txt
123456
```

## Alterar senha do admin

No Windows PowerShell:

```powershell
$env:ADMIN_PASSWORD="minhaSenhaForte"
npm start
```

No Linux/Mac:

```bash
ADMIN_PASSWORD="minhaSenhaForte" npm start
```

## Hospedar no Render

1. Suba esse projeto no GitHub.
2. Entre no Render.
3. Crie um novo Web Service.
4. Conecte o repositorio do GitHub.
5. Use:

```txt
Build Command: npm install
Start Command: npm start
```

6. Em Environment Variables, adicione:

```txt
ADMIN_PASSWORD=suaSenhaForte
```

## Observacoes importantes

- Para o microfone funcionar online, o site precisa estar em HTTPS. O Render ja fornece HTTPS.
- Localmente, `localhost` funciona normalmente.
- Esse projeto e uma base inicial. Para muitos ouvintes, o ideal no futuro e usar uma VPS e melhorar a infraestrutura.
