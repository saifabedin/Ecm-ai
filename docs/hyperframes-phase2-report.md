# HyperFrames Phase 2 — Composition Generator Report

**Date:** 2026-05-16
**Status:** ✅ COMPOSITION GENERATOR VERIFIED — READY FOR PHASE 3
**Scope:** Isolated composition generation module + cinematic render test

---

## 1. FILESYSTEM EXPANSION VERIFIED

| Metric | Before | After |
|--------|--------|-------|
| EBS Volume | 50GB | 99GB |
| Partition (nvme0n1p1) | 49.9G | 98.9G |
| Filesystem (/) | 49G | 96G |
| Free Space | 812MB (99%) | 49GB (50%) |
| Filesystem Type | ext4 | ext4 |

### Commands Executed
```bash
sudo growpart /dev/nvme0n1 1     # Expanded partition 1
sudo resize2fs /dev/nvme0n1p1    # Resized ext4 filesystem
```

### PM2 Impact
- **ecm-api-staging:** online, 0 restarts, no interruption
- **ecm-worker-staging:** online, 0 restarts, no interruption

---

## 2. NEW MODULE CREATED

### File: `backend/hyperframes/composition-generator.cjs`

**Purpose:** Generates HyperFrames-compatible HTML compositions from ECM-AI-OS SceneManager scene data.

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `generateComposition(config)` | async function | Main entry point — generates full project directory |
| `generateCompositionHtml(config)` | function | Returns HTML string only (no file I/O) |
| `calculateTotalDuration(scenes)` | function | Sums scene durations |
| `copyAssetsToProject(projectDir, assets)` | function | Copies media to project assets/ directory |
| `DEFAULT_WIDTH` | constant | 720 |
| `DEFAULT_HEIGHT` | constant | 1280 |
| `DEFAULT_FPS` | constant | 30 |

**Input Contract (matches engine4-video.cjs SceneManager):**
```javascript
{
  scenes: [
    {
      sceneId: "hook_001",
      sceneType: "hook" | "story" | "cta" | "transition",
      scriptText: "Transform your business...",
      startTime: 0,
      duration: 4,
      customTransition: "fade" | "slide_left" | "zoom_out" | null,
    }
  ],
  assets: {
    avatarVideo: "/path/to/avatar.mp4",
    brollPaths: ["/path/to/broll1.mp4", ...],
    voiceoverPath: "/path/to/voiceover.mp3",
    musicPath: "/path/to/music.mp3",
  },
  outputDir: "/tmp/render-project",
  options: {
    width: 720,
    height: 1280,
    fps: 30,
    subtitleStyle: "cinematic",
    showLogo: true,
  }
}
```

**Output:**
```javascript
{
  projectDir: "/tmp/render-project",
  htmlPath: "/tmp/render-project/index.html",
  totalDuration: 22.5,
  assetCount: 6,
  copiedAssets: {
    avatarVideo: "/tmp/render-project/assets/avatar.mp4",
    "broll-0": "/tmp/render-project/assets/broll-0.mp4",
    ...
  },
  sceneCount: 4,
}
```

---

## 3. GENERATED FILE STRUCTURE

```
/tmp/hyperframes-phase2-test/
├── index.html              (14KB, 510 lines)
├── cinematic-output.mp4    (2.18MB, 22.5s)
├── assets/
│   ├── avatar.mp4          (43KB, 720x1280, 20s)
│   ├── broll-0.mp4         (16KB, 1920x1080, 5s)
│   ├── broll-1.mp4         (17KB, 1920x1080, 5s)
│   ├── broll-2.mp4         (17KB, 1920x1080, 5s)
│   ├── voiceover.mp3       (79KB, 20s)
│   └── music.mp3           (79KB, 20s)
└── raw-assets/             (source test assets)
    ├── avatar.mp4
    ├── broll-0.mp4
    ├── broll-1.mp4
    ├── broll-2.mp4
    ├── voiceover.mp3
    └── music.mp3
```

---

## 4. COMPOSITION STRUCTURE (Generated HTML)

### Elements Generated

