# Buffer API

Cliente em Node para a API GraphQL do Buffer, com upload de mídia via Cloudinary.

## Setup

1. API key do Buffer: https://publish.buffer.com/settings/api
2. Conta Cloudinary (plano gratuito serve): https://console.cloudinary.com > Settings > API Keys
3. `Copy-Item .env.example .env` e preencha `BUFFER_API_KEY` e `CLOUDINARY_URL`
4. `npm install`

## Comandos

```sh
npm run channels                                   # lista canais e ids

# sobe a mídia no Cloudinary e cria o post
npm run publish -- --channel instagram --file ./video.mp4 --text "legenda"
npm run publish -- --channel instagram --dir ./pasta-carrossel --text "legenda"   # 2 a 10 imagens, ordem numérica
npm run publish -- --channel tiktok    --file ./video.mp4 --title "Título" --text "legenda"
npm run publish -- --channel youtube   --file ./video.mp4 --title "Título" --text "descrição"

# mídia já hospedada
npm run publish -- --channel instagram --url https://res.cloudinary.com/.../foto.jpg --text "..."

# quando publicar
--now                              publica agora
--at 2026-09-20T18:00:00-03:00     agenda
--draft                            salva como rascunho
(sem flag)                         adiciona à fila

# outros
--type reel|post|story             Instagram (padrão: reel para vídeo único, post para imagem e carrossel)
--privacy public|unlisted|private  YouTube (padrão: public)
--dry-run                          faz o upload e mostra o input, sem criar o post
```

## Fluxo com Google Drive

O Buffer não aceita link do Drive (exige login). Use o Drive como pasta de origem,
baixe o arquivo localmente e rode `npm run publish -- --file <caminho>`: o script
sobe no Cloudinary e passa a URL pública ao Buffer.

## Limites (por API key)

- 100 req / 15 min, 250 req / dia (Free e Essentials), 3.000 a 15.000 / mês conforme o plano
- Excedeu: HTTP 429 com header `Retry-After`

Explorer interativo: https://developers.buffer.com/explorer.html
