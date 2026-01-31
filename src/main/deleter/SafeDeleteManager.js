/**
 * Safe Delete Manager
 * 
 * Manages reversible deletion with quarantine system and undo capability.
 * Never permanently deletes - always moves to quarantine with 30-day retention.
 */

const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

class SafeDeleteManager {
    constructor(options = {}) {
        this.quarantineDir = options.quarantineDir || path.join(process.cwd(), 'data', 'quarantine');
        this.manifestPath = path.join(this.quarantineDir, 'manifest.json');
        this.retentionDays = options.retentionDays || 30;
        this.manifest = { deletions: [] };
    }

    /**
     * Initialize the delete manager
     */
    async initialize() {
        console.log('[SafeDeleteManager] Initializing...');

        // Create quarantine directory if it doesn't exist
        await fs.mkdir(this.quarantineDir, { recursive: true });

        // Load existing manifest
        await this.loadManifest();

        // Clean up expired deletions
        await this.cleanupExpired();

        console.log(`[SafeDeleteManager] Loaded ${this.manifest.deletions.length} quarantined items`);
    }

    /**
     * Load manifest from disk
     */
    async loadManifest() {
        try {
            const data = await fs.readFile(this.manifestPath, 'utf8');
            this.manifest = JSON.parse(data);
        } catch (error) {
            // Manifest doesn't exist yet - create new one
            this.manifest = { deletions: [] };
            await this.saveManifest();
        }
    }

    /**
     * Save manifest to disk
     */
    async saveManifest() {
        await fs.writeFile(
            this.manifestPath,
            JSON.stringify(this.manifest, null, 2),
            'utf8'
        );
    }

    /**
     * Safely delete a folder by moving it to quarantine
     * @param {string} folderPath - Path to delete
     * @param {Object} metadata - Metadata about the folder
     * @returns {Object} Deletion result with ID
     */
    async safeDelete(folderPath, metadata = {}) {
        console.log(`[SafeDeleteManager] Deleting: ${folderPath}`);

        // Verify folder exists
        try {
            await fs.access(folderPath);
        } catch (error) {
            throw new Error(`Folder does not exist: ${folderPath}`);
        }

        // Generate deletion ID
        const deletionId = this.generateDeletionId(folderPath);
        const quarantinePath = path.join(this.quarantineDir, 'deletions', deletionId);

        try {
            // Create quarantine folder
            await fs.mkdir(quarantinePath, { recursive: true });

            // Calculate size before moving
            const size = await this.calculateFolderSize(folderPath);

            // Move folder to quarantine (faster than copy+delete)
            const filesPath = path.join(quarantinePath, 'files');

            console.log(`[SafeDeleteManager] Moving to quarantine: ${filesPath}`);

            // Use robocopy for reliable move on Windows
            await this.moveFolder(folderPath, filesPath);

            // Create metadata file
            const deletionMetadata = {
                id: deletionId,
                timestamp: new Date().toISOString(),
                originalPath: folderPath,
                size: size,
                appName: metadata.appName || 'Unknown',
                folderType: metadata.folderType || 'unknown',
                safetyScore: metadata.safetyScore || 0,
                canRestore: true,
                expiresAt: this.calculateExpirationDate(),
                ...metadata
            };

            await fs.writeFile(
                path.join(quarantinePath, 'metadata.json'),
                JSON.stringify(deletionMetadata, null, 2),
                'utf8'
            );

            // Add to manifest
            this.manifest.deletions.push(deletionMetadata);
            await this.saveManifest();

            console.log(`[SafeDeleteManager] Successfully quarantined: ${deletionId}`);

            return {
                success: true,
                deletionId: deletionId,
                size: size,
                expiresAt: deletionMetadata.expiresAt
            };

        } catch (error) {
            // Rollback if something went wrong
            console.error(`[SafeDeleteManager] Error during deletion:`, error);

            try {
                await fs.rm(quarantinePath, { recursive: true, force: true });
            } catch (rollbackError) {
                console.error('[SafeDeleteManager] Rollback failed:', rollbackError);
            }

            throw new Error(`Failed to delete folder: ${error.message}`);
        }
    }

    /**
     * Move folder using robocopy (Windows)
     */
    async moveFolder(sourcePath, destPath) {
        try {
            // Use robocopy for reliable move
            // /E = copy subdirectories including empty ones
            // /MOVE = move files (delete from source)
            // /NFL /NDL /NJH /NJS /NC /NS = minimal output
            const command = `robocopy "${sourcePath}" "${destPath}" /E /MOVE /NFL /NDL /NJH /NJS /NC /NS`;

            await execAsync(command);

            // robocopy returns exit code 1 for successful copy, so we ignore it
            // Only throw if the destination doesn't exist
            await fs.access(destPath);

            // Remove source directory if it still exists (robocopy may leave empty folder)
            try {
                await fs.rmdir(sourcePath);
            } catch (e) {
                // Folder may already be removed
            }

        } catch (error) {
            // Fallback to manual move if robocopy fails
            console.warn('[SafeDeleteManager] Robocopy failed, using fallback method');
            await fs.rename(sourcePath, destPath);
        }
    }

