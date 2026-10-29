const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Compile only the modules under test; never load production credentials.
function load(file, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, console, URL, AbortSignal, Buffer,
    process: { env: { GOOGLE_PLACES_API_KEY: 'test-key' } },
    require: name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name)) + '.ts', mocks, globals);
      return require(name);
    },
    ...globals,
  }, { filename });
  return module.exports;
}

const policy = load('lib/blocked-destinations.ts');
test('blocks names, addresses, case, separators, unicode and encoded inputs', () => {
  for (const value of ['CV KUNTUL RACING', 'Gunung Kuntul', 'Jl. Kontol No. 1', 'K.u.n.t.u.l', 'ＫＯＮＴＯＬ', 'Kúntul', 'kun\u200btul', 'https://example.test/%4b%55%4e%54%55%4c']) {
    assert.equal(policy.hasBlockedDestination(value), true, value);
  }
  for (const value of ['Kopi Klotok', 'Kantor Surabaya', null, undefined]) {
    assert.equal(policy.hasBlockedDestination(value), false);
  }
});

const reviewUrl = id => `https://search.google.com/local/writereview?placeid=${id}`;
test('blocks known Place IDs even with an innocent label or encoded URL', async () => {
  const validator = load('lib/validate-card-destination.ts', {}, { fetch: () => { throw Error('must not fetch'); } });
  for (const id of policy.BLOCKED_PLACE_IDS) {
    const result = await validator.validateCardDestination({ business_name: 'Warung Aman', place_id: id, google_review_url: reviewUrl(id) }, true);
    assert.equal(result.status, 400);
  }
});

test('checks canonical Google name and address, not just browser-supplied label', async () => {
  for (const details of [{ name: 'Gunung Kuntul', formatted_address: 'Bali' }, { name: 'Warung Aman', formatted_address: 'Jalan Kontol' }]) {
    const validator = load('lib/validate-card-destination.ts', {}, { fetch: async () => ({ ok: true, json: async () => ({ status: 'OK', result: { ...details, place_id: 'safe-id' } }) }) });
    const result = await validator.validateCardDestination({ business_name: 'Warung Aman', place_id: 'safe-id', google_review_url: reviewUrl('safe-id') }, true);
    assert.equal(result.status, 400);
  }
});

test('accepts a verified legitimate place', async () => {
  const validator = load('lib/validate-card-destination.ts', {}, { fetch: async () => ({ ok: true, json: async () => ({ status: 'OK', result: { name: 'Kopi Klotok', formatted_address: 'Sleman', place_id: 'safe-id' } }) }) });
  assert.equal(await validator.validateCardDestination({ business_name: 'Kopi Klotok', place_id: 'safe-id', google_review_url: reviewUrl('safe-id') }, true), null);
});

test('rejects mismatched destinations, opaque short links and non-Google redirects', async () => {
  const validator = load('lib/validate-card-destination.ts', {}, { fetch: () => { throw Error('must not fetch'); } });
  for (const url of [reviewUrl('other-id'), 'https://maps.app.goo.gl/abc', 'https://example.test/local/writereview?placeid=safe-id', 'javascript:alert(1)']) {
    assert.equal((await validator.validateCardDestination({ business_name: 'Aman', place_id: 'safe-id', google_review_url: url }, true)).status, 400);
  }
});

test('fails closed when Google verification or configuration is unavailable', async () => {
  for (const globals of [
    { fetch: async () => { throw Error('offline'); } },
    { fetch: async () => ({ ok: true, json: async () => ({ status: 'REQUEST_DENIED' }) }) },
    { process: { env: {} }, fetch: () => { throw Error('must not fetch'); } },
  ]) {
    const validator = load('lib/validate-card-destination.ts', {}, globals);
    assert.equal((await validator.validateCardDestination({ place_id: 'safe-id', google_review_url: reviewUrl('safe-id') }, true)).status, 503);
  }
});

function activationHarness(active = false) {
  let state = { card_id: 'TEST23', is_active: active, business_name: null, place_id: null, google_review_url: null };
  let writes = 0, audits = 0;
  const db = { from: () => {
    let patch = null, conditions = [];
    const query = {
      select: () => query,
      eq: (key, value) => { conditions.push([key, value]); return query; },
      update: value => { patch = value; return query; },
      maybeSingle: async () => {
        if (!patch) return { data: { ...state }, error: null };
        if (!conditions.every(([key, value]) => state[key] === value)) return { data: null, error: null };
        state = { ...state, ...patch }; writes++;
        return { data: { card_id: state.card_id }, error: null };
      },
    };
    return query;
  } };
  const route = load('app/api/activate/route.ts', {
    '@/lib/supabaseServer': { getSupabaseServerClient: () => db },
    '@/lib/card-audit': { logCardChange: async () => { audits++; }, pickTrackedFields: x => x, getRequestMeta: () => ({}) },
    '@/lib/review-url': load('lib/review-url.ts'),
    '@/lib/validate-card-destination': { validateCardDestination: async () => null },
    bcryptjs: { hash: async () => 'hashed-test-pin' },
  });
  const request = () => ({ json: async () => ({ cardId: 'TEST23', businessName: 'Aman', placeId: 'safe-id', pin: '1234' }) });
  return { route, request, get writes() { return writes; }, get audits() { return audits; } };
}