| Element Type | Count | Tracks | Description |
|-------------|-------|--------|-------------|
| Avatar `<video>` | 4 | Track 0 | Sidebar layout (180px left, full height) |
| B-roll `<video>` | 4 | Track 1 | Content area (468px right, full height) |
| Subtitle `<div>` | 9 | Track 10 | Cinematic style, word-level timing |
| Audio `<audio>` | 2 | Track 20-21 | Voiceover (1.0 volume), Music (0.25 volume) |
| Transition `<div>` | 3 | Track 5 | Fade overlays at scene boundaries |
| Logo `<div>` | 1 | Track 15 | Top-right corner, 3s duration |

### Layout
```
┌─────────────────────────────────────────┐
│ [LOGO]                                  │
│ ┌──────┬──────────────────────────────┐ │
│ │      │                              │ │
│ │      │                              │ │
│ │AVATAR│         B-ROLL               │ │
│ │180px │         468px                │ │
│ │      │                              │ │
│ │      │                              │ │
│ │      │                              │ │
│ └──────┴──────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │         SUBTITLES (cinematic)       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
          720px × 1280px (9:16)
```

### GSAP Animations

| Animation | Target | Effect | Duration |
|-----------|--------|--------|----------|
| Ken Burns | Avatar videos | Scale 1.0 → 1.08 | Per scene |
| Pan | B-roll videos | X: 0 → -23px | Per scene |
| Fade In | Subtitles | Opacity 0→1, Y: 15→0 | 0.3s |
| Fade Out | Subtitles | Opacity 1→0, Y: 0→-10 | 0.2s |
| Crossfade | Transitions | Opacity 0→1→0 | 0.5s total |
| Pop In | Logo | Opacity 0→1, Scale 0.8→1 | 0.5s |
| Fade Out | Logo | Opacity 1→0 | 0.5s |

---

## 5. RENDER RESULTS

### Test Composition
| Metric | Value |
|--------|-------|
| Scenes | 7 total (4 content + 3 transitions) |
| Hook duration | 4s |
| Story 1 duration | 6s |
| Story 2 duration | 6s |
| CTA duration | 5s |
| **Total duration** | **22.5s** |
| Subtitle lines | 9 (word-level, ~5 words each) |

### Render Performance
| Metric | Value |
|--------|-------|
| Composition generation | 12,842ms (includes asset creation) |
| HyperFrames render | 140,580ms (2m 20s) |
| **Total test time** | **153,513ms (2m 33s)** |
| Frames captured | 675 (22.5s × 30fps) |
| Output format | H.264, yuv420p |
| Output resolution | 720×1280 |
| Output framerate | 30fps |
| Output size | 2.18MB |
| Output bitrate | 813 kbps |
| Audio | AAC, 48kHz, stereo |

### Memory Usage
| Metric | Value |
|--------|-------|
| Initial heap | 26MB |
| Final heap | 33MB |
| **Delta** | **+7MB** |
| Chrome peak | ~256MB (estimated) |
| System total | 15GB |
| System used | 1.9GB (13%) |

### Cleanup Verification
| Check | Result |
|-------|--------|
| Chrome processes after render | 0 ✅ |
| Work directories after render | 0 ✅ |
| Temp file leaks | None ✅ |

---

## 6. VERIFICATION CHECKLIST

| Requirement | Status | Detail |
|-------------|--------|--------|
| 9:16 vertical format | ✅ | 720×1280 confirmed |
| Deterministic GSAP timelines | ✅ | Seek-driven, `window.__timelines["ecm-video"]` registered |
| Scene-based timing | ✅ | Each scene has correct data-start/data-duration |
| Subtitle timing | ✅ | 9 word-level subtitle elements with proper fade in/out |
| Avatar video layout | ✅ | Sidebar 180px left, full height, Ken Burns animation |
| B-roll video layout | ✅ | Content area 468px right, pan animation |
| Background music | ✅ | Audio element at 0.25 volume, full duration |
| Voiceover audio | ✅ | Audio element at 1.0 volume, full duration |
| Transition placeholders | ✅ | 3 fade overlays at scene boundaries |
| Logo overlay | ✅ | Top-right corner, 3s with pop-in animation |
| Chrome cleanup | ✅ | 0 processes after render |
| Temp cleanup | ✅ | No work directories remaining |
| PM2 stability | ✅ | Both services online, 0 restarts |
| No engine4-video.cjs changes | ✅ | File untouched |
| No worker/orchestrator changes | ✅ | Queue flow untouched |
| Backward compatibility | ✅ | Module is fully isolated |

