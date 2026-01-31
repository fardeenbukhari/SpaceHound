/**
 * Safety Classification Engine
 * 
 * Assesses deletion risk with confidence scores and provides detailed reasoning.
 * Classification levels: Safe (90-100%), Review (50-89%), Critical (0-49%)
 */

const path = require('path');
const fs = require('fs').promises;

class SafetyClassifier {
    constructor(options = {}) {
        this.options = {
            documentExtensions: ['.docx', '.xlsx', '.pptx', '.pdf', '.txt', '.doc', '.xls', '.ppt'],
            mediaExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.avi', '.mp3', '.wav'],
            codeExtensions: ['.js', '.ts', '.py', '.java', '.cpp', '.cs', '.go', '.rs'],
            ...options
        };

        // System-critical paths that should NEVER be deleted
        this.protectedPaths = [
            'c:\\windows',
            'c:\\program files\\windowsapps',
            'c:\\programdata\\microsoft\\windows',
            'c:\\system volume information',
            'c:\\$recycle.bin',
            'c:\\recovery',
            'c:\\perflogs'
        ];

        // User data paths that require extra caution
        this.userDataPaths = [
            'documents',
            'pictures',
            'videos',
            'music',
            'desktop',
            'downloads'
        ];
    }

    /**
     * Classify safety of deleting a folder
     * @param {string} folderPath - Path to classify
     * @param {Object} ownership - Ownership info from OwnershipMapper
     * @param {Object} fileStats - File statistics (size, count, dates)
     * @param {Object} residue - Residue detection info
     * @returns {Object} Safety classification with score and reasons
     */
    async classify(folderPath, ownership, fileStats, residue = null) {
        let score = 50; // baseline neutral
        const reasons = [];
        const warnings = [];

        // === CRITICAL CHECKS (Can set score to 0) ===

        // Check 1: Protected system paths
        if (this.isProtectedPath(folderPath)) {
            return {
                score: 0,
                level: 'critical',
                badge: '❌ System Critical',
                reasons: ['This is a Windows system folder'],
                warnings: ['NEVER delete this folder - it is required for Windows to function'],
                canDelete: false
            };
        }

        // Check 2: User data paths
        if (this.isUserDataPath(folderPath)) {
            score -= 30;
            warnings.push('This folder may contain your personal files');
        }

        // === OWNERSHIP ANALYSIS ===

        // Check 3: Ownership confidence
        if (ownership.confidence >= 80) {
            score += 20;
            reasons.push('Clearly identified app ownership');
        } else if (ownership.confidence >= 50) {
            score += 10;
            reasons.push('App ownership identified with moderate confidence');
        } else {
            score -= 10;
            warnings.push('Unable to clearly identify which app owns this folder');
        }

        // Check 4: Folder type
        switch (ownership.folderType) {
            case 'cache':
                score += 30;
                reasons.push('Cache files are regenerable');
                break;

            case 'logs':
                score += 25;
                reasons.push('Log files are safe to delete');
                break;

            case 'build':
                score += 25;
                reasons.push('Build artifacts can be regenerated');
                break;

            case 'temp':
                score += 30;
                reasons.push('Temporary files are safe to remove');
                break;

            case 'installer':
                score += 15;
                reasons.push('Installer files are no longer needed after installation');
                break;

            case 'projects':
                score -= 40;
                warnings.push('Contains user-created content - may be irreplaceable');
                break;

            case 'config':
                score -= 20;
                warnings.push('Contains configuration settings');
                break;

            default:
                score -= 5;
                warnings.push('Folder type is unclear');
        }

        // Check 5: Regenerable flag
        if (ownership.isRegenerable) {
            score += 15;
            reasons.push('Data can be automatically regenerated');
        }

        // === RESIDUE ANALYSIS ===

        // Check 6: Uninstalled app residue
        if (residue && residue.isResidue) {
            score += 20;
            reasons.push(`${ownership.appName} is no longer installed`);
        } else if (residue && !residue.isResidue) {
            score -= 10;
            warnings.push(`${ownership.appName} is currently installed and may need this data`);
        }

        // === FILE ANALYSIS ===

        // Check 7: Last access time
        const daysSinceAccess = this.getDaysSince(fileStats.lastAccessed);
        if (daysSinceAccess > 365) {
            score += 15;
            reasons.push('Not accessed in over a year');
        } else if (daysSinceAccess > 180) {
            score += 10;
            reasons.push('Not accessed in over 6 months');
        } else if (daysSinceAccess < 7) {
            score -= 10;
            warnings.push('Recently accessed - may be actively used');
        }

        // Check 8: File content analysis
        const contentAnalysis = await this.analyzeFileContent(folderPath);

        if (contentAnalysis.hasDocuments) {
            score -= 25;
            warnings.push('Contains document files');
        }

        if (contentAnalysis.hasMedia) {
            score -= 15;
            warnings.push('Contains media files (photos/videos)');
        }

        if (contentAnalysis.hasSourceCode) {
            score -= 20;
            warnings.push('Contains source code files');
        }

        // Check 9: Size consideration
        if (fileStats.totalSize > 10 * 1024 * 1024 * 1024) { // > 10 GB
            reasons.push(`Large folder (${this.formatSize(fileStats.totalSize)}) - significant space savings`);
        }

        // === FINAL SCORING ===

        // Clamp score to 0-100
        score = Math.max(0, Math.min(100, score));

        // Determine level
        let level, badge, canDelete;
        if (score >= 90) {
            level = 'safe';
            badge = '✅ Safe to delete';
            canDelete = true;
        } else if (score >= 70) {
            level = 'safe';
            badge = '✅ Probably safe';
            canDelete = true;
        } else if (score >= 50) {
            level = 'review';
            badge = '⚠️ Review before deleting';
            canDelete = true;
        } else if (score >= 30) {
            level = 'review';
            badge = '⚠️ Caution advised';
            canDelete = true;
        } else {
            level = 'critical';
            badge = '❌ Do not delete';
            canDelete = false;
        }

        return {
            score: Math.round(score),
            level: level,
            badge: badge,
            reasons: reasons,
            warnings: warnings,
            canDelete: canDelete,
            explanation: this.generateExplanation(score, ownership, residue)
        };
    }

