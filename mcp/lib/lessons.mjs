/* AA Plug 2 MCP — review lessons kept on this machine only.
   $AAPLUG2_HOME/lessons.json (default ~/.aaplug2/lessons.json) holds generalized lessons, never raw store messages.
   $AAPLUG2_HOME/lessons-export.json is an anonymized copy a person can review. Nothing here touches the network. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Lessons } from './runtime.mjs';

export const LHOME = process.env.AAPLUG2_HOME || path.join(os.homedir(), '.aaplug2');
export const LESSONS_FILE = path.join(LHOME, 'lessons.json');
export const EXPORT_FILE = path.join(LHOME, 'lessons-export.json');

function writeAtomic(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, data, { mode: 0o600 }); fs.renameSync(tmp, f);
}
export function loadLessons() {
  let raw; try { raw = fs.readFileSync(LESSONS_FILE, 'utf8'); } catch { return Lessons.empty(); }
  try { return Lessons.normDb(JSON.parse(raw)); }
  catch { try { fs.renameSync(LESSONS_FILE, LESSONS_FILE + '.bad-' + Date.now()); } catch { } return Lessons.empty(); }
}
export function saveLessons(db) {
  const d = Lessons.normDb(db);
  writeAtomic(LESSONS_FILE, JSON.stringify(d, null, 2));
  writeAtomic(EXPORT_FILE, JSON.stringify(Lessons.exportDb(d), null, 2));
  return d;
}
/* Wrap a read-modify-write; a broken lessons file never breaks the launch flow. */
export function withLessons(fn) {
  try { const db = loadLessons(); const r = fn(db); if (r && r.db) saveLessons(r.db); return r; }
  catch (e) { console.error('[aaplug2] lessons:', e && e.message); return null; }
}
export const relevantLessons = (A, stores, lang) => { try { return Lessons.relevant(loadLessons(), A, stores, lang); } catch { return []; } };
export const listLessons = () => { try { return loadLessons().lessons.map(Lessons.compact); } catch { return []; } };
