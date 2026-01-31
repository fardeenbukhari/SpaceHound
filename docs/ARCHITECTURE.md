# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │ Biggest  │ Safe     │ Leftover │ System Files         │  │
│  │ Folders  │ Cleanup  │ Apps     │ (Do Not Touch)       │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Scan Orchestrator                                   │   │
│  │  ├─ Disk Scanner                                     │   │
│  │  ├─ Residue Detector                                 │   │
│  │  ├─ Ownership Mapper                                 │   │
│  │  ├─ Safety Classifier                                │   │
│  │  ├─ Impact Simulator                                 │   │
│  │  └─ Delete Manager                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┬──────────────┬──────────────────────┐     │
│  │ Signature DB │ Scan Cache   │ Quarantine Storage   │     │
│  │ (SQLite)     │ (JSON)       │ (File System)        │     │
│  └──────────────┴──────────────┴──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   System Integration Layer                   │
│  ┌──────────────┬──────────────┬──────────────────────┐     │
│  │ Windows API  │ Registry     │ File System          │     │
│  │ (MFT Scan)   │ (Apps List)  │ (NTFS)               │     │
│  └──────────────┴──────────────┴──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Disk Scanner Engine

**Purpose**: Fast, accurate disk space analysis

**Implementation**:
- **Primary Method**: NTFS MFT (Master File Table) scanning
  - Direct access to file system metadata
  - 10-100x faster than recursive scanning
  - Requires admin privileges
  
- **Fallback Method**: Recursive directory traversal
  - Used when MFT access fails
  - Standard file system APIs
  - Works without admin rights

**Output**:
```javascript
{
  path: "C:\\Users\\Username\\AppData\\Local\\UnrealEngine",
  totalSize: 51234567890,  // bytes
  fileCount: 12847,
  lastAccessed: "2025-12-15T10:30:00Z",
  lastModified: "2025-12-15T10:30:00Z",
  depth: 4
}
```

**Algorithm**:
1. Enumerate all drives
2. For each NTFS drive:
   - Try MFT scanning (fast path)
   - Fall back to recursive scan if MFT fails
3. Build folder tree with aggregated sizes
4. Cache results for incremental updates

---

### 2. Residue Detection System

**Purpose**: Identify orphaned data from uninstalled applications

**Data Sources**:
1. **Windows Registry**:
   - `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
   - `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`
   - `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`

2. **Windows Apps** (UWP):
   - PowerShell: `Get-AppxPackage`

3. **Known Installation Paths**:
   - `C:\Program Files`
   - `C:\Program Files (x86)`
   - Steam, Epic Games, etc.

**Detection Algorithm**:
```javascript
function detectResidue(folderPath, installedApps, signatureDB) {
  // 1. Extract app name from path
  const appName = extractAppName(folderPath);
  
  // 2. Check if app is installed
  const isInstalled = installedApps.some(app => 
    fuzzyMatch(app.name, appName)
  );
  
  // 3. Check signature database
  const signature = signatureDB.findMatch(folderPath);
  
  // 4. Determine if residue
  if (!isInstalled && signature) {
    return {
      isResidue: true,
      appName: signature.appName,
      confidence: calculateConfidence(folderPath, signature)
    };
  }
  
  return { isResidue: false };
}
```

**Example Output**:
```
"Unreal Engine is not installed, but 48.6 GB of data remains on disk."
```

---

### 3. Ownership Mapping System

**Purpose**: Link folders to the applications that created them

**Signature Database Schema**:
```sql
CREATE TABLE app_signatures (
  id INTEGER PRIMARY KEY,
  app_name TEXT NOT NULL,
  category TEXT,  -- 'game_engine', 'ide', 'browser', etc.
  path_patterns TEXT,  -- JSON array of glob patterns
  file_markers TEXT,   -- JSON array of identifying files
  registry_keys TEXT,  -- JSON array of registry paths
  is_regenerable BOOLEAN,
  risk_level TEXT,  -- 'safe', 'review', 'critical'
  explanation TEXT
);

