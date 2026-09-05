/**
 * Main Application Logic & Data Binding for Wide Gamut Target Testing & Offset Analysis System.
 * STRICTLY HARDWARE ONLY - REAL PHYSICAL OPTICAL READINGS.
 * Supports Dynamic Chinese/English (i18n) Bilinguality, All-point deletion & restoration.
 */

let chart = null;
let appState = {
    points: [],
    settings: {},
    black_baseline: null,
    selectedPointId: 1
};

let ws = null;
let currentLang = localStorage.getItem('app_lang') || 'zh';

const I18N = {
    zh: {
        app_title: "广色域打点测试与补差分析系统",
        meter_checking: "探头状态检查中...",
        meter_connected: "硬件色度计已连接",
        meter_missing: "未检测到物理探头",
        val_btn: "标准原色校准验证",
        tv_window_btn: "打开测色靶窗",
        tv_window_top_btn: "📌 打开置顶靶窗",
        export_csv_btn: "导出 CSV",
        export_png_btn: "导出 4K PNG",
        export_svg_btn: "导出矢量图 (SVG)",
        chart_title: "CIE 1931 色度图 (缩放与拖拽视图)",
        chart_fit: "聚焦色域",
        chart_reset: "复位全图",
        chart_fullscreen: "全屏放大查看",
        chart_exit_fullscreen: "✕ 退出全屏 [ESC]",
        chart_tip: "提示: 滚轮自由缩放，按住左键拖拽平移",
        chk_spectrum: "显示彩色底图",
        chk_locus: "光谱轨迹",
        chk_labels: "编号标号",
        stat_exceeded: "超 DCI-P3 点位数",
        stat_avg_dxy: "平均偏差 Δxy",
        stat_avg_duv: "平均色差 Δu'v'",
        stat_progress: "已测进度",
        table_card_title: "测试坐标与测量微调分析表",
        btn_add_point: "+ 新增自定义坐标点",
        btn_restore_points: "恢复默认点位",
        btn_reset_data: "重置数据",
        step1_title: "第一步: 测前黑场校正与环境漏光自检",
        black_y_label: "基准亮度",
        black_leak_label: "漏光状态",
        black_uncal: "未校准",
        black_pending: "待检测",
        black_normal: "正常 (无明显漏光)",
        black_leaking: "疑似漏光 (>0.3 nit)",
        chk_flare: "扣除黑场光学底噪",
        btn_measure_black: "一键测黑场基准",
        btn_measure_all: "一键自动测量全套坐标",
        btn_measure_selected: "测定选中点",
        cadence_label: "测量间隔:",
        cadence_sec: "秒",
        cadence_rec: "推荐",
        hdr_label: "HDR 模式",
        container_label: "信号容器:",
        step3_title: "全局校准补差 (Global Offset):",
        step3_desc: "(补偿探头间仪器误差)",
        btn_reset_offsets: "清零补差",
        th_point: "点位",
        th_target: "需求值 (x, y)",
        th_measured: "实测值 (x, y)",
        th_delta_xy: "偏差 Δxy",
        th_measured_y: "实测亮度 Y",
        th_offset: "微调补差 (δx, δy)",
        th_delta_uv: "色差 Δu'v'",
        th_rgb: "RGB值",
        th_verdict: "测试判定",
        th_actions: "操作",
        btn_tv_display: "靶窗显示",
        btn_measure_this: "测此点",
        btn_delete: "删除",
        verdict_exceeded: "超色域达标",
        verdict_inside: "未超P3色域",
        verdict_pass: "合格",
        verdict_delta_exceeded: "超差",
        verdict_unmeasured: "待测",
        tip_show_tv: "送信号到电视靶窗",
        tip_measure: "测量该点",
        tip_delete: "删除该点位 (仅当前页有效，重启恢复)",
        tip_target_cell: "点击可修改需求值",
        tip_measured_cell: "双击可手动录入实测值",
        tip_effective_target: "计入微调补差后实际送往电视靶窗的色彩坐标",
        lbl_effective_target: "实际靶向",
        modal_add_title: "新建自定义测试坐标点",
        modal_lbl_name: "点位名称说明:",
        modal_lbl_x: "需求值 x (0.0 ~ 1.0):",
        modal_lbl_y: "需求值 y (0.0 ~ 1.0):",
        btn_cancel: "取消",
        btn_save_add: "保存并添加到测试",
        val_modal_title: "🎯 标准原色校准与探头偏差验证",
        val_modal_desc: "测试 DCI-P3 纯正白场(D65)、RGBW 与 CMY 标准基准色。若屏幕在标准域已出厂校准且探头工作正常，此处实测偏差将极小 (Δxy ≤ 0.003)。",
        val_badge_excellent: "校准极佳",
        val_badge_good: "良好达标",
        val_badge_deviation: "超差偏置",
        val_badge_pending: "待验证",
        val_measure_btn: "测此项",
        val_all_btn: "一键全测标准原色 (7色)",
        val_reset_btn: "重置记录",
        val_ready: "就绪",
        val_th_primary: "基准原色",
        val_th_target: "标准目标 (x, y)",
        val_th_measured: "物理实测 (x, y)",
        val_th_luminance: "亮度 (nits)",
        val_th_delta: "偏差 Δxy",
        val_th_verdict: "评定",
        val_th_action: "操作",
        btn_close: "关闭"
    },
    en: {
        app_title: "Wide Gamut Target Testing & Offset Analysis System",
        meter_checking: "Checking probe status...",
        meter_connected: "Colorimeter Connected",
        meter_missing: "Colorimeter Disconnected",
        val_btn: "Primary Calibration Validation",
        tv_window_btn: "Open Target Patch",
        tv_window_top_btn: "📌 Open Pinned Patch",
        export_csv_btn: "Export CSV",
        export_png_btn: "Export 4K PNG",
        export_svg_btn: "Export Vector (SVG)",
        chart_title: "CIE 1931 Chromaticity Diagram",
        chart_fit: "Focus Gamut",
        chart_reset: "Reset View",
        chart_fullscreen: "Fullscreen View",
        chart_exit_fullscreen: "✕ Exit Fullscreen [ESC]",
        chart_tip: "Tip: Scroll to zoom, left-click & drag to pan",
        chk_spectrum: "Color Spectrum Overlay",
        chk_locus: "Spectral Locus",
        chk_labels: "Point Labels",
        stat_exceeded: "Exceeded P3 Points",
        stat_avg_dxy: "Avg Delta xy",
        stat_avg_duv: "Avg Delta u'v'",
        stat_progress: "Test Progress",
        table_card_title: "Target Coordinates & Offset Analysis Table",
        btn_add_point: "+ Add Custom Point",
        btn_restore_points: "Restore Default Points",
        btn_reset_data: "Reset Data",
        step1_title: "Step 1: Black Baseline & Ambient Leakage Calibration",
        black_y_label: "Baseline Luminance",
        black_leak_label: "Leakage Status",
        black_uncal: "Uncalibrated",
        black_pending: "Pending",
        black_normal: "Normal (No leakage)",
        black_leaking: "Leakage Warning (>0.3 nit)",
        chk_flare: "Compensate Optical Flare",
        btn_measure_black: "Measure Black Level",
        btn_measure_all: "Auto Measure All Points",
        btn_measure_selected: "Measure Selected Point",
        cadence_label: "Interval:",
        cadence_sec: "s",
        cadence_rec: "Recommended",
        hdr_label: "HDR Mode",
        container_label: "Signal Container:",
        step3_title: "Global Offset Compensation (Global Offset):",
        step3_desc: "(Compensates inter-instrument variance)",
        btn_reset_offsets: "Reset Offsets",
        th_point: "Point",
        th_target: "Target (x, y)",
        th_measured: "Measured (x, y)",
        th_delta_xy: "Delta xy",
        th_measured_y: "Luminance Y",
        th_offset: "Offset (dx, dy)",
        th_delta_uv: "Delta u'v'",
        th_rgb: "RGB Value",
        th_verdict: "Verdict",
        th_actions: "Actions",
        btn_tv_display: "Show on TV",
        btn_measure_this: "Measure",
        btn_delete: "Delete",
        verdict_exceeded: "EXCEEDED_P3",
        verdict_inside: "IN_P3_GAMUT",
        verdict_pass: "PASS",
        verdict_delta_exceeded: "DEVIATION",
        verdict_unmeasured: "PENDING",
        tip_show_tv: "Send signal to TV patch window",
        tip_measure: "Measure this point",
        tip_delete: "Delete this point (Current session only; restored on server restart)",
        tip_target_cell: "Click to modify target coordinates",
        tip_measured_cell: "Double-click to manually enter measured value",
        tip_effective_target: "Effective coordinates sent to target window after offsets",
        lbl_effective_target: "Effective Target",
        modal_add_title: "Add Custom Target Coordinate",
        modal_lbl_name: "Target Name / Label:",
        modal_lbl_x: "Target x (0.0 ~ 1.0):",
        modal_lbl_y: "Target y (0.0 ~ 1.0):",
        btn_cancel: "Cancel",
        btn_save_add: "Save & Add to Test",
        val_modal_title: "🎯 Primary Calibration & Probe Validation",
        val_modal_desc: "Evaluates DCI-P3 D65 white point, RGBW and CMY reference primaries. Factory calibrated displays paired with an accurate colorimeter yield negligible deviation (Δxy ≤ 0.003).",
        val_badge_excellent: "EXCELLENT",
        val_badge_good: "GOOD",
        val_badge_deviation: "DEVIATION",
        val_badge_pending: "PENDING",
        val_measure_btn: "Test Item",
        val_all_btn: "Measure All Primaries (7 Colors)",
        val_reset_btn: "Reset Records",
        val_ready: "Ready",
        val_th_primary: "Reference Primary",
        val_th_target: "Target (x, y)",
        val_th_measured: "Measured (x, y)",
        val_th_luminance: "Luminance (nits)",
        val_th_delta: "Delta xy",
        val_th_verdict: "Verdict",
        val_th_action: "Action",
        btn_close: "Close"
    }
};

