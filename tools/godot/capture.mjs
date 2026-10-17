// npm run godot:capture -- [--output .shots/name.png] [--timeout 15]
// Ask the already-running debug game to capture its current root viewport.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { client, root } from './lib.mjs';

const args = process.argv.slice(2);
let output = '.shots/godot-live.png';
let timeoutSeconds = 15;
for (let i = 0; i < args.length; i += 1) {
  const value = args[i + 1];
  if (args[i] === '--output' && value) {
    output = value;
    i += 1;
  } else if (args[i] === '--timeout' && value) {
    timeoutSeconds = Number(value);
    i += 1;
  } else {
    console.error(`Unknown or incomplete argument: ${args[i]}`);
    process.exit(2);
  }
}

if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
  console.error('--timeout must be a positive number of seconds.');
  process.exit(2);
}

const outputPath = isAbsolute(output) ? output : resolve(root, output);
const requestDir = join(client, '.godot', 'xomdao_capture');
const requestPath = join(requestDir, 'request.json');
const resultPath = join(requestDir, 'result.json');
const requestId = `${process.pid}-${Date.now()}`;
mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(requestDir, { recursive: true });
rmSync(resultPath, { force: true });
writeFileSync(requestPath, JSON.stringify({ id: requestId, output: outputPath }));
console.log(`Waiting for the running Godot game to capture its current viewport: ${outputPath}`);

const deadline = Date.now() + timeoutSeconds * 1000;
while (Date.now() < deadline) {
  try {
    const result = JSON.parse(readFileSync(resultPath, 'utf8'));
    if (result.id === requestId) {
      if (result.ok) {
        console.log(`Captured ${result.width}x${result.height}: ${outputPath}`);
        process.exit(0);
      }
      console.error(`Godot viewport capture failed: ${result.error}`);
      process.exit(1);
    }
  } catch {}
  await delay(100);
}

rmSync(requestPath, { force: true });
console.error(
  'No response from the running game. Keep the desktop Godot project running in a debug build and retry.',
);
process.exit(1);
