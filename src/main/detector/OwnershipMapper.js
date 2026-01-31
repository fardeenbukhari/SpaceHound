/**
 * Ownership Mapper
 * 
 * Links folders to the applications that created them using signature matching.
 * Determines folder types (cache, logs, projects, etc.) and provides explanations.
 */

const path = require('path');
const fs = require('fs').promises;
const minimatch = require('minimatch');

class OwnershipMapper {
    constructor(signatureDB) {
        this.signatureDB = signatureDB;
        this.signatures = [];
    }

    /**
     * Initialize by loading all app signatures from database
     */
    async initialize() {
        console.log('[OwnershipMapper] Loading app signatures...');

        this.signatures = await this.signatureDB.getAllSignatures();

        console.log(`[OwnershipMapper] Loaded ${this.signatures.length} app signatures`);
    }

    /**
     * Map a folder to its owning application
     * @param {string} folderPath - Path to analyze
     * @returns {Object} Ownership information
     */
    async mapOwnership(folderPath) {
        const matches = [];

        // Try all matching strategies
        const pathMatches = await this.matchByPath(folderPath);
        matches.push(...pathMatches);

        const markerMatches = await this.matchByFileMarkers(folderPath);
        matches.push(...markerMatches);

        // Sort by confidence and return best match
        matches.sort((a, b) => b.confidence - a.confidence);

        if (matches.length === 0) {
            return this.createUnknownOwnership(folderPath);
        }

        const bestMatch = matches[0];

        // Determine folder type
        const folderType = await this.determineFolderType(folderPath, bestMatch.signature);

        return {
            appName: bestMatch.signature.app_name,
            category: bestMatch.signature.category,
            publisher: bestMatch.signature.publisher,
            confidence: bestMatch.confidence,
            matchType: bestMatch.matchType,
            folderType: folderType.type,
            isRegenerable: folderType.is_regenerable || bestMatch.signature.is_regenerable,
            isSafeToDelete: folderType.is_safe_to_delete,
            explanation: folderType.explanation || bestMatch.signature.description,
            signature: bestMatch.signature
        };
    }

    /**
     * Match folder by path patterns
     */
    async matchByPath(folderPath) {
        const matches = [];
        const normalizedPath = folderPath.replace(/\\/g, '/');

        for (const signature of this.signatures) {
            const pathPatterns = await this.signatureDB.getPathPatterns(signature.id);

            for (const pattern of pathPatterns) {
                const normalizedPattern = pattern.pattern.replace(/\\/g, '/');

                if (minimatch(normalizedPath, normalizedPattern, { nocase: true })) {
                    matches.push({
                        signature: signature,
                        matchType: 'path',
                        confidence: this.calculatePathConfidence(pattern.priority),
                        pattern: pattern.pattern
                    });
                }
            }
        }

        return matches;
    }

    /**
     * Match folder by file markers (identifying files)
     */
    async matchByFileMarkers(folderPath) {
        const matches = [];

        for (const signature of this.signatures) {
            const fileMarkers = await this.signatureDB.getFileMarkers(signature.id);

            if (fileMarkers.length === 0) continue;

            let foundMarkers = 0;
            let requiredMarkers = 0;
            let missingRequired = false;

            for (const marker of fileMarkers) {
                const markerPath = path.join(folderPath, marker.file_path);

                if (marker.is_required) {
                    requiredMarkers++;
                }

                try {
                    await fs.access(markerPath);
                    foundMarkers++;
                } catch (error) {
                    if (marker.is_required) {
                        missingRequired = true;
                        break;
                    }
                }
            }

            // If required markers are missing, skip this signature
            if (missingRequired) {
                continue;
            }

            // Calculate confidence based on marker match ratio
            if (foundMarkers > 0) {
                const confidence = (foundMarkers / fileMarkers.length) * 100;

                matches.push({
                    signature: signature,
                    matchType: 'marker',
                    confidence: confidence,
                    markersFound: foundMarkers,
                    totalMarkers: fileMarkers.length
                });
            }
        }

        return matches;
    }

    /**
     * Calculate confidence score from path pattern priority
     */
    calculatePathConfidence(priority) {
        // Priority ranges from 0-100, map to confidence 50-95
        return 50 + (priority * 0.45);
    }

    /**
     * Determine specific folder type (cache, logs, projects, etc.)
     */
    async determineFolderType(folderPath, signature) {
        const folderTypes = await this.signatureDB.getFolderTypes(signature.id);
        const normalizedPath = folderPath.replace(/\\/g, '/');

        // Try to match against known folder type patterns
        for (const folderType of folderTypes) {
            const normalizedPattern = folderType.path_pattern.replace(/\\/g, '/');

            if (minimatch(normalizedPath, normalizedPattern, { nocase: true })) {
                return folderType;
            }
        }

        // Default to unknown type
        return {
            type: 'unknown',
            is_safe_to_delete: false,
            is_regenerable: signature.is_regenerable,
            explanation: signature.description
        };
    }

