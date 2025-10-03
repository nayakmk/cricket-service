const fs = require('fs');
const path = require('path');

class RawPdfTextExtractor {
  constructor(reportsDir) {
    this.reportsDir = reportsDir || path.join(__dirname, '..', 'reports');
  }

  getPdfFiles() {
    try {
      const files = fs.readdirSync(this.reportsDir);
      return files.filter(f => f.toLowerCase().endsWith('.pdf'));
    } catch (err) {
      console.error('Unable to list reports directory:', err.message);
      return [];
    }
  }

  // Extract printable character sequences from PDF binary (like `strings`)
  extractPrintableSequences(buffer, minLen = 4) {
    const out = [];
    let cur = [];
    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i];
      // allow common printable ASCII and some UTF-8 multi-byte ranges (naive)
      if ((b >= 32 && b <= 126) || b >= 160) {
        cur.push(b);
      } else {
        if (cur.length >= minLen) {
          out.push(Buffer.from(cur).toString('utf8'));
        }
        cur = [];
      }
    }
    if (cur.length >= minLen) out.push(Buffer.from(cur).toString('utf8'));
    return out;
  }

  // Filter out obvious PDF metadata and binary artifacts
  filterCricketContent(sequences) {
    const filtered = [];
    const pdfMetadata = [
      'Width', 'Height', 'BitsPerComponent', 'ColorTransform', 'StructParents',
      'Count', 'Flags', 'ItalicAngle', 'Ascent', 'Descent', 'CapHeight',
      'StemV', 'StemH', 'AvgWidth', 'MaxWidth', 'XHeight', 'Leading',
      'Type', 'Subtype', 'Filter', 'Length', 'Root', 'Pages', 'Kids',
      'MediaBox', 'Contents', 'Resources', 'ProcSet', 'Font', 'Encoding',
      'BaseFont', 'FirstChar', 'LastChar', 'Widths', 'FontDescriptor',
      'CA', 'LC', 'LJ', 'LW', 'ML', 'D', 'RI', 'OP', 'op', 'OPM', 'SA',
      'BM', 'SMask', 'TR', 'TK', 'HT', 'FL', 'AIS', 'ARD', 'ARDN',
      'Metadata', 'XML', 'RDF', 'Description', 'Creator', 'Producer',
      'CreationDate', 'ModDate', 'Title', 'Author', 'Subject', 'Keywords'
    ];

    for (const seq of sequences) {
      // Skip if it contains PDF metadata keywords
      if (pdfMetadata.some(meta => seq.includes(meta))) continue;

      // Skip sequences that are mostly numbers or look like coordinates
      if (/^\d+(\.\d+)?(\s+\d+(\.\d+)?)*$/.test(seq.trim())) continue;

      // Skip very short sequences or those with binary-looking chars
      if (seq.length < 3 || /[\x00-\x1F\x7F-\x9F]/.test(seq)) continue;

      // Skip sequences that look like hex codes or binary data
      if (/^[0-9A-Fa-f]{4,}$/.test(seq.replace(/\s/g, ''))) continue;

      filtered.push(seq);
    }

    return filtered;
  }

  // Heuristic to combine sequences into a continuous text block
  buildTextFromSequences(seqs) {
    // Join with newline and collapse multiple spaces
    return seqs.join('\n').replace(/\u0000/g, '').replace(/ +/g, ' ').replace(/\n{2,}/g, '\n');
  }

  // Very small helper to normalize names (trim and remove weird chars)
  normalizeName(s) {
    return s.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
  }

  parseMatchDataFromText(text) {
    const lines = text.split(/\n|\r/).map(l => l.trim()).filter(l => l.length > 0);
    const match = {
      teams: [],
      players: [],
      innings: [],
      matchInfo: {}
    };

    // Try to find a line that has vs or v
    for (let i = 0; i < Math.min(40, lines.length); i++) {
      const line = lines[i];
      const m = line.match(/^(.{2,60}?)\s+(?:v(?:s)?\.|vs|v)\s+(.{2,60}?)$/i) || line.match(/^(.{2,60}?)\s+v\s+(.{2,60}?)$/i) || line.match(/^(.{2,60}?)\s+vs\s+(.{2,60}?)$/i);
      if (m) {
        const t1 = this.normalizeName(m[1]);
        const t2 = this.normalizeName(m[2]);
        if (t1 && t2) {
          match.teams.push(t1, t2);
          break;
        }
      }
    }

    // Generic batting line patterns like: "PLAYER_NAME 34 (20)" or "Name 34"
    const battingRegex = /([A-Z][A-Za-z\-\.\' ]{1,60}?)\s+(\d{1,3})\s*\(?([0-9]{1,3})?\)?(?:\s+\(.*?\))?$/;
    // Bowling like: "BowlerName 4.0 0 24 2"
    const bowlingRegex = /([A-Z][A-Za-z\-\.\' ]{1,60}?)\s+(\d+)(?:\.(\d+))?\s+(\d+)\s+(\d+)\s+(\d+)/;

    for (const l of lines) {
      // Look for common labels
      if (!match.matchInfo.title) {
        const titleMatch = l.match(/^(Summary Scorecard|Scorecard|Match Summary)[:\-\s]*?(.*)$/i);
        if (titleMatch) {
          match.matchInfo.title = titleMatch[2] || titleMatch[1];
        }
      }

      // look for date/venue
      if (!match.matchInfo.date) {
        const dateMatch = l.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*\d{2,4})/i);
        if (dateMatch) {
          match.matchInfo.date = dateMatch[0];
        }
      }

      // batting
      const b = l.match(battingRegex);
      if (b) {
        const name = this.normalizeName(b[1]);
        const runs = parseInt(b[2]) || 0;
        const balls = b[3] ? parseInt(b[3]) : null;
        match.players.push({ name, batting: { runs, balls } });
        continue;
      }

      // bowling
      const bw = l.match(bowlingRegex);
      if (bw) {
        const name = this.normalizeName(bw[1]);
        const overs = parseFloat(bw[2] + (bw[3] ? '.' + bw[3] : ''));
        const maidens = parseInt(bw[4]);
        const runs = parseInt(bw[5]);
        const wickets = parseInt(bw[6]);
        match.players.push({ name, bowling: { overs, maidens, runs, wickets } });
        continue;
      }

      // result
      const res = l.match(/(won by|beat|defeated|won)\s+(.*)/i);
      if (res && !match.matchInfo.result) {
        match.matchInfo.result = l;
      }
    }

    return match;
  }

  async run() {
    const files = this.getPdfFiles();
    console.log('PDF files found:', files.length);
    const results = [];

    for (const f of files) {
      const p = path.join(this.reportsDir, f);
      try {
        const buf = fs.readFileSync(p);
        const seqs = this.extractPrintableSequences(buf, 4);
        const filteredSeqs = this.filterCricketContent(seqs);
        const text = this.buildTextFromSequences(filteredSeqs);
        const parsed = this.parseMatchDataFromText(text);
        parsed.fileName = f;
        parsed.rawExtractedTextPreview = text.split('\n').slice(0,200).join('\n');
        results.push(parsed);
        console.log(`Processed ${f} -> Teams: ${parsed.teams.join(' | ') || 'N/A'} Players: ${parsed.players.length}`);
      } catch (err) {
        console.error('Error processing', f, err.message);
      }
    }

    const outPath = path.join(process.cwd(), 'extracted-cricket-data-raw.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
    console.log('Saved extracted JSON to', outPath);
    return results;
  }
}

if (require.main === module) {
  const extractor = new RawPdfTextExtractor();
  extractor.run().catch(err => {
    console.error('Fatal', err);
    process.exit(1);
  });
}
