import { mkdir, copyFile } from 'node:fs/promises';
await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
await copyFile(new URL('../../02-webapp/public/icons/icon-512x512.png', import.meta.url), new URL('../assets/icon.png', import.meta.url));