    /**
     * Create ownership object for unknown folders
     */
    createUnknownOwnership(folderPath) {
        // Try to extract app name from path
        const pathParts = folderPath.split(path.sep);
        let appName = 'Unknown Application';

        // Look for common app folder locations
        const appFolderIndex = pathParts.findIndex(part =>
            part.toLowerCase() === 'program files' ||
            part.toLowerCase() === 'program files (x86)' ||
            part.toLowerCase() === 'appdata'
        );

        if (appFolderIndex !== -1 && appFolderIndex < pathParts.length - 1) {
            appName = pathParts[appFolderIndex + 1];
        }

        return {
            appName: appName,
            category: 'unknown',
            publisher: null,
            confidence: 20,
            matchType: 'guess',
            folderType: 'unknown',
            isRegenerable: false,
            isSafeToDelete: false,
            explanation: 'Unable to identify the application that created this folder. Review contents before deleting.',
            signature: null
        };
    }

    /**
     * Get human-readable explanation for a folder
     */
    explainFolder(ownership, folderPath) {
        const explanation = {
            what: '',
            why: '',
            impact: ''
        };

        // What is it?
        if (ownership.folderType === 'cache') {
            explanation.what = `Cache files created by ${ownership.appName}`;
        } else if (ownership.folderType === 'logs') {
            explanation.what = `Log files from ${ownership.appName}`;
        } else if (ownership.folderType === 'build') {
            explanation.what = `Build artifacts from ${ownership.appName}`;
        } else if (ownership.folderType === 'projects') {
            explanation.what = `Project files for ${ownership.appName}`;
        } else if (ownership.folderType === 'installer') {
            explanation.what = `Installation files for ${ownership.appName}`;
        } else {
            explanation.what = ownership.explanation || `Files created by ${ownership.appName}`;
        }

        // Why does it exist?
        explanation.why = this.explainWhy(ownership);

        // What happens if deleted?
        explanation.impact = this.explainImpact(ownership);

        return explanation;
    }

    /**
     * Explain why the folder exists
     */
    explainWhy(ownership) {
        switch (ownership.folderType) {
            case 'cache':
                return `${ownership.appName} stores temporary data here to speed up operations. This is automatically created during use.`;

            case 'logs':
                return `${ownership.appName} writes diagnostic logs here for troubleshooting. These accumulate over time.`;

            case 'build':
                return `${ownership.appName} generates these files when compiling or building projects.`;

            case 'projects':
                return `This contains your work created in ${ownership.appName}.`;

            case 'installer':
                return `These files were downloaded or extracted during ${ownership.appName} installation.`;

            default:
                return `${ownership.appName} uses this folder for storing application data.`;
        }
    }

    /**
     * Explain impact of deletion
     */
    explainImpact(ownership) {
        if (ownership.isSafeToDelete && ownership.isRegenerable) {
            return `✅ Safe to delete. ${ownership.appName} will automatically recreate this data when needed. First launch may be slower.`;
        } else if (ownership.isSafeToDelete) {
            return `✅ Safe to delete. This data is no longer needed.`;
        } else if (ownership.folderType === 'projects') {
            return `❌ DO NOT DELETE. This contains your personal work and cannot be recovered.`;
        } else if (ownership.confidence < 50) {
            return `⚠️ Uncertain. Manually verify the contents before deleting.`;
        } else {
            return `⚠️ Review carefully. ${ownership.appName} may need this data to function correctly.`;
        }
    }

    /**
     * Batch process multiple folders
     */
    async mapMultipleFolders(folderPaths, onProgress) {
        const results = [];
        let processed = 0;

        for (const folderPath of folderPaths) {
            const ownership = await this.mapOwnership(folderPath);
            results.push({
                path: folderPath,
                ownership: ownership
            });

            processed++;
            if (onProgress) {
                onProgress({
                    processed: processed,
                    total: folderPaths.length,
                    currentPath: folderPath
                });
            }
        }

        return results;
    }

    /**
     * Get statistics about ownership mapping
     */
    getStatistics(mappedFolders) {
        const stats = {
            total: mappedFolders.length,
            identified: 0,
            unknown: 0,
            byCategory: new Map(),
            byFolderType: new Map(),
            averageConfidence: 0
        };

        let totalConfidence = 0;

        for (const item of mappedFolders) {
            const ownership = item.ownership;

            if (ownership.confidence >= 50) {
                stats.identified++;
            } else {
                stats.unknown++;
            }

            // Count by category
            const category = ownership.category || 'unknown';
            stats.byCategory.set(category, (stats.byCategory.get(category) || 0) + 1);

            // Count by folder type
            const folderType = ownership.folderType || 'unknown';
            stats.byFolderType.set(folderType, (stats.byFolderType.get(folderType) || 0) + 1);

            totalConfidence += ownership.confidence;
        }

        stats.averageConfidence = mappedFolders.length > 0
            ? totalConfidence / mappedFolders.length
            : 0;

        return stats;
    }
}

module.exports = OwnershipMapper;
