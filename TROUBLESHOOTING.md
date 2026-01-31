# Clearner - Troubleshooting Guide

## Common Issues & Solutions

### ✅ FIXED: Native Module Version Mismatch

**Error Message**:
```
Error: The module 'better_sqlite3.node' was compiled against a different Node.js version
NODE_MODULE_VERSION 127. This version requires NODE_MODULE_VERSION 119.
```

**Cause**: `better-sqlite3` is a native module that needs to be compiled for Electron's specific Node.js version.

**Solution**: ✅ **Already Fixed!**

The `package.json` now includes a `postinstall` script that automatically rebuilds native modules:

```json
"postinstall": "electron-rebuild"
```

**Manual Fix** (if needed):
```bash
npm run rebuild
# or
npx electron-rebuild
```

---

## Installation Issues

### Issue: Dependencies fail to install

**Solution**:
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: Database initialization fails

**Solution**:
```bash
# Reinitialize database
npm run init-db
```

---

## Runtime Issues

### Issue: App won't start

**Checklist**:
1. ✅ Dependencies installed: `npm install`
2. ✅ Native modules rebuilt: `npm run rebuild`
3. ✅ Database initialized: `npm run init-db`

**Solution**:
```bash
# Full reset
npm install
npm run rebuild
npm run init-db
npm run dev
```

### Issue: Scan is very slow

**Causes & Solutions**:

1. **Not running as Administrator**
   - MFT scanning requires admin privileges
   - Solution: Right-click → "Run as Administrator"

2. **Large drive**
   - C: drive with 1TB+ data takes longer
   - Solution: Scan specific folders instead

3. **Network drives**
   - Network drives are slower
   - Solution: Exclude network paths

### Issue: Can't delete folder

**Error**: "Access denied"

**Solutions**:
1. Close apps using the folder
2. Run Clearner as Administrator
3. Check if folder is in use by another process

### Issue: Quarantine restore fails

**Solutions**:
1. Ensure original path still exists
2. Check disk space
3. Run as Administrator

---

## UI Issues

### Issue: Blank screen on startup

**Solutions**:
1. Check DevTools console (Ctrl+Shift+I)
2. Verify `src/renderer/index.html` exists
3. Check for JavaScript errors

### Issue: Styles not loading

**Solutions**:
1. Verify `src/renderer/styles/main.css` exists
2. Clear Electron cache
3. Hard reload (Ctrl+Shift+R)

---

## Database Issues

### Issue: "Database not found"

**Solution**:
```bash
npm run init-db
```

### Issue: "Schema error"

**Solution**:
```bash
# Delete and recreate database
rm data/signatures.db
npm run init-db
```

### Issue: "Signature count is 0"

**Cause**: Database not properly initialized

**Solution**:
```bash
# Verify schema file exists
ls data/schema.sql

# Reinitialize
npm run init-db
```

---

## Performance Issues

### Issue: High memory usage

**Causes**:
- Scanning very large drives
- Many files open

**Solutions**:
1. Scan smaller folders
2. Close other applications
3. Increase system RAM

### Issue: App freezes during scan

**Causes**:
- Very large folders (100k+ files)
- Disk I/O bottleneck

**Solutions**:
1. Be patient - large scans take time
2. Exclude very large folders
3. Run on SSD instead of HDD

---

## Build Issues

### Issue: Build fails

**Error**: "electron-builder not found"

**Solution**:
```bash
npm install --save-dev electron-builder
npm run build:win
```

### Issue: Icon not found

**Error**: "assets/icon.ico not found"

**Solution**:
1. Create `assets/` folder
2. Add `icon.ico` file
3. Or remove icon from `package.json` build config

---

## Development Issues

### Issue: Hot reload not working

**Note**: Electron doesn't support hot reload by default

**Solution**:
- Restart app after code changes: `Ctrl+C` then `npm run dev`

### Issue: DevTools won't open

**Solution**:
- Press `Ctrl+Shift+I`
- Or add to main process: `mainWindow.webContents.openDevTools()`

---

## Windows-Specific Issues

### Issue: PowerShell execution policy

**Error**: "Running scripts is disabled"

**Solution**:
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: Windows Defender blocks app

**Cause**: Unsigned executable

**Solution**:
1. Add exception in Windows Defender
2. Or sign the executable (for production)

---

## Logging & Debugging

### Enable verbose logging

**Main Process** (Backend):
- Logs appear in terminal where you ran `npm run dev`

**Renderer Process** (Frontend):
- Open DevTools: `Ctrl+Shift+I`
- Check Console tab

### Check database contents

```bash
# Install sqlite3 CLI
npm install -g sqlite3

# Query database
sqlite3 data/signatures.db "SELECT * FROM app_signatures;"
```

---

## Getting Help

### Before asking for help:

1. ✅ Check this troubleshooting guide
2. ✅ Check `docs/IMPLEMENTATION.md`
3. ✅ Review error messages in console
4. ✅ Try a full reinstall

### When reporting issues:

Include:
- Error message (full text)
- Steps to reproduce
- Operating system version
- Node.js version: `node --version`
- Electron version: `npm list electron`
- Console logs (both main and renderer)

### Contact:

- GitHub Issues: [github.com/clearner/clearner/issues]
- Email: support@clearner.app

---

## Quick Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| Module version mismatch | `npm run rebuild` |
| Database not found | `npm run init-db` |
| App won't start | `npm install && npm run rebuild` |
| Scan is slow | Run as Administrator |
| Can't delete folder | Close apps, run as Admin |
| Blank screen | Check DevTools console |
| Build fails | `npm install electron-builder` |

---

## Prevention Tips

### For smooth operation:

1. **Always run as Administrator** - Enables fast MFT scanning
2. **Keep database updated** - Run `npm run init-db` after updates
3. **Close apps before deleting** - Prevents "access denied" errors
4. **Regular scans** - Monthly scans catch accumulating cache
5. **Review before deleting** - Read explanations carefully

### For development:

1. **Rebuild after npm install** - `npm run rebuild`
2. **Check logs** - Both terminal and DevTools
3. **Test incrementally** - Test each component separately
4. **Use version control** - Commit working states

---

**Most issues are solved by**: `npm install && npm run rebuild && npm run init-db` 🔧
