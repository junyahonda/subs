import {createHash} from 'node:crypto';
import {readFile, readdir, writeFile} from 'node:fs/promises';

// Fingerprint the complete output, not a manually maintained cache number.
const root = new URL('./dist/', import.meta.url);
const hash = createHash('sha256');
async function fingerprint(directory, prefix = '') {
  for (const entry of (await readdir(directory, {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const path = new URL(entry.name, directory);
    if (entry.isDirectory()) await fingerprint(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`);
    else hash.update(`${prefix}${entry.name}\0`).update(await readFile(path));
  }
}
await fingerprint(root);
const version = hash.digest('hex').slice(0,20);
const html = await readFile(new URL('index.html', root), 'utf8');
await writeFile(new URL('index.html', root), html.replace('<head>', `<head>\n    <meta name="subs-build" content="${version}">`));
const worker = await readFile(new URL('sw.js', root), 'utf8');
await writeFile(new URL('sw.js', root), worker.replaceAll('__SUBS_BUILD__', version));
console.log(`Offline shell: ${version}`);
