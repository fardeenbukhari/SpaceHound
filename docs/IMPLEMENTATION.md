# Clearner - Implementation Guide

## 🎯 Project Overview

**Clearner** is a trust-focused disk cleanup utility that solves a critical user problem:

> "Why is my hard drive full even though I uninstalled big apps and games — and what can I safely delete without breaking my system?"

Unlike traditional disk analyzers, Clearner:
- ✅ Detects leftover data from uninstalled applications
- ✅ Explains what each folder is and why it exists
- ✅ Classifies deletion safety with confidence scores
- ✅ Simulates deletion impact before you commit
- ✅ Provides safe deletion with 30-day undo

## 📁 Project Structure

```
clearner/
├── src/
│   ├── main/                      # Electron main process (backend)
│   │   ├── index.js               # Main entry point & IPC handlers
│   │   ├── preload.js             # Secure IPC bridge
│   │   ├── scanner/
│   │   │   └── DiskScanner.js     # Fast disk scanning engine
│   │   ├── detector/
│   │   │   ├── ResidueDetector.js # Uninstalled app detection
│   │   │   └── OwnershipMapper.js # App ownership mapping
│   │   ├── classifier/
│   │   │   └── SafetyClassifier.js # Deletion risk assessment
│   │   ├── deleter/
│   │   │   └── SafeDeleteManager.js # Quarantine system
│   │   └── database/
│   │       └── SignatureDatabase.js # SQLite signature DB
│   └── renderer/                  # Frontend (UI)
│       ├── index.html             # Main UI structure
│       ├── styles/
│       │   └── main.css           # Premium dark mode design
│       └── scripts/
│           └── app.js             # Frontend application logic
├── data/
│   ├── schema.sql                 # Database schema with signatures
│   ├── signatures.db              # SQLite database (generated)
│   └── quarantine/                # Deleted files storage
├── scripts/
│   └── init-database.js           # Database initialization
├── docs/
│   ├── ARCHITECTURE.md            # System architecture
│   └── IMPLEMENTATION.md          # This file
├── package.json                   # Dependencies & scripts
└── README.md                      # Project overview
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (for Electron and backend)
- **Windows 10/11** (primary target platform)
- **Admin privileges** (optional, for MFT scanning)

### Installation

```bash
# 1. Navigate to project directory
cd c:/Users/FRDNN/OneDrive/Documents/Clearner

# 2. Install dependencies
npm install

# 3. Initialize the signature database
npm run init-db

# 4. Run in development mode
npm run dev
```

### Build for Production

```bash
# Build Windows installer
npm run build:win

# Output will be in dist/ folder
```

## 🏗️ Core Components

### 1. Disk Scanner (`DiskScanner.js`)

**Purpose**: Fast, accurate disk space analysis

**Features**:
- MFT-based scanning for NTFS drives (10-100x faster)
- Recursive fallback for non-NTFS or when MFT fails
- Progress reporting
- System path exclusions

**Usage**:
```javascript
const scanner = new DiskScanner({
  minFolderSize: 100 * 1024 * 1024, // 100 MB
  onProgress: (progress) => console.log(progress)
});

const results = await scanner.scan('C:\\');
```

**Output**:
```javascript
[
  {
    path: "C:\\Users\\User\\AppData\\Local\\UnrealEngine",
    totalSize: 51234567890,
    fileCount: 12847,
    lastAccessed: "2025-12-15T10:30:00Z",
    lastModified: "2025-12-15T10:30:00Z",
    depth: 4
  },
  // ...
]
```

---

### 2. Residue Detector (`ResidueDetector.js`)

**Purpose**: Identify orphaned data from uninstalled apps

**How it works**:
1. Queries Windows Registry for installed apps
2. Queries UWP apps via PowerShell
3. Compares folder ownership against installed apps
4. Calculates confidence score for residue detection

**Usage**:
```javascript
const detector = new ResidueDetector(signatureDB);
await detector.initialize(); // Loads installed apps

const residue = detector.detectResidue(folderPath, ownership);
```

**Output**:
```javascript
{
  isResidue: true,
  confidence: 85,
  appName: "Unreal Engine",
  reason: "Unreal Engine is not installed, but this data was left behind...",
  recommendation: "✅ Safe to delete - Unreal Engine will recreate this data if reinstalled."
}
```

---

### 3. Ownership Mapper (`OwnershipMapper.js`)

**Purpose**: Link folders to applications using signature matching

**Matching strategies**:
1. **Path patterns**: Glob matching against known paths
2. **File markers**: Identifying files (e.g., `UE4Editor.exe`)
3. **Folder type detection**: Cache, logs, projects, etc.

**Usage**:
```javascript
const mapper = new OwnershipMapper(signatureDB);
await mapper.initialize();

