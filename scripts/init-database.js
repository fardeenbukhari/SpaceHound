/**
 * Database Initialization Script
 * 
 * Creates the SQLite database from the schema file.
 * Run this before first use: node scripts/init-database.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/signatures.db');
const SCHEMA_PATH = path.join(__dirname, '../data/schema.sql');

console.log('[Init] Initializing Clearner database...');

// Remove existing database if it exists
if (fs.existsSync(DB_PATH)) {
    console.log('[Init] Removing existing database...');
    fs.unlinkSync(DB_PATH);
}

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Read schema
console.log('[Init] Reading schema...');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

// Create database
console.log('[Init] Creating database...');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Execute schema
console.log('[Init] Executing schema...');

try {
    // Execute the entire schema at once - SQLite handles the transaction
    db.exec(schema);
    console.log('[Init] Schema executed successfully');
} catch (error) {
    console.error('[Init] Error executing schema:', error.message);
    throw error;
}

// Verify database
const count = db.prepare('SELECT COUNT(*) as count FROM app_signatures').get();
console.log(`[Init] Database created with ${count.count} app signatures`);

// Get statistics
const stats = {
    signatures: db.prepare('SELECT COUNT(*) as count FROM app_signatures').get().count,
    patterns: db.prepare('SELECT COUNT(*) as count FROM path_patterns').get().count,
    markers: db.prepare('SELECT COUNT(*) as count FROM file_markers').get().count,
    folderTypes: db.prepare('SELECT COUNT(*) as count FROM folder_types').get().count,
    exclusions: db.prepare('SELECT COUNT(*) as count FROM exclusion_patterns').get().count
};

console.log('\n[Init] Database Statistics:');
console.log(`  - App Signatures: ${stats.signatures}`);
console.log(`  - Path Patterns: ${stats.patterns}`);
console.log(`  - File Markers: ${stats.markers}`);
console.log(`  - Folder Types: ${stats.folderTypes}`);
console.log(`  - Exclusion Patterns: ${stats.exclusions}`);

// List categories
const categories = db.prepare(`
  SELECT category, COUNT(*) as count
  FROM app_signatures
  GROUP BY category
  ORDER BY count DESC
`).all();

console.log('\n[Init] Signatures by Category:');
categories.forEach(cat => {
    console.log(`  - ${cat.category}: ${cat.count}`);
});

db.close();

console.log('\n[Init] ✅ Database initialization complete!');
console.log(`[Init] Database location: ${DB_PATH}`);
