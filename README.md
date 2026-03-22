<div align="center">
  <img src="assets/openmarkerIcon.png" alt="OpenMarker Logo" width="120" />

  # OpenMarker

  **AI-powered grading assistant for teachers and lecturers**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/version-1.0.1-green.svg)](https://github.com/dalexdavis/openmarker/releases)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

  [Download](#download) · [Features](#features) · [How It Works](#how-it-works) · [System Requirements](#system-requirements)

</div>

---

OpenMarker automatically evaluates essays and reports so you can spend more time teaching and engaging with students. In testing, OpenMarker showed an **average deviation of just 7%** compared to human grading making it a reliable tool that can save you hours of marking each week. (This is the initial version without any tuning or customization; improvements and refinements will be made in the next version.)

All processing runs entirely on your local computer using efficient large language models (LLMs). No cost & No data ever leaves your device.

---

## Download

Grab the latest release for your platform:

| Platform | Download |
|----------|----------|
| 🪟 Windows | [OpenMarker-Setup.exe](https://github.com/theDALEX/openmarker/releases/download/v1.0.1/OpenMarker.Setup.1.0.1.exe) |
| 🍎 macOS | [OpenMarker.dmg](https://github.com/theDALEX/openmarker/releases/download/v1.0.1/OpenMarker-1.0.1-arm64.dmg) |
| 🐧 Linux | [OpenMarker.AppImage](https://github.com/theDALEX/openmarker/releases/download/v1.0.1/OpenMarker-1.0.1.AppImage) |

> View all releases and changelogs on the [Releases page](https://github.com/theDALEX/openmarker/releases).

---

## Installation

OpenMarker is not code-signed for macOS, Windows, or Linux, so you may see a security warning on first launch. It is completely safe all processing runs locally on your machine.

**Windows**
1. Run the `.exe` installer
2. If a SmartScreen warning appears, click "More info" → "Run anyway"

**macOS**
1. Open the `.dmg` and drag OpenMarker to your Applications folder
2. Right-click the app → Open → Confirm to bypass the Gatekeeper warning

**Linux**
1. Make the AppImage executable: `chmod +x OpenMarker.AppImage`
2. Run it: `./OpenMarker.AppImage`

---

## Features

- AI-powered marking using local LLMs
- Supports custom marking matrices and criteria
- Batch process multiple student submissions at once
- Generates a detailed Word document with written feedback and grades per student
- Choose your AI model based on your hardware capabilities
- Fully offline — your data never leaves your device (after initial setup).

---

## How It Works

1. Load your marking criteria or matrix into OpenMarker
2. Import student submissions (`.docx` format)
3. Click **"Start Marking"**
4. OpenMarker assesses each submission and returns a detailed Word document with feedback and grades

> OpenMarker is an assistant, not a replacement. You stay in full control of every grading decision.

---

## System Requirements

- OS: Windows, macOS, or Linux (reasonably modern hardware)
- RAM: 4GB minimum (8GB+ recommended for larger models)
- Disk: 5GB free space (plus space for your chosen LLM)
- Works offline after the initial setup.

You can select the AI model that best fits your hardware — lighter models run on modest machines, while more capable models benefit from more RAM and a GPU.

---

## Roadmap

This is version 1 of OpenMarker. The next version will introduce:

- Grade balancing tailored to each educator's marking style
- Further reduction in grading deviation
- Improved UI and support for different file types.

---

## For Institutions

OpenMarker is designed primarily as a local, individual-use tool for teachers and lecturers. While it can serve as a working prototype for institutions, large-scale centralized deployment would require a different architecture. OpenMarker demonstrates the core workflow that can be extended for such systems.

---

## License

MIT © [Dalex Davis](https://github.com/theDALEX)