const ownership = await mapper.mapOwnership(folderPath);
```

**Output**:
```javascript
{
  appName: "Unreal Engine",
  category: "game_engine",
  confidence: 92,
  matchType: "path",
  folderType: "cache",
  isRegenerable: true,
  isSafeToDelete: true,
  explanation: "Cooked asset cache - regenerated on next build"
}
```

---

### 4. Safety Classifier (`SafetyClassifier.js`)

**Purpose**: Assess deletion risk with confidence scores

**Factors considered**:
- System path protection (never delete Windows folders)
- Ownership confidence
- Folder type (cache vs. projects)
- Regenerability
- Last access time
- File content analysis (documents, media, code)

**Classification levels**:
- ✅ **Safe** (90-100%): Cache, logs, temp files
- ⚠️ **Review** (50-89%): Old backups, downloads
- ❌ **Critical** (0-49%): System files, user documents

**Usage**:
```javascript
const classifier = new SafetyClassifier();

const safety = await classifier.classify(
  folderPath,
  ownership,
  fileStats,
  residue
);
```

**Output**:
```javascript
{
  score: 92,
  level: "safe",
  badge: "✅ Safe to delete",
  reasons: [
    "Clearly identified app ownership",
    "Cache files are regenerable",
    "Not accessed in 6+ months"
  ],
  warnings: [],
  canDelete: true,
  explanation: "92% safe — regenerable cache files created by Unreal Engine."
}
```

---

### 5. Safe Delete Manager (`SafeDeleteManager.js`)

**Purpose**: Reversible deletion with quarantine system

**Features**:
- Moves files to quarantine (not permanent delete)
- 30-day retention period
- One-click restore
- Automatic expiration cleanup
- Deletion manifest tracking

**Usage**:
```javascript
const deleteManager = new SafeDeleteManager();
await deleteManager.initialize();

// Delete (move to quarantine)
const result = await deleteManager.safeDelete(folderPath, metadata);

// Restore
await deleteManager.restore(deletionId);

// Permanent delete (cannot undo)
await deleteManager.permanentlyDelete(deletionId);
```

**Quarantine structure**:
```
data/quarantine/
├── manifest.json
└── deletions/
    ├── 2026-01-31_193045_UnrealEngine_Cache/
    │   ├── metadata.json
    │   └── files/
    │       └── [original folder structure]
```

---

### 6. Signature Database (`SignatureDatabase.js`)

**Purpose**: SQLite database of app signatures

**Schema**:
- `app_signatures`: App metadata
- `path_patterns`: Glob patterns for matching
- `file_markers`: Identifying files
- `folder_types`: Cache, logs, projects, etc.
- `exclusion_patterns`: Protected system paths

**Pre-loaded signatures**:
- **Game Engines**: Unreal Engine, Unity
- **Game Platforms**: Steam, Epic Games
- **IDEs**: Visual Studio, Android Studio
- **Dev Tools**: Node.js, Python, npm
- **Browsers**: Chrome, Edge
- **System**: Windows Temp, GPU Cache

**Usage**:
```javascript
const db = new SignatureDatabase();
await db.initialize();

const signatures = db.getAllSignatures();
const patterns = db.getPathPatterns(signatureId);
```

---

## 🎨 User Interface

### Design Philosophy

**Premium Dark Mode** with:
- Vibrant gradient accents (#6366f1 → #8b5cf6)
- Glassmorphism effects
- Smooth micro-animations
- Modern typography (Inter font)
- Confidence-driven design

### Views

1. **Overview**: Welcome screen → Scan progress → Results summary
2. **Biggest Folders**: All folders sorted by size
3. **Safe Cleanup**: High-confidence safe items
4. **Uninstalled Apps**: Leftover data from removed apps
5. **Recently Deleted**: Quarantine with restore capability

### Key UI Elements

- **Folder Cards**: Show size, app name, safety badge, explanation
- **Safety Badges**: 
  - ✅ Safe to delete (green)
  - ⚠️ Review before deleting (yellow)
  - ❌ Do not delete (red)
- **Explanations**: Plain English for every folder
- **Progress Indicators**: Real-time scan feedback

---

## 🔄 Data Flow

### Complete Scan → Delete Flow

```
1. User clicks "Scan Drive C:"
   ↓
2. DiskScanner scans all folders
   ↓
3. For each large folder:
   ├─→ OwnershipMapper identifies app
   ├─→ ResidueDetector checks if app is uninstalled
   ├─→ SafetyClassifier assigns risk score
   └─→ Generate human-readable explanation
   ↓
4. Display results in UI with:
   - Size, app name, safety badge
   - Explanation (what, why, impact)
   - Delete/View Details buttons
   ↓