CREATE TABLE folder_types (
  id INTEGER PRIMARY KEY,
  app_signature_id INTEGER,
  folder_type TEXT,  -- 'cache', 'logs', 'build', 'projects', 'installer'
  path_pattern TEXT,
  description TEXT,
  is_safe_to_delete BOOLEAN,
  FOREIGN KEY (app_signature_id) REFERENCES app_signatures(id)
);
```

**Matching Algorithm**:
```javascript
function mapOwnership(folderPath, signatureDB) {
  const matches = [];
  
  // 1. Path pattern matching
  for (const signature of signatureDB.getAllSignatures()) {
    for (const pattern of signature.pathPatterns) {
      if (minimatch(folderPath, pattern)) {
        matches.push({
          signature,
          matchType: 'path',
          confidence: 0.7
        });
      }
    }
  }
  
  // 2. File marker detection
  for (const signature of signatureDB.getAllSignatures()) {
    const markerCount = signature.fileMarkers.filter(marker =>
      fs.existsSync(path.join(folderPath, marker))
    ).length;
    
    if (markerCount > 0) {
      matches.push({
        signature,
        matchType: 'marker',
        confidence: markerCount / signature.fileMarkers.length
      });
    }
  }
  
  // 3. Registry key verification
  // ... similar logic
  
  // 4. Return best match
  return matches.sort((a, b) => b.confidence - a.confidence)[0];
}
```

**Example Signatures** (see `data/signatures.json` for full list):

```json
{
  "appName": "Unreal Engine",
  "category": "game_engine",
  "pathPatterns": [
    "**/UnrealEngine/**",
    "**/Epic Games/UE_*/**",
    "**/.uproject"
  ],
  "fileMarkers": [
    "Engine/Binaries/Win64/UE4Editor.exe",
    "Engine/Build/Build.version"
  ],
  "folderTypes": [
    {
      "type": "cache",
      "pattern": "**/Saved/Cooked/**",
      "safeToDelete": true,
      "explanation": "Cooked asset cache - regenerated on next build"
    },
    {
      "type": "build",
      "pattern": "**/Intermediate/**",
      "safeToDelete": true,
      "explanation": "Build artifacts - regenerated on next compile"
    },
    {
      "type": "projects",
      "pattern": "**/Content/**",
      "safeToDelete": false,
      "explanation": "User project files - contains your work"
    }
  ]
}
```

---

### 4. Safety Classification Engine

**Purpose**: Assess deletion risk with confidence scores

**Classification Levels**:
- ✅ **Safe** (90-100%): Cache, logs, temp files, regenerable data
- ⚠️ **Review** (50-89%): Old backups, downloads, installer files
- ❌ **Critical** (0-49%): System files, user documents, active app data

**Scoring Algorithm**:
```javascript
function classifySafety(folderPath, ownership, fileStats) {
  let score = 50; // baseline
  const reasons = [];
  
  // Factor 1: Ownership confidence
  if (ownership.confidence > 0.8) {
    score += 20;
    reasons.push("Clearly identified app ownership");
  }
  
  // Factor 2: Folder type
  if (ownership.folderType === 'cache') {
    score += 30;
    reasons.push("Cache files are regenerable");
  } else if (ownership.folderType === 'projects') {
    score -= 40;
    reasons.push("Contains user-created content");
  }
  
  // Factor 3: System path protection
  const systemPaths = [
    'C:\\Windows',
    'C:\\Program Files\\WindowsApps',
    'C:\\ProgramData\\Microsoft'
  ];
  
  if (systemPaths.some(p => folderPath.startsWith(p))) {
    score = 0;
    reasons.push("System-critical path");
  }
  
  // Factor 4: Last access time
  const daysSinceAccess = (Date.now() - fileStats.lastAccessed) / (1000 * 60 * 60 * 24);
  if (daysSinceAccess > 180) {
    score += 10;
    reasons.push("Not accessed in 6+ months");
  }
  
  // Factor 5: File extensions
  const hasUserDocs = containsExtensions(folderPath, ['.docx', '.xlsx', '.pdf']);
  if (hasUserDocs) {
    score -= 30;
    reasons.push("Contains document files");
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    level: score >= 90 ? 'safe' : score >= 50 ? 'review' : 'critical',
    reasons
  };
}
```

**Output Example**:
```javascript
{
  score: 92,
  level: 'safe',
  badge: '✅ Safe to delete',
  reasons: [
    "Clearly identified app ownership",
    "Cache files are regenerable",
    "Not accessed in 6+ months"
  ],
  explanation: "92% safe — regenerable cache files created by Unreal Engine."
}
```

---

### 5. Deletion Impact Simulator

**Purpose**: Predict consequences before deletion

**Analysis**:
```javascript
function simulateImpact(folderPath, ownership, installedApps) {
  const impact = {
    spaceFreed: calculateSize(folderPath),
    affectedApps: [],
    canRegenerate: false,
    userDataLoss: false,
    warnings: []
  };
  
  // Check if app is installed
  const app = installedApps.find(a => a.name === ownership.appName);
  
  if (app) {
    impact.affectedApps.push(app.name);
    
    if (ownership.isRegenerable) {
      impact.canRegenerate = true;
      impact.warnings.push(
        `${app.name} will rebuild this data if needed (may take time)`
      );
    } else {
      impact.warnings.push(
        `${app.name} may not function correctly after deletion`
      );
    }
  } else {
    impact.warnings.push(
      `${ownership.appName} is not installed - safe to remove`
    );
  }
  
  // Check for user data
  if (ownership.folderType === 'projects' || ownership.folderType === 'documents') {
    impact.userDataLoss = true;
    impact.warnings.push(
      '⚠️ WARNING: This folder may contain your personal files'
    );
  }
  
  return impact;
}
```

**UI Display**:
```
┌─────────────────────────────────────────────────────┐
│ Deletion Impact Preview                             │
├─────────────────────────────────────────────────────┤
│ Space to be freed: 46.7 GB                          │
│                                                      │
│ ✅ Unreal Engine will rebuild this data if          │
│    reinstalled (shader cache)                       │
│                                                      │
│ ⚠️  First launch may be slower while cache rebuilds │
│                                                      │
│ [ Cancel ]  [ Move to Quarantine ]                  │
└─────────────────────────────────────────────────────┘
```

---

### 6. Safe Delete Manager

**Purpose**: Reversible deletion with undo capability

**Quarantine Structure**:
```
data/quarantine/
├── manifest.json
└── deletions/
    ├── 2026-01-31_193045_UnrealEngine_Cache/
    │   ├── metadata.json
    │   └── files/
    │       └── [original folder structure]
    └── 2026-01-30_141230_Steam_Logs/
        ├── metadata.json
        └── files/
