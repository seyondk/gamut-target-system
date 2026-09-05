"""
FastAPI Server & WebSocket Orchestrator for DCI-P3 Colorimeter Testing System.
STRICTLY REAL HARDWARE ONLY - ZERO SIMULATION.
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import csv
import json
import math
import asyncio
from io import StringIO
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.color_engine import (
    DEFAULT_15_POINTS,
    COLOR_SPACES,
    SPECTRAL_LOCUS_380_700,
    calculate_point_result,
    xy_to_container_rgb,
    xyY_to_XYZ,
    XYZ_to_xyY,
    delta_xy,
    delta_uv_prime,
)
from backend.meter_driver import MeterDriver

app = FastAPI(title="Wide Gamut Target Testing & Offset Analysis System (Hardware Only)")

DEFAULT_VALIDATION_PRIMARIES = [
    {"id": "W", "name": "White D65", "target_x": 0.3127, "target_y": 0.3290, "rgb": [1.0, 1.0, 1.0], "color_hex": "#ffffff"},
    {"id": "R", "name": "Red 100% (P3)", "target_x": 0.6800, "target_y": 0.3200, "rgb": [1.0, 0.0, 0.0], "color_hex": "#ef4444"},
    {"id": "G", "name": "Green 100% (P3)", "target_x": 0.2650, "target_y": 0.6900, "rgb": [0.0, 1.0, 0.0], "color_hex": "#10b981"},
    {"id": "B", "name": "Blue 100% (P3)", "target_x": 0.1500, "target_y": 0.0600, "rgb": [0.0, 0.0, 1.0], "color_hex": "#3b82f6"},
    {"id": "Y", "name": "Yellow (P3)", "target_x": 0.4420, "target_y": 0.5360, "rgb": [1.0, 1.0, 0.0], "color_hex": "#eab308"},
    {"id": "C", "name": "Cyan (P3)", "target_x": 0.2000, "target_y": 0.7070, "rgb": [0.0, 1.0, 1.0], "color_hex": "#06b6d4"},
    {"id": "M", "name": "Magenta (P3)", "target_x": 0.3800, "target_y": 0.1700, "rgb": [1.0, 0.0, 1.0], "color_hex": "#ec4899"},
]

meter = MeterDriver()

# Global Application State
class AppState:
    def __init__(self):
        self.settings = {
            "container_space": "bt2020",      # bt2020 | p3 | srgb | native
            "patch_size": "20%",              # 10% | 20% | 50% | 100%
            "background": "black",            # black | gray18
            "apply_flare_comp": False,
            "hdr_mode": True,                 # HDR EOTF simulation
            "global_offset_x": 0.0,
            "global_offset_y": 0.0,
            "selected_ccss": None,
            "auto_delay": 3.0,                # Default 3.0s interval for TV stability
        }
        self.black_baseline: Optional[Dict[str, Any]] = None
        self.active_patch: Optional[Dict[str, Any]] = None
        self.is_measuring: bool = False
        self.points: List[Dict[str, Any]] = []
        self.validation_primaries: List[Dict[str, Any]] = []
        self.init_points()
        self.init_validation_primaries()

    def init_validation_primaries(self):
        self.validation_primaries = []
        for item in DEFAULT_VALIDATION_PRIMARIES:
            self.validation_primaries.append({
                "id": item["id"],
                "name": item["name"],
                "target_x": item["target_x"],
                "target_y": item["target_y"],
                "rgb": item["rgb"],
                "color_hex": item["color_hex"],
                "measured_x": None,
                "measured_y": None,
                "measured_Y": None,
                "delta_xy": None,
                "delta_uv": None,
                "status": "PENDING"
            })

    def get_validation_summary(self) -> Dict[str, Any]:
        measured = [v for v in self.validation_primaries if v["delta_xy"] is not None]
        if not measured:
            return {
                "count": 0,
                "total": len(self.validation_primaries),
                "avg_delta_xy": None,
                "max_delta_xy": None,
                "verdict": "PENDING",
                "message": "Standard primary validation has not been performed yet."
            }
        avg_dxy = sum(v["delta_xy"] for v in measured) / len(measured)
        max_dxy = max(v["delta_xy"] for v in measured)
        if avg_dxy <= 0.003 and max_dxy <= 0.005:
            verdict = "EXCELLENT"
            msg = "Display primary calibration is excellent; colorimeter probe operating accurately."
        elif avg_dxy <= 0.006:
            verdict = "GOOD"
            msg = "Display primary calibration is good; colorimeter probe reading accurately."
        else:
            verdict = "DEVIATION"
            msg = f"Minor primary deviation detected (Avg delta_xy={avg_dxy:.4f})."

        return {
            "count": len(measured),
            "total": len(self.validation_primaries),
            "avg_delta_xy": round(avg_dxy, 4),
            "max_delta_xy": round(max_dxy, 4),
            "verdict": verdict,
            "message": msg
        }

    def init_points(self):
        self.points = []
        for item in DEFAULT_15_POINTS:
            self._add_point_internal(item["id"], item["name"], item["target_x"], item["target_y"], is_custom=False)

    def _add_point_internal(self, pid: int, name: str, tx: float, ty: float, is_custom: bool = False):
        pt = {
            "id": pid,
            "name": name,
            "target_x": round(tx, 4),
            "target_y": round(ty, 4),
            "measured_x": None,
            "measured_y": None,
            "measured_Y": None,
            "offset_x": 0.0,
            "offset_y": 0.0,
            "final_x": None,
            "final_y": None,
            "delta_xy": None,
            "delta_uv": None,
            "target_exceeds_p3": None,
            "measured_exceeds_p3": None,
            "pass_status": "PENDING",
            "is_custom": is_custom,
        }
        pt["rgb_bt2020"] = list(xy_to_container_rgb(pt["target_x"], pt["target_y"], "bt2020")[:3])
        pt["rgb_p3"] = list(xy_to_container_rgb(pt["target_x"], pt["target_y"], "p3")[:3])
        pt["rgb_srgb"] = list(xy_to_container_rgb(pt["target_x"], pt["target_y"], "srgb")[:3])
        pt["rgb_native"] = list(xy_to_container_rgb(pt["target_x"], pt["target_y"], "native")[:3])
        container = self.settings.get("container_space", "bt2020")
        target_rgb_cur = pt.get(f"rgb_{container}", pt["rgb_bt2020"])
        pt["target_rgb_255"] = [round(max(0.0, min(1.0, c)) * 255) for c in target_rgb_cur]
        pt["rgb_255"] = pt["target_rgb_255"]
        pt["effective_target_x"] = pt["target_x"]
        pt["effective_target_y"] = pt["target_y"]

        calc = calculate_point_result(pt["target_x"], pt["target_y"])
        pt.update(calc)
        self.points.append(pt)

    def recompute_point(self, pt_id: int):
        for pt in self.points:
            if pt["id"] == pt_id:
                black_XYZ = tuple(self.black_baseline["XYZ"]) if self.black_baseline else None
                tot_off_x = pt["offset_x"] + self.settings["global_offset_x"]
                tot_off_y = pt["offset_y"] + self.settings["global_offset_y"]
                calc = calculate_point_result(
                    target_x=pt["target_x"],
                    target_y=pt["target_y"],
                    measured_x=pt["measured_x"],
                    measured_y=pt["measured_y"],
                    offset_x=tot_off_x,
                    offset_y=tot_off_y,
                    measured_Y=pt["measured_Y"],
                    black_XYZ=black_XYZ,
                    apply_flare_comp=self.settings["apply_flare_comp"],
                )
                pt.update(calc)
                eff_x = round(pt["target_x"] + tot_off_x, 4)
                eff_y = round(pt["target_y"] + tot_off_y, 4)
                pt["effective_target_x"] = eff_x
                pt["effective_target_y"] = eff_y
                pt["rgb_bt2020"] = list(xy_to_container_rgb(eff_x, eff_y, "bt2020")[:3])
                pt["rgb_p3"] = list(xy_to_container_rgb(eff_x, eff_y, "p3")[:3])
                pt["rgb_srgb"] = list(xy_to_container_rgb(eff_x, eff_y, "srgb")[:3])
                pt["rgb_native"] = list(xy_to_container_rgb(eff_x, eff_y, "native")[:3])

                container = self.settings.get("container_space", "bt2020")
                # Target nominal RGB directly from demand value (target_x, target_y)
                target_rgb = xy_to_container_rgb(pt["target_x"], pt["target_y"], container)
                pt["target_rgb_255"] = [round(max(0.0, min(1.0, c)) * 255) for c in target_rgb[:3]]
                pt["rgb_255"] = pt["target_rgb_255"]
                break

    def recompute_all(self):
        for pt in self.points:
            self.recompute_point(pt["id"])

state = AppState()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for conn in list(self.active_connections):
            try:
                await conn.send_json(message)
            except Exception:
                self.disconnect(conn)

manager = ConnectionManager()


# API Models
class OffsetUpdateModel(BaseModel):
    point_id: Optional[int] = None
    offset_x: float = 0.0
    offset_y: float = 0.0
    is_global: bool = False

class TargetUpdateModel(BaseModel):
    point_id: int
    target_x: float
    target_y: float
    name: Optional[str] = None

class AddPointModel(BaseModel):
    name: str
    target_x: float
    target_y: float

class SettingsUpdateModel(BaseModel):
    container_space: Optional[str] = None
    patch_size: Optional[str] = None
    background: Optional[str] = None
    apply_flare_comp: Optional[bool] = None
    hdr_mode: Optional[bool] = None
    global_offset_x: Optional[float] = None
    global_offset_y: Optional[float] = None
    selected_ccss: Optional[str] = None
    auto_delay: Optional[float] = None


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    meter_status = meter.detect_instruments(force_refresh=False)
    await websocket.send_json({
        "type": "INIT_STATE",
        "state": {
            "settings": state.settings,
            "points": state.points,
            "black_baseline": state.black_baseline,
            "active_patch": state.active_patch,
            "color_spaces": COLOR_SPACES,
            "spectral_locus": SPECTRAL_LOCUS_380_700,
            "instrument_status": meter_status,
            "meter_info": meter_status,
            "ccss_files": meter.get_available_ccss_files(),
            "validation_primaries": state.validation_primaries,
            "validation_summary": state.get_validation_summary()
        }
    })
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/api/state")
def get_state():
    meter_status = meter.detect_instruments(force_refresh=False)
    return {
        "settings": state.settings,
        "points": state.points,
        "black_baseline": state.black_baseline,
        "active_patch": state.active_patch,
        "color_spaces": COLOR_SPACES,
        "spectral_locus": SPECTRAL_LOCUS_380_700,
        "instrument_status": meter_status,
        "meter_info": meter_status,
        "ccss_files": meter.get_available_ccss_files(),
        "validation_primaries": state.validation_primaries,
        "validation_summary": state.get_validation_summary()
    }


@app.get("/api/meter/status")
def get_meter_status(refresh: bool = False):
    status = meter.detect_instruments(force_refresh=refresh)
    return status


@app.post("/api/settings")
async def update_settings(req: SettingsUpdateModel):
    for field, val in req.dict(exclude_unset=True).items():
        state.settings[field] = val
        if field == "selected_ccss":
            meter.selected_ccss = val

    state.recompute_all()
    await manager.broadcast({
        "type": "SETTINGS_UPDATED",
        "settings": state.settings,
        "points": state.points
    })
    return {"status": "ok", "settings": state.settings}


@app.post("/api/patch/display/{point_id}")
async def display_patch(point_id: int):
    target = None
    for pt in state.points:
        if pt["id"] == point_id:
            target = pt
            break
    if not target:
        raise HTTPException(status_code=404, detail="Point not found")

    container = state.settings["container_space"]
    eff_x = target.get("effective_target_x", target["target_x"])
    eff_y = target.get("effective_target_y", target["target_y"])
    r, g, b, is_clipped = xy_to_container_rgb(eff_x, eff_y, container)

    patch_info = {
        "point_id": target["id"],
        "name": f"P{target['id']}",
        "target_x": target["target_x"],
        "target_y": target["target_y"],
        "effective_target_x": eff_x,
        "effective_target_y": eff_y,
        "container": container,
        "rgb": [r, g, b],
        "is_clipped": is_clipped,
        "patch_size": state.settings["patch_size"],
        "background": state.settings["background"],
        "hdr_mode": state.settings["hdr_mode"],
        "is_black": False
    }
    state.active_patch = patch_info
    await manager.broadcast({"type": "PATCH_DISPLAY", "patch": patch_info})
    return {"status": "ok", "patch": patch_info}


@app.post("/api/measure/black")
async def measure_black():
    state.is_measuring = True
    black_patch = {
        "point_id": 0,
        "name": "测前黑场基准 (Black Baseline)",
        "target_x": 0.3127,
        "target_y": 0.3290,
        "container": state.settings["container_space"],
        "rgb": [0.0, 0.0, 0.0],
        "is_clipped": False,
        "patch_size": state.settings["patch_size"],
        "background": "black",
        "hdr_mode": state.settings["hdr_mode"],
        "is_black": True
    }
    state.active_patch = black_patch
    await manager.broadcast({"type": "PATCH_DISPLAY", "patch": black_patch})
    
    await asyncio.sleep(0.8)

    try:
        loop = asyncio.get_event_loop()
        meas_result = await loop.run_in_executor(None, lambda: meter.measure(0.3127, 0.3290, is_black=True))
        state.black_baseline = meas_result
        state.recompute_all()
        await manager.broadcast({
            "type": "BLACK_CALIBRATED",
            "black_baseline": state.black_baseline,
            "points": state.points
        })
        return {"status": "ok", "black_baseline": state.black_baseline}
    except Exception as e:
        await manager.broadcast({"type": "MEASURE_ERROR", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        state.is_measuring = False


@app.post("/api/measure/point/{point_id}")
async def measure_point(point_id: int):
    target = None
    for pt in state.points:
        if pt["id"] == point_id:
            target = pt
            break
    if not target:
        raise HTTPException(status_code=404, detail="Point not found")

    state.is_measuring = True
    await display_patch(point_id)
    await asyncio.sleep(0.8)

    try:
        loop = asyncio.get_event_loop()
        meas_result = await loop.run_in_executor(None, lambda: meter.measure(target["target_x"], target["target_y"], is_black=False))

        target["measured_x"] = meas_result["x"]
        target["measured_y"] = meas_result["y"]
        target["measured_Y"] = meas_result["Y"]
        
        state.recompute_point(point_id)
        await manager.broadcast({
            "type": "POINT_MEASURED",
            "point": target,
            "points": state.points
        })
        return {"status": "ok", "point": target, "points": state.points}
    except Exception as e:
        await manager.broadcast({"type": "MEASURE_ERROR", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        state.is_measuring = False


@app.post("/api/measure/all")
async def measure_all():
    state.is_measuring = True
    total_delay = max(1.0, float(state.settings.get("auto_delay", 3.0)))
    
    try:
        for pt in state.points:
            container = state.settings["container_space"]
            eff_x = pt.get("effective_target_x", pt["target_x"])
            eff_y = pt.get("effective_target_y", pt["target_y"])
            r, g, b, is_clipped = xy_to_container_rgb(eff_x, eff_y, container)
            patch_info = {
                "point_id": pt["id"],
                "name": f"P{pt['id']}",
                "target_x": pt["target_x"],
                "target_y": pt["target_y"],
                "effective_target_x": eff_x,
                "effective_target_y": eff_y,
                "container": container,
                "rgb": [r, g, b],
                "is_clipped": is_clipped,
                "patch_size": state.settings["patch_size"],
                "background": state.settings["background"],
                "hdr_mode": state.settings["hdr_mode"],
                "is_black": False
            }
            state.active_patch = patch_info
            await manager.broadcast({"type": "PATCH_DISPLAY", "patch": patch_info})
            
            await asyncio.sleep(0.8)
            
            loop = asyncio.get_event_loop()
            meas_result = await loop.run_in_executor(None, lambda x=eff_x, y=eff_y: meter.measure(x, y, is_black=False))
            
            pt["measured_x"] = meas_result["x"]
            pt["measured_y"] = meas_result["y"]
            pt["measured_Y"] = meas_result["Y"]
            state.recompute_point(pt["id"])
            
            await manager.broadcast({
                "type": "POINT_MEASURED",
                "point": pt,
                "points": state.points
            })
            
            remaining_wait = max(0.4, total_delay - 0.8 - 0.3)
            await asyncio.sleep(remaining_wait)

        state.active_patch = None
        await manager.broadcast({"type": "STANDBY_MODE"})
        await manager.broadcast({
            "type": "BATCH_MEASURE_COMPLETED",
            "total_points": len(state.points)
        })
        return {"status": "completed", "points": state.points}
    except Exception as e:
        await manager.broadcast({"type": "MEASURE_ERROR", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        state.is_measuring = False


@app.post("/api/points/target")
async def update_point_target(req: TargetUpdateModel):
    target = None
    for pt in state.points:
        if pt["id"] == req.point_id:
            target = pt
            break
    if not target:
        raise HTTPException(status_code=404, detail="Point not found")

    target["target_x"] = round(req.target_x, 4)
    target["target_y"] = round(req.target_y, 4)
    if req.name:
        target["name"] = req.name

    state.recompute_point(req.point_id)
    await manager.broadcast({"type": "POINTS_UPDATED", "points": state.points})
    return {"status": "ok", "point": target}


@app.post("/api/points/add")
async def add_custom_point(req: AddPointModel):
    new_id = max([p["id"] for p in state.points] + [0]) + 1
    state._add_point_internal(new_id, req.name, req.target_x, req.target_y, is_custom=True)
    await manager.broadcast({"type": "POINTS_UPDATED", "points": state.points})
    return {"status": "ok", "point_id": new_id, "points": state.points}


@app.post("/api/points/delete/{point_id}")
@app.delete("/api/points/{point_id}")
async def delete_point(point_id: int):
    target_idx = -1
    for idx, pt in enumerate(state.points):
        if pt["id"] == point_id:
            target_idx = idx
            break
    if target_idx == -1:
        raise HTTPException(status_code=404, detail="Point not found")

    del state.points[target_idx]
    state.recompute_all()
    await manager.broadcast({"type": "POINTS_UPDATED", "points": state.points})
    return {"status": "ok", "deleted_id": point_id, "points": state.points}


@app.post("/api/points/offset")
async def update_offset(req: OffsetUpdateModel):
    if req.is_global:
        state.settings["global_offset_x"] = req.offset_x
        state.settings["global_offset_y"] = req.offset_y
    else:
        for pt in state.points:
            if pt["id"] == req.point_id:
                pt["offset_x"] = req.offset_x
                pt["offset_y"] = req.offset_y
                break
    state.recompute_all()
    await manager.broadcast({
        "type": "POINTS_UPDATED",
        "points": state.points,
        "settings": state.settings
    })
    return {"status": "ok", "points": state.points}


@app.post("/api/points/manual_value")
async def set_manual_measured_value(data: Dict[str, Any]):
    pt_id = data.get("point_id")
    meas_x = data.get("measured_x")
    meas_y = data.get("measured_y")
    meas_Y = data.get("measured_Y", 100.0)

    for pt in state.points:
        if pt["id"] == pt_id:
            pt["measured_x"] = float(meas_x) if meas_x is not None else None
            pt["measured_y"] = float(meas_y) if meas_y is not None else None
            pt["measured_Y"] = float(meas_Y) if meas_Y is not None else None
            break

    state.recompute_point(pt_id)
    await manager.broadcast({"type": "POINTS_UPDATED", "points": state.points})
    return {"status": "ok", "points": state.points}


@app.post("/api/points/reset")
async def reset_points():
    state.init_points()
    await manager.broadcast({"type": "POINTS_UPDATED", "points": state.points})
    return {"status": "ok", "points": state.points}


@app.get("/api/validation/status")
def get_validation_status():
    return {
        "status": "ok",
        "primaries": state.validation_primaries,
        "summary": state.get_validation_summary()
    }


@app.post("/api/validation/reset")
async def reset_validation():
    state.init_validation_primaries()
    await manager.broadcast({
        "type": "VALIDATION_UPDATED",
        "primaries": state.validation_primaries,
        "summary": state.get_validation_summary()
    })
    return {"status": "ok", "primaries": state.validation_primaries, "summary": state.get_validation_summary()}


@app.post("/api/validation/measure/{color_id}")
async def measure_validation_primary(color_id: str):
    item = next((v for v in state.validation_primaries if v["id"] == color_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Primary color item not found")

    patch_info = {
        "point_id": f"VAL_{item['id']}",
        "name": f"Primary: {item['name']}",
        "target_x": item["target_x"],
        "target_y": item["target_y"],
        "container": "p3",
        "rgb": item["rgb"],
        "is_clipped": False,
        "patch_size": state.settings["patch_size"],
        "background": state.settings["background"],
        "hdr_mode": state.settings["hdr_mode"],
        "is_black": False
    }
    state.active_patch = patch_info
    await manager.broadcast({"type": "PATCH_DISPLAY", "patch": patch_info})
    await asyncio.sleep(0.8)

    try:
        loop = asyncio.get_event_loop()
        meas = await loop.run_in_executor(None, lambda: meter.measure(item["target_x"], item["target_y"], is_black=False))

        item["measured_x"] = meas["x"]
        item["measured_y"] = meas["y"]
        item["measured_Y"] = meas["Y"]

        item["delta_xy"] = round(delta_xy(item["target_x"], item["target_y"], meas["x"], meas["y"]), 4)
        item["delta_uv"] = round(delta_uv_prime(item["target_x"], item["target_y"], meas["x"], meas["y"]), 4)

        if item["delta_xy"] <= 0.003:
            item["status"] = "EXCELLENT"
        elif item["delta_xy"] <= 0.006:
            item["status"] = "GOOD"
        else:
            item["status"] = "DEVIATION"

        await manager.broadcast({
            "type": "VALIDATION_UPDATED",
            "item": item,
            "primaries": state.validation_primaries,
            "summary": state.get_validation_summary()
        })
        return {"status": "ok", "item": item, "summary": state.get_validation_summary()}
    except Exception as e:
        await manager.broadcast({"type": "MEASURE_ERROR", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/validation/measure_all")
async def measure_all_validation():
    total_delay = max(1.0, float(state.settings.get("auto_delay", 3.0)))
    try:
        for item in state.validation_primaries:
            patch_info = {
                "point_id": f"VAL_{item['id']}",
                "name": f"Primary: {item['name']}",
                "target_x": item["target_x"],
                "target_y": item["target_y"],
                "container": "p3",
                "rgb": item["rgb"],
                "is_clipped": False,
                "patch_size": state.settings["patch_size"],
                "background": state.settings["background"],
                "hdr_mode": state.settings["hdr_mode"],
                "is_black": False
            }
            state.active_patch = patch_info
            await manager.broadcast({"type": "PATCH_DISPLAY", "patch": patch_info})
            await asyncio.sleep(0.8)

            loop = asyncio.get_event_loop()
            meas = await loop.run_in_executor(None, lambda tx=item["target_x"], ty=item["target_y"]: meter.measure(tx, ty, is_black=False))

            item["measured_x"] = meas["x"]
            item["measured_y"] = meas["y"]
            item["measured_Y"] = meas["Y"]

            item["delta_xy"] = round(delta_xy(item["target_x"], item["target_y"], meas["x"], meas["y"]), 4)
            item["delta_uv"] = round(delta_uv_prime(item["target_x"], item["target_y"], meas["x"], meas["y"]), 4)

            if item["delta_xy"] <= 0.003:
                item["status"] = "EXCELLENT"
            elif item["delta_xy"] <= 0.006:
                item["status"] = "GOOD"
            else:
                item["status"] = "DEVIATION"

            await manager.broadcast({
                "type": "VALIDATION_UPDATED",
                "item": item,
                "primaries": state.validation_primaries,
                "summary": state.get_validation_summary()
            })

            remaining_wait = max(0.4, total_delay - 0.8 - 0.3)
            await asyncio.sleep(remaining_wait)

        state.active_patch = None
        summary = state.get_validation_summary()
        await manager.broadcast({"type": "STANDBY_MODE"})
        await manager.broadcast({
            "type": "VALIDATION_COMPLETED",
            "primaries": state.validation_primaries,
            "summary": summary
        })
        return {"status": "ok", "primaries": state.validation_primaries, "summary": summary}
    except Exception as e:
        state.active_patch = None
        await manager.broadcast({"type": "STANDBY_MODE"})
        await manager.broadcast({"type": "MEASURE_ERROR", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/patch/standby")
async def set_patch_standby():
    state.active_patch = None
    await manager.broadcast({"type": "STANDBY_MODE"})
    return {"status": "ok", "mode": "standby"}


@app.get("/api/export/csv")
def export_csv():
    output = StringIO()
    output.write("\ufeff")  # UTF-8 BOM for universal Excel compatibility
    writer = csv.writer(output)
    writer.writerow([
        "Point_ID", "Point_Name",
        "Target_x", "Target_y",
        "Measured_x", "Measured_y",
        "Delta_xy",
        "Measured_Luminance_Y_nits",
        "Offset_dx", "Offset_dy",
        "Adjusted_Target_x", "Adjusted_Target_y",
        "Delta_uv",
        "RGB_Value",
        "Target_Exceeds_P3", "Measured_Exceeds_P3", "Test_Verdict"
    ])
    for pt in state.points:
        verdict = pt.get("pass_status", "")
        if verdict == "EXCEEDED_P3" or verdict == "超色域达标":
            verdict_en = "EXCEEDED_P3"
        elif verdict == "INSIDE_P3" or verdict == "未超P3色域":
            verdict_en = "IN_P3_GAMUT"
        elif verdict == "PASS" or verdict == "合格":
            verdict_en = "PASS"
        elif verdict == "DELTA_EXCEEDED" or verdict == "超差":
            verdict_en = "DELTA_EXCEEDED"
        elif verdict == "未测量" or not verdict:
            verdict_en = "NOT_MEASURED"
        else:
            verdict_en = str(verdict)

        target_rgb = pt.get("target_rgb_255", pt.get("rgb_255"))
        rgb_str = f"({target_rgb[0]}, {target_rgb[1]}, {target_rgb[2]})" if target_rgb else ""
        adj_x = pt.get("effective_target_x", pt["target_x"] + pt["offset_x"])
        adj_y = pt.get("effective_target_y", pt["target_y"] + pt["offset_y"])

        writer.writerow([
            pt["id"],
            pt["name"],
            f"{pt['target_x']:.4f}",
            f"{pt['target_y']:.4f}",
            f"{pt['measured_x']:.4f}" if pt.get("measured_x") is not None else "",
            f"{pt['measured_y']:.4f}" if pt.get("measured_y") is not None else "",
            f"{pt['delta_xy']:.4f}" if pt.get("delta_xy") is not None else "",
            f"{pt['measured_Y']:.4f}" if pt.get("measured_Y") is not None else "",
            f"{pt['offset_x']:.4f}",
            f"{pt['offset_y']:.4f}",
            f"{adj_x:.4f}",
            f"{adj_y:.4f}",
            f"{pt['delta_uv']:.4f}" if pt.get("delta_uv") is not None else "",
            rgb_str,
            "YES" if pt.get("target_exceeds_p3") else "NO",
            "YES" if pt.get("measured_exceeds_p3") is True else ("NO" if pt.get("measured_exceeds_p3") is False else ""),
            verdict_en
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=dci_p3_gamut_test_results.csv"}
    )


# Serve Static Frontend Files
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    with open(os.path.join(STATIC_DIR, "index.html"), "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

@app.get("/patch")
def serve_patch():
    with open(os.path.join(STATIC_DIR, "patch.html"), "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="127.0.0.1", port=8000, reload=True)
