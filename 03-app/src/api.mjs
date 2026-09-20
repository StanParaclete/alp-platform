export class ApiError extends Error { constructor(message, status = 0) { super(message); this.status = status; } }
export function apiOrigin(value, development = false) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(development && url.protocol === 'http:' && url.hostname === '127.0.0.1'))) throw new Error('Configure a trusted HTTPS API origin.');
  return url.origin;
}
export function createApi({ base, send = fetch, onSession = async () => {} }) {
  let session = null, refreshing = null, generation = 0;
  async function raw(path, { method = 'GET', body, school, token } = {}) {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('..') || path.includes('\\')) throw new ApiError('Invalid endpoint.');
    let response;
    try {
      response = await send(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(school ? { 'X-School-Id': school } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch { throw new ApiError('ALP could not connect. Check your internet connection and try again.'); }
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.error || 'Unable to complete the request.', response.status);
    return data;
  }
  async function remember(value, expectedGeneration) {
    if (generation !== expectedGeneration) throw new ApiError('Session changed. Sign in again.', 401);
    session = value;
    await onSession(value);
    return value;
  }
  async function refresh() {
    if (!session) throw new ApiError('Sign in to continue.', 401);
    if (!refreshing) {
      const current = generation, token = session.refreshToken;
      const operation = raw('/auth/refresh', { method: 'POST', body: { refreshToken: token } })
        .then(value => remember(value, current))
        .catch(async error => { if (current === generation && error.status === 401) { session = null; await onSession(null); } throw error; })
        .finally(() => { if (refreshing === operation) refreshing = null; });
      refreshing = operation;
    }
    return refreshing;
  }
  return {
    requestPasswordRecovery(email) { return raw('/auth/password/request', { method: 'POST', body: { email } }); },
    async resetPassword(body) {
      const current = generation;
      await raw('/auth/password/reset', { method: 'POST', body });
      if (current === generation) { generation++; refreshing = null; session = null; await onSession(null); }
    },
    registerInvitation(body) { return raw('/auth/invitations/register', { method: 'POST', body }); },
    async login(email, password) { const current = ++generation; refreshing = null; session = null; const value = await raw('/auth/login', { method: 'POST', body: { email, password } }); return remember(value, current); },
    async restore(refreshToken) { generation++; refreshing = null; session = { refreshToken }; return refresh(); },
    async logout() { const token = session?.refreshToken; generation++; refreshing = null; session = null; await onSession(null); if (token) await raw('/auth/logout', { method: 'POST', body: { refreshToken: token } }); },
    async request(path, options = {}) {
      const current = generation;
      if (!session?.accessToken) throw new ApiError('Sign in to continue.', 401);
      let value;
      try { value = await raw(path, { ...options, token: session.accessToken }); }
      catch (error) {
        if (error.status !== 401 || current !== generation) throw error;
        const renewed = await refresh();
        value = await raw(path, { ...options, token: renewed.accessToken });
      }
      if (current !== generation) throw new ApiError('Session changed.', 401);
      return value;
    },
  };
}
