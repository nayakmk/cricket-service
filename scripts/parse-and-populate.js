const fs = require('fs');
const path = require('path');
const { collections, db, admin } = require('../config/database');

const RAW_PATH = path.join(process.cwd(), 'extracted-cricket-data-raw.json');
const OUTPUT_PATH = path.join(process.cwd(), 'extracted-cricket-data-parsed.json');

function dedupePlayers(players) {
  const map = new Map();
  for (const p of players) {
    const n = p.name.replace(/\s+/g, ' ').trim();
    if (!map.has(n)) map.set(n, { name: n, batting: p.batting || null, bowling: p.bowling || null });
    else {
      const existing = map.get(n);
      existing.batting = existing.batting || p.batting;
      existing.bowling = existing.bowling || p.bowling;
    }
  }
  return Array.from(map.values());
}

function heuristicParse(raw) {
  const parsed = [];
  for (const item of raw) {
    const teams = item.teams && item.teams.length ? item.teams : inferTeamsFromText(item.rawExtractedTextPreview);
    const players = dedupePlayers(item.players || []);
    const matchInfo = item.matchInfo || {};
    parsed.push({ fileName: item.fileName, teams, players, matchInfo });
  }
  return parsed;
}

function inferTeamsFromText(textPreview) {
  const lines = textPreview.split(/\n/).slice(0, 50);
  for (const l of lines) {
    const m = l.match(/^(.*?)\s+v(?:s|)\.?\s+(.*?)$/i) || l.match(/^(.*?)\s+vs\s+(.*?)$/i);
    if (m) return [m[1].trim(), m[2].trim()];
  }
  // fallback: look for capitalized words likely team names
  const uniq = new Set();
  for (const l of lines) {
    const words = l.split(/\s+/).filter(w => w.length > 2 && /^[A-Z]/.test(w));
    for (const w of words) uniq.add(w);
  }
  return Array.from(uniq).slice(0,2);
}

async function upsertTeam(teamName) {
  if (!teamName) return null;
  const teamsCol = collections.teams;
  // Try to find existing
  const q = await teamsCol.where('name', '==', teamName).limit(1).get();
  if (!q.empty) return q.docs[0].id;

  const res = await teamsCol.add({ name: teamName, shortName: teamName.split(' ').map(s=>s[0]).slice(0,3).join('').toUpperCase() });
  return res.id;
}

async function upsertPlayer(player) {
  if (!player || !player.name) return null;
  const playersCol = collections.players;
  const q = await playersCol.where('name', '==', player.name).limit(1).get();
  if (!q.empty) return q.docs[0].id;
  const res = await playersCol.add({ name: player.name, stats: {} });
  return res.id;
}

async function populateToFirestore(parsed, options = { dryRun: true }) {
  if (!process.env.POPULATE_FIRESTORE) {
    console.log('POPULATE_FIRESTORE not set. Skipping population (dry-run).');
    options.dryRun = true;
  }

  const results = [];
  for (const m of parsed) {
    const itemRes = { fileName: m.fileName, teams: [], players: [], matchId: null };
    // upsert teams
    for (const t of m.teams) {
      try {
        const teamId = options.dryRun ? `DRY_TEAM_${t}` : await upsertTeam(t);
        itemRes.teams.push({ name: t, id: teamId });
      } catch (err) { console.error('Team upsert error', err); }
    }

    // upsert players
    for (const p of m.players) {
      try {
        const playerId = options.dryRun ? `DRY_PLAYER_${p.name}` : await upsertPlayer(p);
        itemRes.players.push({ name: p.name, id: playerId });
      } catch (err) { console.error('Player upsert error', err); }
    }

    // Create match document
    const matchDoc = {
      title: m.matchInfo.title || m.fileName,
      venue: m.matchInfo.venue || 'Unknown',
      date: m.matchInfo.date || new Date().toISOString(),
      format: 'Box Cricket',
      teamNames: m.teams,
      rawFile: m.fileName
    };

    if (!options.dryRun) {
      try {
        const r = await collections.matches.add(matchDoc);
        itemRes.matchId = r.id;
      } catch (err) { console.error('Match insert error', err); }
    } else {
      itemRes.matchId = `DRY_MATCH_${m.fileName}`;
    }

    results.push(itemRes);
  }
  return results;
}

async function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error('Raw extraction file not found:', RAW_PATH);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  const parsed = heuristicParse(raw);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(parsed, null, 2), 'utf8');
  console.log('Parsed data written to', OUTPUT_PATH);

  const populate = await populateToFirestore(parsed, { dryRun: true });
  const populatePath = path.join(process.cwd(), 'populate-dry-run.json');
  fs.writeFileSync(populatePath, JSON.stringify(populate, null, 2), 'utf8');
  console.log('Dry-run populate results written to', populatePath);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
