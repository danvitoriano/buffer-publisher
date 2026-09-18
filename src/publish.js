// Sobe uma mídia para o Cloudinary e cria o post no Buffer.
//
// Uso:
//   npm run publish -- --channel instagram --file ./video.mp4 --text "legenda"
//   npm run publish -- --channel tiktok    --file ./video.mp4 --title "Título" --text "legenda"
//   npm run publish -- --channel youtube   --file ./video.mp4 --title "Título" --text "descrição"
//   npm run publish -- --channel <channelId> --url https://... --text "..."
//
// Opções:
//   --channel   instagram | tiktok | youtube | <channelId>
//   --file      caminho local (faz upload no Cloudinary)   OU
//   --dir       pasta com imagens numeradas (carrossel, 2 a 10 itens)   OU
//   --url       URL https pública já hospedada
//   --text      legenda / descrição
//   --text-file arquivo .txt com a legenda (útil para várias linhas e emojis)
//   --title     título (TikTok e YouTube)
//   --type      instagram: post | reel | story   (padrão: reel p/ vídeo, post p/ imagem)
//   --privacy   youtube: public | unlisted | private        (padrão: public)
//   --now       publica imediatamente          (padrão: adiciona à fila)
//   --at        agenda em data ISO, ex: 2026-09-20T18:00:00-03:00
//   --draft     salva como rascunho, não publica
//   --dry-run   só faz o upload e mostra o que seria enviado ao Buffer
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { bufferQuery } from "./buffer.js";
import { uploadMedia } from "./cloudinary.js";

const args = parseArgs(process.argv.slice(2));
if (args["text-file"]) args.text = readFileSync(args["text-file"], "utf8").trim();
if (!args.channel || (!args.file && !args.url && !args.dir)) {
  console.error("Uso: npm run publish -- --channel <instagram|tiktok|youtube|channelId> (--file <caminho> | --dir <pasta> | --url <https>) [--text ...] [--title ...]");
  process.exit(1);
}

// 1. Resolve o canal (aceita nome do serviço ou id)
const channel = await resolveChannel(args.channel);
console.log(`Canal: ${channel.service} / ${channel.name} (${channel.id})`);

// 2. Mídia: upload no Cloudinary ou URL já pronta. `medias` é sempre uma lista (carrossel = várias)
let medias = [];
if (args.dir) {
  const files = readdirSync(args.dir)
    .filter((f) => /\.(png|jpe?g|webp|mp4|mov)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length < 2 || files.length > 10) {
    throw new Error(`Carrossel precisa de 2 a 10 mídias, a pasta tem ${files.length}.`);
  }
  for (const f of files) {
    const path = join(args.dir, f);
    console.log(`Subindo ${path}...`);
    const m = await uploadMedia(path);
    console.log(`  ${m.kind} ${formatBytes(m.bytes)} ${m.width}x${m.height}  ${m.url}`);
    medias.push(m);
  }
} else if (args.file) {
  console.log(`Subindo ${args.file} para o Cloudinary...`);
  const m = await uploadMedia(args.file);
  console.log(`  ${m.kind} ${formatBytes(m.bytes)} ${m.width}x${m.height}${m.duration ? ` ${m.duration.toFixed(1)}s` : ""}`);
  console.log(`  ${m.url}`);
  medias = [m];
} else {
  medias = [{ url: args.url, kind: /\.(mp4|mov|webm|m4v)(\?|$)/i.test(args.url) ? "video" : "image" }];
}
const isCarousel = medias.length > 1;
const kind = medias.every((m) => m.kind === "video") ? "video" : "image";

// 3. Monta o input do createPost
const assets = medias.map((m) => (m.kind === "video" ? { video: { url: m.url } } : { image: { url: m.url } }));

const input = {
  channelId: channel.id,
  text: args.text ?? "",
  assets,
  needsApproval: false,
  schedulingType: "automatic",
  mode: args.now ? "shareNow" : args.at ? "customScheduled" : "addToQueue",
  ...(args.at ? { dueAt: new Date(args.at).toISOString() } : {}),
  ...(args.draft ? { saveToDraft: true } : {}),
  metadata: buildMetadata(channel.service, kind, isCarousel, args),
};

if (args["dry-run"]) {
  console.log("\n[dry-run] input que seria enviado ao Buffer:");
  console.log(JSON.stringify(input, null, 2));
  process.exit(0);
}

// 4. Cria o post
const CREATE_POST = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post { id status dueAt shareMode text }
      }
      ... on MutationError { message }
    }
  }
`;

const { createPost } = await bufferQuery(CREATE_POST, { input });
if (createPost.__typename !== "PostActionSuccess") {
  console.error(`\nBuffer recusou o post (${createPost.__typename}): ${createPost.message}`);
  process.exit(1);
}
const p = createPost.post;
console.log(`\nPost criado: id=${p.id} status=${p.status} modo=${p.shareMode} dueAt=${p.dueAt ?? "(fila)"}`);

// ---------- helpers ----------

function buildMetadata(service, kind, isCarousel, a) {
  switch (service) {
    case "instagram": {
      // carrossel no Instagram é um "post" com vários assets (o Buffer não aceita o tipo "carousel")
      const type = a.type ?? (isCarousel || kind !== "video" ? "post" : "reel");
      return { instagram: { type, shouldShareToFeed: type !== "story" } };
    }
    case "tiktok":
      return { tiktok: { title: a.title ?? a.text?.slice(0, 90) ?? "" } };
    case "youtube":
      return {
        youtube: {
          title: a.title ?? a.text?.slice(0, 100) ?? "Sem título",
          privacy: a.privacy ?? "public",
          madeForKids: false,
          notifySubscribers: true,
          embeddable: true,
        },
      };
    default:
      return undefined;
  }
}

async function resolveChannel(ref) {
  const { account } = await bufferQuery(`{ account { organizations { id } } }`);
  const all = [];
  for (const org of account.organizations) {
    const { channels } = await bufferQuery(
      `query($id: OrganizationId!) { channels(input: { organizationId: $id }) { id name service isDisconnected } }`,
      { id: org.id },
    );
    all.push(...channels);
  }
  const found = all.find((c) => c.id === ref) ?? all.find((c) => c.service === ref.toLowerCase());
  if (!found) {
    throw new Error(`Canal "${ref}" não encontrado. Disponíveis: ${all.map((c) => `${c.service}=${c.id}`).join(", ")}`);
  }
  if (found.isDisconnected) throw new Error(`Canal ${found.service} está desconectado no Buffer.`);
  return found;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const key = k.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function formatBytes(b) {
  return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`;
}
