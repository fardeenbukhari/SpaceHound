/**
 * Preload Script
 * 
 * Exposes safe IPC methods to the renderer process via contextBridge.
 * This maintains security while allowing communication with the main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('clearnerAPI', {
    // Scanning
    scanDrive: (targetPath) => ipcRenderer.invoke('scan-drive', targetPath),
    cancelScan: () => ipcRenderer.invoke('cancel-scan'),

    // Deletion
    deleteFolder: (folderPath, metadata) => ipcRenderer.invoke('delete-folder', folderPath, metadata),
    batchDelete: (items) => ipcRenderer.invoke('batch-delete', items),

    // Restoration
    restoreFolder: (deletionId) => ipcRenderer.invoke('restore-folder', deletionId),

    // Quarantine
    getQuarantinedItems: () => ipcRenderer.invoke('get-quarantined-items'),
    getQuarantineStats: () => ipcRenderer.invoke('get-quarantine-stats'),
    permanentDelete: (deletionId) => ipcRenderer.invoke('permanent-delete', deletionId),

    // Database
    getDBStats: () => ipcRenderer.invoke('get-db-stats'),

    // Event listeners
    onScanProgress: (callback) => {
        ipcRenderer.on('scan-progress', (event, data) => callback(data));
    },

    onScanStatus: (callback) => {
        ipcRenderer.on('scan-status', (event, data) => callback(data));
    },

    onAnalysisProgress: (callback) => {
        ipcRenderer.on('analysis-progress', (event, data) => callback(data));
    },

    onDeleteProgress: (callback) => {
        ipcRenderer.on('delete-progress', (event, data) => callback(data));
    },

    onBackendReady: (callback) => {
        ipcRenderer.on('backend-ready', () => callback());
    },

    // Remove listeners
    removeListener: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
