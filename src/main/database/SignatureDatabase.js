/**
 * Signature Database Manager
 * 
 * Manages SQLite database of app signatures for ownership mapping.
 * Provides methods to query signatures, patterns, and folder types.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class SignatureDatabase {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(process.cwd(), 'data', 'signatures.db');
        this.db = null;
    }

    /**
     * Initialize database connection
     */
    async initialize() {
        console.log(`[SignatureDB] Initializing database: ${this.dbPath}`);

        // Check if database exists
        const dbExists = fs.existsSync(this.dbPath);

        // Open database connection
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL'); // Better performance

        if (!dbExists) {
            console.log('[SignatureDB] Database not found, creating from schema...');
            await this.createFromSchema();
        }

        // Verify database
        const count = this.db.prepare('SELECT COUNT(*) as count FROM app_signatures').get();
        console.log(`[SignatureDB] Loaded ${count.count} app signatures`);
    }

    /**
     * Create database from schema file
     */
    async createFromSchema() {
        const schemaPath = path.join(process.cwd(), 'data', 'schema.sql');

        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema (split by semicolons and execute each statement)
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            try {
                this.db.exec(statement);
            } catch (error) {
                console.error(`[SignatureDB] Error executing statement: ${error.message}`);
                console.error(`Statement: ${statement.substring(0, 100)}...`);
            }
        }

        console.log('[SignatureDB] Database created successfully');
    }

    /**
     * Get all app signatures
     */
    getAllSignatures() {
        const stmt = this.db.prepare(`
      SELECT * FROM app_signatures
      ORDER BY app_name
    `);

        return stmt.all();
    }

    /**
     * Get signature by ID
     */
    getSignatureById(id) {
        const stmt = this.db.prepare(`
      SELECT * FROM app_signatures WHERE id = ?
    `);

        return stmt.get(id);
    }

    /**
     * Get signatures by category
     */
    getSignaturesByCategory(category) {
        const stmt = this.db.prepare(`
      SELECT * FROM app_signatures
      WHERE category = ?
      ORDER BY app_name
    `);

        return stmt.all(category);
    }

    /**
     * Get path patterns for a signature
     */
    getPathPatterns(signatureId) {
        const stmt = this.db.prepare(`
      SELECT * FROM path_patterns
      WHERE app_signature_id = ?
      ORDER BY priority DESC
    `);

        return stmt.all(signatureId);
    }

    /**
     * Get file markers for a signature
     */
    getFileMarkers(signatureId) {
        const stmt = this.db.prepare(`
      SELECT * FROM file_markers
      WHERE app_signature_id = ?
      ORDER BY is_required DESC
    `);

        return stmt.all(signatureId);
    }

    /**
     * Get registry keys for a signature
     */
    getRegistryKeys(signatureId) {
        const stmt = this.db.prepare(`
      SELECT * FROM registry_keys
      WHERE app_signature_id = ?
    `);

        return stmt.all(signatureId);
    }

    /**
     * Get folder types for a signature
     */
    getFolderTypes(signatureId) {
        const stmt = this.db.prepare(`
      SELECT * FROM folder_types
      WHERE app_signature_id = ?
    `);

        return stmt.all(signatureId);
    }

    /**
     * Get exclusion patterns (protected paths)
     */
    getExclusionPatterns() {
        const stmt = this.db.prepare(`
      SELECT * FROM exclusion_patterns
      ORDER BY severity DESC
    `);

        return stmt.all();
    }

    /**
     * Search signatures by app name
     */
    searchSignatures(query) {
        const stmt = this.db.prepare(`
      SELECT * FROM app_signatures
      WHERE app_name LIKE ? OR publisher LIKE ?
      ORDER BY app_name
    `);

        const searchTerm = `%${query}%`;
        return stmt.all(searchTerm, searchTerm);
    }

    /**
     * Add new app signature
     */
    addSignature(signature) {
        const stmt = this.db.prepare(`
      INSERT INTO app_signatures (
        app_name, category, publisher, is_regenerable, base_risk_level, description
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(
            signature.app_name,
            signature.category,
            signature.publisher || null,
            signature.is_regenerable ? 1 : 0,
            signature.base_risk_level || 'review',
            signature.description || null
        );

        return result.lastInsertRowid;
    }

    /**
     * Add path pattern
     */
    addPathPattern(signatureId, pattern, priority = 50) {
        const stmt = this.db.prepare(`
      INSERT INTO path_patterns (app_signature_id, pattern, priority)
      VALUES (?, ?, ?)
    `);

        return stmt.run(signatureId, pattern, priority);
    }

    /**
     * Add file marker
     */
    addFileMarker(signatureId, filePath, isRequired = false) {
        const stmt = this.db.prepare(`
      INSERT INTO file_markers (app_signature_id, file_path, is_required)
      VALUES (?, ?, ?)
    `);

        return stmt.run(signatureId, filePath, isRequired ? 1 : 0);
    }

    /**
     * Add folder type
     */
    addFolderType(signatureId, folderType) {
        const stmt = this.db.prepare(`
      INSERT INTO folder_types (
        app_signature_id, folder_type, path_pattern, 
        is_safe_to_delete, is_regenerable, explanation
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

        return stmt.run(
            signatureId,
            folderType.folder_type,
            folderType.path_pattern,
            folderType.is_safe_to_delete ? 1 : 0,
            folderType.is_regenerable ? 1 : 0,
            folderType.explanation || null
        );
    }

    /**
     * Get database statistics
     */
    getStatistics() {
        const stats = {
            totalSignatures: 0,
            byCategory: {},
            totalPatterns: 0,
            totalMarkers: 0,
            totalFolderTypes: 0
        };

        // Total signatures
        const sigCount = this.db.prepare('SELECT COUNT(*) as count FROM app_signatures').get();
        stats.totalSignatures = sigCount.count;

        // By category
        const categories = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM app_signatures
      GROUP BY category
    `).all();

        for (const cat of categories) {
            stats.byCategory[cat.category] = cat.count;
        }

        // Total patterns
        const patternCount = this.db.prepare('SELECT COUNT(*) as count FROM path_patterns').get();
        stats.totalPatterns = patternCount.count;

        // Total markers
        const markerCount = this.db.prepare('SELECT COUNT(*) as count FROM file_markers').get();
        stats.totalMarkers = markerCount.count;

        // Total folder types
        const folderTypeCount = this.db.prepare('SELECT COUNT(*) as count FROM folder_types').get();
        stats.totalFolderTypes = folderTypeCount.count;

        return stats;
    }

    /**
     * Export database to JSON
     */
    exportToJSON() {
        const data = {
            signatures: [],
            exclusions: this.getExclusionPatterns()
        };

        const signatures = this.getAllSignatures();

        for (const sig of signatures) {
            data.signatures.push({
                ...sig,
                pathPatterns: this.getPathPatterns(sig.id),
                fileMarkers: this.getFileMarkers(sig.id),
                registryKeys: this.getRegistryKeys(sig.id),
                folderTypes: this.getFolderTypes(sig.id)
            });
        }

        return data;
    }

    /**
     * Import signatures from JSON
     */
    importFromJSON(jsonData) {
        const transaction = this.db.transaction(() => {
            for (const sig of jsonData.signatures) {
                const sigId = this.addSignature(sig);

                // Add path patterns
                for (const pattern of sig.pathPatterns || []) {
                    this.addPathPattern(sigId, pattern.pattern, pattern.priority);
                }

                // Add file markers
                for (const marker of sig.fileMarkers || []) {
                    this.addFileMarker(sigId, marker.file_path, marker.is_required);
                }

                // Add folder types
                for (const folderType of sig.folderTypes || []) {
                    this.addFolderType(sigId, folderType);
                }
            }
        });

        transaction();
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            console.log('[SignatureDB] Database connection closed');
        }
    }

    /**
     * Vacuum database (optimize)
     */
    vacuum() {
        console.log('[SignatureDB] Vacuuming database...');
        this.db.exec('VACUUM');
        console.log('[SignatureDB] Database optimized');
    }
}

module.exports = SignatureDatabase;