test('simultaneous activations have one winner and one audit record', async () => {
  const harness = activationHarness();
  const results = await Promise.all([harness.route.POST(harness.request()), harness.route.POST(harness.request())]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(harness.writes, 1);
  assert.equal(harness.audits, 1);
});

test('activation cannot overwrite an already active card', async () => {
  const harness = activationHarness(true);
  assert.equal((await harness.route.POST(harness.request())).status, 409);
  assert.equal(harness.writes, 0);
});

test('blocked activation is rejected before hashing, writing or audit success', async () => {
  let writes = 0;
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { is_active: false } }), update: () => { writes++; throw Error('must not write'); } };
  const route = load('app/api/activate/route.ts', {
    '@/lib/supabaseServer': { getSupabaseServerClient: () => ({ from: () => query }) },
    '@/lib/card-audit': {},
    '@/lib/review-url': load('lib/review-url.ts'),
    '@/lib/validate-card-destination': load('lib/validate-card-destination.ts'),
  });
  const result = await route.POST({ json: async () => ({ cardId: 'TEST23', businessName: 'Gunung Kuntul', placeId: 'safe-id', pin: '1234' }) });
  assert.equal(result.status, 400);
  assert.equal(writes, 0);
});

test('PIN and company edit endpoints reject blocked names before updating', async () => {
  for (const kind of ['pin', 'company']) {
    let writes = 0;
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { card_id: 'TEST23', batch_label: 'Company', business_name: 'Aman', is_active: true, pin_hash: 'hash' } }), update: () => { writes++; throw Error('must not write'); } };
    const route = load(kind === 'pin' ? 'app/api/edit/route.ts' : 'app/api/company/card/route.ts', {
      '@/lib/supabaseServer': { getSupabaseServerClient: () => ({ from: () => query }) },
      '@/lib/company-auth': { getCompanySession: async () => ({ companyName: 'Company' }) },
      '@/lib/card-audit': {},
      '@/lib/review-url': load('lib/review-url.ts'),
      '@/lib/validate-card-destination': load('lib/validate-card-destination.ts'),
      bcryptjs: { compare: async () => true },
    });
    const request = { json: async () => ({ cardId: 'TEST23', pin: '1234', newBusinessName: 'Gunung Kontol' }) };
    const result = await (kind === 'pin' ? route.POST(request) : route.PATCH(request));
    assert.equal(result.status, 400, kind);
    assert.equal(writes, 0);
  }
});

test('autocomplete removes blocked descriptions and disguised known Place IDs', async () => {
  const route = load('app/api/places/route.ts', {
    '@/lib/blocked-destinations': policy,
  }, { fetch: async () => ({ json: async () => ({ status: 'OK', predictions: [
    { description: 'Aman', place_id: 'safe-id' },
    { description: 'Gunung Kuntul', place_id: 'unknown-id' },
    { description: 'Warung Aman', place_id: policy.BLOCKED_PLACE_IDS[0] },
  ] }) }) });
  const result = await route.GET({ nextUrl: new URL('https://ratey.test/api/places?query=warung') });
  assert.deepEqual((await result.json()).suggestions, [{ description: 'Aman', place_id: 'safe-id' }]);
});

test('admin endpoints refuse access without configured secret, including old default', async () => {
  for (const file of ['login', 'cards', 'action', 'upload']) {
    const route = load(`app/api/admin/${file}/route.ts`, {
      '@/lib/supabaseServer': { getSupabaseServerClient: () => { throw Error('must not access database'); } },
      '@/lib/client-auth': {}, '@/lib/card-audit': {}, '@/lib/tammmu-preset-menu': {},
    }, { process: { env: {} } });
    const result = await route.POST({ headers: new Headers(), json: async () => ({ secretKey: 'ratey-admin-secret-2026' }) });
    assert.equal(result.status, 503, file);
  }
});

test('portal tokens signed with former public default secrets are rejected', () => {
  const crypto = require('node:crypto');
  for (const kind of ['client', 'company']) {
    const auth = load(`lib/${kind}-auth.ts`, {}, { process: { env: {} } });
    const body = Buffer.from(JSON.stringify({ exp: Date.now() + 60000, clientSlug: 'victim', companyName: 'victim' })).toString('base64url');
    const signature = crypto.createHmac('sha256', `ratey-${kind}-session-secret-2026`).update(body).digest('base64url');
    const verify = kind === 'client' ? auth.verifyClientSessionToken : auth.verifyCompanySessionToken;
    assert.equal(verify(`${body}.${signature}`), null);
  }
});
