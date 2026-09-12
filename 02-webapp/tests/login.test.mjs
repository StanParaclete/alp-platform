import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';

// Exercise the shipped handler without loading the app or connecting to Supabase.
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const login = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'Login');
const handler = login.body.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'handleSignIn');
const handlerSource = source.slice(handler.start, handler.end);

function setup({ email = ' teacher@example.test ', pw = 'test-only-password', signIn } = {}) {
  const state = { loading: false, error: '', role: null, step: 'credentials', calls: [] };
  const context = vm.createContext({
    email, pw,
    setLoading: value => { state.loading = value; },
    setLoginError: value => { state.error = value; },
    setStep: value => { state.step = value; },
    onLogin: value => { state.role = value; },
    Supabase: { signIn: async (...args) => {
      state.calls.push(args);
      assert.equal(state.loading, true);
      return signIn ? signIn(...args) : { data: { user: { user_metadata: { role: 'teacher' } } } };
    } },
  });
  return { state, submit: () => vm.runInContext(`${handlerSource}; handleSignIn()`, context) };
}

test('sign-in uses the entered password and trimmed email, then clears loading', async () => {
  const { state, submit } = setup();
  await submit();
  assert.deepEqual(state.calls, [['teacher@example.test', 'test-only-password']]);
  assert.equal(state.role, 'teacher');
  assert.equal(state.error, '');
  assert.equal(state.loading, false);
});

test('missing credentials produce an error without calling authentication', async () => {
  for (const input of [{ email: ' ' }, { pw: '' }]) {
    const { state, submit } = setup(input);
    await submit();
    assert.equal(state.calls.length, 0);
    assert.match(state.error, /email address and password/);
    assert.equal(state.loading, false);
  }
});

test('authentication rejection displays the error and makes retry possible', async () => {
  const { state, submit } = setup({ signIn: () => ({ error: { message: 'Invalid login credentials' } }) });
  await submit();
  assert.equal(state.error, 'Invalid login credentials');
  assert.equal(state.loading, false);
  assert.equal(state.role, null);
});

test('network exceptions do not leave the sign-in spinner running', async () => {
  const { state, submit } = setup({ signIn: () => { throw new TypeError('Failed to fetch'); } });
  await submit();
  assert.match(state.error, /Check your connection/);
  assert.equal(state.loading, false);
  assert.equal(state.role, null);
});

test('existing unconfigured demo transition also clears loading', async () => {
  const { state, submit } = setup({ signIn: () => ({ error: { message: 'Supabase not configured' } }) });
  await submit();
  assert.equal(state.step, 'role');
  assert.equal(state.loading, false);
  assert.equal(state.role, null);
});

const app = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'AppInner');
const { code: appSource } = await transform(source.slice(app.start, app.end), { loader: 'jsx' });
const componentNames = new Set();
function collectComponents(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'JSXOpeningElement' && node.name.type === 'JSXIdentifier' && /^[A-Z]/.test(node.name.name)) {
    componentNames.add(node.name.name);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(collectComponents);
    else if (value && typeof value === 'object') collectComponents(value);
  }
}
collectComponents(app);

function renderApp(profile, configured = true) {
  const noop = () => {};
  const context = {
    ...Object.fromEntries([...componentNames].map(name => [name, name])),
    React: { Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props, children }) },
    useTheme: () => ({ isDark: false }),
    useRole: () => ({ role: 'teacher', setRole: noop }),
    useSupabaseAuth: () => ({ user: { email: 'teacher@example.test' }, profile }),
    useState: value => [value === 'landing' ? 'app' : value, noop],
    useEffect: noop, usePageTitle: noop, useToast: () => ({ toast: noop }),
    C: {}, CL: {}, CD: {}, CSS: '', Supabase: { supabase: configured ? {} : null },
  };
  const tree = vm.runInNewContext(`${appSource}; AppInner()`, context);
  const rendered = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    rendered.push(node.type);
    visit(node.children);
  }
  visit(tree);
  return rendered;
}

test('signed-in account without a school renders the pending screen, not the workspace', () => {
  const rendered = renderApp({ org_id: null });
  assert.ok(rendered.includes('PendingAccount'));
  assert.ok(!rendered.includes('SidebarFull'));
});

test('school account and unconfigured demo can render the workspace without undefined auth values', () => {
  for (const rendered of [renderApp({ org_id: 'test-school' }), renderApp(null, false)]) {
    assert.ok(rendered.includes('SidebarFull'));
    assert.ok(!rendered.includes('PendingAccount'));
  }
});