function t(key, fallback = '') {
    const dict = I18N[currentLang] || I18N['zh'];
    return dict[key] !== undefined ? dict[key] : (fallback || key);
}

function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('app_lang', currentLang);
    applyTranslations();
}

function formatApiError(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (typeof err.detail === "string") return err.detail;
    if (Array.isArray(err.detail)) {
        return err.detail.map(d => d.msg || JSON.stringify(d)).join("; ");
    }
    if (err.detail && typeof err.detail === "object") {
        return err.detail.msg || JSON.stringify(err.detail);
    }
    return err.message || JSON.stringify(err);
}

function updateMeterDisplay() {
    const dot = document.getElementById('meter-dot');
    const label = document.getElementById('meter-label');
    if (!dot || !label) return;
    const info = appState.meter_info;
    if (info && info.has_hardware) {
        dot.className = 'dot dot-green';
        let devName = '';
        if (info.instruments && Array.isArray(info.instruments)) {
            const hw = info.instruments.find(i => i.is_colorimeter);
            if (hw && hw.name) {
                let clean = hw.name.replace(/^hid\d*:\s*\(?/, '').replace(/\)?$/, '').trim();
                if (clean.includes(',')) {
                    clean = clean.split(',')[0].trim();
                }
                devName = clean;
            }
        }
        if (devName) {
            label.innerText = devName;
            label.title = `${currentLang === 'en' ? 'Hardware probe connected' : '硬件色度计已就绪'}: ${devName}`;
        } else {
            label.innerText = currentLang === 'en' ? 'Colorimeter Connected' : '硬件色度计已连接';
            label.title = '';
        }
    } else if (info) {
        dot.className = 'dot dot-purple';
        label.innerText = currentLang === 'en' ? 'Colorimeter Disconnected' : '未检测到物理探头';
        label.title = '';
    } else {
        dot.className = 'dot dot-purple';
        label.innerText = currentLang === 'en' ? 'Checking probe status...' : '探头状态检查中...';
        label.title = '';
    }
}

function applyTranslations() {
    // Update language toggle button text: when currently in Chinese, show '🌐 English' so English speakers know where to click!
    const btnLang = document.getElementById('btn-lang-toggle');
    if (btnLang) {
        btnLang.innerText = currentLang === 'en' ? '🌐 中文' : '🌐 English';
    }

    // Update document title
    document.title = t('app_title') + (currentLang === 'en' ? ' - Wide Gamut Target Testing' : ' - CIE 1931');

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[currentLang] && I18N[currentLang][key]) {
            el.innerText = I18N[currentLang][key];
        }
    });

    // Update select options
    const selDelay = document.getElementById('select-auto-delay');
    if (selDelay && selDelay.options.length >= 4) {
        selDelay.options[0].text = currentLang === 'en' ? '2.0 s' : '2.0 秒';
        selDelay.options[1].text = currentLang === 'en' ? '3.0 s (Recommended)' : '3.0 秒 (推荐)';
        selDelay.options[2].text = currentLang === 'en' ? '4.0 s' : '4.0 秒';
        selDelay.options[3].text = currentLang === 'en' ? '5.0 s' : '5.0 秒';
    }

    const selContainer = document.getElementById('select-container');
    if (selContainer && selContainer.options.length >= 2) {
        selContainer.options[0].text = currentLang === 'en' ? 'Native Passthrough (Unclipped)' : 'Native 原生直通 (无截断)';
        selContainer.options[1].text = currentLang === 'en' ? 'BT.2020 (Recommended/Wide Gamut)' : 'BT.2020 (推荐/广色域)';
    }

    // Update meter status
    updateMeterDisplay();

    // Update chart language safely
    try {
        if (chart && chart.setLanguage) {
            chart.setLanguage(currentLang);
        }
    } catch (e) {
        console.warn("Chart setLanguage warning:", e);
    }

    // Re-render table and stats with new language
    try {
        renderTable();
        updateStats();
        if (appState.validation_primaries) {
            renderValidationUI(appState.validation_primaries, appState.validation_summary);
        }
    } catch (e) {
        console.warn("applyTranslations render error:", e);
    }
}

