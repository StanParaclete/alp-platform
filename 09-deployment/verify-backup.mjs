import { open, readFile } from 'node:fs/promises';
import { createDecipheriv } from 'node:crypto';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export async function readBackup(file, keyFile, destination = null) {
  const handle = await open(file, 'r');
  let key;
  try {
    const text = (await readFile(keyFile, 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/i.test(text)) throw new Error('Invalid recovery key');
    key = Buffer.from(text, 'hex');
    const { size } = await handle.stat();
    if (size < 39) throw new Error('Incomplete encrypted backup');
    const header = Buffer.alloc(22), tag = Buffer.alloc(16);
    await handle.read(header, 0, 22, 0);
    await handle.read(tag, 0, 16, size - 16);
    if (header.subarray(0, 10).toString() !== 'ALPBACKUP1') throw new Error('Unknown backup format');
    const decrypt = async output => {
      const cipher = createDecipheriv('aes-256-gcm', key, header.subarray(10));
      cipher.setAuthTag(tag);
      await pipeline(handle.createReadStream({ start: 22, end: size - 17, autoClose: false }), cipher, output);
    };
    // Authenticate the entire archive before releasing any plaintext to a restore process.
    await decrypt(new Writable({ write(_data, _encoding, done) { done(); } }));
    if (destination) await decrypt(destination);
    return { status: 'authenticated', encryptedBytes: size };
  } finally {
    key?.fill(0);
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, keyFile, mode] = process.argv.slice(2);
  if (!file || !keyFile || (mode && mode !== '--stream') || (mode && process.stdout.isTTY)) {
    console.error('Usage: node verify-backup.mjs BACKUP_PATH KEY_PATH [--stream]. Stream mode requires a pipe.');
    process.exitCode = 1;
  } else {
    try {
      const result = await readBackup(file, keyFile, mode ? process.stdout : null);
      if (!mode) console.log(JSON.stringify(result));
    } catch {
      console.error('Backup verification failed. No credentials or record details are logged.');
      process.exitCode = 1;
    }
  }
}
