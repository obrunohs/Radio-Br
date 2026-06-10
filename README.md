# ACDSFM

Projeto da rádio e TV ao vivo ACDSFM.

## Rodar localmente

```bash
npm install
npm start
```

Site:

```txt
http://localhost:3000
```

Painel admin:

```txt
http://localhost:3000/admin
```

Senha padrão:

```txt
123456
```

## OBS Studio

O painel já está preparado com área de OBS Studio, servidor RTMP e stream key.
No Render, a transmissão real pelo OBS ainda fica apenas preparada.
Quando migrar para uma VPS Hostinger, será possível ativar Nginx RTMP/FFmpeg e usar a mesma TV do site para receber o OBS.

Variáveis futuras:

```txt
RTMP_SERVER=rtmp://seu-dominio.com/live
STREAM_KEY=acdsfm-live-123
OBS_PLAYBACK_URL=https://seu-dominio.com/live/acdsfm.m3u8
```
