# Clearner - Quick Start Guide

## 🚀 Get Started in 3 Minutes

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- **Electron** - Desktop app framework
- **better-sqlite3** - Fast SQLite database
- **minimatch** - Pattern matching
- **fast-glob** - File system utilities

**Note**: Native modules (like better-sqlite3) are automatically rebuilt for Electron during installation.

### Step 2: Initialize Database

```bash
npm run init-db
```

This creates `data/signatures.db` with 15+ pre-loaded app signatures including:
- Unreal Engine, Unity
- Steam, Epic Games
- Visual Studio, Android Studio
- Node.js, Python
- Chrome, Edge
- And more...

### Step 3: Run the App

```bash
npm run dev
```

The app will open with a beautiful dark mode interface!

## 📖 How to Use

### 1. Scan Your Drive

1. Select drive (C:, D:, etc.) from dropdown
2. Click **"Scan Drive"** button
3. Wait for scan to complete (usually < 30 seconds)

### 2. Review Results

The app shows 4 categories:

- **✅ Safe Cleanup** - High-confidence safe items
- **⚠️ Uninstalled Apps** - Leftover data from removed apps
- **📊 Biggest Folders** - All folders sorted by size
- **🗑️ Recently Deleted** - Quarantine with restore option

### 3. Delete Safely

1. Click on any folder to view details
2. Read the explanation (what, why, impact)
3. Click **"Delete"** to move to quarantine
4. Files are kept for 30 days - can be restored anytime!

### 4. Restore if Needed

1. Go to **"Recently Deleted"** view
2. Click **"Restore"** on any item
3. Files return to original location

## 🎯 Example Workflow

**Scenario**: You uninstalled Unreal Engine but disk is still full

1. **Scan C: drive**
   - App finds: `C:\Users\You\AppData\Local\UnrealEngine\Common\DerivedDataCache`
   - Size: 48.6 GB

2. **App explains**:
   - ✅ **What**: Shader and asset cache from Unreal Engine
   - 📝 **Why**: Unreal Engine was uninstalled but left this data behind
   - 💡 **Impact**: Safe to delete - will be recreated if you reinstall UE

3. **You delete**:
   - Files moved to quarantine
   - Freed: 48.6 GB
   - Can restore for 30 days

4. **Result**: Disk space recovered, system safe!

## 🔒 Safety Features

### Never Deletes

- Windows system files
- Program Files\WindowsApps
- User Documents, Pictures, Videos
- System Volume Information
- Recycle Bin

### Always Explains

Every folder shows:
- Which app created it
- Why it exists
- What happens if deleted
- Confidence score (0-100%)

### Always Reversible

- All deletions go to quarantine
- 30-day retention period
- One-click restore
- No permanent deletes without confirmation

## 🎨 UI Overview

### Sidebar Navigation

- **Overview** - Welcome screen and scan results
- **Biggest Folders** - Sorted by size
- **Safe Cleanup** - High-confidence safe items
- **Uninstalled Apps** - Leftover data
- **Recently Deleted** - Quarantine

### Folder Cards Show

- App name and icon
- Folder path
- Total size
- Safety badge (✅ ⚠️ ❌)
- Folder type (cache, logs, projects, etc.)
- Human-readable explanation
- Delete/Restore buttons

### Safety Badges

- ✅ **Safe to delete** (90-100% confidence)
- ⚠️ **Review before deleting** (50-89%)
- ❌ **Do not delete** (0-49%)

## 🛠️ Troubleshooting

### Scan is Slow

**Problem**: Scan takes > 1 minute

**Solutions**:
1. Run as Administrator (enables fast MFT scanning)
2. Exclude network drives
3. Close other disk-intensive apps

### Can't Delete Folder

**Problem**: "Access denied" error

**Solutions**:
1. Close apps that might be using the folder
2. Run Clearner as Administrator
3. Check if folder is in use by another process

### Database Error

**Problem**: "Database not found" or "Schema error"

**Solution**:
```bash
npm run init-db
```

This recreates the database from scratch.

## 📊 Performance Tips

### For Fastest Scans

1. **Run as Administrator** - Enables MFT scanning (10-100x faster)
2. **Scan specific folders** - Instead of entire C: drive
3. **Close other apps** - Reduces disk contention

### For Best Results

1. **Scan after uninstalling apps** - Catches fresh residue
2. **Review "Uninstalled Apps" first** - Usually biggest wins
3. **Check "Safe Cleanup" regularly** - Cache accumulates over time

## 🔮 What's Next?

After using Clearner:

1. **Regular scans** - Run monthly to catch accumulating cache
2. **Before big installs** - Free up space for new apps
3. **After uninstalls** - Clean up leftover data immediately

## 📝 Keyboard Shortcuts (Coming Soon)

- `Ctrl+R` - Refresh scan
- `Ctrl+F` - Search folders
- `Ctrl+Z` - Undo last delete
- `Esc` - Close modal

## 🐛 Known Issues

1. **First scan may be slow** - Subsequent scans are cached
2. **Large folders (100+ GB)** - Deletion may take time
3. **Network drives** - Not supported yet

## 💡 Pro Tips

1. **Sort by size** - Focus on biggest space hogs first
2. **Read explanations** - Understand before deleting
3. **Use quarantine** - Never permanently delete immediately
4. **Check confidence scores** - Higher = safer

## 🎓 Learn More

- **Full Documentation**: `docs/IMPLEMENTATION.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Add Signatures**: Edit `data/schema.sql`

## 🤝 Need Help?

- Check `docs/IMPLEMENTATION.md` for detailed guides
- Open an issue on GitHub
- Email: support@clearner.app

---

**Happy Cleaning! 🧹✨**

Remember: Clearner is designed to be **safe** and **trustworthy**. When in doubt, don't delete!
