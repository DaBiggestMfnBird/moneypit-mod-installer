# 🎮 MoneyPit Mod Installer v1.0.0

<div align="center">

![MoneyPit](https://img.shields.io/badge/MoneyPit-v1.0.0-orange?style=for-the-badge&logo=racing)
![Electron](https://img.shields.io/badge/Electron-28.3.3-47848f?style=for-the-badge&logo=electron)
![Tests](https://img.shields.io/badge/Tests-80%2F80-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**The easiest way to install mods for BeamNG.drive** 🚗

One-click installation with personality. Pick your animal companion, install your mods, watch them celebrate.

*Not affiliated with BeamNG GmbH.*

[Download Now](#-download) • [Features](#-features) • [How to Use](#-how-to-use) • [GitHub](https://github.com/DaBiggestMfnBird/moneypit-mod-installer)

</div>

---

## What is MoneyPit?

MoneyPit is a **modern, user-friendly mod installer** for BeamNG.drive that makes managing your mod collection effortless. Instead of navigating websites and manually extracting files, MoneyPit handles everything with a beautiful interface powered by **Electron**.

### Why Choose MoneyPit?

✨ **Steam Workshop-style workflow** — Browse, download, install in seconds
🎨 **50 animal companions** — Pixel-art friends that react to your actions
⚡ **Fast & reliable** — One-click installation with SHA256 verification
🔒 **Secure by default** — IPC isolation, no nodeIntegration
🌐 **Multi-source support** — Pull mods from BeamNG, WorldOfMods, Modland
💾 **Smart caching** — Access mods offline after first download
🎮 **60fps animations** — Smooth pixel-art UI that never lags

---

## 📥 Download

### Windows (Recommended)
[**Download MoneyPit Mod Installer Setup 1.0.0.exe**](https://github.com/DaBiggestMfnBird/moneypit-mod-installer/releases/download/v1.0.0/MoneyPit.Mod.Installer.Setup.1.0.0.exe) (79.2 MB)

Just run the installer and follow the prompts.

### macOS & Linux
*Coming soon* — Built with electron-builder

---

## ✨ Features

### 🎠 Browse Mods
- See trending mods from **BeamNG.com**, **WorldOfMods.com**, and **Modland.net**
- One-click redirection to download the .zip file
- Never miss a new mod release

### 🖱️ Three Ways to Install
1. **Drag & drop** .zip files from your Downloads folder
2. **Click to browse** and select files on your computer
3. **Paste URLs** for direct mod links

### 🎓 Installation Guide
- **4-step walkthrough** for new users
- **Clear instructions** for each mod source
- **Pro tips** for advanced users
- **Keyboard shortcuts** (Escape to close)

### 🦁 50 Animal Companions
Each animal has unique movement and behavior:
- 🦅 Birds that fly freely across the UI
- 🐯 Predators that patrol and hunt
- 🦒 Herbivores that wander peacefully
- 🐉 Mythical creatures with magical effects
- ...and 45 more with distinct personalities

**Emotional reactions:**
- 😊 Happy when you select them
- 🤔 Thoughtful while installing mods
- 🎉 Celebrating when mods are ready

### 🔐 Security First
- **SHA256 verification** of all downloads
- **IPC isolation** prevents malicious scripts
- **URL whitelist** protects against phishing
- **No nodeIntegration** in renderer process
- **Context isolation** between main and renderer

### 💾 Smart Caching
- **In-memory cache** (1 hour) for ultra-fast loads
- **Persistent cache** (24 hours) survives restarts
- **Graceful fallback** — Uses cached mods if network fails
- **Rate limiting** prevents throttling from mod sites

### 📊 Real-Time Progress
- Download progress (0-100%)
- Extraction status
- Installation feedback
- Success/error notifications

---

## 🎮 How to Use

### 1️⃣ Download the Installer
Download the `.exe` from [releases](https://github.com/DaBiggestMfnBird/moneypit-mod-installer/releases)

### 2️⃣ Run the Installer
Execute the file and follow setup prompts. It will auto-detect your BeamNG mods folder.

### 3️⃣ Pick Your Companion
Click any animal in the left sidebar to select it. Watch it jump to the center!

### 4️⃣ Install a Mod

**Option A: Browse Mods (Recommended)**
```
1. See a mod you want in the carousel
2. Click it → Opens in your browser
3. Download the .zip from the website
4. Drag the .zip into MoneyPit
5. Watch your animal celebrate! 🎉
```

**Option B: Direct URL**
```
1. Copy a mod's .zip download link
2. Paste into the text field
3. Click "INSTALL MOD"
4. Done!
```

**Option C: File Picker**
```
1. Click the drop zone
2. Select .zip from Downloads
3. Installation starts immediately
```

### 5️⃣ Restart BeamNG
Close and reopen BeamNG.drive to see your new mods!

---

## 🔧 System Requirements

- **Windows 10/11** 64-bit (macOS/Linux coming soon)
- **BeamNG.drive** installed
- **Internet connection** (for browsing mods; local files work offline)

---

## 🏗️ Architecture

Built with modern, secure technologies:

```
Main Process (Node.js)
├─ File I/O & ZIP extraction
├─ Mod scraping & caching
├─ SHA256 verification
├─ Auto-updates
└─ IPC event handler

        ↕ (contextBridge)

Renderer Process (Browser, Sandboxed)
├─ HTML/CSS/JavaScript UI
├─ 60fps Canvas animation
├─ Particle effects
└─ Event handling
```

### Technologies
- **Electron 28.3.3** — Desktop framework
- **Electron-builder 24.13.3** — Building & packaging
- **Electron-updater 6.8.3** — Auto-updates
- **Axios 1.15.0** — HTTP requests
- **Cheerio 1.0.0** — HTML parsing
- **Jest 30.3.0** — Testing

---

## 🧪 Testing

Thoroughly tested for quality and security:

- ✅ **80 unit tests** — All passing
- ✅ **32 integration tests** — All passing
- ✅ **Security audit** — IPC, validation, isolation
- ✅ **Cross-platform** — Verified on Windows

Run tests yourself:
```bash
npm test
```

---

## 📝 Mod Sources Supported

| Source | Status | Notes |
|--------|--------|-------|
| BeamNG.com | ✅ Full Support | Official resource hub |
| WorldOfMods.com | ✅ Full Support | Large mod community |
| Modland.net | ✅ Full Support | Comprehensive database |
| Direct .zip URLs | ✅ Full Support | From any website |
| GitHub Releases | ✅ Full Support | Indie mod creators |

---

## 🤝 Contributing

Love MoneyPit? Contribute!

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/amazing-idea

# 3. Make your changes and test
npm test

# 4. Commit with clear messages
git commit -m 'feat: add amazing feature'

# 5. Push and open a Pull Request
git push origin feature/amazing-idea
```

---

## 📄 License

MIT License — Use freely, commercially or personally.

See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **50 Animal Companions** inspired by real-life behaviors
- **Mod Communities** for creating incredible content
- **Electron** for enabling cross-platform desktop apps
- **You** for making MoneyPit part of your experience 🎮

---

## 📞 Support

### Having Issues?
1. Check the [How to Use](#-how-to-use) section
2. Search [existing issues](https://github.com/DaBiggestMfnBird/moneypit-mod-installer/issues)
3. Create a [new issue](https://github.com/DaBiggestMfnBird/moneypit-mod-installer/issues/new) with details

### Bug Report Template
```
**Describe the bug:**
[What happened?]

**Steps to reproduce:**
1. [First step]
2. [Second step]

**Expected behavior:**
[What should happen?]

**Screenshots:**
[If applicable]

**System info:**
- OS: [Windows 10/11]
- BeamNG version: [e.g., 0.30.2]
- MoneyPit version: [1.0.0]
```

---

<div align="center">

**Made with ❤️ by the MoneyPit Team**

*Bringing joy, personality, and organization to BeamNG.drive modding.*

⭐ **Star us on GitHub!** ⭐

*Not for the slow lane.*

</div>
