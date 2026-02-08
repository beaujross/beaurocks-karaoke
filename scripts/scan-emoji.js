import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import emojiRegex from 'emoji-regex';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'src');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const EMOJI_RE = emojiRegex();

const walk = (dir, files = []) => {
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (entry === 'node_modules' || entry === 'archive') continue;
            walk(full, files);
        } else {
            const ext = entry.slice(entry.lastIndexOf('.'));
            if (EXTENSIONS.has(ext)) files.push(full);
        }
    }
    return files;
};

const results = [];
for (const file of walk(SRC_DIR)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
        if (EMOJI_RE.test(line)) {
            results.push(`${rel}:${idx + 1}: ${line.trim()}`);
        }
    });
}

if (results.length) {
    console.error('Emoji literals detected (use emoji helper instead):');
    results.forEach(r => console.error(`- ${r}`));
    process.exit(1);
}

console.log('Emoji scan passed.');
