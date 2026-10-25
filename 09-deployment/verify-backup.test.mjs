import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import { readBackup } from './verify-backup.mjs';

test('backup verifies before streaming; corruption and wrong keys release no records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alp-backup-test-'));
  try {
    const file = join(dir, 'synthetic.backup'), keyFile = join(dir, 'synthetic.key');
    const key = randomBytes(32), iv = randomBytes(12), content = Buffer.from('synthetic test archive');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const envelope = Buffer.concat([Buffer.from('ALPBACKUP1'), iv, cipher.update(content), cipher.final(), cipher.getAuthTag()]);
    await writeFile(file, envelope); await writeFile(keyFile, key.toString('hex'));
    assert.equal((await readBackup(file, keyFile)).status, 'authenticated');
    const chunks = [];
    await readBackup(file, keyFile, new Writable({ write(data, _encoding, done) { chunks.push(data); done(); } }));
    assert.deepEqual(Buffer.concat(chunks), content);
    for (const change of ['wrong-key', 'modified-archive']) {
      const original = await readFile(file);
      if (change === 'wrong-key') await writeFile(keyFile, randomBytes(32).toString('hex'));
      else { await writeFile(keyFile, key.toString('hex')); const bad = Buffer.from(original); bad[22] ^= 1; await writeFile(file, bad); }
      let released = 0;
      await assert.rejects(readBackup(file, keyFile, new Writable({ write(data, _encoding, done) { released += data.length; done(); } })));
      assert.equal(released, 0);
      await writeFile(file, original);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