async function loadInitialState() {
    try {
        const res = await fetch('/api/state');
        if (res.ok) {
            const data = await res.json();
            handleServerEvent({ type: 'INIT_STATE', state: data });
        }
    } catch (e) {
        console.warn("Could not pre-fetch /api/state, waiting for WebSocket:", e);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        chart = new CIE1931Chart('cie-canvas');
        window.onChartPointSelected = (pointId) => {
            selectPoint(pointId);
        };
    } catch (e) {
        console.error("CIE1931Chart initialization failed:", e);
    }

    // Connect WebSocket and fetch state immediately
    try {
        connectWebSocket();
    } catch (e) {
        console.error("WebSocket connection error:", e);
    }

    try {
        await loadInitialState();
    } catch (e) {
        console.error("loadInitialState error:", e);
    }

    try {
        applyTranslations();
    } catch (e) {
        console.error("applyTranslations error:", e);
    }
});

function connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.onopen = () => {
        console.log("WebSocket connected to test server");
    };

    ws.onclose = () => {
        console.warn("WebSocket disconnected, reconnecting in 2s...");
        setTimeout(connectWebSocket, 2000);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerEvent(data);
        } catch (e) {
            console.error("Error parsing WS message:", e);
        }
    };
}

function playCompletionChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';

        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        osc.frequency.setValueAtTime(1046.50, now + 0.36);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

        osc.start(now);
        osc.stop(now + 0.95);
    } catch (e) {
        console.log("Audio chime note:", e);
    }
}

function handleServerEvent(msg) {
    switch (msg.type) {
        case 'INIT_STATE':
            appState.settings = msg.state.settings;
            appState.points = msg.state.points || [];
            appState.black_baseline = msg.state.black_baseline;
            appState.meter_info = msg.state.meter_info || msg.state.instrument_status;
            if (msg.state.validation_primaries) {
                appState.validation_primaries = msg.state.validation_primaries;
            }
            if (msg.state.validation_summary) {
                appState.validation_summary = msg.state.validation_summary;
            }
            
            if (msg.state.spectral_locus) {
                chart.setSpectralLocus(msg.state.spectral_locus);
            }
            updateUIFromState(msg.state);
            break;

        case 'POINT_MEASURED':
            const updatedPt = msg.point;
            const idx = appState.points.findIndex(p => p.id === updatedPt.id);
            if (idx !== -1) {
                appState.points[idx] = updatedPt;
            }
            if (msg.points) appState.points = msg.points;
            renderTable();
            chart.setPoints(appState.points);
            updateStats();
            break;

        case 'BATCH_MEASURE_COMPLETED':
            const btnAll = document.getElementById('btn-measure-all');
            if (btnAll) {
                btnAll.disabled = false;
                btnAll.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span>${t('btn_measure_all', '一键自动测量全套坐标')}</span>`;
            }
            playCompletionChime();
            const doneMsg = currentLang === 'en' ? 
                `🎉 All ${msg.total_points || 15} coordinates measured successfully!\nData updated and TV patch window completed flashing notification.` :
                `🎉 全套 ${msg.total_points || 15} 个坐标点位测量已全部完成！\n实测数据与判定已同步更新，电视靶窗已同步完成发光提醒与复位。`;
            alert(doneMsg);
            break;

        case 'VALIDATION_UPDATED':
            if (msg.primaries) appState.validation_primaries = msg.primaries;
            if (msg.summary) appState.validation_summary = msg.summary;
            renderValidationUI(appState.validation_primaries, appState.validation_summary);
            break;

        case 'VALIDATION_COMPLETED':
            if (msg.primaries) appState.validation_primaries = msg.primaries;
            if (msg.summary) appState.validation_summary = msg.summary;
            renderValidationUI(appState.validation_primaries, appState.validation_summary);
            const valBtn = document.getElementById('btn-val-measure-all');
            if (valBtn) {
                valBtn.disabled = false;
                valBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ${t('val_all_btn', '一键全测标准原色 (7色)')}`;
            }
            playCompletionChime();
            document.getElementById('val-progress-text').innerText = currentLang === 'en' ? 'Primary validation completed!' : '全套标准原色校准验证完成！';
            break;

        case 'POINTS_UPDATED':
            appState.points = msg.points;
            if (msg.settings) appState.settings = msg.settings;
            renderTable();
            chart.setPoints(appState.points);
            updateStats();
            break;

        case 'BLACK_CALIBRATED':
            appState.black_baseline = msg.black_baseline;
            if (msg.points) appState.points = msg.points;
            updateBlackDisplay();
            renderTable();
            chart.setPoints(appState.points);
            break;

        case 'SETTINGS_UPDATED':
            appState.settings = msg.settings;
            if (msg.points) appState.points = msg.points;
            renderTable();
            chart.setPoints(appState.points);
            break;

        case 'PATCH_DISPLAY':
            selectPoint(msg.patch.point_id, false);
            break;

        case 'MEASURE_ERROR':
            const errTitle = currentLang === 'en' ? "【Colorimeter Hardware Error】\n" : "【硬件色度计异常】\n";
            alert(errTitle + msg.error);
            break;
    }
}

function updateUIFromState(stateData) {
    if (stateData) {
        appState.meter_info = stateData.meter_info || stateData.instrument_status || appState.meter_info;
    }
    updateMeterDisplay();

    // Controls
    if (stateData.settings) {
        const selContainer = document.getElementById('select-container');
        if (selContainer) selContainer.value = stateData.settings.container_space || 'bt2020';

        const selDelay = document.getElementById('select-auto-delay');
        if (selDelay && stateData.settings.auto_delay) {
            selDelay.value = stateData.settings.auto_delay.toFixed(1);
        }

        const chkHdr = document.getElementById('chk-hdr-mode');
        if (chkHdr && stateData.settings.hdr_mode !== undefined) {
            chkHdr.checked = stateData.settings.hdr_mode;
        }

        const chkFlare = document.getElementById('chk-flare-comp');
        if (chkFlare && stateData.settings.apply_flare_comp !== undefined) {
            chkFlare.checked = stateData.settings.apply_flare_comp;
        }

        const offX = document.getElementById('global-offset-x');
        const offY = document.getElementById('global-offset-y');
        if (offX) offX.value = (stateData.settings.global_offset_x || 0).toFixed(4);
        if (offY) offY.value = (stateData.settings.global_offset_y || 0).toFixed(4);
    }

    updateBlackDisplay();
    renderTable();
    chart.setPoints(appState.points);
    updateStats();
}

