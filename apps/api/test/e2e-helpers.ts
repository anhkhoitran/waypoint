import { connect } from 'node:net';

function probe(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * The e2e suites boot the full AppModule against a real Postgres + Redis.
 * Locally that means Docker Compose has to be up; in CI, service containers
 * provide them. Rather than fail the whole run with connection errors when
 * they're absent, probe both ports first and skip the suite cleanly.
 */
export async function checkE2eServicesAvailable(): Promise<boolean> {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL ?? '');
    const redisUrl = new URL(process.env.REDIS_URL ?? '');
    const [dbOk, redisOk] = await Promise.all([
      probe(dbUrl.hostname, Number(dbUrl.port) || 5432),
      probe(redisUrl.hostname, Number(redisUrl.port) || 6379),
    ]);
    return dbOk && redisOk;
  } catch {
    return false;
  }
}