5. User clicks "Delete" on a folder
   ↓
6. Show deletion impact preview
   ↓
7. User confirms
   ↓
8. SafeDeleteManager moves to quarantine
   ↓
9. UI updates, shows "Recently Deleted"
   ↓
10. User can restore within 30 days
```

---

## 🔒 Safety Guarantees

### Protected Paths (Never Delete)

```javascript
const PROTECTED_PATHS = [
  'C:\\Windows',
  'C:\\Program Files\\WindowsApps',
  'C:\\ProgramData\\Microsoft\\Windows',
  'C:\\$Recycle.Bin',
  'C:\\System Volume Information',
  'C:\\Recovery'
];
```

### User Data Warnings

Folders containing:
- Documents (`.docx`, `.pdf`, `.xlsx`)
- Media (`.jpg`, `.mp4`, `.mp3`)
- Source code (`.js`, `.py`, `.cpp`)

→ Automatically flagged with warnings

### Undo System

- All deletions go to quarantine
- 30-day retention period
- One-click restore
- Automatic cleanup after expiration

---

## 🧪 Testing Strategy

### Unit Tests (TODO)

```bash
npm test
```

**Test coverage**:
- Signature matching accuracy
- Safety scoring consistency
- Path protection validation
- Quarantine operations

### Manual Testing Checklist

- [ ] Scan C: drive successfully
- [ ] Detect leftover data from uninstalled app
- [ ] Correctly classify safe vs. critical folders
- [ ] Delete folder → moves to quarantine
- [ ] Restore folder from quarantine
- [ ] Permanent delete after 30 days
- [ ] Never delete system files
- [ ] UI responsive and smooth

---

## 📊 Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Full C: scan | < 30 seconds | Using MFT scanning |
| Ownership mapping | < 5 seconds | For 100 folders |
| Safety classification | < 10 seconds | For 100 folders |
| Delete operation | < 5 seconds | Per folder |
| Restore operation | < 5 seconds | Per folder |

---

## 🐛 Known Limitations

1. **MFT Scanning**: Requires admin privileges on Windows
   - Fallback: Recursive scanning (slower)

2. **Signature Database**: Limited to pre-defined apps
   - Solution: Regular updates, user contributions

3. **Windows Only**: Currently targets Windows 10/11
   - Future: macOS and Linux support

4. **Large Folders**: Moving 100+ GB can be slow
   - Optimization: Use robocopy for reliable moves

---

## 🔮 Future Enhancements (Post-MVP)

### Phase 2 Features

1. **Duplicate File Detection**
   - Find identical files across drives
   - Smart deduplication

2. **Smart Compression**
   - Compress rarely-used folders
   - Transparent decompression

3. **Scheduled Scans**
   - Weekly automatic analysis
   - Email reports

4. **Cloud Storage Integration**
   - Detect OneDrive/Dropbox duplicates
   - Optimize cloud sync folders

5. **Portable Version**
   - Run without installation
   - USB drive support

### Community Features

1. **Signature Contributions**
   - Users can submit new app signatures
   - Crowdsourced database

2. **Telemetry (Opt-in)**
   - Anonymous usage statistics
   - Improve detection accuracy

---

## 📝 Development Workflow

### Adding a New App Signature

1. Open `data/schema.sql`
2. Add new signature:

```sql
INSERT INTO app_signatures (app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES ('MyApp', 'category', 'Publisher', 1, 'safe', 'Description');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (last_insert_rowid(), '**/MyApp/**', 70);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (last_insert_rowid(), 'cache', '**/MyApp/Cache/**', 1, 1, 'Cache files - regenerated automatically');
```

3. Reinitialize database:

```bash
npm run init-db
```

### Debugging

```bash
# Run with DevTools open
npm run dev

# Check logs
# Main process: Terminal output
# Renderer process: DevTools console
```

---

## 🤝 Contributing

### Code Style

- **JavaScript**: ES6+ with async/await
- **Formatting**: 2 spaces, semicolons
- **Comments**: JSDoc for functions
- **Naming**: camelCase for variables, PascalCase for classes

### Pull Request Process

1. Fork the repository
2. Create feature branch (`feature/amazing-feature`)
3. Commit changes with clear messages
4. Add tests if applicable
5. Submit pull request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Electron**: Cross-platform desktop framework
- **better-sqlite3**: Fast SQLite bindings
- **minimatch**: Glob pattern matching
- **Inter Font**: Modern typography

---

## 📞 Support

For issues, questions, or feature requests:
- GitHub Issues: [github.com/clearner/clearner/issues]
- Email: support@clearner.app

---

**Built with ❤️ for users who want to trust their disk cleanup tool.**