function updateBlackDisplay() {
    const yValEl = document.getElementById('black-y-val');
    const badgeEl = document.getElementById('black-leakage-badge');
    if (!yValEl || !badgeEl) return;

    if (appState.black_baseline) {
        yValEl.innerText = `${appState.black_baseline.Y.toFixed(4)} nit`;
        if (appState.black_baseline.leakage_warning) {
            badgeEl.className = 'badge badge-fail';
            badgeEl.innerText = t('black_leaking', '疑似漏光 (>0.3 nit)');
        } else {
            badgeEl.className = 'badge badge-pass';
            badgeEl.innerText = t('black_normal', '正常 (无明显漏光)');
        }
    } else {
        yValEl.innerText = t('black_uncal', '未校准');
        badgeEl.className = 'badge badge-pending';
        badgeEl.innerText = t('black_pending', '待检测');
    }
}

function xyToDisplayColor(x, y) {
    let X = x / y;
    let Y = 1.0;
    let Z = (1 - x - y) / y;

    let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;

    const maxC = Math.max(r, g, b, 0.001);
    r = Math.max(0, Math.min(1, r / maxC));
    g = Math.max(0, Math.min(1, g / maxC));
    b = Math.max(0, Math.min(1, b / maxC));

    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    return `rgb(${r}, ${g}, ${b})`;
}