---

## 7. REAL BLOCKERS

### BLOCKER 1: Render Time for Long Videos ⚠️ MONITORING
- **Current:** 22.5s composition = 140s render (~6.2x real-time)
- **Projected 45-60s video:** 280-370s render (~4.7-6.2 minutes)
- **Impact:** Within 5-minute BullMQ timeout? **NO** — current timeout is 300s
- **Mitigation for Phase 3:**
  - Increase BullMQ `lockDuration` from 600s to 900s
  - Increase job `timeout` from 300s to 600s
  - Consider `quality: "draft"` for faster iteration
  - GPU encoding (`--gpu`) could reduce encode time by 30-50%

### BLOCKER 2: Avatar Video Looping ⚠️ KNOWN
- **Issue:** Single avatar video is reused across multiple scenes via separate `<video>` elements
- **Current behavior:** Each element plays the same source file from its data-start time
- **Impact:** If avatar video is shorter than total duration, playback may end early
- **Mitigation for Phase 3:** Ensure D-ID avatar video covers full composition duration, or implement video looping in composition generator

### BLOCKER 3: B-roll Video Duration Mismatch ⚠️ KNOWN
- **Issue:** B-roll videos are landscape (1920×1080) but displayed in portrait crop (468×1280)
- **Current behavior:** `object-fit: cover` handles the crop, but aspect ratio is very different
- **Impact:** B-roll content may be partially cropped
- **Mitigation for Phase 3:** Pre-crop b-roll to 9:16 before composition, or use HyperFrames' built-in video cropping

---

## 8. NON-BLOCKERS

| Item | Status | Notes |
|------|--------|-------|
| Disk space | ✅ 49GB free | Ample for production renders |
| Node.js | ✅ v22.22.2 | Compatible |
| FFmpeg | ✅ 4.4.2 | Streaming encode works |
| Chrome headless-shell | ✅ | Clean lifecycle |
| Memory | ✅ +7MB heap | Well within limits |
| Module isolation | ✅ | No changes to existing code |
| Asset copying | ✅ | 6 assets copied correctly |
| HTML generation | ✅ | 510 lines, valid structure |
| Audio mixing | ✅ | HyperFrames handles voice + music |

---

## 9. COMPOSITION GENERATOR CAPABILITIES

### What It Does
- Generates complete HyperFrames HTML from SceneManager-compatible scene data
- Creates sidebar avatar layout with Ken Burns zoom animation
- Creates b-roll content area with pan animation
- Generates word-level subtitle elements with cinematic fade in/out
- Places voiceover and background music audio tracks
- Creates transition overlay elements with fade animations
- Adds logo overlay placeholder with pop-in animation
- Copies all media assets to project directory
- Calculates total composition duration

### What It Does NOT Do (Phase 3+)
- Does NOT integrate into engine4-video.cjs yet
- Does NOT modify BullMQ worker flow
- Does NOT replace existing FFmpeg pipeline
- Does NOT handle real D-ID/Pexels/ElevenLabs assets yet
- Does NOT implement shader transitions (uses CSS overlays)
- Does NOT implement motion graphics beyond GSAP basics

---

## 10. RECOMMENDED NEXT STEP

Proceed to **Phase 3: Producer Integration** — wrap `@hyperframes/producer` in a dedicated renderer module that:
1. Accepts composition generator output
2. Executes HyperFrames render with proper timeout handling
3. Returns output path for existing `masterVideo()` post-processing
4. Includes memory guards and browser cleanup

**Prerequisites before Phase 3:**
- Decide on BullMQ timeout increase (300s → 600s)
- Decide on PM2 worker memory limit increase (1G → 3G)
- Test with 45-60s composition to validate render time projections
