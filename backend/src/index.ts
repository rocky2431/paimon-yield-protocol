import 'dotenv/config';
import { buildServer } from './server.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start().catch(console.error);