function renderTable() {
    const tbody = document.getElementById('points-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    appState.points.forEach((pt) => {
        const tr = document.createElement('tr');
        if (pt.id === appState.selectedPointId) {
            tr.classList.add('selected');
        }
        tr.onclick = () => selectPoint(pt.id);

        let statusBadge = `<span class="badge badge-pending">${t('verdict_unmeasured', '待测')}</span>`;
        if (pt.has_measured) {
            if (pt.pass_status === 'EXCEEDED_P3') {
                statusBadge = `<span class="badge badge-exceeded">★ ${t('verdict_exceeded', '超色域达标')}</span>`;
            } else if (pt.pass_status === 'INSIDE_P3') {
                statusBadge = `<span class="badge badge-inside">${t('verdict_inside', '未超P3色域')}</span>`;
            } else if (pt.pass_status === 'PASS') {
                statusBadge = `<span class="badge badge-pass">${t('verdict_pass', '合格')}</span>`;
            } else {
                statusBadge = `<span class="badge badge-inside">${t('verdict_delta_exceeded', '超差')}</span>`;
            }
        }

        // Highlight red if delta_xy > 0.006
        const isDeltaExceeded = pt.has_measured && pt.delta_xy > 0.006;
        const deltaDisplay = pt.has_measured ? 
            (isDeltaExceeded ? `<span class="delta-exceeded-red">${pt.delta_xy.toFixed(4)}</span>` : `<span class="mono">${pt.delta_xy.toFixed(4)}</span>`) : 
            '<span style="color:var(--text-muted)">--</span>';

        const targetCell = `<span class="mono" title="${t('tip_target_cell', '点击可修改需求值')}" style="cursor:pointer;" onclick="promptTargetValue(${pt.id})">(${pt.target_x.toFixed(4)}, ${pt.target_y.toFixed(4)})</span>`;

        const globalOffX = (appState.settings && appState.settings.global_offset_x) || 0;
        const globalOffY = (appState.settings && appState.settings.global_offset_y) || 0;
        const adjX = pt.effective_target_x !== undefined ? pt.effective_target_x : Math.round((pt.target_x + (pt.offset_x || 0) + globalOffX) * 10000) / 10000;
        const adjY = pt.effective_target_y !== undefined ? pt.effective_target_y : Math.round((pt.target_y + (pt.offset_y || 0) + globalOffY) * 10000) / 10000;

        const swatchColor = xyToDisplayColor(pt.target_x, pt.target_y);
        const pointLabel = `
            <div style="display:flex; align-items:center;">
                <span class="point-color-swatch" style="background:${swatchColor};" title="CIE: (${pt.target_x.toFixed(4)}, ${pt.target_y.toFixed(4)})"></span>
                <strong class="mono" style="color:var(--accent-blue); font-size:12px;">P${pt.id}</strong>
                ${pt.is_custom && pt.name && pt.name !== `P${pt.id}` ? `<span style="margin-left:4px; font-size:10px; color:var(--text-muted);" title="${pt.name}">(${pt.name.slice(0, 4)})</span>` : ''}
            </div>
        `;

        const targetRgb = pt.target_rgb_255 || pt.rgb_255;
        const rgbDisplay = (targetRgb && targetRgb.length >= 3) ? 
            `<span class="mono" style="color:#e2e8f0; font-size:11px;" title="RGB (0-255)">(${targetRgb[0]}, ${targetRgb[1]}, ${targetRgb[2]})</span>` : 
            '<span style="color:var(--text-muted)">--</span>';

        // Action buttons: Delete available for ALL points (P1-P15 and custom points)
        let actionButtons = `
            <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); displayOnTV(${pt.id})" title="${t('tip_show_tv', '送信号到电视靶窗')}">
                ${t('btn_tv_display', '靶窗显示')}
            </button>
            <button class="btn btn-xs btn-success" onclick="event.stopPropagation(); measureSingle(${pt.id})" title="${t('tip_measure', '测量该点')}">
                ${t('btn_measure_this', '测此点')}
            </button>
            <button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); deletePoint(${pt.id})" title="${t('tip_delete', '删除该点位 (仅当前页有效，重启恢复)')}">
                ${t('btn_delete', '删除')}
            </button>
        `;

        tr.innerHTML = `
            <td>${pointLabel}</td>
            <td>${targetCell}</td>
            <td class="mono" title="${t('tip_measured_cell', '双击可手动录入实测值')}" ondblclick="promptManualValue(${pt.id})">
                ${pt.has_measured ? `(${pt.measured_x.toFixed(4)}, ${pt.measured_y.toFixed(4)})` : '<span style="color:var(--text-muted)">--</span>'}
            </td>
            <td>${deltaDisplay}</td>
            <td class="mono">
                ${pt.has_measured && pt.measured_Y !== null ? `${pt.measured_Y.toFixed(1)} nit` : '<span style="color:var(--text-muted)">--</span>'}
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <div style="display:flex; gap:3px; align-items:center;">
                        <input type="number" step="0.0005" class="stepper-input" value="${pt.offset_x.toFixed(4)}" 
                            onchange="updateRowOffset(${pt.id}, this.value, null)" title="dx">
                        <input type="number" step="0.0005" class="stepper-input" value="${pt.offset_y.toFixed(4)}" 
                            onchange="updateRowOffset(${pt.id}, null, this.value)" title="dy">
                    </div>
                    <div style="font-size:10px; color:var(--accent-cyan); font-family:monospace;" title="${t('tip_effective_target', '实际靶向')}">
                        ${t('lbl_effective_target', '实际靶向')}: (${adjX.toFixed(4)}, ${adjY.toFixed(4)})
                    </div>
                </div>
            </td>
            <td class="mono">${pt.has_measured && pt.delta_uv !== null ? pt.delta_uv.toFixed(4) : '<span style="color:var(--text-muted)">--</span>'}</td>
            <td>${rgbDisplay}</td>
            <td>${statusBadge}</td>
            <td style="text-align: right;">
                <div style="display:flex; gap:4px; justify-content:flex-end;">
                    ${actionButtons}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStats() {
    const points = appState.points || [];
    const tested = points.filter(p => p.has_measured);
    const exceeded = tested.filter(p => p.pass_status === 'EXCEEDED_P3');

    const elTested = document.getElementById('stat-tested-count');
    if (elTested) elTested.innerText = `${tested.length} / ${points.length}`;

    const elExceeded = document.getElementById('stat-exceeded-count') || document.getElementById('stat-exceeded-p3');
    if (elExceeded) elExceeded.innerText = `${exceeded.length} / ${points.length}`;

    const elAvgDxy = document.getElementById('stat-avg-dxy');
    const elAvgDuv = document.getElementById('stat-avg-duv');

    if (tested.length > 0) {
        const sumDxy = tested.reduce((acc, p) => acc + (p.delta_xy || 0), 0);
        if (elAvgDxy) elAvgDxy.innerText = (sumDxy / tested.length).toFixed(4);

        const testedWithDuv = tested.filter(p => p.delta_uv !== null && p.delta_uv !== undefined);
        if (testedWithDuv.length > 0) {
            const sumDuv = testedWithDuv.reduce((acc, p) => acc + p.delta_uv, 0);
            if (elAvgDuv) elAvgDuv.innerText = (sumDuv / testedWithDuv.length).toFixed(4);
        } else {
            if (elAvgDuv) elAvgDuv.innerText = '--';
        }
    } else {
        if (elAvgDxy) elAvgDxy.innerText = '--';
        if (elAvgDuv) elAvgDuv.innerText = '--';
    }
}

function selectPoint(pointId, updateTV = true) {
    appState.selectedPointId = pointId;
    renderTable();
    if (chart && chart.setSelectedPoint) {
        chart.setSelectedPoint(pointId);
    }

    if (pointId != null) {
        const selectedRow = document.querySelector('#points-tbody tr.selected');
        if (selectedRow) {
            selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (updateTV) {
            displayOnTV(pointId);
        }
    }
}

async function displayOnTV(pointId) {
    try {
        await fetch(`/api/patch/display/${pointId}`, { method: 'POST' });
    } catch (e) {
        console.error("Failed to display patch on TV:", e);
    }
}

async function measureSingle(pointId) {
    try {
        const resp = await fetch(`/api/measure/point/${pointId}`, { method: 'POST' });
        if (!resp.ok) {
            const err = await resp.json();
            alert(currentLang === 'en' ? ("Measurement failed: " + formatApiError(err)) : ("测量失败: " + formatApiError(err)));
        } else {
            const data = await resp.json();
            if (data.point) {
                const idx = appState.points.findIndex(p => p.id === data.point.id);
                if (idx !== -1) appState.points[idx] = data.point;
            }
            if (data.points) {
                appState.points = data.points;
            }
            renderTable();
            if (chart && chart.setPoints) chart.setPoints(appState.points);
            updateStats();
        }
    } catch (e) {
        alert(currentLang === 'en' ? ("Measurement failed: " + e.message) : ("测量失败: " + e.message));
    }
}

async function measureSelectedPoint() {
    if (appState.selectedPointId) {
        await measureSingle(appState.selectedPointId);
    }
}

async function measureBlack() {
    const btn = document.getElementById('btn-measure-black');
    if (btn) {
        btn.disabled = true;
        btn.innerText = currentLang === 'en' ? 'Measuring Black Level...' : '正在测定黑场...';
    }
    try {
        const resp = await fetch('/api/measure/black', { method: 'POST' });
        if (!resp.ok) {
            const err = await resp.json();
            alert(currentLang === 'en' ? ("Black measurement error: " + formatApiError(err)) : ("【黑场测量异常】\n" + formatApiError(err)));
        } else {
            const data = await resp.json();
            if (data.black_baseline) {
                appState.black_baseline = data.black_baseline;
                if (data.points) appState.points = data.points;
                updateBlackDisplay();
                renderTable();
                if (chart && chart.setPoints) chart.setPoints(appState.points);
                updateStats();
            }
        }
    } catch (e) {
        alert(currentLang === 'en' ? ("Black measurement error: " + e.message) : ("测黑场出错: " + e.message));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = t('btn_measure_black', '一键测黑场基准');
        }
    }
}

async function measureAllPoints() {
    const delayVal = appState.settings.auto_delay || 3.0;
    const confirmPrompt = currentLang === 'en' ?
        `Starting automated optical sampling (${appState.points.length} points, ${delayVal}s interval).\nPlease make sure colorimeter probe is placed at the center of the patch window.\n\nClick OK to start.` :
        `即将开始硬件连续采样 (共 ${appState.points.length} 点，点间隔 ${delayVal} 秒)。\n请确保探头已贴紧电视靶窗中央。\n\n点击【确定】开始。`;

    if (!confirm(confirmPrompt)) {
        return;
    }
    const btn = document.getElementById('btn-measure-all');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = currentLang === 'en' ? 'Reading hardware samples...' : '正在读取硬件采样中...';
    }

    try {
        const resp = await fetch('/api/measure/all', { method: 'POST' });
        if (!resp.ok) {
            const err = await resp.json();
            alert(currentLang === 'en' ? ("Measurement interrupted: " + formatApiError(err)) : ("【自动化测量中断】\n" + formatApiError(err)));
        } else {
            const data = await resp.json();
            if (data.points) {
                appState.points = data.points;
                renderTable();
                if (chart && chart.setPoints) chart.setPoints(appState.points);
                updateStats();
            }
        }
    } catch (e) {
        alert(currentLang === 'en' ? ("Continuous measurement error: " + e.message) : ("连续测量出错: " + e.message));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span>${t('btn_measure_all', '一键自动测量全套坐标')}</span>`;
        }
    }
}

