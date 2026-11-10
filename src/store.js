// Simple JSON-file storage. Data lives in data/db.json (or GRAMMA_DATA_DIR).
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { getSeedData } = require('./seed');

const DATA_DIR = process.env.GRAMMA_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    // Only pre-seed when not in automated test mode
    if (!process.env.GRAMMA_DATA_DIR) {
      try {
        const seed = getSeedData();
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
        return seed;
      } catch (e) {
        console.warn('Seed initialization error:', e.message);
      }
    }
    return { users: [], jobs: [], appointments: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read db.json, starting with empty data:', err.message);
    return { users: [], jobs: [], appointments: [] };
  }
}

const db = load();

// Write to a temp file first, then rename, so a crash never leaves a half-written file.
function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

module.exports = { db, save, newId: () => randomUUID() };
