/**
 * Clearner - Main Process
 * 
 * Electron main process that orchestrates all backend components
 * and provides IPC communication with the renderer process.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import core components
const DiskScanner = require('./scanner/DiskScanner');
const SignatureDatabase = require('./database/SignatureDatabase');
const OwnershipMapper = require('./detector/OwnershipMapper');
const ResidueDetector = require('./detector/ResidueDetector');
const SafetyClassifier = require('./classifier/SafetyClassifier');
const SafeDeleteManager = require('./deleter/SafeDeleteManager');

// Global instances
let mainWindow = null;
let signatureDB = null;
let scanner = null;
let ownershipMapper = null;
let residueDetector = null;
let safetyClassifier = null;
let deleteManager = null;

/**
 * Create main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#0f0f0f',
        show: false // Show after ready
    });

    // Load the UI
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Initialize all backend components
 */
async function initializeComponents() {
    console.log('[Main] Initializing components...');

    try {
        // Initialize signature database
        signatureDB = new SignatureDatabase();
        await signatureDB.initialize();

        // Initialize ownership mapper
        ownershipMapper = new OwnershipMapper(signatureDB);
        await ownershipMapper.initialize();

        // Initialize residue detector
        residueDetector = new ResidueDetector(signatureDB);
        await residueDetector.initialize();

        // Initialize safety classifier
        safetyClassifier = new SafetyClassifier();

        // Initialize delete manager
        deleteManager = new SafeDeleteManager();
        await deleteManager.initialize();

        // Initialize scanner
        scanner = new DiskScanner({
            minFolderSize: 100 * 1024 * 1024, // 100 MB
            onProgress: (progress) => {
                if (mainWindow) {
                    mainWindow.webContents.send('scan-progress', progress);
                }
            }
        });

        console.log('[Main] All components initialized successfully');

        // Send ready event to renderer
        if (mainWindow) {
            mainWindow.webContents.send('backend-ready');
        }

    } catch (error) {
        console.error('[Main] Failed to initialize components:', error);
        throw error;
    }
}

/**
 * Perform full disk scan and analysis
 */
async function performScan(targetPath) {
    console.log(`[Main] Starting scan of: ${targetPath}`);

    try {
        // Step 1: Scan disk
        mainWindow.webContents.send('scan-status', {
            stage: 'scanning',
            message: 'Scanning disk...'
        });

        const scanResults = await scanner.scan(targetPath);
        console.log(`[Main] Found ${scanResults.length} large folders`);

        // Step 2: Map ownership
        mainWindow.webContents.send('scan-status', {
            stage: 'analyzing',
            message: 'Identifying app ownership...'
        });

        const enrichedResults = [];

        for (let i = 0; i < scanResults.length; i++) {
            const folder = scanResults[i];

            // Map ownership
            const ownership = await ownershipMapper.mapOwnership(folder.path);

            // Detect residue
            const residue = residueDetector.detectResidue(folder.path, ownership);

            // Classify safety
            const safety = await safetyClassifier.classify(
                folder.path,
                ownership,
                folder,
                residue
            );

            // Generate explanation
            const explanation = ownershipMapper.explainFolder(ownership, folder.path);

            enrichedResults.push({
                ...folder,
                ownership,
                residue,
                safety,
                explanation
            });

            // Send progress
            if (i % 10 === 0) {
                mainWindow.webContents.send('analysis-progress', {
                    processed: i + 1,
                    total: scanResults.length
                });
            }
        }

        // Step 3: Generate summary
        const summary = {
            totalFolders: enrichedResults.length,
            totalSize: enrichedResults.reduce((sum, f) => sum + f.totalSize, 0),
            safeToDelete: enrichedResults.filter(f => f.safety.level === 'safe').length,
            safeToDeleteSize: enrichedResults
                .filter(f => f.safety.level === 'safe')
                .reduce((sum, f) => sum + f.totalSize, 0),
            residueItems: enrichedResults.filter(f => f.residue.isResidue).length,
            residueSize: enrichedResults
                .filter(f => f.residue.isResidue)
                .reduce((sum, f) => sum + f.totalSize, 0),
            categories: {}
        };

        // Count by category
        for (const item of enrichedResults) {
            const cat = item.ownership.category || 'unknown';
            if (!summary.categories[cat]) {
                summary.categories[cat] = { count: 0, size: 0 };
            }
            summary.categories[cat].count++;
            summary.categories[cat].size += item.totalSize;
        }

        console.log('[Main] Scan complete');

        return {
            results: enrichedResults,
            summary: summary
        };

    } catch (error) {
        console.error('[Main] Scan failed:', error);
        throw error;
    }
}

// ============================================================================
// IPC Handlers
// ============================================================================

/**
 * Handle scan request
 */
ipcMain.handle('scan-drive', async (event, targetPath) => {
    try {
        const result = await performScan(targetPath);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Handle delete request
 */
ipcMain.handle('delete-folder', async (event, folderPath, metadata) => {
    try {
        const result = await deleteManager.safeDelete(folderPath, metadata);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Handle batch delete request
 */
ipcMain.handle('batch-delete', async (event, items) => {
    try {
        const result = await deleteManager.batchDelete(items, (progress) => {
            mainWindow.webContents.send('delete-progress', progress);
        });
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Handle restore request
 */
ipcMain.handle('restore-folder', async (event, deletionId) => {
    try {
        const result = await deleteManager.restore(deletionId);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Get quarantined items
 */
ipcMain.handle('get-quarantined-items', async () => {
    try {
        const items = deleteManager.getQuarantinedItems();
        return { success: true, data: items };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Get quarantine statistics
 */
ipcMain.handle('get-quarantine-stats', async () => {
    try {
        const stats = deleteManager.getStatistics();
        return { success: true, data: stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Permanently delete quarantined item
 */
ipcMain.handle('permanent-delete', async (event, deletionId) => {
    try {
        const result = await deleteManager.permanentlyDelete(deletionId);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Get database statistics
 */
ipcMain.handle('get-db-stats', async () => {
    try {
        const stats = signatureDB.getStatistics();
        return { success: true, data: stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Cancel ongoing scan
 */
ipcMain.handle('cancel-scan', async () => {
    if (scanner) {
        scanner.cancel();
    }
    return { success: true };
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(async () => {
    createWindow();
    await initializeComponents();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Close database connection
        if (signatureDB) {
            signatureDB.close();
        }
        app.quit();
    }
});

app.on('before-quit', () => {
    // Cleanup
    if (signatureDB) {
        signatureDB.close();
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});
