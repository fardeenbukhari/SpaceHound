/**
 * Residue Detection System
 * 
 * Identifies orphaned data from uninstalled applications by comparing
 * folder signatures against the list of currently installed apps.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

class ResidueDetector {
    constructor(signatureDB) {
        this.signatureDB = signatureDB;
        this.installedApps = [];
        this.installedAppsMap = new Map();
    }

    /**
     * Initialize by loading list of installed applications
     */
    async initialize() {
        console.log('[ResidueDetector] Loading installed applications...');

        this.installedApps = await this.getInstalledApplications();

        // Create lookup map for faster searching
        this.installedAppsMap.clear();
        for (const app of this.installedApps) {
            const normalizedName = this.normalizeAppName(app.name);
            this.installedAppsMap.set(normalizedName, app);
        }

        console.log(`[ResidueDetector] Found ${this.installedApps.length} installed applications`);
    }

    /**
     * Get list of installed applications from Windows Registry and UWP
     */
    async getInstalledApplications() {
        const apps = [];

        // Get Win32 apps from Registry
        const registryApps = await this.getRegistryApps();
        apps.push(...registryApps);

        // Get UWP apps
        const uwpApps = await this.getUWPApps();
        apps.push(...uwpApps);

        // Deduplicate by name
        const uniqueApps = Array.from(
            new Map(apps.map(app => [app.name.toLowerCase(), app])).values()
        );

        return uniqueApps;
    }

    /**
     * Get installed apps from Windows Registry
     */
    async getRegistryApps() {
        const apps = [];

        // Registry paths to check
        const registryPaths = [
            'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
            'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
        ];

        for (const regPath of registryPaths) {
            try {
                // Query registry for subkeys
                const { stdout: subkeys } = await execAsync(`reg query "${regPath}"`);

                const keyPaths = subkeys
                    .split('\n')
                    .filter(line => line.trim().startsWith('HKEY'))
                    .map(line => line.trim());

                // Query each subkey for DisplayName
                for (const keyPath of keyPaths) {
                    try {
                        const { stdout: values } = await execAsync(`reg query "${keyPath}" /v DisplayName`);

                        const nameMatch = values.match(/DisplayName\s+REG_SZ\s+(.+)/);
                        if (nameMatch && nameMatch[1]) {
                            const appName = nameMatch[1].trim();

                            // Try to get install location
                            let installLocation = null;
                            try {
                                const { stdout: locValues } = await execAsync(`reg query "${keyPath}" /v InstallLocation`);
                                const locMatch = locValues.match(/InstallLocation\s+REG_SZ\s+(.+)/);
                                if (locMatch && locMatch[1]) {
                                    installLocation = locMatch[1].trim();
                                }
                            } catch (e) {
                                // InstallLocation not always present
                            }

                            apps.push({
                                name: appName,
                                installLocation: installLocation,
                                source: 'registry',
                                registryKey: keyPath
                            });
                        }
                    } catch (error) {
                        // Skip keys without DisplayName
                    }
                }
            } catch (error) {
                console.warn(`[ResidueDetector] Failed to query ${regPath}:`, error.message);
            }
        }

        return apps;
    }

    /**
     * Get installed UWP apps using PowerShell
     */
    async getUWPApps() {
        const apps = [];

        try {
            const psScript = `
        Get-AppxPackage | 
        Select-Object Name, InstallLocation | 
        ConvertTo-Json -Compress
      `;

            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`,
                { maxBuffer: 10 * 1024 * 1024 }
            );

            const uwpApps = JSON.parse(stdout);

            for (const uwpApp of uwpApps) {
                apps.push({
                    name: uwpApp.Name,
                    installLocation: uwpApp.InstallLocation,
                    source: 'uwp'
                });
            }
        } catch (error) {
            console.warn('[ResidueDetector] Failed to get UWP apps:', error.message);
        }

        return apps;
    }

    /**
     * Detect if a folder is residue from an uninstalled app
     * @param {string} folderPath - Path to check
     * @param {Object} ownership - Ownership info from OwnershipMapper
     * @returns {Object} Residue detection result
     */
    detectResidue(folderPath, ownership) {
        if (!ownership || !ownership.appName) {
            return {
                isResidue: false,
                confidence: 0,
                reason: 'Unknown ownership'
            };
        }

        // Check if app is currently installed
        const normalizedAppName = this.normalizeAppName(ownership.appName);
        const isInstalled = this.installedAppsMap.has(normalizedAppName);

        if (isInstalled) {
            return {
                isResidue: false,
                confidence: 0,
                reason: `${ownership.appName} is currently installed`,
                installedApp: this.installedAppsMap.get(normalizedAppName)
            };
        }

        // App is not installed - this is likely residue
        const confidence = this.calculateResidueConfidence(folderPath, ownership);

        return {
            isResidue: true,
            confidence: confidence,
            appName: ownership.appName,
            reason: this.generateResidueReason(ownership, confidence),
            recommendation: this.generateResidueRecommendation(ownership, confidence)
        };
    }

    /**
     * Calculate confidence that this is actually residue
     */
    calculateResidueConfidence(folderPath, ownership) {
        let confidence = 50; // baseline

        // Factor 1: Ownership match confidence
        confidence += ownership.confidence * 30;

        // Factor 2: Known app signature
        if (ownership.matchType === 'signature') {
            confidence += 20;
        }

        // Factor 3: Typical residue locations
        const residueLocations = [
            'appdata\\local',
            'appdata\\roaming',
            'programdata',
            'users\\public'
        ];

        const normalizedPath = folderPath.toLowerCase();
        for (const location of residueLocations) {
            if (normalizedPath.includes(location)) {
                confidence += 10;
                break;
            }
        }

        // Factor 4: Folder type
        if (ownership.folderType === 'cache' || ownership.folderType === 'logs') {
            confidence += 15;
        } else if (ownership.folderType === 'projects') {
            confidence -= 20; // Less likely to be safe residue
        }

        // Clamp to 0-100
        return Math.max(0, Math.min(100, confidence));
    }

    /**
     * Generate human-readable reason for residue detection
     */
    generateResidueReason(ownership, confidence) {
        const appName = ownership.appName;

        if (confidence >= 80) {
            return `${appName} is not installed, but this data was left behind. This is common when apps don't clean up during uninstallation.`;
        } else if (confidence >= 50) {
            return `${appName} appears to be uninstalled, but verification is uncertain. This folder may be leftover data.`;
        } else {
            return `This folder may be related to ${appName}, but it's unclear if the app is actually uninstalled.`;
        }
    }

    /**
     * Generate recommendation for handling residue
     */
    generateResidueRecommendation(ownership, confidence) {
        if (confidence >= 80 && ownership.isRegenerable) {
            return `✅ Safe to delete - ${ownership.appName} will recreate this data if reinstalled.`;
        } else if (confidence >= 80) {
            return `✅ Safe to delete - ${ownership.appName} is no longer installed.`;
        } else if (confidence >= 50) {
            return `⚠️ Review before deleting - verify that ${ownership.appName} is not needed.`;
        } else {
            return `⚠️ Uncertain - manually verify before deleting.`;
        }
    }

    /**
     * Normalize app name for comparison (fuzzy matching)
     */
    normalizeAppName(appName) {
        return appName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove special chars
            .replace(/\s+/g, ''); // Remove whitespace
    }

    /**
     * Fuzzy match app names (handles variations like "Unreal Engine 5" vs "UnrealEngine")
     */
    fuzzyMatchAppName(name1, name2) {
        const normalized1 = this.normalizeAppName(name1);
        const normalized2 = this.normalizeAppName(name2);

        // Exact match
        if (normalized1 === normalized2) {
            return true;
        }

        // Substring match
        if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
            return true;
        }

        // Levenshtein distance check (simple version)
        const distance = this.levenshteinDistance(normalized1, normalized2);
        const maxLength = Math.max(normalized1.length, normalized2.length);
        const similarity = 1 - (distance / maxLength);

        return similarity >= 0.8; // 80% similarity threshold
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Get summary of all detected residue
     */
    getSummary(scanResults) {
        const residueItems = scanResults.filter(item => item.residue && item.residue.isResidue);

        const totalSize = residueItems.reduce((sum, item) => sum + item.totalSize, 0);
        const appCounts = new Map();

        for (const item of residueItems) {
            const appName = item.residue.appName;
            if (!appCounts.has(appName)) {
                appCounts.set(appName, { count: 0, size: 0 });
            }
            const stats = appCounts.get(appName);
            stats.count += 1;
            stats.size += item.totalSize;
        }

        return {
            totalItems: residueItems.length,
            totalSize: totalSize,
            affectedApps: Array.from(appCounts.entries()).map(([appName, stats]) => ({
                appName,
                folderCount: stats.count,
                totalSize: stats.size
            })).sort((a, b) => b.totalSize - a.totalSize)
        };
    }
}

module.exports = ResidueDetector;
