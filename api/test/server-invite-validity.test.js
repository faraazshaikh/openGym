/* An invite can carry the person's name, their address and a number of months. The months count
   from sign-up; once they have passed the account is locked out like a disabled one (its data
   stays) until an admin extends it. An invite made for an address only works with that address.
   Real server.js in a child, password sign-up (no browser needed for a passkey ceremony). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ADMIN = 'u_adm_v';
const PW = 'tangerine-orbit-77-sailing';

const mint = uid => {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};
const asAdmin = { Cookie: `gymsid=${mint(ADMIN)}`, 'Content-Type': 'application/json' };

async function startServer(t, extraUsers = []) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-validity-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [{ id: ADMIN, name: 'Boss', created: new Date().toISOString(), admin: true }, ...extraUsers], creds: [], subs: [], invites: []
  }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost',
      INVITE_ONLY: '1', PASSWORD_LOGIN: '1', ADMIN_UIDS: ADMIN, TRUST_PROXY: '1' }
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const port = await boundPort(child, () => log);
  const api = `http://127.0.0.1:${port}`;
  let n = 0;
  const call = async (method, p, body, headers = {}) => {
    // A fresh address per call keeps the sign-up and sign-in limiters out of the way.
    const r = await fetch(api + p, {
      method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${++n % 250 + 1}`, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: r.status, body: await r.json().catch(() => ({})), cookie: r.headers.get('set-cookie') };
  };
  const invite = body => call('POST', '/api/admin/invites/new', body, asAdmin);
  const db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  return { api, dataDir, call, invite, db };
}

test('an invite stores the name, the normalised address and the months', async t => {
  const h = await startServer(t);
  const a = await h.invite({ name: 'Alex', email: ' Alex@Example.COM ', months: 3 });
  assert.equal(a.status, 200);
  assert.equal(a.body.invite.name, 'Alex');
  assert.equal(a.body.invite.email, 'alex@example.com');
  assert.equal(a.body.invite.months, 3);

  // No months means indefinite; an older client that only sends a note still works.
  const b = await h.invite({ note: 'for Sam' });
  assert.equal(b.status, 200);
  assert.equal(b.body.invite.months, null);
  assert.equal(b.body.invite.name, 'for Sam');
  assert.equal(b.body.invite.email, undefined);

  for (const bad of [0, -1, 1.5, 121, 'soon']) {
    const r = await h.invite({ name: 'X', months: bad });
    assert.equal(r.status, 400, `months ${bad} refused`);
    assert.equal(r.body.code, 'months');
  }
  assert.equal((await h.invite({ name: 'X', email: 'not-an-address' })).status, 400);
});

test('the code only works with the address it was made for, and the months start at sign-up', async t => {
  const h = await startServer(t);
  const { invite } = (await h.invite({ name: 'Alex', email: 'alex@example.com', months: 2 })).body;

  const wrong = await h.call('POST', '/api/register/password', { name: 'Alex', password: PW, code: invite.code, email: 'someone@else.com' });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.body.code, 'invite-email');
  const none = await h.call('POST', '/api/register/password', { name: 'Alex', password: PW, code: invite.code });
  assert.equal(none.status, 403);
  assert.equal(none.body.code, 'invite-email');
  assert.equal(h.db().invites[0].usedBy, undefined, 'a refused sign-up leaves the code unused');

  const before = Date.now();
  const ok = await h.call('POST', '/api/register/password', { name: 'Alex', password: PW, code: invite.code, email: 'ALEX@example.com' });
  assert.equal(ok.status, 200);
  const user = h.db().users.find(u => u.name === 'Alex');
  assert.ok(user.expiresAt, 'a months invite puts an end date on the account');
  const days = (Date.parse(user.expiresAt) - before) / 86400000;
  assert.ok(days > 58 && days < 63, `two months out, got ${days.toFixed(1)} days`);

  // Each code works once.
  const again = await h.call('POST', '/api/register/password', { name: 'Alex2', password: PW, code: invite.code, email: 'alex@example.com' });
  assert.equal(again.status, 403);
});

test('an indefinite invite never sets an end date; an invite without an address takes any', async t => {
  const h = await startServer(t);
  const { invite } = (await h.invite({ name: 'Free' })).body;
  const ok = await h.call('POST', '/api/register/password', { name: 'Free', password: PW, code: invite.code });
  assert.equal(ok.status, 200);
  assert.equal(h.db().users.find(u => u.name === 'Free').expiresAt, undefined);
});

test('once the months have passed the account is locked out, data kept, and an admin extends it', async t => {
  const KIM = 'u_kim_x';
  const h = await startServer(t, [{ id: KIM, name: 'Kim', created: '2026-01-01T00:00:00.000Z', expiresAt: new Date(Date.now() - 1000).toISOString() }]);
  const kimCookie = { Cookie: `gymsid=${mint(KIM)}` };
  fs.writeFileSync(path.join(h.dataDir, `state-${KIM}.json`), JSON.stringify({ workouts: [{ id: 'w1', name: 'Legs', d: '2026-02-01', start: 1, end: 2, entries: [] }] }));

  assert.equal((await h.call('GET', '/api/me', undefined, kimCookie)).status, 401, 'an expired session stops resolving');
  const list = await h.call('GET', '/api/admin/users', undefined, asAdmin);
  const row = list.body.users.find(u => u.id === KIM);
  assert.equal(row.expired, true);
  assert.equal(row.disabled, false, 'expired is not the same as disabled');
  assert.equal(fs.existsSync(path.join(h.dataDir, `state-${KIM}.json`)), true, 'their data is still there');

  const back = await h.call('POST', '/api/admin/user/validity', { id: KIM, months: 1 }, asAdmin);
  assert.equal(back.status, 200);
  assert.equal(back.body.expired, false);
  assert.equal((await h.call('GET', '/api/me', undefined, kimCookie)).status, 200, 'extending brings them back at once');
});

test('the validity route: months extend from what is left, null is indefinite, the owner is exempt', async t => {
  const h = await startServer(t);
  const { invite } = (await h.invite({ name: 'Lee', months: 1 })).body;
  await h.call('POST', '/api/register/password', { name: 'Lee', password: PW, code: invite.code });
  const lee = h.db().users.find(u => u.name === 'Lee');
  const first = Date.parse(lee.expiresAt);

  const more = await h.call('POST', '/api/admin/user/validity', { id: lee.id, months: 2 }, asAdmin);
  assert.equal(more.status, 200);
  assert.ok(Date.parse(more.body.expiresAt) > first + 55 * 86400000, 'two more months on top of what was left');

  const list = await h.call('GET', '/api/admin/users', undefined, asAdmin);
  const row = list.body.users.find(u => u.id === lee.id);
  assert.equal(row.expired, false);
  assert.equal(row.expiresAt, more.body.expiresAt);

  const forever = await h.call('POST', '/api/admin/user/validity', { id: lee.id, months: null }, asAdmin);
  assert.equal(forever.body.expiresAt, null);
  assert.equal(h.db().users.find(u => u.id === lee.id).expiresAt, undefined);

  assert.equal((await h.call('POST', '/api/admin/user/validity', { id: lee.id, months: 0 }, asAdmin)).status, 400);
  assert.equal((await h.call('POST', '/api/admin/user/validity', { id: 'nobody', months: 1 }, asAdmin)).status, 404);
  assert.equal((await h.call('POST', '/api/admin/user/validity', { id: lee.id, months: 1 })).status, 401, 'admin only');
});

test('the signed-in user carries expiresAt, for the app to warn before it comes', async t => {
  const SAM = 'u_sam_x', END = new Date(Date.now() + 5 * 86400000).toISOString();
  const h = await startServer(t, [{ id: SAM, name: 'Sam', created: '2026-01-01T00:00:00.000Z', expiresAt: END }]);
  const sam = await h.call('GET', '/api/me', undefined, { Cookie: `gymsid=${mint(SAM)}` });
  assert.equal(sam.status, 200);
  assert.equal(sam.body.user.expiresAt, END);
  const boss = await h.call('GET', '/api/me', undefined, asAdmin);
  assert.equal('expiresAt' in boss.body.user, false, 'an account without an end date says nothing');
});
