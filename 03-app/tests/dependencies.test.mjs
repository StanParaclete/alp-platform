import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('React renderers and native animation peers match the installed Expo SDK', async () => {
  const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const project = await read('../package.json');
  const supported = await read('../node_modules/expo/bundledNativeModules.json');
  const lock = await read('../package-lock.json');
  for (const name of ['react', 'react-dom', 'react-native', 'react-native-reanimated', 'react-native-worklets']) {
    assert.equal(project.dependencies[name], supported[name], `${name} must match Expo's supported version`);
    assert.equal(lock.packages[`node_modules/${name}`].version, supported[name], `${name} lock must be aligned`);
    assert.equal((await read(`../node_modules/${name}/package.json`)).version, supported[name], `${name} installation must be aligned`);
  }
});