    /**
     * Restore a deleted folder
     * @param {string} deletionId - ID of the deletion to restore
     * @returns {Object} Restore result
     */
    async restore(deletionId) {
        console.log(`[SafeDeleteManager] Restoring: ${deletionId}`);

        // Find deletion in manifest
        const deletion = this.manifest.deletions.find(d => d.id === deletionId);

        if (!deletion) {
            throw new Error(`Deletion not found: ${deletionId}`);
        }

        const quarantinePath = path.join(this.quarantineDir, 'deletions', deletionId);
        const filesPath = path.join(quarantinePath, 'files');

        // Check if quarantined files exist
        try {
            await fs.access(filesPath);
        } catch (error) {
            throw new Error(`Quarantined files not found for: ${deletionId}`);
        }

        // Check if original path is available
        try {
            await fs.access(deletion.originalPath);
            throw new Error(`Original path already exists: ${deletion.originalPath}`);
        } catch (error) {
            // Good - path doesn't exist, we can restore
            if (error.message.includes('already exists')) {
                throw error;
            }
        }

        try {
            // Ensure parent directory exists
            const parentDir = path.dirname(deletion.originalPath);
            await fs.mkdir(parentDir, { recursive: true });

            // Move files back to original location
            await this.moveFolder(filesPath, deletion.originalPath);

            // Remove from quarantine
            await fs.rm(quarantinePath, { recursive: true, force: true });

            // Remove from manifest
            this.manifest.deletions = this.manifest.deletions.filter(d => d.id !== deletionId);
            await this.saveManifest();

            console.log(`[SafeDeleteManager] Successfully restored: ${deletionId}`);

            return {
                success: true,
                restoredPath: deletion.originalPath,
                size: deletion.size
            };

        } catch (error) {
            throw new Error(`Failed to restore folder: ${error.message}`);
        }
    }

    /**
     * Permanently delete a quarantined item (cannot be undone)
     */
    async permanentlyDelete(deletionId) {
        console.log(`[SafeDeleteManager] Permanently deleting: ${deletionId}`);

        const deletion = this.manifest.deletions.find(d => d.id === deletionId);

        if (!deletion) {
            throw new Error(`Deletion not found: ${deletionId}`);
        }

        const quarantinePath = path.join(this.quarantineDir, 'deletions', deletionId);

        try {
            // Permanently delete files
            await fs.rm(quarantinePath, { recursive: true, force: true });

            // Remove from manifest
            this.manifest.deletions = this.manifest.deletions.filter(d => d.id !== deletionId);
            await this.saveManifest();

            console.log(`[SafeDeleteManager] Permanently deleted: ${deletionId}`);

            return {
                success: true,
                freedSpace: deletion.size
            };

        } catch (error) {
            throw new Error(`Failed to permanently delete: ${error.message}`);
        }
    }

    /**
     * Clean up expired deletions
     */
    async cleanupExpired() {
        const now = new Date();
        const expiredDeletions = this.manifest.deletions.filter(d => {
            const expiresAt = new Date(d.expiresAt);
            return expiresAt < now;
        });

        console.log(`[SafeDeleteManager] Cleaning up ${expiredDeletions.length} expired items`);

        for (const deletion of expiredDeletions) {
            try {
                await this.permanentlyDelete(deletion.id);
            } catch (error) {
                console.error(`[SafeDeleteManager] Failed to cleanup ${deletion.id}:`, error.message);
            }
        }
    }

    /**
     * Get list of all quarantined items
     */
    getQuarantinedItems() {
        return this.manifest.deletions.map(d => ({
            ...d,
            daysUntilExpiration: this.getDaysUntilExpiration(d.expiresAt)
        }));
    }

    /**
     * Get quarantine statistics
     */
    getStatistics() {
        const totalSize = this.manifest.deletions.reduce((sum, d) => sum + d.size, 0);
        const expiringToday = this.manifest.deletions.filter(d =>
            this.getDaysUntilExpiration(d.expiresAt) === 0
        ).length;

        return {
            totalItems: this.manifest.deletions.length,
            totalSize: totalSize,
            expiringToday: expiringToday,
            oldestDeletion: this.manifest.deletions.length > 0
                ? this.manifest.deletions.reduce((oldest, d) =>
                    new Date(d.timestamp) < new Date(oldest.timestamp) ? d : oldest
                ).timestamp
                : null
        };
    }

    /**
     * Generate unique deletion ID
     */
    generateDeletionId(folderPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const folderName = path.basename(folderPath).replace(/[^a-zA-Z0-9]/g, '_');
        return `${timestamp}_${folderName}`;
    }

    /**
     * Calculate expiration date
     */
    calculateExpirationDate() {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.retentionDays);
        return expiresAt.toISOString();
    }

    /**
     * Calculate days until expiration
     */
    getDaysUntilExpiration(expiresAt) {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diffMs = expires - now;
        return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    /**
     * Calculate folder size recursively
     */
    async calculateFolderSize(folderPath) {
        let totalSize = 0;

        try {
            const entries = await fs.readdir(folderPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(folderPath, entry.name);

                if (entry.isDirectory()) {
                    totalSize += await this.calculateFolderSize(fullPath);
                } else if (entry.isFile()) {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            console.debug(`[SafeDeleteManager] Error calculating size: ${error.message}`);
        }

        return totalSize;
    }

    /**
     * Format bytes to human-readable size
     */
    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Batch delete multiple folders
     */
    async batchDelete(items, onProgress) {
        const results = [];
        let processed = 0;
        let totalFreed = 0;

        for (const item of items) {
            try {
                const result = await this.safeDelete(item.path, item.metadata);
                results.push({
                    path: item.path,
                    success: true,
                    deletionId: result.deletionId,
                    size: result.size
                });
                totalFreed += result.size;
            } catch (error) {
                results.push({
                    path: item.path,
                    success: false,
                    error: error.message
                });
            }

            processed++;
            if (onProgress) {
                onProgress({
                    processed: processed,
                    total: items.length,
                    totalFreed: totalFreed
                });
            }
        }

        return {
            results: results,
            totalFreed: totalFreed,
            successCount: results.filter(r => r.success).length,
            failureCount: results.filter(r => !r.success).length
        };
    }
}

module.exports = SafeDeleteManager;
