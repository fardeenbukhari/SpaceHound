/**
 * Clearner - Frontend Application
 * 
 * Handles UI interactions and communicates with the backend via IPC.
 */

// State management
const state = {
    scanResults: [],
    currentView: 'overview',
    isScanning: false,
    selectedDrive: 'C:\\'
};

// DOM elements
const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),

    // Header
    driveSelect: document.getElementById('drive-select'),
    scanButton: document.getElementById('scan-button'),
    headerStats: document.getElementById('header-stats'),

    // Stats
    totalSize: document.getElementById('total-size'),
    safeSize: document.getElementById('safe-size'),
    residueSize: document.getElementById('residue-size'),
    safeCount: document.getElementById('safe-count'),
    residueCount: document.getElementById('residue-count'),
    quarantineCount: document.getElementById('quarantine-count'),

    // Overview
    welcomeScreen: document.getElementById('welcome-screen'),
    scanProgress: document.getElementById('scan-progress'),
    overviewResults: document.getElementById('overview-results'),
    startScanBtn: document.getElementById('start-scan-btn'),

    // Progress
    scanStatusTitle: document.getElementById('scan-status-title'),
    scanStatusMessage: document.getElementById('scan-status-message'),
    progressFill: document.getElementById('progress-fill'),
    progressDetail: document.getElementById('progress-detail'),

    // Lists
    biggestList: document.getElementById('biggest-list'),
    safeCleanupList: document.getElementById('safe-cleanup-list'),
    leftoversList: document.getElementById('leftovers-list'),
    quarantineList: document.getElementById('quarantine-list'),

    // Database
    dbSignatureCount: document.getElementById('db-signature-count'),

    // Modal
    modal: document.getElementById('folder-modal'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close')
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadDatabaseStats();
    loadQuarantineStats();
});

// Listen for backend ready
window.clearnerAPI.onBackendReady(() => {
    console.log('[Frontend] Backend ready');
});

function initializeEventListeners() {
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // Scan controls
    elements.scanButton.addEventListener('click', startScan);
    elements.startScanBtn.addEventListener('click', startScan);
    elements.driveSelect.addEventListener('change', (e) => {
        state.selectedDrive = e.target.value;
    });

    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });

    // View switchers
    document.querySelectorAll('[data-view-switch]').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.viewSwitch;
            switchView(view);
        });
    });

    // Bulk actions
    const deleteAllSafeBtn = document.getElementById('delete-all-safe');
    if (deleteAllSafeBtn) {
        deleteAllSafeBtn.addEventListener('click', deleteAllSafe);
    }
}

// ============================================================================
// VIEW MANAGEMENT
// ============================================================================