function openAddPointModal() {
    document.getElementById('modal-point-name').value = `P${appState.points.length + 1}`;
    document.getElementById('modal-point-x').value = '0.6800';
    document.getElementById('modal-point-y').value = '0.3200';
    document.getElementById('modal-add-point').classList.add('active');
}

function closeAddPointModal() {
    document.getElementById('modal-add-point').classList.remove('active');
}

async function submitAddPoint() {
    const name = document.getElementById('modal-point-name').value.trim() || `P${appState.points.length + 1}`;
    const x = parseFloat(document.getElementById('modal-point-x').value);
    const y = parseFloat(document.getElementById('modal-point-y').value);

    if (isNaN(x) || isNaN(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        alert(currentLang === 'en' ? "Please enter valid coordinates (0.0000 ~ 1.0000)" : "请输入有效的坐标范围 (0.0000 ~ 1.0000)");
        return;
    }

    try {
        await fetch('/api/points/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                target_x: x,
                target_y: y
            })
        });
        closeAddPointModal();
    } catch (e) {
        alert(currentLang === 'en' ? ("Failed to add point: " + e.message) : ("添加自定义点失败: " + e.message));
    }
}

// Unified Delete Function: Supports deleting ANY point in current page session
async function deletePoint(pointId) {
    const pt = appState.points.find(p => p.id === pointId);
    if (!pt) return;
    const ptName = pt.name || ('P' + pt.id);
    const confirmMsg = currentLang === 'en' ?
        `Are you sure you want to delete [${ptName}]?\n(Applies to current session only; restarting server or clicking "Restore Default Points" restores all points)` :
        `确定要删除点位【${ptName}】吗？\n（仅在当前页面生效，重新启动服务或点击“恢复默认点位”即可完整恢复）`;

    if (confirm(confirmMsg)) {
        try {
            const resp = await fetch(`/api/points/delete/${pointId}`, { method: 'POST' });
            if (resp.ok) {
                const data = await resp.json();
                if (data.points) {
                    appState.points = data.points;
                    renderTable();
                    if (chart && chart.setPoints) chart.setPoints(appState.points);
                    updateStats();
                }
            }
        } catch (e) {
            alert(currentLang === 'en' ? ("Delete failed: " + e.message) : ("删除点位失败: " + e.message));
        }
    }
}

const deleteCustomPoint = deletePoint;

async function restoreDefaultPoints() {
    const confirmMsg = currentLang === 'en' ?
        "Are you sure you want to restore the default 15 target coordinates?" :
        "确定要恢复为系统默认的 15 个关键测试坐标点吗？";
    if (!confirm(confirmMsg)) return;

    try {
        const resp = await fetch('/api/points/reset', { method: 'POST' });
        if (resp.ok) {
            const data = await resp.json();
            if (data.points) {
                appState.points = data.points;
                renderTable();
                if (chart && chart.setPoints) chart.setPoints(appState.points);
                updateStats();
            }
        }
    } catch (e) {
        alert(currentLang === 'en' ? ("Restore failed: " + e.message) : ("恢复默认点位失败: " + e.message));
    }
}

function promptTargetValue(pointId) {
    const pt = appState.points.find(p => p.id === pointId);
    if (!pt) return;
    const promptMsg = currentLang === 'en' ? 
        `Modify target coordinates for [${pt.name}] (format: x, y):` : 
        `修改【${pt.name}】需求值坐标 (格式: x, y):`;
    const input = prompt(promptMsg, `${pt.target_x}, ${pt.target_y}`);
    if (!input) return;
    const parts = input.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        fetch('/api/points/target', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                point_id: pointId,
                target_x: parts[0],
                target_y: parts[1]
            })
        });
    }
}

async function updateRowOffset(pointId, offsetX, offsetY) {
    const pt = appState.points.find(p => p.id === pointId);
    if (!pt) return;

    const newX = offsetX !== null ? parseFloat(offsetX) : pt.offset_x;
    const newY = offsetY !== null ? parseFloat(offsetY) : pt.offset_y;

    try {
        await fetch('/api/points/offset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                point_id: pointId,
                offset_x: newX,
                offset_y: newY,
                is_global: false
            })
        });
    } catch (e) {
        console.error("Failed to update row offset:", e);
    }
}

async function applyGlobalOffset() {
    const ox = parseFloat(document.getElementById('global-offset-x').value) || 0.0;
    const oy = parseFloat(document.getElementById('global-offset-y').value) || 0.0;

    try {
        await fetch('/api/points/offset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                offset_x: ox,
                offset_y: oy,
                is_global: true
            })
        });
    } catch (e) {
        console.error("Failed to apply global offset:", e);
    }
}

async function resetOffsets() {
    document.getElementById('global-offset-x').value = "0.0000";
    document.getElementById('global-offset-y').value = "0.0000";
    await applyGlobalOffset();

    for (let pt of appState.points) {
        await updateRowOffset(pt.id, 0.0, 0.0);
    }
}

async function resetAllPoints() {
    const confirmMsg = currentLang === 'en' ? 
        "Reset all measurement records and reload default target coordinates?" : 
        "确定要清空全部实测数据并重置为初始默认坐标吗？";
    if (confirm(confirmMsg)) {
        const resp = await fetch('/api/points/reset', { method: 'POST' });
        if (resp.ok) {
            const data = await resp.json();
            if (data.points) {
                appState.points = data.points;
                renderTable();
                if (chart && chart.setPoints) chart.setPoints(appState.points);
                updateStats();
            }
        }
        await resetOffsets();
    }
}

function promptManualValue(pointId) {
    const pt = appState.points.find(p => p.id === pointId);
    if (!pt) return;

    const defaultVal = pt.has_measured ? `${pt.measured_x.toFixed(4)}, ${pt.measured_y.toFixed(4)}, ${pt.measured_Y ? pt.measured_Y.toFixed(1) : 100}` : "";
    const promptMsg = currentLang === 'en' ?
        `[Manual Input] Enter optical readings for [${pt.name}]:\nFormat: x, y, Luminance Y(optional nits)\nExample: 0.6800, 0.3200, 150` :
        `【手动录入】请输入【${pt.name}】的色品实测值:\n格式: x, y, 亮度Y(可选nit)\n例如: 0.6800, 0.3200, 150`;

    const input = prompt(promptMsg, defaultVal);
    if (!input) return;

    const parts = input.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const mx = parts[0];
        const my = parts[1];
        const mY = (parts.length >= 3 && !isNaN(parts[2])) ? parts[2] : 100.0;

        fetch('/api/points/manual_value', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                point_id: pointId,
                measured_x: mx,
                measured_y: my,
                measured_Y: mY
            })
        });
    }
}

