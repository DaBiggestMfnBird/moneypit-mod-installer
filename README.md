# MoneyPit Mod Installer

**The fastest way to install BeamNG.drive mods. Built by the pit crew, for the pit crew.**

Not affiliated with BeamNG GmbH.

---

## Features

- Paste any mod URL and hit install — done
- Drag & drop `.zip` files straight from your downloads
- Auto-detects your BeamNG mods folder (any version)
- PS2 × Stark Industries × 8-bit pixel art UI
- Pixel race cars battle across the bottom of the screen
- Auto-updates silently in the background

## Supported Mod Sources

| Source | Status |
|--------|--------|
| BeamNG.com | Supported |
| WorldOfMods | Supported |
| Modland | Supported |
| GitHub Releases | Supported |
| Direct `.zip` links | Supported |

## Security

Every download is validated:
- HTTPS only — no plain HTTP
- Allowlisted domains — no arbitrary URL fetching
- Path traversal protection on zip extraction
- 500 MB size cap, enforced during download
- Content-type check before writing to disk

## Installation

### Option 1 — Download the EXE (Recommended)

Grab the latest `.exe` installer from [Releases](../../releases).

### Option 2 — Build from source

```bash
# Requires Node.js v18+
npm install
npm test        # run security tests first
npm run build:win
# installer will be in dist/
```

## Development

```bash
npm install
npm start       # launches in dev mode
npm test        # 36 security unit tests
```

## System Requirements

- Windows 10/11 64-bit (macOS and Linux builds available)
- BeamNG.drive installed
- Internet connection (for URL installs)

## Tips

- Always restart BeamNG after installing new mods
- Install one mod at a time to isolate conflicts
- Check the game's built-in mod manager if a mod doesn't show up

## License

MIT — see [LICENSE](LICENSE)

---

*MoneyPit — Not for the slow lane.*