function switchView(viewName) {
    // Update navigation
    elements.navItems.forEach(item => {
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update views
    elements.views.forEach(view => {
        if (view.id === `view-${viewName}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    state.currentView = viewName;

    // Load view-specific data
    if (viewName === 'quarantine') {
        loadQuarantineItems();
    }
}

// ============================================================================
// SCANNING
// ============================================================================

async function startScan() {
    if (state.isScanning) return;

    state.isScanning = true;
    elements.scanButton.disabled = true;

    // Show progress screen
    elements.welcomeScreen.style.display = 'none';
    elements.scanProgress.style.display = 'flex';
    elements.overviewResults.style.display = 'none';

    try {
        const result = await window.clearnerAPI.scanDrive(state.selectedDrive);

        if (result.success) {
            state.scanResults = result.data.results;
            displayScanResults(result.data);
        } else {
            showError('Scan failed: ' + result.error);
        }
    } catch (error) {
        showError('Scan error: ' + error.message);
    } finally {
        state.isScanning = false;
        elements.scanButton.disabled = false;
    }
}

// Listen for scan progress
window.clearnerAPI.onScanProgress((progress) => {
    elements.progressDetail.textContent = `${progress.scanned} folders scanned`;
});

window.clearnerAPI.onScanStatus((status) => {
    elements.scanStatusTitle.textContent = status.message;
    if (status.stage === 'scanning') {
        elements.progressFill.style.width = '30%';
    } else if (status.stage === 'analyzing') {
        elements.progressFill.style.width = '70%';
    }
});

window.clearnerAPI.onAnalysisProgress((progress) => {
    const percent = (progress.processed / progress.total) * 30 + 70;
    elements.progressFill.style.width = `${percent}%`;
});

// ============================================================================
// DISPLAY RESULTS
// ============================================================================

function displayScanResults(data) {
    const { results, summary } = data;

    // Hide progress, show results
    elements.scanProgress.style.display = 'none';
    elements.overviewResults.style.display = 'block';
    elements.headerStats.style.display = 'flex';

    // Update header stats
    elements.totalSize.textContent = formatSize(summary.totalSize);
    elements.safeSize.textContent = formatSize(summary.safeToDeleteSize);
    elements.residueSize.textContent = formatSize(summary.residueSize);

    // Update sidebar badges
    elements.safeCount.textContent = summary.safeToDelete;
    elements.residueCount.textContent = summary.residueItems;

    // Update overview cards
    document.getElementById('overview-safe-size').textContent = formatSize(summary.safeToDeleteSize);
    document.getElementById('overview-safe-count').textContent = `${summary.safeToDelete} items`;
    document.getElementById('overview-residue-size').textContent = formatSize(summary.residueSize);
    document.getElementById('overview-residue-count').textContent = `${summary.residueItems} items`;
    document.getElementById('overview-largest-size').textContent = formatSize(results[0]?.totalSize || 0);
    document.getElementById('overview-largest-count').textContent = `${Math.min(10, results.length)} items`;

    // Populate lists
    populateBiggestList(results);
    populateSafeCleanupList(results);
    populateLeftoversList(results);
}

function populateBiggestList(results) {
    const sorted = [...results].sort((a, b) => b.totalSize - a.totalSize);
    const top20 = sorted.slice(0, 20);

    elements.biggestList.innerHTML = top20.map(item => createFolderCard(item)).join('');
    attachFolderCardListeners(elements.biggestList);
}

function populateSafeCleanupList(results) {
    const safe = results.filter(item => item.safety.level === 'safe');
    const sorted = safe.sort((a, b) => b.totalSize - a.totalSize);

    if (sorted.length === 0) {
        elements.safeCleanupList.innerHTML = '<div class="empty-state"><p>No safe items found</p></div>';
        return;
    }

    elements.safeCleanupList.innerHTML = sorted.map(item => createFolderCard(item)).join('');
    attachFolderCardListeners(elements.safeCleanupList);
}

function populateLeftoversList(results) {
    const leftovers = results.filter(item => item.residue.isResidue);
    const sorted = leftovers.sort((a, b) => b.totalSize - a.totalSize);

    if (sorted.length === 0) {
        elements.leftoversList.innerHTML = '<div class="empty-state"><p>No leftover data found</p></div>';
        return;
    }

    elements.leftoversList.innerHTML = sorted.map(item => createFolderCard(item)).join('');
    attachFolderCardListeners(elements.leftoversList);
}

function createFolderCard(item) {
    const safetyBadgeClass = item.safety.level === 'safe' ? 'safe' :
        item.safety.level === 'review' ? 'warning' : 'critical';

    return `
    <div class="folder-item" data-path="${escapeHtml(item.path)}">
      <div class="folder-header">
        <div class="folder-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H12L10 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="folder-info">
          <div class="folder-name">${escapeHtml(item.ownership.appName)}</div>
          <div class="folder-path">${escapeHtml(item.path)}</div>
        </div>
        <div class="folder-size">${formatSize(item.totalSize)}</div>
      </div>
      
      <div class="folder-meta">
        <span class="meta-badge ${safetyBadgeClass}">${item.safety.badge}</span>
        <span class="meta-badge">${item.ownership.folderType}</span>
        <span class="meta-badge">${item.fileCount} files</span>
        ${item.residue.isResidue ? '<span class="meta-badge warning">Leftover Data</span>' : ''}
      </div>
      
      <div class="folder-explanation">
        ${escapeHtml(item.explanation.what)}
        <br><br>
        <strong>Why:</strong> ${escapeHtml(item.explanation.why)}
        <br><br>
        <strong>Impact:</strong> ${escapeHtml(item.explanation.impact)}
      </div>
      
      <div class="folder-actions">
        <button class="btn btn-secondary view-details-btn">View Details</button>
        ${item.safety.canDelete ? '<button class="btn btn-primary delete-btn">Delete</button>' : ''}
      </div>
    </div>
  `;
}

function attachFolderCardListeners(container) {
    container.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.folder-item');
            const path = card.dataset.path;
            const item = state.scanResults.find(r => r.path === path);
            showFolderDetails(item);
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const card = e.target.closest('.folder-item');
            const path = card.dataset.path;
            const item = state.scanResults.find(r => r.path === path);
            await deleteFolder(item);
        });
    });
}

// ============================================================================
// FOLDER ACTIONS
// ============================================================================

async function deleteFolder(item) {
    if (!confirm(`Are you sure you want to delete:\n\n${item.path}\n\nSize: ${formatSize(item.totalSize)}\n\nThis will be moved to quarantine and can be restored within 30 days.`)) {
        return;
    }

    try {
        const result = await window.clearnerAPI.deleteFolder(item.path, {
            appName: item.ownership.appName,
            folderType: item.ownership.folderType,
            safetyScore: item.safety.score
        });

        if (result.success) {
            showSuccess(`Deleted ${formatSize(result.data.size)}. Can be restored from "Recently Deleted" within 30 days.`);

            // Remove from current view
            state.scanResults = state.scanResults.filter(r => r.path !== item.path);

            // Refresh current view
            if (state.currentView === 'biggest') {
                populateBiggestList(state.scanResults);
            } else if (state.currentView === 'safe-cleanup') {
                populateSafeCleanupList(state.scanResults);
            } else if (state.currentView === 'leftovers') {
                populateLeftoversList(state.scanResults);
            }

            // Update quarantine count
            loadQuarantineStats();
        } else {
            showError('Delete failed: ' + result.error);
        }
    } catch (error) {
        showError('Delete error: ' + error.message);
    }
}

async function deleteAllSafe() {
    const safeItems = state.scanResults.filter(item => item.safety.level === 'safe');

    if (safeItems.length === 0) {
        showError('No safe items to delete');
        return;
    }

    const totalSize = safeItems.reduce((sum, item) => sum + item.totalSize, 0);

    if (!confirm(`Delete all ${safeItems.length} safe items?\n\nTotal size: ${formatSize(totalSize)}\n\nAll items will be moved to quarantine and can be restored within 30 days.`)) {
        return;
    }

    try {
        const items = safeItems.map(item => ({
            path: item.path,
            metadata: {
                appName: item.ownership.appName,
                folderType: item.ownership.folderType,
                safetyScore: item.safety.score
            }
        }));

        const result = await window.clearnerAPI.batchDelete(items);

        if (result.success) {
            showSuccess(`Deleted ${result.data.successCount} items, freed ${formatSize(result.data.totalFreed)}`);

            // Refresh scan
            startScan();
        } else {
            showError('Batch delete failed: ' + result.error);
        }
    } catch (error) {
        showError('Batch delete error: ' + error.message);
    }
}

// ============================================================================
// QUARANTINE
// ============================================================================

async function loadQuarantineItems() {
    try {
        const result = await window.clearnerAPI.getQuarantinedItems();

        if (result.success) {
            displayQuarantineItems(result.data);
        }
    } catch (error) {
        console.error('Failed to load quarantine items:', error);
    }
}

async function loadQuarantineStats() {
    try {
        const result = await window.clearnerAPI.getQuarantineStats();

        if (result.success) {
            elements.quarantineCount.textContent = result.data.totalItems;
        }
    } catch (error) {
        console.error('Failed to load quarantine stats:', error);
    }
}

function displayQuarantineItems(items) {
    if (items.length === 0) {
        elements.quarantineList.innerHTML = '<div class="empty-state"><p>No items in quarantine</p></div>';
        return;
    }

    elements.quarantineList.innerHTML = items.map(item => `
    <div class="folder-item">
      <div class="folder-header">
        <div class="folder-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M10 3V10M10 10L14 6M10 10L6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 10V15C4 16.1046 4.89543 17 6 17H14C15.1046 17 16 16.1046 16 15V10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="folder-info">
          <div class="folder-name">${escapeHtml(item.appName)}</div>
          <div class="folder-path">${escapeHtml(item.originalPath)}</div>
        </div>
        <div class="folder-size">${formatSize(item.size)}</div>
      </div>
      
      <div class="folder-meta">
        <span class="meta-badge info">Expires in ${item.daysUntilExpiration} days</span>
        <span class="meta-badge">${item.folderType}</span>
      </div>
      
      <div class="folder-actions">
        <button class="btn btn-primary restore-btn" data-id="${item.id}">Restore</button>
        <button class="btn btn-secondary permanent-delete-btn" data-id="${item.id}">Permanent Delete</button>
      </div>
    </div>
  `).join('');

    // Attach listeners
    elements.quarantineList.querySelectorAll('.restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await restoreFolder(id);
        });
    });

    elements.quarantineList.querySelectorAll('.permanent-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await permanentDelete(id);
        });
    });
}

async function restoreFolder(deletionId) {
    if (!confirm('Restore this folder to its original location?')) {
        return;
    }

    try {
        const result = await window.clearnerAPI.restoreFolder(deletionId);

        if (result.success) {
            showSuccess(`Restored ${formatSize(result.data.size)} to ${result.data.restoredPath}`);
            loadQuarantineItems();
            loadQuarantineStats();
        } else {
            showError('Restore failed: ' + result.error);
        }
    } catch (error) {
        showError('Restore error: ' + error.message);
    }
}

async function permanentDelete(deletionId) {
    if (!confirm('Permanently delete this item? This CANNOT be undone!')) {
        return;
    }

    try {
        const result = await window.clearnerAPI.permanentDelete(deletionId);

        if (result.success) {
            showSuccess(`Permanently deleted, freed ${formatSize(result.data.freedSpace)}`);
            loadQuarantineItems();
            loadQuarantineStats();
        } else {
            showError('Permanent delete failed: ' + result.error);
        }
    } catch (error) {
        showError('Permanent delete error: ' + error.message);
    }
}

// ============================================================================
// DATABASE
// ============================================================================

async function loadDatabaseStats() {
    try {
        const result = await window.clearnerAPI.getDBStats();

        if (result.success) {
            elements.dbSignatureCount.textContent = `${result.data.totalSignatures} apps recognized`;
        }
    } catch (error) {
        elements.dbSignatureCount.textContent = 'Error loading';
    }
}

// ============================================================================
// MODAL
// ============================================================================

function showFolderDetails(item) {
    elements.modalBody.innerHTML = `
    <h2>${escapeHtml(item.ownership.appName)}</h2>
    <p style="color: var(--text-tertiary); margin-bottom: 2rem;">${escapeHtml(item.path)}</p>
    
    <div style="margin-bottom: 2rem;">
      <h3 style="margin-bottom: 1rem;">Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem 0; color: var(--text-secondary);">Size</td>
          <td style="padding: 0.75rem 0; text-align: right; font-weight: 600;">${formatSize(item.totalSize)}</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem 0; color: var(--text-secondary);">Files</td>
          <td style="padding: 0.75rem 0; text-align: right; font-weight: 600;">${item.fileCount.toLocaleString()}</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem 0; color: var(--text-secondary);">Type</td>
          <td style="padding: 0.75rem 0; text-align: right; font-weight: 600;">${item.ownership.folderType}</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem 0; color: var(--text-secondary);">Safety</td>
          <td style="padding: 0.75rem 0; text-align: right; font-weight: 600;">${item.safety.badge}</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.75rem 0; color: var(--text-secondary);">Confidence</td>
          <td style="padding: 0.75rem 0; text-align: right; font-weight: 600;">${item.safety.score}%</td>
        </tr>
      </table>
    </div>
    
    <div style="margin-bottom: 2rem;">
      <h3 style="margin-bottom: 1rem;">Explanation</h3>
      <div style="padding: 1rem; background: rgba(99, 102, 241, 0.05); border-radius: 0.5rem; line-height: 1.6;">
        <p style="margin-bottom: 1rem;"><strong>What:</strong> ${escapeHtml(item.explanation.what)}</p>
        <p style="margin-bottom: 1rem;"><strong>Why:</strong> ${escapeHtml(item.explanation.why)}</p>
        <p><strong>Impact:</strong> ${escapeHtml(item.explanation.impact)}</p>
      </div>
    </div>
    
    ${item.safety.reasons.length > 0 ? `
      <div style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">Safety Reasons</h3>
        <ul style="list-style: none; padding: 0;">
          ${item.safety.reasons.map(reason => `
            <li style="padding: 0.5rem 0; color: var(--text-secondary);">✓ ${escapeHtml(reason)}</li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
    
    ${item.safety.warnings.length > 0 ? `
      <div style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem; color: var(--warning);">Warnings</h3>
        <ul style="list-style: none; padding: 0;">
          ${item.safety.warnings.map(warning => `
            <li style="padding: 0.5rem 0; color: var(--warning);">⚠ ${escapeHtml(warning)}</li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
  `;

    elements.modal.classList.add('active');
}

function closeModal() {
    elements.modal.classList.remove('active');
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}