async function updateContainerSpace() {
    const val = document.getElementById('select-container').value;
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_space: val })
    });
}

async function updateAutoDelay() {
    const val = parseFloat(document.getElementById('select-auto-delay').value) || 3.0;
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_delay: val })
    });
}

async function toggleHDRMode() {
    const val = document.getElementById('chk-hdr-mode').checked;
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hdr_mode: val })
    });
}

async function toggleFlareComp() {
    const val = document.getElementById('chk-flare-comp').checked;
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply_flare_comp: val })
    });
}

function openTVPatchWindow(pinned = false) {
    const url = pinned ? '/patch?pin=1' : '/patch';
    window.open(url, 'TVPatchWindow', 'width=960,height=600,menubar=no,toolbar=no,location=no,status=no');
}

function exportCSV() {
    window.location.href = '/api/export/csv';
}

function exportHighResPNG() {
    if (!chart) return;
    try {
        const dataUrl = chart.exportHighResPNG(3000);
        if (!dataUrl) return;
        const link = document.createElement('a');
        link.download = `CIE1931_Gamut_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Export PNG failed:", err);
        alert(currentLang === 'en' ? 'Failed to export PNG: ' + err.message : '导出PNG失败: ' + err.message);
    }
}

function exportSVG() {
    if (!chart) return;
    try {
        const svgStr = chart.exportSVG ? chart.exportSVG() : (chart.exportUniversalSVG ? chart.exportUniversalSVG() : '');
        if (!svgStr) return;
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `CIE1931_Vector_${new Date().toISOString().slice(0, 10)}.svg`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error("Export SVG failed:", err);
        alert(currentLang === 'en' ? 'Failed to export SVG: ' + err.message : '导出SVG失败: ' + err.message);
    }
}

function updateGamutToggles() {
    if (!chart) return;
    chart.updateOptions({
        showSpectrumFill: document.getElementById('chk-spectrum')?.checked ?? true,
        showP3: document.getElementById('chk-p3')?.checked ?? true,
        showBT2020: document.getElementById('chk-bt2020')?.checked ?? true,
        showLocus: document.getElementById('chk-locus')?.checked ?? true,
        showLabels: document.getElementById('chk-labels')?.checked ?? true
    });
}

function toggleChartFullscreen() {
    const card = document.getElementById('card-cie-chart');
    if (!card) return;
    const isFull = card.classList.toggle('chart-fullscreen-mode');
    document.body.classList.toggle('fullscreen-active', isFull);
    const btn = document.getElementById('btn-chart-fullscreen');

    if (isFull) {
        if (btn) {
            btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> <span>${t('chart_exit_fullscreen', '✕ 退出全屏 [ESC]')}</span>`;
            btn.className = 'btn btn-sm btn-danger';
        }
        if (chart) {
            chart.resize();
            chart.fitGamut();
        }
    } else {
        if (btn) {
            btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg> <span>${t('chart_fullscreen', '全屏放大查看')}</span>`;
            btn.className = 'btn btn-sm btn-primary';
        }
        if (chart) {
            chart.resize();
        }
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const card = document.getElementById('card-cie-chart');
        if (card && card.classList.contains('chart-fullscreen-mode')) {
            toggleChartFullscreen();
        }
        closeValidationModal();
        closeAddPointModal();
    }
});

// ==========================================
// Primary Color & Probe Validation Functions
// ==========================================

function openValidationModal() {
    document.getElementById('modal-validation').classList.add('active');
    fetch('/api/validation/status')
        .then(res => res.json())
        .then(data => {
            if (data.status === 'ok') {
                appState.validation_primaries = data.primaries;
                appState.validation_summary = data.summary;
                renderValidationUI(data.primaries, data.summary);
            }
        })
        .catch(err => console.error(err));
}

function closeValidationModal() {
    document.getElementById('modal-validation').classList.remove('active');
}

function renderValidationUI(primaries, summary) {
    if (!primaries) return;
    const tbody = document.getElementById('val-table-body');
    if (!tbody) return;

    tbody.innerHTML = primaries.map(item => {
        const hasMeas = item.measured_x !== null && item.measured_y !== null;
        let badgeHtml = `<span class="badge badge-pending">${t('val_badge_pending', '待测')}</span>`;
        let deltaHtml = '--';

        if (hasMeas) {
            const isExceeded = item.delta_xy > 0.006;
            const isExcellent = item.delta_xy <= 0.003;
            if (isExcellent) {
                badgeHtml = `<span class="badge badge-pass" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid rgba(16,185,129,0.4);">${t('val_badge_excellent', '校准极佳')}</span>`;
            } else if (!isExceeded) {
                badgeHtml = `<span class="badge badge-pass" style="background:rgba(6,182,212,0.2); color:#06b6d4; border:1px solid rgba(6,182,212,0.4);">${t('val_badge_good', '良好达标')}</span>`;
            } else {
                badgeHtml = `<span class="badge badge-fail" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.4);">${t('val_badge_deviation', '超差偏置')}</span>`;
            }

            deltaHtml = `<strong style="color:${isExceeded ? '#ef4444' : (isExcellent ? '#10b981' : '#06b6d4')}">${item.delta_xy.toFixed(4)}</strong>`;
        }

        return `
            <tr style="border-bottom:1px solid var(--border); background:${hasMeas ? 'rgba(30,41,59,0.4)' : 'transparent'};">
                <td style="padding:8px 10px; font-weight:600;">
                    <span class="val-color-swatch" style="background:${item.color_hex};"></span>
                    ${item.name}
                </td>
                <td style="padding:8px 10px; font-family:'SF Mono',monospace; color:var(--accent-blue);">
                    (${item.target_x.toFixed(4)}, ${item.target_y.toFixed(4)})
                </td>
                <td style="padding:8px 10px; font-family:'SF Mono',monospace;">
                    ${hasMeas ? `(${item.measured_x.toFixed(4)}, ${item.measured_y.toFixed(4)})` : '<span style="color:var(--text-muted)">--</span>'}
                </td>
                <td style="padding:8px 10px; font-family:'SF Mono',monospace;">
                    ${hasMeas && item.measured_Y !== null ? `${item.measured_Y.toFixed(1)} nit` : '<span style="color:var(--text-muted)">--</span>'}
                </td>
                <td style="padding:8px 10px; font-family:'SF Mono',monospace;">
                    ${deltaHtml}
                </td>
                <td style="padding:8px 10px;">
                    ${badgeHtml}
                </td>
                <td style="padding:8px 10px; text-align:right;">
                    <button class="btn btn-sm" onclick="measureValidationSingle('${item.id}')" style="padding:3px 8px; font-size:11px;">${t('val_measure_btn', '测此项')}</button>
                </td>
            </tr>
        `;
    }).join('');

    // Update Summary Card
    if (summary) {
        const badge = document.getElementById('val-verdict-badge');
        const title = document.getElementById('val-verdict-title');
        const desc = document.getElementById('val-verdict-desc');
        const stats = document.getElementById('val-verdict-stats');

        if (summary.verdict === 'EXCELLENT') {
            badge.innerText = t('val_badge_excellent', '校准极佳');
            badge.style.background = 'rgba(16,185,129,0.2)';
            badge.style.color = '#10b981';
            badge.style.border = '1px solid #10b981';
            title.innerText = currentLang === 'en' ? 'Colorimeter & Display Calibration Excellent' : '探头工作完全正常 · 屏幕原色出厂校准极佳';
            title.style.color = '#10b981';
            desc.innerText = currentLang === 'en' ? 
                'Average Delta xy is under 0.003 across standard D65 and primaries. Out-of-gamut point shifts are strictly due to display physical gamut boundaries.' :
                '标准 DCI-P3 域内原色与白点实测平均偏差小于 0.003，实测与理论基准严丝合缝。若超色域点出现偏差，完全系显示屏物理色域极限截断所致。';
        } else if (summary.verdict === 'GOOD') {
            badge.innerText = t('val_badge_good', '良好达标');
            badge.style.background = 'rgba(6,182,212,0.2)';
            badge.style.color = '#06b6d4';
            badge.style.border = '1px solid #06b6d4';
            title.innerText = currentLang === 'en' ? 'Display Primaries Well-Calibrated' : '屏幕原色校准良好 · 探头读数精准可靠';
            title.style.color = '#38bdf8';
            desc.innerText = currentLang === 'en' ? 
                'Primary deviations are well within broadcast monitor tolerances.' :
                '原色基准偏差均在广播监视级容差之内，设备工作处于稳定可靠状态。';
        } else if (summary.verdict === 'DEVIATION') {
            badge.innerText = t('val_badge_deviation', '超差偏置');
            badge.style.background = 'rgba(239,68,68,0.2)';
            badge.style.color = '#ef4444';
            badge.style.border = '1px solid #ef4444';
            title.innerText = currentLang === 'en' ? 'Primary Bias Detected' : '检测到标准基准色存在偏移';
            title.style.color = '#f87171';
            desc.innerText = summary.message || (currentLang === 'en' ? 'Display might have native color bias.' : '屏幕原生模式或未完全矫正标准色彩空间，可结合单点微调补偿。');
        } else {
            badge.innerText = t('val_badge_pending', '待验证');
            badge.style.background = '#334155';
            badge.style.color = '#94a3b8';
            badge.style.border = 'none';
            title.innerText = currentLang === 'en' ? 'Validation Not Performed Yet' : '尚未进行基准测试';
            title.style.color = '#f8fafc';
            desc.innerText = currentLang === 'en' ? 
                'Click "Measure All Primaries" above to verify factory calibration and colorimeter accuracy.' :
                '点击上方“一键全测”验证显示屏在 DCI-P3 标准域内的校准水准与色度计精度。';
        }

        stats.innerHTML = `${currentLang === 'en' ? 'Avg Delta xy' : '平均 Δxy'}: <strong>${summary.avg_delta_xy !== null ? summary.avg_delta_xy.toFixed(4) : '--'}</strong><br>${currentLang === 'en' ? 'Tested' : '已测'}: ${summary.count}/${summary.total}`;
    }
}

