# 广色域打点测试与补差分析系统
### Wide Gamut Target Testing & Offset Analysis System

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue.svg)](https://github.com)
[![Hardware](https://img.shields.io/badge/Hardware-Calibrite%20%2F%20X--Rite%20Display%20Plus%20HL-success.svg)](https://calibrite.com)
[![Driver](https://img.shields.io/badge/Engine-ArgyllCMS%20spotread-orange.svg)](https://www.argyllcms.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](#english-documentation) | [中文说明文档](#中文说明文档)

---

## 中文说明文档

### 1. 系统概述
**广色域打点测试与补差分析系统** 是一套专为 **macOS 与 Windows** 平台打造的专业级色度学评测与微调补差工具。针对高动态范围 (HDR) 电视、OLED/Mini-LED 广色域显示器，在 DCI-P3、BT.2020 及 Native（面板物理极限）色域下的打点测试与色彩偏移分析。

系统直接驱动硬件探头（**Calibrite / X-Rite Display Plus HL**、**i1Display Pro** 等），基于官方 **ArgyllCMS `spotread`** 底层引擎进行 100% 真实光学采样（完全无任何软件仿真伪造数据）。

---

### 2. 核心特性

- **跨平台原生支持 (macOS & Windows)**：
  - macOS: 基于 POSIX 伪终端 (`pty`) 与 Homebrew ArgyllCMS 驱动。
  - Windows: 基于非阻塞后台多线程管道 (`subprocess.Popen`) 与 Windows ArgyllCMS 驱动路径智能探测。
- **15 关键坐标点位精准打点与自定义点扩展**：
  - 默认内置 P1 至 P15 关键饱和度与边界点（包含修正后的超蓝界极限 P11 `(0.1405, 0.0530)`）。
  - 支持动态新增自定义点位（自由命名与设定需求坐标），支持表格点位即时单点删除（仅作用于当前页内存，重新运行或点击恢复按钮即可复原）。
- **CIE 1931 色域图平滑交互与矢量图导出**：
  - 支持鼠标滚轮缩放（最高 30x）与左键拖拽平移，一键复位。
  - 支持全屏沉浸式色度图视图与可选色彩底图叠加渲染。
  - 支持一键导出无水印、无操作按钮干扰的高清晰度 **PNG** 与 **标准矢量 SVG**。
- **微调补差与色彩预测 (Offset & Compensation)**：
  - 每点独立支持 $(\delta x, \delta y)$ 步进调节与输入，实时预测补差后的期望落点。
  - 支持一键全局平移补差（Global Offset），快速消除探头硬件或系统全局色偏。
- **感知均匀色差 ($\Delta u'v'$) 与 阈值高亮报警**：
  - 自动计算 CIE 1976 UCS 感知均匀色度差 $\Delta u'v' = \sqrt{(u'_m - u'_t)^2 + (v'_m - v'_t)^2}$。
  - 自动对实测色偏 $\Delta xy > 0.006$ 的点位进行高亮警示。
- **外接电视专用独立测色靶窗 (`/patch`)**：
  - 独立全黑待机模式：初始无色块输出，仅显示中央定位准星，防止长时间静止灼屏。
  - 键盘快捷键：`[F]` 全屏切换、`[S]` 切换靶窗比例（10%、20%、50%、全屏）、`[H]` 准星开关、`[B]` 背景黑/灰切换、`[C]` 复位待机。
  - 自动测色完成提示：整轮点位或验证测试完成后，靶窗触发屏幕四周呼吸闪烁动画与上升琶音音效提醒。
- **探头与出厂校色基准验证 (Validation)**：
  - 一键对 7 项标准原色与白点（红/绿/蓝/青/品红/黄/D65白场）执行光学复测，评估色度计探头状态与屏幕出厂校准精度。
- **完整中英双语界面 (i18n)**：
  - 前端控制台右上角一键切换 `[ 🌐 EN / 中文 ]`，实时无刷新切换，偏好记忆持久化；外接电视靶窗同步响应。
  - 终端控制台、后台运行日志及导出的 CSV 报表均采用纯英文标准化格式，彻底杜绝乱码。

---

### 3. 快速启动

#### 环境要求
- **Python 3.10+**
- **硬件色度计**：Calibrite Display Plus HL / Display Pro / i1Display Pro
- **ArgyllCMS**：
  - **macOS**: `brew install argyll-cms`
  - **Windows**: 安装 [DisplayCAL](https://displaycal.net) 或下载解压 [ArgyllCMS](https://www.argyllcms.com) 并将其 `bin` 目录加入系统环境变量 `PATH`（或放置于 `C:\ArgyllCMS\bin\`）。

#### macOS / Linux
```bash
# 给予脚本执行权限并启动
chmod +x start.sh
./start.sh
```

#### Windows
双击运行 `start.bat`，或在命令提示符 (CMD) / PowerShell 中执行：
```cmd
start.bat
```

> **提示**：启动脚本会自动释放 8000 端口占用、安装 `requirements.txt` 依赖并自动弹出默认浏览器打开主控制台。

---

### 4. 命令行独立运行 (CLI)
若不需要网页界面，可直接在终端中调用独立测色脚本：
```bash
# 执行硬件 15 点测色并输出表格报告
python3 cli.py

# 调整点间延时 (例如每点等待 3 秒)
python3 cli.py --delay 3.0

# 启用全局微调补差
python3 cli.py --offset-x 0.0015 --offset-y -0.0010
```

---

## English Documentation

### 1. Overview
The **Wide Gamut Target Testing & Offset Analysis System** is a professional-grade colorimetric evaluation and offset compensation suite tailored for **macOS and Windows**. Designed specifically for high-dynamic-range (HDR) televisions, OLED, and Mini-LED wide-gamut displays, it evaluates target coordinates across DCI-P3, BT.2020, and Native (panel physical limit) color spaces.

The system communicates directly with hardware colorimeters (**Calibrite / X-Rite Display Plus HL**, **i1Display Pro**) using the official **ArgyllCMS `spotread`** low-level engine for 100% genuine optical sampling without software simulation.

---

### 2. Key Features

- **Cross-Platform Support (macOS & Windows)**:
  - macOS: POSIX Pseudo-terminal (`pty`) with Homebrew ArgyllCMS.
  - Windows: Non-blocking threaded pipe stream (`subprocess.Popen`) with automatic ArgyllCMS binary path discovery.
- **15 Target Coordinates & Dynamic Custom Points**:
  - Pre-configured targets P1 through P15 (including corrected extreme blue boundary P11 `(0.1405, 0.0530)`).
  - Add custom target points with user-defined names and coordinates.
  - Instant row deletion for any target point (P1–P15 and custom points; session-based with one-click restore).
- **Interactive CIE 1931 Chromaticity Diagram & Vector Export**:
  - Smooth wheel zoom (up to 30x) and drag-to-pan with one-click reset.
  - Fullscreen expansion and optional chromatic spectrum overlay.
  - Clean export of high-resolution **PNG** and resolution-independent **SVG** without UI overlays.
- **Fine-Tuning Offset & Expected Compensation**:
  - Independent $(\delta x, \delta y)$ adjustments per coordinate with immediate target update.
  - Global translation offset to rectify systematic colorimeter or pipeline shifts.
- **Perceptually Uniform Color Difference ($\Delta u'v'$) & Threshold Highlighting**:
  - Calculates CIE 1976 UCS distance: $\Delta u'v' = \sqrt{(u'_m - u'_t)^2 + (v'_m - v'_t)^2}$.
  - Highlights test points in warning red whenever $\Delta xy > 0.006$.
- **Dedicated External TV Target Window (`/patch`)**:
  - Default pure-black standby mode with crosshair target alignment ring (prevents panel burn-in).
  - Hotkeys: `[F]` Fullscreen, `[S]` Cycle size (10%, 20%, 50%, 100%), `[H]` Crosshair toggle, `[B]` Black/Gray background, `[C]` Standby reset.
  - Automatic completion alert with border pulse animation and audio chime.
- **Colorimeter & Factory Calibration Validation**:
  - One-click optical verification across 7 primary/secondary reference colors and D65 white point.
- **Full Bilingual i18n & Clean English Output**:
  - Immediate language switching `[ 🌐 EN / 中文 ]` on frontend with `localStorage` persistence.
  - 100% pure English terminal logs, backend messages, and CSV exports to eliminate encoding artifacts.

---

### 3. Quick Start

#### Requirements
- **Python 3.10+**
- **Colorimeter Hardware**: Calibrite Display Plus HL / Display Pro / i1Display Pro
- **ArgyllCMS Engine**:
  - **macOS**: `brew install argyll-cms`
  - **Windows**: Install [DisplayCAL](https://displaycal.net) or place ArgyllCMS binaries in `C:\ArgyllCMS\bin\` or add to system `PATH`.

#### macOS / Linux Launch
```bash
chmod +x start.sh
./start.sh
```

#### Windows Launch
Double-click `start.bat` or run in CMD / PowerShell:
```cmd
start.bat
```

The script cleans port 8000, installs packages from `requirements.txt`, boots the FastAPI service, and automatically opens `http://127.0.0.1:8000`.

---

### 4. CLI Headless Mode
```bash
# Run 15-point hardware measurement
python3 cli.py

# Adjust measurement delay (e.g. 3.0s interval)
python3 cli.py --delay 3.0

# Apply global offset compensation
python3 cli.py --offset-x 0.0015 --offset-y -0.0010
```

---

### 5. Project Structure

```
├── README.md                      # Comprehensive documentation (EN & ZH)
├── requirements.txt               # Python package dependencies
├── start.sh                       # macOS / Linux one-click launch script
├── start.bat                      # Windows one-click launch script
├── cli.py                         # Standalone command-line testing tool
├── backend/
│   ├── color_engine.py            # CIE 1931 / CIE 1976 UCS color math & target definitions
│   ├── meter_driver.py            # Cross-platform ArgyllCMS spotread hardware driver
│   └── server.py                  # FastAPI application & WebSocket server
├── frontend/
│   ├── index.html                 # Main control console UI
│   ├── patch.html                 # External TV target patch window
│   ├── app.js                     # Core application logic, i18n & API sync
│   └── cie1931.js                 # CIE 1931 canvas rendering, zoom/pan & vector SVG export
└── fraction/                      # Exported test records, CSV reports & diagrams
```

---

### 6. License
MIT License. Open-source and free for personal and research use.
