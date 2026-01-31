# 🐕 SpaceHound

**Sniff out hidden disk space and safely reclaim gigabytes**

SpaceHound is an intelligent disk cleanup utility that solves a critical problem: **"Why is my hard drive full even though I uninstalled big apps and games?"**

Unlike traditional disk analyzers, SpaceHound doesn't just show you what's taking up space—it **explains what everything is**, **detects leftover data from uninstalled apps**, and **tells you exactly what's safe to delete**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://www.microsoft.com/windows)
[![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-47848F.svg)](https://www.electronjs.org/)

---

## ✨ Features

### 🔍 **Smart Detection**
- **Leftover Data Detection** - Finds data from uninstalled applications
- **App Ownership Mapping** - Links folders to the apps that created them
- **10+ Pre-loaded Signatures** - Recognizes Unreal Engine, Unity, Steam, Visual Studio, Chrome, and more

### 🛡️ **Safety First**
- **Multi-Factor Risk Assessment** - 9 factors analyzed for each folder
- **Confidence Scores** - 0-100% safety ratings with detailed explanations
- **Protected Paths** - Never deletes Windows system files or user documents
- **30-Day Quarantine** - All deletions are reversible with one-click restore

### 📊 **Crystal Clear Insights**
- **Plain English Explanations** - Understand what, why, and impact for every folder
- **Safety Badges** - ✅ Safe | ⚠️ Review | ❌ Critical
- **Folder Type Classification** - Cache, logs, build artifacts, projects, etc.
- **Impact Simulation** - Know exactly what will happen before you delete

### ⚡ **Lightning Fast**
- **MFT-Based Scanning** - 10-100x faster than traditional scanners on NTFS drives
- **Smart Caching** - Subsequent scans are even faster
- **Efficient Database** - SQLite-powered signature matching

### 🎨 **Premium UI**
- **Modern Dark Mode** - Stunning glassmorphism design
- **Vibrant Gradients** - Eye-catching purple/blue color scheme
- **Smooth Animations** - Polished micro-interactions
- **5 Focused Views** - Overview, Biggest Folders, Safe Cleanup, Leftovers, Quarantine

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/fardeenbukhari/SpaceHound.git
cd SpaceHound

# Install dependencies (automatically rebuilds native modules)
npm install

# Initialize the signature database
npm run init-db

# Run the app
npm run dev
```

### Building

```bash
# Build Windows installer
npm run build:win

# Output: dist/SpaceHound Setup.exe
```

---

## 📖 How It Works

### 1️⃣ **Scan Your Drive**
SpaceHound uses fast MFT scanning (when run as Administrator) to analyze your entire drive in seconds.

### 2️⃣ **Intelligent Analysis**
Each folder is analyzed through:
- **Ownership Mapper** - Identifies which app created it
- **Residue Detector** - Checks if the app is still installed
- **Safety Classifier** - Assesses deletion risk with 9 factors
- **Explainability Engine** - Generates human-readable explanations

### 3️⃣ **Safe Deletion**
When you delete:
- Files are moved to quarantine (not permanently deleted)
- Detailed manifest is created
- 30-day retention period begins
- One-click restore available anytime

### 4️⃣ **Automatic Cleanup**
After 30 days, quarantined items are automatically purged, or you can manually delete them sooner.

---

## 🎯 Example Use Case

**Scenario**: You uninstalled Unreal Engine months ago, but your C: drive is still full.

**SpaceHound finds**:
```
📁 C:\Users\You\AppData\Local\UnrealEngine\Common\DerivedDataCache
💾 Size: 48.6 GB
✅ Safety: 92% (Safe to delete)

What: Shader and asset cache from Unreal Engine
Why: Unreal Engine was uninstalled but left this data behind
Impact: Safe to delete - will be recreated if you reinstall UE
```

**You click "Delete"**:
- ✅ 48.6 GB freed instantly
- ✅ Files moved to quarantine
- ✅ Can restore for 30 days
- ✅ System remains stable

---

## 🔒 Safety Guarantees

### ❌ **Never Deletes**
- Windows system files (`C:\Windows`)
- Program Files\WindowsApps
- User Documents, Pictures, Videos, Music
- System restore points
- Recycle Bin

### ⚠️ **Warns About**
- User data folders
- Source code files
- Media files (photos, videos)
- Documents

### ✅ **Safely Deletes**
- Application cache
- Build artifacts
- Temporary files
- Log files
- Shader cache
- Package manager cache (npm, pip, etc.)

---

## 📊 Supported Applications

SpaceHound comes pre-loaded with signatures for:

**Game Engines**
- Unreal Engine (cache, build artifacts, logs)
- Unity (shader cache, build files)

**Game Platforms**
- Steam (shader cache, downloads)

**Development Tools**
- Visual Studio (cache, build outputs)
- Node.js / npm (node_modules, cache)
- Python / pip (bytecode cache)

**Browsers**
- Google Chrome (cache, GPU cache)
- Microsoft Edge (cache)

**System**
- Windows Temp files
- GPU shader cache (NVIDIA, AMD, Intel)

*More signatures can be easily added to `data/schema.sql`*

---

## 🛠️ Technology Stack

- **Electron** - Cross-platform desktop framework
- **Node.js** - Backend runtime
- **better-sqlite3** - Fast SQLite database
- **minimatch** - Glob pattern matching
- **HTML/CSS/JavaScript** - Premium dark mode UI

---

## 📁 Project Structure

```
SpaceHound/
├── src/
│   ├── main/              # Backend (Electron main process)
│   │   ├── scanner/       # Fast disk scanning
│   │   ├── detector/      # Residue & ownership detection
│   │   ├── classifier/    # Safety assessment
│   │   ├── deleter/       # Quarantine system
│   │   └── database/      # SQLite manager
│   └── renderer/          # Frontend (UI)
│       ├── index.html
│       ├── styles/        # Premium CSS
│       └── scripts/       # Application logic
├── data/
│   ├── schema.sql         # Database schema
│   ├── signatures.db      # SQLite database
│   └── quarantine/        # Deleted files
├── docs/                  # Comprehensive documentation
└── scripts/               # Utility scripts
```

---

## 📚 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 3 minutes
- **[Architecture](docs/ARCHITECTURE.md)** - System design and algorithms
- **[Implementation Guide](docs/IMPLEMENTATION.md)** - Developer documentation
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[Project Structure](PROJECT_STRUCTURE.md)** - File organization

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Adding App Signatures

1. Edit `data/schema.sql`
2. Add new app signature with patterns and folder types
3. Run `npm run init-db` to rebuild database
4. Test and submit a pull request

### Improving Detection

- Enhance ownership mapping algorithms
- Add new folder type classifications
- Improve safety scoring logic

### Reporting Issues

Please include:
- Error messages (full text)
- Steps to reproduce
- OS version
- Console logs

---

## 🐛 Known Limitations

- **Windows Only** - Currently targets Windows 10/11 (macOS/Linux support planned)
- **MFT Scanning** - Requires Administrator privileges for fastest scanning
- **Signature Database** - Limited to pre-defined apps (expandable by users)

---

## 🔮 Roadmap

- [ ] Duplicate file detection
- [ ] Smart compression for rarely-used folders
- [ ] Scheduled automatic scans
- [ ] Cloud storage integration (OneDrive, Dropbox)
- [ ] macOS and Linux support
- [ ] Community signature database

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Database powered by [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- Pattern matching by [minimatch](https://github.com/isaacs/minimatch)
- UI font: [Inter](https://rsms.me/inter/)

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/fardeenbukhari/SpaceHound/issues)
- **Discussions**: [GitHub Discussions](https://github.com/fardeenbukhari/SpaceHound/discussions)

---

<div align="center">

**Built with ❤️ for users who want to trust their disk cleanup tool**

🐕 **SpaceHound** - *Sniff out hidden disk space*

[⭐ Star this repo](https://github.com/fardeenbukhari/SpaceHound) • [🐛 Report Bug](https://github.com/fardeenbukhari/SpaceHound/issues) • [💡 Request Feature](https://github.com/fardeenbukhari/SpaceHound/issues)

</div>#   S p a c e H o u n d  
 #   S p a c e H o u n d  
 