// Lista organizações e canais conectados. Uso: npm run channels
import { bufferQuery } from "./buffer.js";

const ORGS = `
  query GetOrganizations {
    account {
      id
      email
      organizations { id name }
    }
  }
`;

const CHANNELS = `
  query GetChannels($organizationId: OrganizationId!) {
    channels(input: { organizationId: $organizationId }) {
      id
      name
      displayName
      service
      isDisconnected
    }
  }
`;

const { account } = await bufferQuery(ORGS);
console.log(`Conta: ${account.email} (${account.id})\n`);

for (const org of account.organizations) {
  console.log(`Organização: ${org.name} (${org.id})`);
  const { channels } = await bufferQuery(CHANNELS, { organizationId: org.id });
  if (channels.length === 0) console.log("  (nenhum canal)");
  for (const c of channels) {
    const flag = c.isDisconnected ? " [DESCONECTADO]" : "";
    console.log(`  - ${c.service.padEnd(12)} ${c.name}  id=${c.id}${flag}`);
  }
  console.log();
}
