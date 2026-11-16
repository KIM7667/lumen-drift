// Lumen Drift's hand-in program (Node 22, standard library only).
//
// The game itself is the game/ folder beside this file: plain static files a
// desktop browser opens offline, no build step and no network. This program
// hands it in — it copies game/ and screenshots/ into the output directory
// and writes dossier.json there with make.fun's vendored library, exactly
// the summary the judge reads. Run it the way the grader does:
//
//   node main.ts                          (writes /output)
//   MAKEFUN_OUTPUT_DIR=out node main.ts   (writes ./out, for a local look)
//
// Play the game first if you like: `node serve.ts`, then open
// http://localhost:8080 in a desktop browser.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (its gate.json): the byte cap shapes the
// dossier's text, and the rest make this program refuse anything the scorer
// would refuse — too many or too-large screenshots, too many game files, a
// path too long — here, where it can still be fixed, instead of there.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
