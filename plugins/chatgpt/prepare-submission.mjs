import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative, isAbsolute } from 'node:path';

const source = fileURLToPath(new URL('./', import.meta.url));
const output = join(source, 'submission');
const manifest = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8'));
if (!/^[a-z][a-z0-9-]{0,63}$/.test(manifest.name)) throw new Error('Invalid package name');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Use a semantic version');
const openai = manifest.extensions['com.openai'];
delete manifest.apps;
delete openai.apps;
const listing = openai.interface;
const count = value => [...value].length;
for (const [key, max] of [['displayName', 30], ['shortDescription', 30], ['longDescription', 4000], ['developerName', 80]]) {
  if (typeof listing[key] !== 'string' || !listing[key].trim() || count(listing[key]) > max) throw new Error(`Invalid ${key}`);
}
const prompts = Array.isArray(listing.defaultPrompt) ? listing.defaultPrompt : [listing.defaultPrompt];
if (prompts.length < 1 || prompts.length > 3 || prompts.some(p => typeof p !== 'string' || !p.trim() || count(p) > 128 || /[\n\r@]/.test(p)) || new Set(prompts.map(p => p.trim().replace(/\s+/g, ' '))).size !== prompts.length) throw new Error('Invalid starter prompts');
const cases = openai.review?.test_cases;
if (cases?.positive?.length !== 5 || cases?.negative?.length !== 3) throw new Error('Expected five positive and three negative review cases');
for (const c of cases.positive) for (const key of ['description', 'prompt', 'tools_triggered', 'expected_behavior']) if (!c[key]?.trim()) throw new Error(`Missing case ${key}`);
for (const c of cases.negative) for (const key of ['description', 'prompt']) if (!c[key]?.trim()) throw new Error(`Missing case ${key}`);
for (const t of Object.values(openai.publication?.translations ?? {})) {
  for (const [key, max] of [['subtitle', 30], ['description', 4000]]) if (t[key] != null && (typeof t[key] !== 'string' || !t[key].trim() || count(t[key]) > max || /[\t\r]/.test(t[key]))) throw new Error(`Invalid translation ${key}`);
}
const mcp = JSON.parse(await readFile(join(source, 'mcp.json'), 'utf8'));
const servers = Object.values(mcp.mcpServers ?? {});
if (servers.length !== 1) throw new Error('Review cases require exactly one MCP server');
for (const server of servers) {
  const url = new URL(server.url);
  if (server.type !== 'streamable-http' || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Use the verified public HTTPS MCP endpoint');
}
const missing = [];
for (const key of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
  if (!listing[key]) { missing.push(key); continue; }
  const url = new URL(listing[key]);
  if (url.protocol !== 'https:' || url.username || url.password || count(listing[key]) > 1024) throw new Error(`Invalid ${key}`);
}
if (!openai.review.demo_recording_url) missing.push('demo_recording_url');
if (!listing.category) missing.push('portal category');
const assets = [];
for (const key of ['logo', 'composerIcon', 'logoDark', 'composerIconDark']) {
  if (!listing[key]) continue;
  const path = resolve(source, listing[key]);
  const contained = relative(source, path);
  if (!contained.startsWith('assets/') || contained.split('/').includes('..') || isAbsolute(contained)) throw new Error('Icons must be contained in assets/');
  const bytes = await readFile(path);
  const minimum = key.startsWith('logo') ? 256 : 48;
  if (bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== bytes.readUInt32BE(20) || bytes.readUInt32BE(16) < minimum || bytes.readUInt32BE(16) > 4096 || bytes.length > 5 * 1024 * 1024) throw new Error('Expected square submission PNG');
  assets.push(contained);
}
// Only rebuild this script's generated output. Never copy the project wholesale.
await mkdir(output, { recursive: true });
const directory = join(output, manifest.name);
await rm(directory, { recursive: true, force: true });
await mkdir(join(directory, 'assets'), { recursive: true });
await writeFile(join(directory, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(directory, 'mcp.json'), JSON.stringify(mcp, null, 2) + '\n');
for (const path of new Set(assets)) await copyFile(join(source, path), join(directory, path));
const archive = join(output, `${manifest.name}-${manifest.version}-draft.zip`);
await rm(archive, { force: true });
execFileSync('zip', ['-q', '-r', archive, manifest.name], { cwd: output });
const report = {
  archive, version: manifest.version, status: 'PREPARATION_DRAFT', missingPackageFields: missing,
  remainingVerification: ['Published listing URLs and recording playback', 'All eight cases against the exact portal-saved version', 'Verified publishing identity', 'Domain verification and portal scans', 'Authorized developer policy attestations'],
};
await writeFile(join(output, 'readiness.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
