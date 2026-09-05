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
  - 动态几何坐标换算器：消除全局缩放与 Retina 高分屏下的像素偏移，鼠标悬停与点击取点实现 **100% 像素级精准对齐**。
  - 点击点位呈现专属**发光虚线选中光环**，其详细参数卡片（需求值、实测值、Δxy、Δu'v'、超色域判定）**稳定常驻显示**，右侧数据表格自动联动平滑滚动并高亮对应行。
  - 沉浸式全屏放大视图：独立深黑全屏视口，彻底杜绝按钮重叠与表格元素穿透；彩色连续底图、DCI-P3、BT.2020、光谱轨迹、标号 5 组图层独立复选显隐。
  - 一键导出无水印、无操作按钮干扰的 3000×3000 4K 高分辨率 **PNG** 与标准无损矢量 **SVG**（自动触发浏览器下载保存）。
- **微调补差与色彩预测 (Offset & Compensation)**：
  - 每点独立支持 $(\delta x, \delta y)$ 步进调节与输入，实时预测补差后的期望落点与 RGB 驱动信号。
  - 支持一键全局平移补差（Global Offset），快速消除探头硬件或系统全局色偏。
- **感知均匀色差 ($\Delta u'v'$) 与 阈值高亮报警**：
  - 自动计算 CIE 1976 UCS 感知均匀色度差 $\Delta u'v' = \sqrt{(u'_m - u'_t)^2 + (v'_m - v'_t)^2}$。
  - 自动对实测色偏 $\Delta xy > 0.006$ 的点位进行醒目高亮警示。
- **外接电视专用独立测色靶窗 (`/patch`) 与 强制置顶功能 (Always on Top)**：
  - **系统级强制置顶 (Always on Top / PiP)**：集成 W3C Document Picture-in-Picture API，点击工具栏 `[📌 强制置顶]` 或快捷键 **`[T]`**，即可将靶窗提升为操作系统原生最高层级的独立悬浮窗（置顶于所有桌面应用之上）；主控制台提供 **`[📌 打开置顶靶窗]`** 一键直达入口。
  - **防息屏保持 (Screen Wake Lock)**：置顶运行期间自动启用屏幕唤醒锁，防止测试过程中电视或显示器意外息屏休眠。
  - **全黑防灼屏待机模式**：初始无色彩方块输出，仅显示中央定位准星，防止长时间静止高亮图像导致 OLED 灼屏。
  - **完整键盘快捷键体系**：
    - `[T]`：开启 / 关闭系统级强制置顶 (Always on Top)
    - `[F]`：全屏沉浸切换 (Fullscreen)
    - `[S]`：循环切换靶窗显示比例 (10%、20%、50%、全屏)
    - `[H]`：开启 / 关闭中央准星定位标框
    - `[B]`：切换纯黑 / 18% 灰背景底色
    - `[C]`：一键复位为全黑待机定位模式
    - `[ESC]`：关闭测试完成通知横幅 / 退出置顶
  - **自动测色完成视听提醒**：整轮点位或验证测试完成后，靶窗触发屏幕四周绿色脉冲呼吸闪烁与上升琶音音效提醒。
- **探头与出厂校色基准验证 (Validation) 及 型号直观识别**：
  - 自动检测并精准显示物理探头硬件真实型号（如 `X-Rite i1 DisplayPro` / `Calibrite Display Plus HL`），配备状态圆点指示。
  - 一键对 7 项标准原色与白点（红/绿/蓝/青/品红/黄/D65白场）执行光学复测，评估色度计探头状态与屏幕出厂校准水准。
- **完整中英双语界面 (i18n)**：
  - 前端控制台右上角一键切换 `[ 🌐 EN / 中文 ]`，实时无刷新切换，偏好记忆持久化；外接电视靶窗同步联动。
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
  - Dynamic geometric coordinate scaler: eliminates viewport zoom and Retina high-DPI offsets for **100% pixel-accurate point targeting**.
  - Clicking any point reveals an illuminated **dashed selection ring** and keeps the detailed parameter card (demand xy, measured xy, Δxy, Δu'v', gamut pass/exceeded status) **permanently displayed**, while the data table smoothly scrolls and highlights the row.
  - Immersive fullscreen diagram mode: isolated deep-slate viewport eliminating element overlap; 5 independent toggle layers for Spectrum, DCI-P3, BT.2020, Spectral Locus, and Labels.
  - One-click clean export of 3000×3000 4K high-resolution **PNG** and resolution-independent **SVG** (automatically initiates browser download).
- **Fine-Tuning Offset & Expected Compensation**:
  - Independent $(\delta x, \delta y)$ adjustments per coordinate with immediate target update and RGB drive signal calculation.
  - Global translation offset to rectify systematic colorimeter or pipeline shifts.
- **Perceptually Uniform Color Difference ($\Delta u'v'$) & Threshold Highlighting**:
  - Calculates CIE 1976 UCS distance: $\Delta u'v' = \sqrt{(u'_m - u'_t)^2 + (v'_m - v'_t)^2}$.
  - Highlights test points in warning red whenever $\Delta xy > 0.006$.
- **Dedicated External TV Target Window (`/patch`) with Always-on-Top (PiP)**:
  - **Native OS Always-on-Top (PiP)**: Built-in W3C Document Picture-in-Picture API enables true OS-level always-on-top floating patch window above all desktop applications with one click `[📌 Always on Top]` or hotkey **`[T]`**; quick launch button `[📌 Open Pinned Patch]` on the main dashboard.
  - **Screen Wake Lock**: Automatically maintains display wakefulness during calibration to prevent unexpected screen dimming or sleep.
  - **Pure-Black Standby Mode**: Default zero-luminance background with high-visibility center crosshair and alignment ring, preventing OLED panel burn-in.
  - **Keyboard Shortcut System**:
    - `[T]`: Toggle Always-on-Top mode (Picture-in-Picture)
    - `[F]`: Fullscreen toggle
    - `[S]`: Cycle patch window size (10%, 20%, 50%, 100%)
    - `[H]`: Toggle center crosshair alignment ring
    - `[B]`: Toggle black / 18% gray background
    - `[C]`: One-key reset to black standby alignment mode
    - `[ESC]`: Dismiss completion overlay / Exit pinned window
  - **Completion Audiovisual Alert**: Automatic border pulse flash and ascending chime upon finishing batch testing or validation.
- **Colorimeter Hardware Model Recognition & Factory Validation**:
  - Automatic detection and explicit display of physical hardware model (e.g. `X-Rite i1 DisplayPro` / `Calibrite Display Plus HL`) with live connection dot.
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