    /**
     * Check if path is system-protected
     */
    isProtectedPath(folderPath) {
        const normalized = folderPath.toLowerCase();

        for (const protectedPath of this.protectedPaths) {
            if (normalized.startsWith(protectedPath)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if path contains user data
     */
    isUserDataPath(folderPath) {
        const normalized = folderPath.toLowerCase();

        for (const userPath of this.userDataPaths) {
            if (normalized.includes(`\\${userPath}\\`) || normalized.endsWith(`\\${userPath}`)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Analyze file content types in folder
     */
    async analyzeFileContent(folderPath, sampleSize = 100) {
        const analysis = {
            hasDocuments: false,
            hasMedia: false,
            hasSourceCode: false,
            fileTypes: new Map()
        };

        try {
            const files = await this.sampleFiles(folderPath, sampleSize);

            for (const file of files) {
                const ext = path.extname(file).toLowerCase();

                // Count file types
                analysis.fileTypes.set(ext, (analysis.fileTypes.get(ext) || 0) + 1);

                // Check categories
                if (this.options.documentExtensions.includes(ext)) {
                    analysis.hasDocuments = true;
                }
                if (this.options.mediaExtensions.includes(ext)) {
                    analysis.hasMedia = true;
                }
                if (this.options.codeExtensions.includes(ext)) {
                    analysis.hasSourceCode = true;
                }
            }
        } catch (error) {
            console.debug(`[SafetyClassifier] Could not analyze folder content: ${error.message}`);
        }

        return analysis;
    }

    /**
     * Sample files from folder (for performance)
     */
    async sampleFiles(folderPath, maxFiles) {
        const files = [];

        try {
            const entries = await fs.readdir(folderPath, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length >= maxFiles) break;

                const fullPath = path.join(folderPath, entry.name);

                if (entry.isFile()) {
                    files.push(fullPath);
                } else if (entry.isDirectory()) {
                    // Recursively sample subdirectories
                    const subFiles = await this.sampleFiles(fullPath, maxFiles - files.length);
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            // Folder may be inaccessible
        }

        return files;
    }

    /**
     * Calculate days since a date
     */
    getDaysSince(date) {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Generate human-readable explanation
     */
    generateExplanation(score, ownership, residue) {
        if (score >= 90) {
            if (residue && residue.isResidue) {
                return `${score}% safe — ${ownership.appName} is not installed, and this data is no longer needed.`;
            } else if (ownership.isRegenerable) {
                return `${score}% safe — regenerable ${ownership.folderType} files created by ${ownership.appName}.`;
            } else {
                return `${score}% safe — ${ownership.folderType} files that are safe to remove.`;
            }
        } else if (score >= 50) {
            return `${score}% confidence — review the contents before deleting. ${ownership.appName} may need this data.`;
        } else {
            return `${score}% confidence — deletion not recommended. This folder may be important.`;
        }
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

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Batch classify multiple folders
     */
    async classifyMultiple(items, onProgress) {
        const results = [];
        let processed = 0;

        for (const item of items) {
            const classification = await this.classify(
                item.path,
                item.ownership,
                item.fileStats,
                item.residue
            );

            results.push({
                ...item,
                safety: classification
            });

            processed++;
            if (onProgress) {
                onProgress({
                    processed: processed,
                    total: items.length
                });
            }
        }

        return results;
    }

    /**
     * Get summary statistics
     */
    getSummary(classifiedItems) {
        const summary = {
            total: classifiedItems.length,
            safe: 0,
            review: 0,
            critical: 0,
            totalSize: 0,
            safeToDeleteSize: 0
        };

        for (const item of classifiedItems) {
            summary.totalSize += item.fileStats.totalSize;

            if (item.safety.level === 'safe') {
                summary.safe++;
                summary.safeToDeleteSize += item.fileStats.totalSize;
            } else if (item.safety.level === 'review') {
                summary.review++;
            } else {
                summary.critical++;
            }
        }

        return summary;
    }
}

module.exports = SafetyClassifier;