```

**Manifest Schema**:
```json
{
  "deletions": [
    {
      "id": "2026-01-31_193045_UnrealEngine_Cache",
      "timestamp": "2026-01-31T19:30:45Z",
      "originalPath": "C:\\Users\\User\\AppData\\Local\\UnrealEngine\\Common\\DerivedDataCache",
      "size": 50234567890,
      "appName": "Unreal Engine",
      "safetyScore": 95,
      "canRestore": true,
      "expiresAt": "2026-03-02T19:30:45Z"
    }
  ]
}
```

**Delete Operation**:
```javascript
async function safeDelete(folderPath, metadata) {
  const deletionId = generateDeletionId(folderPath);
  const quarantinePath = path.join(QUARANTINE_DIR, deletionId);
  
  // 1. Create quarantine folder
  await fs.mkdir(quarantinePath, { recursive: true });
  
  // 2. Move files (not copy - saves space)
  await fs.rename(folderPath, path.join(quarantinePath, 'files'));
  
  // 3. Save metadata
  await fs.writeFile(
    path.join(quarantinePath, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // 4. Update manifest
  await updateManifest(deletionId, metadata);
  
  // 5. Schedule auto-cleanup (30 days)
  scheduleExpiration(deletionId, 30);
  
  return deletionId;
}
```

**Restore Operation**:
```javascript
async function restore(deletionId) {
  const quarantinePath = path.join(QUARANTINE_DIR, deletionId);
  const metadata = await loadMetadata(deletionId);
  
  // 1. Check if original path is available
  if (await fs.exists(metadata.originalPath)) {
    throw new Error('Original path already exists');
  }
  
  // 2. Move files back
  await fs.rename(
    path.join(quarantinePath, 'files'),
    metadata.originalPath
  );
  
  // 3. Remove from quarantine
  await fs.rm(quarantinePath, { recursive: true });
  
  // 4. Update manifest
  await removeFromManifest(deletionId);
}
```

---

### 7. Explainability System

**Purpose**: Replace technical jargon with human language

**Translation Examples**:

| Technical Path | Human Explanation |
|---------------|-------------------|
| `C:\Users\User\AppData\Local\UnrealEngine\Common\DerivedDataCache` | "Unreal Engine's shader cache - speeds up project loading. Regenerated automatically when needed." |
| `C:\Program Files (x86)\Steam\steamapps\shadercache` | "Steam's graphics shader cache. Games will rebuild this on first launch after deletion." |
| `C:\Users\User\AppData\Local\Temp` | "Windows temporary files - safe to delete. Used by apps for short-term storage." |
| `C:\Windows\Installer` | "⚠️ Windows installer database - needed to uninstall/repair programs. Do not delete." |

**Context Provider**:
```javascript
function explainFolder(folderPath, ownership, safety) {
  const explanation = {
    what: "",
    why: "",
    impact: ""
  };
  
  // What is it?
  explanation.what = ownership.explanation || 
    `Files created by ${ownership.appName}`;
  
  // Why does it exist?
  if (ownership.isResidue) {
    explanation.why = `${ownership.appName} was uninstalled, but this data was left behind. Windows doesn't always clean up app data during uninstallation.`;
  } else {
    explanation.why = `${ownership.appName} is installed and uses this folder for ${ownership.folderType}.`;
  }
  
  // What happens if deleted?
  if (safety.level === 'safe') {
    explanation.impact = ownership.isRegenerable ?
      `${ownership.appName} will automatically recreate this data when needed.` :
      `This data is no longer needed and can be safely removed.`;
  } else if (safety.level === 'review') {
    explanation.impact = `Review the contents before deleting. May contain files you want to keep.`;
  } else {
    explanation.impact = `⚠️ DO NOT DELETE. This is required for ${ownership.appName} or Windows to function correctly.`;
  }
  
  return explanation;
}
```

---

## Data Flow

### Scan Flow
```
User clicks "Scan Drive C:"
  ↓
Disk Scanner starts
  ↓
For each large folder found:
  ├─→ Residue Detector checks if app is uninstalled
  ├─→ Ownership Mapper identifies which app owns it
  ├─→ Safety Classifier assigns risk score
  └─→ Explainability System generates human description
  ↓
Results displayed in UI with:
  - Size
  - App name
  - Safety badge
  - Explanation
  - Action buttons
```

### Delete Flow
```
User clicks "Delete" on a folder
  ↓
Impact Simulator shows preview:
  - Space to be freed
  - Affected apps
  - Warnings
  ↓
User confirms
  ↓
Safe Delete Manager:
  ├─→ Moves files to quarantine
  ├─→ Saves metadata
  └─→ Updates manifest
  ↓
UI updates:
  - Shows freed space
  - Adds to "Recently Deleted" list
  - Enables "Undo" button
```

---

## Performance Considerations

### Scanning Speed
- **MFT Scanning**: ~500 GB/second (metadata only)
- **Recursive Scanning**: ~50 GB/second (depends on file count)
- **Target**: Full C: drive scan in < 30 seconds

### Memory Usage
- **Folder Tree**: ~1 KB per folder
- **100,000 folders**: ~100 MB RAM
- **Optimization**: Stream processing for very large drives

### Database Size
- **Signature DB**: ~5 MB (500+ app signatures)
- **Scan Cache**: ~10 MB per scan
- **Quarantine Manifest**: ~1 KB per deletion

---

## Security & Privacy

### Permissions Required
- **Read**: All drives (for scanning)
- **Write**: Quarantine folder only
- **Admin**: Optional (for MFT scanning)

### Data Collection
- **ZERO telemetry** - all processing is local
- **No cloud sync** - signature DB is bundled
- **No analytics** - user privacy first

### Protected Paths
```javascript
const PROTECTED_PATHS = [
  'C:\\Windows',
  'C:\\Program Files\\WindowsApps',
  'C:\\ProgramData\\Microsoft\\Windows',
  'C:\\Users\\*\\AppData\\Roaming\\Microsoft\\Windows',
  'C:\\$Recycle.Bin'
];
```

---

## Testing Strategy

### Unit Tests
- Signature matching accuracy
- Safety scoring consistency
- Path protection validation

### Integration Tests
- End-to-end scan → delete → restore flow
- MFT fallback behavior
- Quarantine expiration

### Safety Tests
- **Critical**: Never delete system files
- **Critical**: Never delete user documents
- **Critical**: Always allow undo within 30 days

---

## Future Enhancements (Post-MVP)

1. **Duplicate File Detection** - Find identical files across drives
2. **Smart Compression** - Compress rarely-used folders
3. **Scheduled Scans** - Weekly automatic analysis
4. **Cloud Storage Integration** - Detect OneDrive/Dropbox duplicates
5. **Portable Version** - Run without installation

---

## Conclusion

This architecture prioritizes **trust** and **safety** above all else. Every decision is explained, every action is reversible, and system integrity is never compromised.

The goal is not to be the fastest disk cleaner, but the most **trustworthy** one.
