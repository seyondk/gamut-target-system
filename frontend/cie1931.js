/**
 * CIE 1931 Chromaticity Diagram Interactive Canvas Renderer & Vector SVG / 4K PNG Exporter
 * Supports Smooth Zoom & Pan, High-Res Offscreen Rendering, Standalone Universal SVG,
 * Gamut Triangles (sRGB, DCI-P3, BT.2020), Target Points, Measured Points, and Deviation Vectors.
 */

class CIE1931Chart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.options = Object.assign({
            showSRGB: false,          // sRGB hidden as per user request
            showP3: true,
            showBT2020: true,
            showLocus: true,
            showGrid: true,
            showLabels: true,
            showSpectrumFill: true,   // Real physical CIE 1931 color spectrum fill
            theme: 'dark'
        }, options);

        this.points = [];
        this.spectralLocus = [];
        this.hoveredPoint = null;
        this.selectedPointId = null;
        this.spectrumCanvas = null;
        this.initSpectrumCanvas();

        // Base Coordinate Bounds (CIE 1931 x: -0.05..0.82, y: -0.05..0.90)
        this.baseMinX = -0.05;
        this.baseMaxX = 0.82;
        this.baseMinY = -0.05;
        this.baseMaxY = 0.90;

        // Interactive Zoom and Pan State
        this.zoom = 1.0;
        this.panX = 0.0;
        this.panY = 0.0;

        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.hasMovedDrag = false;

        this.margin = { top: 22, right: 22, bottom: 34, left: 44 };
        this.lang = 'zh';

        this.initEventListeners();
        this.resize();
    }

    setLanguage(lang) {
        this.lang = lang || 'zh';
        this.render();
    }

    draw() {
        this.render();
    }

    initSpectrumCanvas() {
        try {
            this.spectrumCanvas = document.createElement('canvas');
            const size = 450;
            this.spectrumCanvas.width = size;
            this.spectrumCanvas.height = size;
            const sCtx = this.spectrumCanvas.getContext('2d');
            const imgData = sCtx.createImageData(size, size);
            const data = imgData.data;

            for (let py = 0; py < size; py++) {
                const y = ((size - py) / size) * 0.90;
                for (let px = 0; px < size; px++) {
                    const x = (px / size) * 0.85;
                    const idx = (py * size + px) * 4;

                    if (y <= 0.005 || x <= 0.005 || x + y > 1.04) {
                        data[idx + 3] = 0;
                        continue;
                    }

                    // XYZ colorimetry
                    const X = x / y;
                    const Y = 1.0;
                    const Z = (1.0 - x - y) / y;

                    // Standard CIE XYZ to sRGB / Rec.709
                    let r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
                    let g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
                    let b = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;

                    const minVal = Math.min(r, g, b);
                    if (minVal < 0) {
                        r -= minVal;
                        g -= minVal;
                        b -= minVal;
                    }
                    const maxVal = Math.max(r, g, b);
                    if (maxVal > 0) {
                        r /= maxVal;
                        g /= maxVal;
                        b /= maxVal;
                    }

                    // Perceptual Gamma 2.2
                    data[idx] = Math.round(Math.pow(r, 1 / 2.2) * 255);
                    data[idx + 1] = Math.round(Math.pow(g, 1 / 2.2) * 255);
                    data[idx + 2] = Math.round(Math.pow(b, 1 / 2.2) * 255);
                    data[idx + 3] = 230; // Visible opacity
                }
            }
            sCtx.putImageData(imgData, 0, 0);
        } catch (e) {
            console.error("Failed to generate spectrum canvas:", e);
        }
    }

    getBounds() {
        const spanX = (this.baseMaxX - this.baseMinX) / this.zoom;
        const spanY = (this.baseMaxY - this.baseMinY) / this.zoom;

        const centerX = (this.baseMinX + this.baseMaxX) / 2 + this.panX;
        const centerY = (this.baseMinY + this.baseMaxY) / 2 + this.panY;

        return {
            minX: centerX - spanX / 2,
            maxX: centerX + spanX / 2,
            minY: centerY - spanY / 2,
            maxY: centerY + spanY / 2,
        };
    }

    setSpectralLocus(locus) {
        this.spectralLocus = locus;
        this.render();
    }

    setPoints(points) {
        this.points = points;
        this.render();
    }

    setSelectedPoint(pointId) {
        this.selectedPointId = pointId;
        this.render();
    }

    updateOptions(newOptions) {
        Object.assign(this.options, newOptions);
        this.render();
    }

    resetView() {
        this.zoom = 1.0;
        this.panX = 0.0;
        this.panY = 0.0;
        this.render();
    }

    fitGamut() {
        // Automatically zooms and centers to tightly frame the spectral locus and gamut edge-to-edge (Image 2 style)
        this.zoom = 1.18;
        this.panX = 0.02;
        this.panY = 0.005;
        this.render();
    }

    zoomIn() {
        this.zoom = Math.min(30.0, this.zoom * 1.35);
        this.render();
    }

    zoomOut() {
        this.zoom = Math.max(1.0, this.zoom / 1.35);
        if (this.zoom === 1.0) {
            this.panX = 0.0;
            this.panY = 0.0;
        }
        this.render();
    }

    resize() {
        const isFullscreen = document.body.classList.contains('fullscreen-active') || document.getElementById('card-cie-chart')?.classList.contains('chart-fullscreen-mode');
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        let size;
        if (isFullscreen) {
            const availH = window.innerHeight - 130;
            const availW = window.innerWidth - 60;
            size = Math.max(300, Math.min(availW, availH));
        } else {
            size = Math.min(rect.width, rect.height > 200 ? rect.height : rect.width);
        }

        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = `${size}px`;
        this.canvas.style.height = `${size}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.render();
    }

    toPixel(x, y, customBounds = null, customMargin = null, customWidth = null, customHeight = null) {
        const b = customBounds || this.getBounds();
        const m = customMargin || this.margin;
        const w = customWidth || (this.canvas.width / (window.devicePixelRatio || 1));
        const h = customHeight || (this.canvas.height / (window.devicePixelRatio || 1));

        const plotW = w - m.left - m.right;
        const plotH = h - m.top - m.bottom;

        const px = m.left + ((x - b.minX) / (b.maxX - b.minX)) * plotW;
        const py = m.top + plotH - ((y - b.minY) / (b.maxY - b.minY)) * plotH;
        return { x: px, y: py };
    }

    toCoord(px, py) {
        const b = this.getBounds();
        const dpr = window.devicePixelRatio || 1;
        const w = (this.canvas.width / dpr) - this.margin.left - this.margin.right;
        const h = (this.canvas.height / dpr) - this.margin.top - this.margin.bottom;

        const x = b.minX + ((px - this.margin.left) / w) * (b.maxX - b.minX);
        const y = b.minY + ((this.margin.top + h - py) / h) * (b.maxY - b.minY);
        return { x, y };
    }

    render() {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;

        this.drawChartCore(ctx, w, h, this.getBounds(), this.margin, {
            isInteractive: true,
            selectedPointId: this.selectedPointId,
            hoveredPoint: this.hoveredPoint,
            zoom: this.zoom
        });
    }

    /**
     * Core Drawing Engine (Shared between Interactive Screen, High-Res PNG, and Print)
     */
    drawChartCore(ctx, w, h, bounds, margin, extraOpts = {}) {
        const isInteractive = extraOpts.isInteractive || false;
        const scaleFactor = extraOpts.scaleFactor || 1.0;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        const plotX = margin.left;
        const plotY = margin.top;
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;

        ctx.save();
        ctx.beginPath();
        ctx.rect(plotX, plotY, plotW, plotH);
        ctx.clip();

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(plotX, plotY, plotW, plotH);

        if (this.options.showGrid) {
            this.drawGridCore(ctx, w, h, bounds, margin, scaleFactor);
        }

        if (this.options.showLocus && this.spectralLocus.length > 0) {
            this.drawLocusCore(ctx, w, h, bounds, margin, scaleFactor);
        }

        // Gamut Triangles
        if (this.options.showBT2020) {
            this.drawTriangleCore(ctx, {
                r: [0.708, 0.292], g: [0.170, 0.797], b: [0.131, 0.046]
            }, '#ec4899', 'BT.2020', [6 * scaleFactor, 4 * scaleFactor], bounds, margin, w, h, scaleFactor);
        }

        if (this.options.showP3) {
            this.drawTriangleCore(ctx, {
                r: [0.680, 0.320], g: [0.265, 0.690], b: [0.150, 0.060]
            }, '#06b6d4', 'DCI-P3', [], bounds, margin, w, h, scaleFactor, 2.5 * scaleFactor);
        }

        if (this.options.showSRGB) {
            this.drawTriangleCore(ctx, {
                r: [0.640, 0.330], g: [0.300, 0.600], b: [0.150, 0.060]
            }, '#f59e0b', 'sRGB', [3 * scaleFactor, 3 * scaleFactor], bounds, margin, w, h, scaleFactor);
        }

        // D65 White Point
        const pw = this.toPixel(0.3127, 0.3290, bounds, margin, w, h);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * scaleFactor;
        ctx.beginPath();
        ctx.arc(pw.x, pw.y, 4 * scaleFactor, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `${Math.round(10 * scaleFactor)}px Inter, system-ui`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('D65', pw.x + 6 * scaleFactor, pw.y - 4 * scaleFactor);

        // Draw Target & Measured Points
        this.drawPointsCore(ctx, bounds, margin, w, h, scaleFactor, extraOpts.selectedPointId);

        ctx.restore(); // end plot clip

        // Axes & Axis Labels
        this.drawAxesCore(ctx, w, h, bounds, margin, scaleFactor);

        // If Exporting: Draw clean Title & Gamut Legend (NO UI Buttons)
        if (!isInteractive) {
            this.drawExportLegend(ctx, w, h, margin, scaleFactor);
        } else {
            // Interactive on-screen HUD
            this.drawHUD(ctx);
            const ptToHighlight = extraOpts.hoveredPoint || (extraOpts.selectedPointId ? this.points.find(p => p.id === extraOpts.selectedPointId) : null);
            if (ptToHighlight) {
                this.drawTooltip(ctx, ptToHighlight);
            }
        }
    }

    drawGridCore(ctx, w, h, b, m, scale) {
        ctx.save();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.8 * scale;
        ctx.font = `${Math.round(10 * scale)}px Inter, system-ui`;
        ctx.fillStyle = '#64748b';

        const step = (b.maxX - b.minX) < 0.25 ? 0.02 : ((b.maxX - b.minX) < 0.5 ? 0.05 : 0.1);
        const startX = Math.floor(b.minX / step) * step;
        const endX = Math.ceil(b.maxX / step) * step;

        for (let x = startX; x <= endX + 1e-5; x += step) {
            if (x < -0.05 || x > 0.85) continue;
            const p1 = this.toPixel(x, b.minY, b, m, w, h);
            const p2 = this.toPixel(x, b.maxY, b, m, w, h);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            const pTick = this.toPixel(x, b.minY, b, m, w, h);
            ctx.fillText(x.toFixed(step < 0.05 ? 3 : 2), pTick.x, h - m.bottom + 16 * scale);
        }

        const startY = Math.floor(b.minY / step) * step;
        const endY = Math.ceil(b.maxY / step) * step;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = startY; y <= endY + 1e-5; y += step) {
            if (y < -0.05 || y > 0.95) continue;
            const p1 = this.toPixel(b.minX, y, b, m, w, h);
            const p2 = this.toPixel(b.maxX, y, b, m, w, h);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            ctx.fillText(y.toFixed(step < 0.05 ? 3 : 2), m.left - 8 * scale, p1.y);
        }
        ctx.restore();
    }

    drawLocusCore(ctx, w, h, b, m, scale) {
        ctx.save();
        ctx.beginPath();
        const p0 = this.toPixel(this.spectralLocus[0][0], this.spectralLocus[0][1], b, m, w, h);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < this.spectralLocus.length; i++) {
            const pt = this.toPixel(this.spectralLocus[i][0], this.spectralLocus[i][1], b, m, w, h);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        // Render Color Spectrum Tongue if enabled
        if (this.options.showSpectrumFill && this.spectrumCanvas) {
            ctx.save();
            ctx.clip();
            const p00 = this.toPixel(0, 0, b, m, w, h);
            const pMax = this.toPixel(0.85, 0.90, b, m, w, h);
            const destX = p00.x;
            const destY = pMax.y;
            const destW = pMax.x - p00.x;
            const destH = p00.y - pMax.y;

            ctx.globalAlpha = 0.85;
            ctx.drawImage(this.spectrumCanvas, destX, destY, destW, destH);
            ctx.restore();
        } else {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
            ctx.fill();
        }

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.6 * scale;
        ctx.stroke();

        // Line of Purples
        const pFirst = this.toPixel(this.spectralLocus[0][0], this.spectralLocus[0][1], b, m, w, h);
        const pLast = this.toPixel(this.spectralLocus[this.spectralLocus.length - 1][0], this.spectralLocus[this.spectralLocus.length - 1][1], b, m, w, h);
        ctx.beginPath();
        ctx.setLineDash([4 * scale, 4 * scale]);
        ctx.moveTo(pFirst.x, pFirst.y);
        ctx.lineTo(pLast.x, pLast.y);
        ctx.strokeStyle = '#64748b';
        ctx.stroke();
        ctx.setLineDash([]);

        // Wavelength labels
        const wavelengths = [
            { nm: '460', idx: 16 }, { nm: '480', idx: 20 }, { nm: '500', idx: 24 },
            { nm: '520', idx: 28 }, { nm: '540', idx: 32 }, { nm: '560', idx: 36 },
            { nm: '580', idx: 40 }, { nm: '600', idx: 44 }, { nm: '620', idx: 48 },
            { nm: '700', idx: this.spectralLocus.length - 1 }
        ];

        ctx.font = `${Math.round(9 * scale)}px system-ui`;
        ctx.fillStyle = '#94a3b8';
        for (const wl of wavelengths) {
            if (wl.idx < this.spectralLocus.length) {
                const coord = this.spectralLocus[wl.idx];
                const pt = this.toPixel(coord[0], coord[1], b, m, w, h);
                ctx.fillText(wl.nm, pt.x + 4 * scale, pt.y - 3 * scale);
            }
        }
        ctx.restore();
    }

    drawTriangleCore(ctx, space, color, label, dash, b, m, w, h, scale, lineW = 1.6) {
        const pr = this.toPixel(space.r[0], space.r[1], b, m, w, h);
        const pg = this.toPixel(space.g[0], space.g[1], b, m, w, h);
        const pb = this.toPixel(space.b[0], space.b[1], b, m, w, h);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pr.x, pr.y);
        ctx.lineTo(pg.x, pg.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.closePath();

        ctx.fillStyle = color === '#06b6d4' ? 'rgba(6, 182, 212, 0.08)' : (color === '#ec4899' ? 'rgba(236, 72, 153, 0.05)' : 'rgba(245, 158, 11, 0.05)');
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = lineW * scale;
        if (dash.length > 0) ctx.setLineDash(dash);
        ctx.stroke();

        // Corner Primaries
        [pr, pg, pb].forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * scale, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });
        ctx.restore();
    }

    drawPointsCore(ctx, b, m, w, h, scale, selectedId) {
        if (!this.points || this.points.length === 0) return;

        ctx.save();
        this.points.forEach((pt) => {
            const isSelected = selectedId === pt.id;
            const pTgt = this.toPixel(pt.target_x, pt.target_y, b, m, w, h);

            // Deviation Vector line
            if (pt.has_measured && pt.final_x != null && pt.final_y != null) {
                const pMeas = this.toPixel(pt.final_x, pt.final_y, b, m, w, h);
                ctx.beginPath();
                ctx.moveTo(pTgt.x, pTgt.y);
                ctx.lineTo(pMeas.x, pMeas.y);
                // Highlight red if delta_xy > 0.006!
                ctx.strokeStyle = pt.delta_xy > 0.006 ? '#ef4444' : '#10b981';
                ctx.lineWidth = (isSelected ? 2.8 : 2.0) * scale;
                ctx.stroke();

                // Measured Point
                ctx.beginPath();
                ctx.arc(pMeas.x, pMeas.y, (isSelected ? 7 : 5) * scale, 0, Math.PI * 2);
                ctx.fillStyle = pt.delta_xy > 0.006 ? '#ef4444' : '#10b981';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 * scale;
                ctx.stroke();
            }

            // Target Point (Diamond marker)
            ctx.beginPath();
            const sz = (isSelected ? 7 : 5) * scale;
            ctx.moveTo(pTgt.x, pTgt.y - sz);
            ctx.lineTo(pTgt.x + sz, pTgt.y);
            ctx.lineTo(pTgt.x, pTgt.y + sz);
            ctx.lineTo(pTgt.x - sz, pTgt.y);
            ctx.closePath();

            ctx.fillStyle = isSelected ? '#38bdf8' : '#e2e8f0';
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1 * scale;
            ctx.stroke();

            // Distinctive glowing dashed ring on selected point
            if (isSelected) {
                const ptPos = (pt.has_measured && pt.final_x != null) ? this.toPixel(pt.final_x, pt.final_y, b, m, w, h) : pTgt;
                ctx.save();
                ctx.beginPath();
                ctx.arc(ptPos.x, ptPos.y, 14 * scale, 0, Math.PI * 2);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2 * scale;
                ctx.setLineDash([4 * scale, 3 * scale]);
                ctx.stroke();
                ctx.restore();
            }

            // Intelligent Outward Label Offset to avoid overlapping
            if (this.options.showLabels) {
                ctx.font = `${Math.round((isSelected ? 11 : 10) * scale)}px Inter, system-ui, sans-serif`;
                ctx.fillStyle = isSelected ? '#38bdf8' : '#cbd5e1';

                // Vector from D65 white point (0.3127, 0.3290) to target point
                const vecX = pt.target_x - 0.3127;
                const vecY = pt.target_y - 0.3290;
                const len = Math.hypot(vecX, vecY) || 1.0;
                const normX = vecX / len;
                const normY = -vecY / len; // Canvas Y is inverted

                const offsetDist = 12 * scale;
                const labelX = pTgt.x + normX * offsetDist;
                const labelY = pTgt.y + normY * offsetDist;

                ctx.textAlign = normX > 0.1 ? 'left' : (normX < -0.1 ? 'right' : 'center');
                ctx.textBaseline = 'middle';
                ctx.fillText(`P${pt.id.toString().padStart(2, '0')}`, labelX, labelY);
            }
        });
        ctx.restore();
    }

    drawAxesCore(ctx, w, h, b, m, scale) {
        ctx.save();
        ctx.font = `bold ${Math.round(12 * scale)}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';

        ctx.fillText('CIE 1931 x', m.left + (w - m.left - m.right) / 2, h - 12 * scale);

        ctx.save();
        ctx.translate(18 * scale, m.top + (h - m.top - m.bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('CIE 1931 y', 0, 0);
        ctx.restore();

        ctx.restore();
    }

    drawExportLegend(ctx, w, h, m, scale) {
        ctx.save();
        const isEn = this.lang === 'en';
        // Title Bar
        ctx.font = `bold ${Math.round(16 * scale)}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'left';
        ctx.fillText(isEn ? 'CIE 1931 Chromaticity Diagram - Target Gamut & Offset Analysis' : 'CIE 1931 色度图 - 广色域打点测试与补差分析', m.left, 24 * scale);

        // Legend Pills
        const legendItems = [
            { label: 'DCI-P3 (D65)', color: '#06b6d4' },
            { label: 'BT.2020', color: '#ec4899' },
            { label: isEn ? 'Target Point (◆)' : '需求点 (◆)', color: '#e2e8f0' },
            { label: isEn ? 'Measured OK (●)' : '实测达标 (●)', color: '#10b981' },
            { label: isEn ? 'Delta xy>0.006 (●)' : '超差 Δxy>0.006 (●)', color: '#ef4444' }
        ];
        if (this.options.showSRGB) {
            legendItems.splice(2, 0, { label: 'sRGB', color: '#f59e0b' });
        }

        let curX = m.left;
        const legendY = 44 * scale;
        ctx.font = `${Math.round(11 * scale)}px Inter, system-ui`;

        legendItems.forEach(item => {
            ctx.fillStyle = item.color;
            ctx.fillRect(curX, legendY - 8 * scale, 10 * scale, 10 * scale);
            ctx.fillStyle = '#cbd5e1';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, curX + 14 * scale, legendY);
            curX += ctx.measureText(item.label).width + 24 * scale;
        });

        ctx.restore();
    }

    drawHUD(ctx) {
        ctx.save();
        const isEn = this.lang === 'en';
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;

        // Zoom badge
        const zoomText = isEn ? `${Math.round(this.zoom * 100)}% Zoom` : `${Math.round(this.zoom * 100)}% 缩放`;
        ctx.font = '10px SF Mono, monospace';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(w - 110, 8, 90, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(zoomText, w - 65, 18);

        if (this.zoom === 1.0) {
            ctx.font = '9px system-ui';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'left';
            ctx.fillText(isEn ? 'Scroll to zoom / Drag to pan' : '滚轮缩放 / 拖拽平移', this.margin.left + 5, 20);
        }
        ctx.restore();
    }

    drawTooltip(ctx, pt) {
        const isEn = this.lang === 'en';
        const p = this.toPixel(pt.final_x != null ? pt.final_x : pt.target_x, pt.final_y != null ? pt.final_y : pt.target_y);
        ctx.save();
        const lines = [
            `【${pt.name}】`,
            isEn ? `Target: (${pt.target_x.toFixed(4)}, ${pt.target_y.toFixed(4)})` : `需求值: (${pt.target_x.toFixed(4)}, ${pt.target_y.toFixed(4)})`,
            pt.has_measured ? 
                (isEn ? `Measured: (${pt.measured_x.toFixed(4)}, ${pt.measured_y.toFixed(4)})` : `实测值: (${pt.measured_x.toFixed(4)}, ${pt.measured_y.toFixed(4)})`) : 
                (isEn ? 'Measured: Pending' : '实测值: 待测'),
            (pt.offset_x !== 0 || pt.offset_y !== 0) ? 
                (isEn ? `Offset: (${pt.offset_x >= 0 ? '+' : ''}${pt.offset_x.toFixed(4)}, ${pt.offset_y >= 0 ? '+' : ''}${pt.offset_y.toFixed(4)})` : `微调补差: (${pt.offset_x >= 0 ? '+' : ''}${pt.offset_x.toFixed(4)}, ${pt.offset_y >= 0 ? '+' : ''}${pt.offset_y.toFixed(4)})`) : null,
            (pt.effective_target_x != null && (pt.offset_x !== 0 || pt.offset_y !== 0)) ? 
                (isEn ? `Effective: (${pt.effective_target_x.toFixed(4)}, ${pt.effective_target_y.toFixed(4)})` : `实际靶向: (${pt.effective_target_x.toFixed(4)}, ${pt.effective_target_y.toFixed(4)})`) : null,
            pt.has_measured && pt.measured_Y != null ? 
                (isEn ? `Luminance: ${pt.measured_Y.toFixed(1)} nits` : `实测亮度: ${pt.measured_Y.toFixed(1)} nit`) : null,
            pt.has_measured ? 
                (isEn ? `Delta xy: ${pt.delta_xy.toFixed(4)} ${pt.delta_xy > 0.006 ? '(Exceeded)' : ''}` : `色品偏差 Δxy: ${pt.delta_xy.toFixed(4)} ${pt.delta_xy > 0.006 ? '(超标)' : ''}`) : null,
            pt.has_measured ? 
                (isEn ? `Delta u'v': ${pt.delta_uv.toFixed(4)}` : `人眼色差 Δu'v': ${pt.delta_uv.toFixed(4)}`) : null,
            pt.pass_status === 'EXCEEDED_P3' ? 
                (isEn ? '★ Exceeded DCI-P3 Gamut' : '★ 已超越 DCI-P3 色域边界') : 
                (pt.pass_status === 'INSIDE_P3' ? (isEn ? '⚠ Inside DCI-P3 Bounds' : '⚠ 未达 P3 边界') : null)
        ].filter(Boolean);

        ctx.font = '11px Inter, system-ui, sans-serif';
        let maxTextW = 0;
        lines.forEach(line => {
            const lw = ctx.measureText(line).width;
            if (lw > maxTextW) maxTextW = lw;
        });

        const padX = 12;
        const padY = 10;
        const boxW = maxTextW + padX * 2;
        const boxH = lines.length * 16 + padY * 2;

        let boxX = p.x + 15;
        let boxY = p.y - boxH / 2;

        const dpr = window.devicePixelRatio || 1;
        const canvasW = this.canvas.width / dpr;
        if (boxX + boxW > canvasW - 10) boxX = p.x - boxW - 15;
        if (boxY < 10) boxY = 10;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = pt.delta_xy > 0.006 ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            if (i === 0) {
                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            } else if (line.includes('(超标)')) {
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            } else if (line.startsWith('★')) {
                ctx.fillStyle = '#10b981';
                ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            } else {
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '11px Inter, system-ui, sans-serif';
            }
            ctx.fillText(line, boxX + padX, boxY + padY + i * 16);
        });

        ctx.restore();
    }

    initEventListeners() {
        window.addEventListener('resize', () => this.resize());

        const getMousePos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.clientWidth / (rect.width || 1);
            const scaleY = this.canvas.clientHeight / (rect.height || 1);
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const pos = getMousePos(e);
            const coordBefore = this.toCoord(pos.x, pos.y);
            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
            const newZoom = Math.max(1.0, Math.min(30.0, this.zoom * zoomFactor));

            if (newZoom !== this.zoom) {
                this.zoom = newZoom;
                if (this.zoom === 1.0) {
                    this.panX = 0;
                    this.panY = 0;
                } else {
                    const coordAfter = this.toCoord(pos.x, pos.y);
                    this.panX += (coordBefore.x - coordAfter.x);
                    this.panY += (coordBefore.y - coordAfter.y);
                }
                this.render();
            }
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.hasMovedDrag = false;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const pos = getMousePos(e);

            if (this.isDragging) {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.clientWidth / (rect.width || 1);
                const scaleY = this.canvas.clientHeight / (rect.height || 1);
                const dx = (e.clientX - this.dragStartX) * scaleX;
                const dy = (e.clientY - this.dragStartY) * scaleY;
                if (Math.hypot(dx, dy) > 3) {
                    this.hasMovedDrag = true;
                    this.canvas.style.cursor = 'grabbing';

                    const b = this.getBounds();
                    const w = this.canvas.clientWidth - this.margin.left - this.margin.right;
                    const h = this.canvas.clientHeight - this.margin.top - this.margin.bottom;
                    const deltaX = (dx / w) * (b.maxX - b.minX);
                    const deltaY = (dy / h) * (b.maxY - b.minY);

                    this.panX -= deltaX;
                    this.panY += deltaY;

                    this.dragStartX = e.clientX;
                    this.dragStartY = e.clientY;
                    this.render();
                    return;
                }
            }

            let closest = null;
            let minDist = 28;

            for (const pt of this.points) {
                const pTgt = this.toPixel(pt.target_x, pt.target_y);
                const d1 = Math.hypot(pos.x - pTgt.x, pos.y - pTgt.y);
                if (d1 < minDist) {
                    minDist = d1;
                    closest = pt;
                }
                if (pt.has_measured && pt.final_x != null && pt.final_y != null) {
                    const pMeas = this.toPixel(pt.final_x, pt.final_y);
                    const d2 = Math.hypot(pos.x - pMeas.x, pos.y - pMeas.y);
                    if (d2 < minDist) {
                        minDist = d2;
                        closest = pt;
                    }
                }
            }

            if (this.hoveredPoint !== closest) {
                this.hoveredPoint = closest;
                this.canvas.style.cursor = closest ? 'pointer' : 'crosshair';
                this.render();
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.hoveredPoint) {
                this.hoveredPoint = null;
                this.render();
            }
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.hasMovedDrag) return;
            const pos = getMousePos(e);
            let closest = null;
            let minDist = 28;

            for (const pt of this.points) {
                const pTgt = this.toPixel(pt.target_x, pt.target_y);
                const d1 = Math.hypot(pos.x - pTgt.x, pos.y - pTgt.y);
                if (d1 < minDist) {
                    minDist = d1;
                    closest = pt;
                }
                if (pt.has_measured && pt.final_x != null && pt.final_y != null) {
                    const pMeas = this.toPixel(pt.final_x, pt.final_y);
                    const d2 = Math.hypot(pos.x - pMeas.x, pos.y - pMeas.y);
                    if (d2 < minDist) {
                        minDist = d2;
                        closest = pt;
                    }
                }
            }

            if (closest) {
                this.selectedPointId = closest.id;
                this.hoveredPoint = closest;
                if (window.onChartPointSelected) {
                    window.onChartPointSelected(closest.id);
                }
            } else {
                this.selectedPointId = null;
                if (window.onChartPointSelected) {
                    window.onChartPointSelected(null);
                }
            }
            this.render();
        });
    }

    /**
     * Exports Ultra High-Res PNG (3000x3000px, 4K / 300DPI Grade)
     * Completely clean with NO on-screen UI buttons/overlays.
     */
    exportHighResPNG(pixelSize = 3000) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = pixelSize;
        offCanvas.height = pixelSize;
        const offCtx = offCanvas.getContext('2d');

        const scale = pixelSize / 800;
        const exportMargin = {
            top: 70 * scale,
            right: 40 * scale,
            bottom: 55 * scale,
            left: 65 * scale
        };

        // Render full overview bounds
        const exportBounds = {
            minX: this.baseMinX,
            maxX: this.baseMaxX,
            minY: this.baseMinY,
            maxY: this.baseMaxY
        };

        this.drawChartCore(offCtx, pixelSize, pixelSize, exportBounds, exportMargin, {
            isInteractive: false,
            scaleFactor: scale,
            selectedPointId: null,
            hoveredPoint: null
        });

        return offCanvas.toDataURL('image/png');
    }

    /**
     * Exports Universal Standalone Vector SVG
     * Opens directly in any browser with zero pixelation at 10000% zoom.
     */
    exportSVG(viewWidth = 1200, viewHeight = 1200) {
        const b = { minX: this.baseMinX, maxX: this.baseMaxX, minY: this.baseMinY, maxY: this.baseMaxY };
        const m = { top: 90, right: 50, bottom: 70, left: 80 };
        const plotW = viewWidth - m.left - m.right;
        const plotH = viewHeight - m.top - m.bottom;

        const toSvgP = (x, y) => {
            const px = m.left + ((x - b.minX) / (b.maxX - b.minX)) * plotW;
            const py = m.top + plotH - ((y - b.minY) / (b.maxY - b.minY)) * plotH;
            return { x: px.toFixed(2), y: py.toFixed(2) };
        };

        let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}" width="100%" height="100%">\n`;
        svg += `<style>
            .bg { fill: #0f172a; }
            .plot-bg { fill: #1e293b; }
            .grid { stroke: #334155; stroke-width: 0.9; }
            .axis-text { fill: #94a3b8; font-family: -apple-system, system-ui, sans-serif; font-size: 14px; }
            .title { fill: #f8fafc; font-family: -apple-system, system-ui, sans-serif; font-size: 20px; font-weight: bold; }
            .legend-text { fill: #cbd5e1; font-family: -apple-system, system-ui, sans-serif; font-size: 13px; }
            .p-label { fill: #cbd5e1; font-family: 'SF Mono', monospace; font-size: 12px; font-weight: 600; }
        </style>\n`;

        // Backgrounds
        svg += `<rect class="bg" width="${viewWidth}" height="${viewHeight}"/>\n`;
        svg += `<rect class="plot-bg" x="${m.left}" y="${m.top}" width="${plotW}" height="${plotH}"/>\n`;

        // Grid lines
        for (let x = 0.0; x <= 0.81; x += 0.1) {
            const p1 = toSvgP(x, b.minY);
            const p2 = toSvgP(x, b.maxY);
            svg += `<line class="grid" x1="${p1.x}" y1="${m.top}" x2="${p2.x}" y2="${m.top + plotH}"/>\n`;
            svg += `<text class="axis-text" x="${p1.x}" y="${viewHeight - m.bottom + 20}" text-anchor="middle">${x.toFixed(1)}</text>\n`;
        }
        for (let y = 0.0; y <= 0.91; y += 0.1) {
            const p = toSvgP(b.minX, y);
            svg += `<line class="grid" x1="${m.left}" y1="${p.y}" x2="${m.left + plotW}" y2="${p.y}"/>\n`;
            svg += `<text class="axis-text" x="${m.left - 12}" y="${p.y}" text-anchor="end" dominant-baseline="middle">${y.toFixed(1)}</text>\n`;
        }

        // Spectral Locus Path & Optional Spectrum Color Tongue
        if (this.spectralLocus.length > 0) {
            let pathD = `M ${toSvgP(this.spectralLocus[0][0], this.spectralLocus[0][1]).x} ${toSvgP(this.spectralLocus[0][0], this.spectralLocus[0][1]).y} `;
            for (let i = 1; i < this.spectralLocus.length; i++) {
                const pt = toSvgP(this.spectralLocus[i][0], this.spectralLocus[i][1]);
                pathD += `L ${pt.x} ${pt.y} `;
            }
            pathD += `Z`;

            if (this.options.showSpectrumFill && this.spectrumCanvas) {
                const p00 = toSvgP(0, 0);
                const pMax = toSvgP(0.85, 0.90);
                const imgW = (parseFloat(pMax.x) - parseFloat(p00.x)).toFixed(2);
                const imgH = (parseFloat(p00.y) - parseFloat(pMax.y)).toFixed(2);
                const dataUrl = this.spectrumCanvas.toDataURL('image/png');

                svg += `<defs><clipPath id="svg-locus-clip"><path d="${pathD}"/></clipPath></defs>\n`;
                svg += `<image href="${dataUrl}" x="${p00.x}" y="${pMax.y}" width="${imgW}" height="${imgH}" clip-path="url(#svg-locus-clip)" opacity="0.85"/>\n`;
            } else {
                svg += `<path d="${pathD}" fill="rgba(56, 189, 248, 0.05)"/>\n`;
            }

            svg += `<path d="${pathD}" fill="none" stroke="#94a3b8" stroke-width="2"/>\n`;
        }

        // Gamut Triangles
        const makeTriangle = (space, color, dash = '') => {
            const r = toSvgP(space[0][0], space[0][1]);
            const g = toSvgP(space[1][0], space[1][1]);
            const b = toSvgP(space[2][0], space[2][1]);
            return `<polygon points="${r.x},${r.y} ${g.x},${g.y} ${b.x},${b.y}" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}"/>\n`;
        };

        svg += makeTriangle([[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]], '#ec4899', '8,5'); // BT.2020
        svg += makeTriangle([[0.680, 0.320], [0.265, 0.690], [0.150, 0.060]], '#06b6d4'); // DCI-P3
        if (this.options.showSRGB) {
            svg += makeTriangle([[0.640, 0.330], [0.300, 0.600], [0.150, 0.060]], '#f59e0b', '4,4'); // sRGB
        }

        // D65 White point
        const pw = toSvgP(0.3127, 0.3290);
        svg += `<circle cx="${pw.x}" cy="${pw.y}" r="5" fill="none" stroke="#ffffff" stroke-width="2"/>\n`;
        svg += `<text class="axis-text" x="${parseFloat(pw.x)+8}" y="${parseFloat(pw.y)-6}" fill="#fff">D65</text>\n`;

        // Points & Deviation Vectors
        this.points.forEach(pt => {
            const pTgt = toSvgP(pt.target_x, pt.target_y);
            const isExceeded = pt.pass_status === 'EXCEEDED_P3';
            const isRed = pt.delta_xy > 0.006;

            if (pt.has_measured && pt.final_x != null && pt.final_y != null) {
                const pMeas = toSvgP(pt.final_x, pt.final_y);
                const strokeCol = isRed ? '#ef4444' : '#10b981';
                svg += `<line x1="${pTgt.x}" y1="${pTgt.y}" x2="${pMeas.x}" y2="${pMeas.y}" stroke="${strokeCol}" stroke-width="2.2"/>\n`;
                svg += `<circle cx="${pMeas.x}" cy="${pMeas.y}" r="6.5" fill="${strokeCol}" stroke="#ffffff" stroke-width="1.8"/>\n`;
            }

            // Target Diamond
            const sz = 6.5;
            const x = parseFloat(pTgt.x), y = parseFloat(pTgt.y);
            svg += `<polygon points="${x},${y-sz} ${x+sz},${y} ${x},${y+sz} ${x-sz},${y}" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.2"/>\n`;

            // Outward Label Offset
            const vecX = pt.target_x - 0.3127, vecY = pt.target_y - 0.3290;
            const len = Math.hypot(vecX, vecY) || 1.0;
            const normX = vecX / len, normY = -vecY / len;
            const lx = (x + normX * 16).toFixed(1);
            const ly = (y + normY * 16).toFixed(1);
            const anchor = normX > 0.1 ? 'start' : (normX < -0.1 ? 'end' : 'middle');

            svg += `<text class="p-label" x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle">P${pt.id.toString().padStart(2, '0')}</text>\n`;
        });

        // Header Title & Legend
        const isEn = this.lang === 'en';
        const titleText = isEn ? 'CIE 1931 Chromaticity Diagram - Target Gamut & Offset Vector Report' : 'CIE 1931 色度图 - 广色域打点测试与补差分析矢量报告';
        svg += `<text class="title" x="${m.left}" y="42">${titleText}</text>\n`;
        svg += `<text class="legend-text" x="${m.left}" y="68">
            <tspan fill="#06b6d4">■ DCI-P3 (D65)</tspan>   
            <tspan fill="#ec4899">■ BT.2020</tspan>   
            ${this.options.showSRGB ? '<tspan fill="#f59e0b">■ sRGB</tspan>   ' : ''}
            <tspan fill="#e2e8f0">◆ ${isEn ? 'Target Point' : '需求点'}</tspan>   
            <tspan fill="#10b981">● ${isEn ? 'Measured OK' : '实测达标'}</tspan>   
            <tspan fill="#ef4444">● ${isEn ? 'Delta xy>0.006' : '超差 (Δxy&gt;0.006)'}</tspan>
        </text>\n`;

        // Axes titles
        svg += `<text class="axis-text" x="${m.left + plotW / 2}" y="${viewHeight - 20}" text-anchor="middle" font-weight="bold">CIE 1931 x</text>\n`;
        svg += `<text class="axis-text" x="25" y="${m.top + plotH / 2}" text-anchor="middle" transform="rotate(-90, 25, ${m.top + plotH / 2})" font-weight="bold">CIE 1931 y</text>\n`;

        svg += `</svg>`;
        return svg;
    }

    exportUniversalSVG(viewWidth = 1200, viewHeight = 1200) {
        return this.exportSVG(viewWidth, viewHeight);
    }
}
