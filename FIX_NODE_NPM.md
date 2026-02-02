# Fix Node.js and npm Setup

## Problem
PowerShell cannot find `npm` or `node` commands, indicating Node.js is either not installed or not in your system PATH.

## Solution Options

### Option 1: Install/Reinstall Node.js (Recommended)

1. **Download Node.js**
   - Go to https://nodejs.org/
   - Download the LTS (Long Term Support) version
   - Choose the Windows Installer (.msi) for your system (likely 64-bit)

2. **Run the Installer**
   - Double-click the downloaded .msi file
   - Follow the installation wizard
   - **IMPORTANT**: Make sure "Add to PATH" is checked during installation
   - Complete the installation

3. **Restart PowerShell**
   - Close all PowerShell/terminal windows
   - Open a new PowerShell window
   - Test with: `node --version` and `npm --version`

### Option 2: Add Node.js to PATH (If Already Installed)

If Node.js is already installed but not in PATH:

1. **Find Node.js Installation**
   - Common locations:
     - `C:\Program Files\nodejs\`
     - `C:\Program Files (x86)\nodejs\`
     - `%APPDATA%\npm`

2. **Add to System PATH**
   - Press `Win + X` and select "System"
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", find and select "Path"
   - Click "Edit"
   - Click "New"
   - Add the Node.js installation path (e.g., `C:\Program Files\nodejs\`)
   - Click "OK" on all dialogs

3. **Restart PowerShell**
   - Close all terminal windows
   - Open a new PowerShell window
   - Test with: `node --version` and `npm --version`

### Option 3: Use Node Version Manager (nvm-windows)

For better Node.js version management:

1. **Download nvm-windows**
   - Go to https://github.com/coreybutler/nvm-windows/releases
   - Download `nvm-setup.exe`
   - Run the installer

2. **Install Node.js via nvm**
   - Open PowerShell as Administrator
   - Run: `nvm install lts`
   - Run: `nvm use lts`
   - Test with: `node --version` and `npm --version`

## Verification Steps

After fixing Node.js/npm, verify everything works:

```powershell
# Check Node.js version
node --version
# Should show: v18.x.x or v20.x.x

# Check npm version
npm --version
# Should show: 9.x.x or 10.x.x

# Navigate to project directory
cd C:\Users\bharg\OneDrive\Code\del-norte-course-selector\del-norte-course-selector

# Install dependencies
npm install

# Verify multer was installed
npm list multer
# Should show: multer@1.4.5-lts.1
```

## Common Issues

### Issue: "npm is not recognized" after installation

**Solution:**
- Restart your computer (not just PowerShell)
- Verify Node.js is in PATH (see Option 2 above)

### Issue: Permission errors during npm install

**Solution:**
- Run PowerShell as Administrator
- Or use: `npm install --no-optional`

### Issue: Node.js installed but old version

**Solution:**
- Uninstall current Node.js via Control Panel
- Install latest LTS version from nodejs.org

### Issue: Multiple Node.js versions causing conflicts

**Solution:**
- Uninstall all Node.js versions
- Use nvm-windows for version management (Option 3)

## After Fixing npm

Once npm is working, run these commands in your project directory:

```powershell
# Install all dependencies (including multer)
npm install

# Start development server (frontend)
npm run dev

# In a separate terminal, start backend server
node server/index.js
```

## Quick Test

To quickly test if npm is working:

```powershell
# This should show npm version
npm --version

# This should show Node.js version
node --version

# This should show your current directory
pwd

# Navigate to project
cd C:\Users\bharg\OneDrive\Code\del-norte-course-selector\del-norte-course-selector

# Try to install dependencies
npm install
```

## Alternative: Use Git Bash or WSL

If PowerShell continues to have issues:

### Git Bash
- Install Git for Windows (includes Git Bash)
- Open Git Bash terminal
- Navigate to project and run npm commands

### WSL (Windows Subsystem for Linux)
- Enable WSL in Windows Features
- Install Ubuntu from Microsoft Store
- Install Node.js in WSL: `sudo apt install nodejs npm`
- Navigate to project and run commands

## Need More Help?

If you continue to have issues:
1. Check if Node.js is installed: Look in `C:\Program Files\nodejs\`
2. Check Windows Environment Variables for PATH
3. Try running PowerShell as Administrator
4. Restart your computer after installation
5. Consider using Git Bash or WSL as alternative

---

**Note**: The admin panel code is complete and ready. You just need to get npm working to install the `multer` dependency and run the application.
