export function entryScreen(pathname) {
  if (pathname === '/login' || pathname === '/login/') return 'login';
  if (pathname === '/signup' || pathname === '/signup/') return 'signup';
  return 'landing';
}
