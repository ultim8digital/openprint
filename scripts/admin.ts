import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Store } from '../server/database.js';
import { digest, hashPassword } from '../server/security.js';
import { email } from '../shared/validation.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const address = email.parse(process.argv[2]);
const recover = process.argv.includes('--recover');
const dataDir = resolve(process.env.DATA_DIR || '.local/data');
const store = new Store(join(dataDir, 'openprint.sqlite'));
if (store.get("SELECT 1 FROM meta WHERE key='demo'"))
  throw new Error('Use a real community database, not the demo.');
let user = store.get<{ id: string; suspended: number }>(
  'SELECT id,suspended FROM users WHERE email=?',
  address,
);
if (user?.suspended)
  throw new Error('Account was suspended or removed; create a different account.');
if (!user && recover) throw new Error('No such account. Ask the participant to register first.');
if (!user) {
  user = { id: randomUUID(), suspended: 0 };
  store.run(
    "INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,'Community operator',?,?)",
    user.id,
    address,
    await hashPassword(randomBytes(32).toString('hex')),
    Date.now(),
  );
}
const token = randomBytes(32).toString('hex');
store.transaction(() => {
  store.run('DELETE FROM reset_tokens WHERE user_id=?', user!.id);
  store.run(
    'INSERT INTO reset_tokens(token_hash,user_id,expires_at,promote_admin) VALUES(?,?,?,?)',
    digest(token),
    user!.id,
    Date.now() + 30 * 60000,
    recover ? 0 : 1,
  );
});
store.close();
console.log(`${recover ? 'Password recovery' : 'Administrator setup'}: ${address}`);
if (!recover)
  console.log(
    'Administrator rights activate only after this link is redeemed and all old sessions are revoked.',
  );
console.log(
  'Share this single-use link privately after verifying the person. It expires in 30 minutes.',
);
console.log(`${process.env.APP_URL || 'http://localhost:3000'}/recover#token=${token}`);
