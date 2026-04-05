/**
 * One-time script to extract text from the WRC Penalties 2025 PDF
 * and output a TypeScript data file for the client.
 *
 * Usage:
 *   node scripts/extractWrcPenalties.js > ../client/src/data/wrcPenalties.ts
 */

const https = require('https');
const { PDFParse } = require('pdf-parse');

const PDF_URL = 'https://static1.squarespace.com/static/634a7884c297a25f06589b79/t/6833a1f248230718b731592f/1748214258864/WRC+Penalties+2025.pdf';
const SOURCE_URL = PDF_URL;

function fetchPdf(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPdf(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function escape(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function classifyPenalty(penaltyStr) {
  const lower = penaltyStr.toLowerCase();
  if (lower.includes('penalty game')) return 'penalty_game';
  if (lower.includes('dead hand')) return 'dead_hand';
  if (/\d+/.test(lower)) return 'points';
  return 'procedural';
}

/**
 * Best-effort parser for WRC penalty documents.
 * The PDF text from pdf-parse comes out as a flat string with newlines.
 * We look for numbered section headers and collect their content.
 */
function parseEntries(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const entries = [];
  let idCounter = 1;

  // We'll collect sections by tracking when we see a header line
  // Headers tend to look like:  "1. SECTION TITLE"  or  "1.2 Some Sub Title"
  // Rule entries may have a penalty listed after a dash or at end of block

  let currentSection = '';
  let currentSectionNum = '';
  let buffer = [];

  const sectionHeaderRe = /^(\d+(?:\.\d+)*)\s+(.+)$/;
  // Penalty patterns
  const penaltyRe = /penalty[:\s]+([^.]+)/i;
  const pointsRe = /(\d[\d,]*)\s*(?:point|pt)/i;
  const deadHandRe = /dead\s*hand/i;
  const penaltyGameRe = /penalty\s*game/i;

  function flushBuffer() {
    if (!currentSection || buffer.length === 0) return;
    const fullText = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (fullText.length < 10) return;

    // Try to extract a penalty value from the text
    let penalty = '';
    const pgMatch = fullText.match(penaltyGameRe);
    const dhMatch = fullText.match(deadHandRe);
    const ptMatch = fullText.match(pointsRe);

    if (pgMatch) penalty = 'Penalty Game';
    else if (dhMatch) penalty = 'Dead Hand';
    else if (ptMatch) penalty = `${ptMatch[1]} points`;
    else {
      const pm = fullText.match(penaltyRe);
      if (pm) penalty = pm[1].trim();
    }

    // Build tags from key words
    const tags = [];
    const keyWords = ['chombo', 'dead hand', 'penalty game', 'riichi', 'tenpai', 'ron', 'tsumo',
      'discard', 'draw', 'tile', 'wall', 'dora', 'furiten', 'agari', 'hand', 'seat', 'wind',
      'score', 'payment', 'kong', 'kan', 'call', 'meld', 'flower', 'honor', 'late', 'false',
      'wrong', 'restart', 'reshuffle', 'timeout', 'etiquette'];
    for (const kw of keyWords) {
      if (fullText.toLowerCase().includes(kw)) tags.push(kw);
    }

    entries.push({
      id: `${currentSectionNum}-${idCounter++}`,
      sectionNumber: currentSectionNum,
      sectionTitle: currentSection,
      description: fullText,
      penalty,
      tags,
    });
  }

  for (const line of lines) {
    const headerMatch = line.match(sectionHeaderRe);
    if (headerMatch) {
      flushBuffer();
      buffer = [];
      currentSectionNum = headerMatch[1];
      currentSection = headerMatch[2];
      // Include the header text itself as the start of the buffer
      // so it's searchable
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  return entries;
}

async function main() {
  process.stderr.write('Fetching PDF...\n');
  const parser = new PDFParse({ url: PDF_URL });
	const data = await parser.getText();

  process.stderr.write(`Extracted ${data.text.length} characters of text\n`);

  const entries = parseEntries(data.text);
  process.stderr.write(`Parsed ${entries.length} entries\n`);

  // Output TypeScript file
  const lines = [
    `// Auto-generated from WRC Penalties 2025 PDF`,
    `// Source: ${SOURCE_URL}`,
    `// Re-generate: node server/scripts/extractWrcPenalties.js > client/src/data/wrcPenalties.ts`,
    ``,
    `export type PenaltyType = 'penalty_game' | 'dead_hand' | 'points' | 'procedural';`,
    ``,
    `export interface PenaltyEntry {`,
    `  id: string;`,
    `  sectionNumber: string;`,
    `  sectionTitle: string;`,
    `  description: string;`,
    `  penalty: string;`,
    `  penaltyType: PenaltyType;`,
    `  tags: string[];`,
    `}`,
    ``,
    `export const wrcPenalties: PenaltyEntry[] = [`,
  ];

  for (const entry of entries) {
    lines.push(`  {`);
    lines.push(`    id: \`${escape(entry.id)}\`,`);
    lines.push(`    sectionNumber: \`${escape(entry.sectionNumber)}\`,`);
    lines.push(`    sectionTitle: \`${escape(entry.sectionTitle)}\`,`);
    lines.push(`    description: \`${escape(entry.description)}\`,`);
    lines.push(`    penalty: \`${escape(entry.penalty)}\`,`);
    lines.push(`    penaltyType: '${classifyPenalty(entry.penalty)}',`);
    lines.push(`    tags: [${entry.tags.map(t => `'${t}'`).join(', ')}],`);
    lines.push(`  },`);
  }

  lines.push(`];`);
  lines.push(``);
  lines.push(`export const metadata = {`);
  lines.push(`  source: 'WRC Penalties 2025',`);
  lines.push(`  sourceUrl: '${SOURCE_URL}',`);
  lines.push(`  extractedAt: '${new Date().toISOString().slice(0, 10)}',`);
  lines.push(`};`);
  lines.push(``);

  process.stdout.write(lines.join('\n'));
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