async function measureValidationSingle(colorId) {
    const progress = document.getElementById('val-progress-text');
    if (progress) progress.innerText = currentLang === 'en' ? `Measuring ${colorId}...` : `正在测量 ${colorId}...`;
    try {
        const resp = await fetch(`/api/validation/measure/${colorId}`, { method: 'POST' });
        if (!resp.ok) {
            const err = await resp.json();
            alert((currentLang === 'en' ? "Validation Error: " : "【验证测量异常】\n") + formatApiError(err));
        } else {
            const res = await resp.json();
            if (res.item && appState.validation_primaries) {
                const idx = appState.validation_primaries.findIndex(v => v.id === res.item.id);
                if (idx !== -1) appState.validation_primaries[idx] = res.item;
                if (res.summary) appState.validation_summary = res.summary;
                renderValidationUI(appState.validation_primaries, appState.validation_summary);
            }
            if (progress) progress.innerText = currentLang === 'en' ? `Item complete (Delta xy=${res.item.delta_xy.toFixed(4)})` : `单项完成 (Δxy=${res.item.delta_xy.toFixed(4)})`;
        }
    } catch (e) {
        alert((currentLang === 'en' ? "Validation failed: " : "单项验证测量失败: ") + e.message);
        if (progress) progress.innerText = currentLang === 'en' ? 'Ready' : '就绪';
    }
}

async function measureAllValidation() {
    const btn = document.getElementById('btn-val-measure-all');
    const progress = document.getElementById('val-progress-text');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = currentLang === 'en' ? 'Continuous optical sampling...' : '正在连续光学采样中...';
    }
    if (progress) progress.innerText = currentLang === 'en' ? 'Measuring standard primaries (keep probe steady at center)...' : '正在测定基准原色 (请保持探头贴紧靶窗中央)...';

    try {
        const resp = await fetch('/api/validation/measure_all', { method: 'POST' });
        if (!resp.ok) {
            const err = await resp.json();
            alert((currentLang === 'en' ? "Validation Error: " : "【全套验证异常】\n") + formatApiError(err));
        } else {
            const res = await resp.json();
            if (res.primaries) appState.validation_primaries = res.primaries;
            if (res.summary) appState.validation_summary = res.summary;
            renderValidationUI(appState.validation_primaries, appState.validation_summary);
            if (progress) progress.innerText = currentLang === 'en' ? 'All standard primaries measured successfully!' : '全套标准原色测定完成！';
        }
    } catch (e) {
        alert((currentLang === 'en' ? "Primary validation error: " : "全套原色验证测量出错: ") + e.message);
        if (progress) progress.innerText = currentLang === 'en' ? 'Ready' : '就绪';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ${t('val_all_btn', '一键全测标准原色 (7色)')}`;
        }
    }
}

async function resetValidation() {
    const confirmMsg = currentLang === 'en' ?
        "Clear validation history records?" :
        "确定要清空原色校对验证的历史记录吗？";
    if (!confirm(confirmMsg)) return;
    try {
        const resp = await fetch('/api/validation/reset', { method: 'POST' });
        const data = await resp.json();
        if (data.status === 'ok') {
            appState.validation_primaries = data.primaries;
            appState.validation_summary = data.summary;
            renderValidationUI(data.primaries, data.summary);
            document.getElementById('val-progress-text').innerText = currentLang === 'en' ? 'Reset' : '已重置';
        }
    } catch (e) {
        console.error(e);
    }
}
