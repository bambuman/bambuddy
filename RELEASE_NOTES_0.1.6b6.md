# Bambuddy v0.1.6b6 Release Notes

## Highlights

- **Resizable Printer Cards** - Customize your dashboard with 4 card sizes (S/M/L/XL)
- **Queue Only Mode** - Stage prints without auto-start, release when ready
- **Virtual Printer Model Selection** - Choose which Bambu printer to emulate
- **Camera Auto-Reconnect** - Automatic recovery from stalled streams
- **H2D Multi-AMS Fix** - Correct slot display for dual-nozzle printers with multiple AMS units

---

## New Features

### Resizable Printer Cards
Adjust printer card size from the Printers page toolbar to fit your screen and monitoring style.

- Four sizes: **Small**, **Medium** (default), **Large**, **XL**
- **+/-** buttons in toolbar header
- Size preference saved automatically
- Responsive grid adapts to selected size

> **Tip:** Use Small size for monitoring many printers on a large screen or dashboard display.

### Queue Only Mode
Stage prints without automatic scheduling - perfect for preparing batches.

- New **"Queue Only"** option when adding prints to queue
- Staged prints show purple **"Staged"** badge
- Click **Play** button to release staged prints to the queue
- Edit queue items to switch between ASAP, Scheduled, and Queue Only modes

### Virtual Printer Model Selection
Choose which Bambu printer model the virtual printer should emulate.

- Dropdown in **Settings > Virtual Printer**
- Supports all models: X1C, X1, X1E, P1S, P1P, P2S, A1, A1 Mini, H2D, H2C, H2S
- Model change automatically restarts the virtual printer
- Models sorted alphabetically for easy selection

### Tasmota Admin Link
Quick access to your smart plug's web interface.

- **Admin** link on each smart plug card
- Auto-login using stored credentials (when configured)
- Opens in new tab for quick configuration access

### Other Additions
- **Pending upload delete confirmation** - Confirmation modal when discarding pending uploads
- **Debug logging** - Added logging for printer hour counter and AMS slot mapping
- **Demo video recorder** - Playwright-based tool for recording demo videos (`demo-video/` directory)

---

## Bug Fixes

### Camera Stream Reconnection
Improved detection of stuck camera streams with automatic reconnection.

- Periodic stall detection checks every 5 seconds
- Automatic reconnection when stream stops receiving frames
- New `/api/v1/printers/{id}/camera/status` endpoint for stream health monitoring

### Active AMS Slot Display (H2D)
Fixed incorrect slot display on H2D printers with multiple AMS units connected to the same extruder.

- Now parses `snow` field from `device.extruder.info` which contains actual AMS ID
- Previously picked first AMS on the extruder, causing wrong display when multiple AMS connected
- Example: Switching from B2 to C1 now correctly shows C1 instead of A1

### Spoolman Sync
Fixed sync issues with Spoolman integration.

- Now only matches Bambu Lab vendor filaments when syncing
- Prevents incorrect matching with third-party filaments by color alone
- Improved filament matching accuracy

### Skip Objects Modal
Fixed object ID markers not correctly positioned over build plate preview.

- Now uses `bbox_all` from plate metadata for accurate coordinate mapping
- Markers correctly position relative to actual object bounds
- Works correctly for multi-plate projects

### Virtual Printer Fixes
Multiple fixes to improve virtual printer reliability:

- **Model codes** - Corrected SSDP model codes (C11=P1P, C12=P1S, N7=P2S)
- **Serial prefixes** - Fixed to match real Bambu Lab format (X1C=00M, P1S=01P, etc.)
- **Startup model** - Now correctly loads saved model from database on restart
- **Model change** - Changes now auto-restart the virtual printer (no manual disable needed)
- **Certificate persistence** - Fixed Docker volume mounting for proper cert storage

### Other Fixes
- **Archive card context menu** - Fixed positioning issues (#46)
- **Printer card cover image** - Fixed wrong image for multi-plate print files
- **Spoolman link function** - Improved "Link to Spoolman" in AMS slot detail modal
- **GCode viewer** - Minor improvements to visualization
- **Cover image retrieval** - Improved reliability of extraction

---

## Virtual Printer Setup

> **Important:** The virtual printer requires additional system configuration before it will work.

The setup documentation has been significantly improved:

- Prominent **"Setup Required"** warning in UI linking to documentation
- Certificate must **REPLACE** the last cert in slicer's `printer.cer` file (not append!)
- One CA certificate per slicer - replace when switching Bambuddy hosts
- Platform-specific instructions for Linux, Docker, macOS, Windows, Unraid, Synology, TrueNAS, Proxmox

Read the full guide: [Virtual Printer Setup](https://wiki.bambuddy.cool/features/virtual-printer/)

---

## Testing

- Added **16 integration tests** for print queue API endpoints
- Added **3 unit tests** for virtual printer model configuration
- Updated VirtualPrinterSettings tests for new UI layout and model codes

---

## Upgrade Notes

### From 0.1.6b5
Standard upgrade - no breaking changes.

```bash
# Docker
docker compose pull
docker compose up -d

# Native
git pull
pip install -r requirements.txt
```

### Virtual Printer Users
If you're using the virtual printer and switching hosts, you must **replace** (not add) the certificate in your slicer's `printer.cer` file. See the [setup guide](https://wiki.bambuddy.cool/features/virtual-printer/) for details.

---

## Full Changelog

See [CHANGELOG.md](https://github.com/maziggy/bambuddy/blob/main/CHANGELOG.md) for complete details.

---

**Thank you to everyone who reported issues and provided feedback!**
