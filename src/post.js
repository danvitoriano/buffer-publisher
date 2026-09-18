// Cria um post na fila de um canal.
// Uso: npm run post -- <channelId> "texto do post" [--now | --draft]
import { bufferQuery } from "./buffer.js";

const [channelId, text, flag] = process.argv.slice(2);
if (!channelId || !text) {
  console.error('Uso: npm run post -- <channelId> "texto" [--now | --draft]');
  process.exit(1);
}

const CREATE_POST = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post { id text status dueAt channelId }
      }
      ... on MutationError { message }
    }
  }
`;

const input = {
  channelId,
  text,
  assets: [],
  needsApproval: false,
  schedulingType: "automatic",
  mode: flag === "--now" ? "shareNow" : "addToQueue",
  ...(flag === "--draft" ? { saveToDraft: true } : {}),
};

const { createPost } = await bufferQuery(CREATE_POST, { input });

if (createPost.__typename === "PostActionSuccess") {
  const p = createPost.post;
  console.log(`Post criado: id=${p.id} status=${p.status} dueAt=${p.dueAt ?? "(fila)"}`);
} else {
  console.error(`Erro ao criar post: ${createPost.message}`);
  process.exit(1);
}
