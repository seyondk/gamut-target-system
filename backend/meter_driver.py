"""
Hardware driver for X-Rite / Calibrite Display Plus HL via ArgyllCMS 'spotread' CLI.
Strictly hardware-only: ALL SIMULATION HAS BEEN REMOVED.
Supports cross-platform execution on macOS, Windows, and Linux.
"""

import os
import re
import glob
import time
import shutil
import logging
import subprocess
from typing import Dict, Any, Optional, List, Tuple

if os.name != "nt":
    import pty
    import select
else:
    import threading
    import queue

logger = logging.getLogger("meter_driver")
logging.basicConfig(level=logging.INFO)

# Search paths across macOS, Windows, and Linux
DEFAULT_SPOTREAD_SEARCH_PATHS = [
    # macOS paths
    "/Users/dk/Library/Application Support/DisplayCAL/dl/Argyll_V3.5.0/bin/spotread",
    "/Applications/DisplayCAL/DisplayCAL.app/Contents/MacOS/spotread",
    "/opt/homebrew/bin/spotread",
    "/usr/local/bin/spotread",
    "/usr/bin/spotread",
    # Windows paths
    r"C:\ArgyllCMS\bin\spotread.exe",
    r"C:\Program Files\ArgyllCMS\bin\spotread.exe",
    r"C:\Program Files (x86)\ArgyllCMS\bin\spotread.exe",
    r"C:\Program Files (x86)\DisplayCAL\dl\Argyll_V3.5.0\bin\spotread.exe",
]

def _get_ccss_dir() -> str:
    """Returns platform-specific DisplayCAL CCSS directory."""
    if os.name == "nt":
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            p = os.path.join(appdata, "DisplayCAL", "dl", "i1d3")
            if os.path.isdir(p):
                return p
        return r"C:\DisplayCAL\dl\i1d3"
    else:
        mac_path = "/Users/dk/Library/Application Support/DisplayCAL/dl/i1d3"
        if os.path.isdir(mac_path):
            return mac_path
        expanded = os.path.expanduser("~/Library/Application Support/DisplayCAL/dl/i1d3")
        return expanded

CCSS_DIR = _get_ccss_dir()


class MeterDriver:
    def __init__(self, spotread_path: Optional[str] = None):
        self.spotread_path = spotread_path or self._find_spotread()
        self.black_baseline: Optional[Dict[str, float]] = None
        self.selected_ccss: Optional[str] = None
        self.selected_port: Optional[int] = None
        self._cached_instruments: Optional[Dict[str, Any]] = None
        
        if not self.spotread_path:
            logger.error("ArgyllCMS 'spotread' executable was not found on this system!")
        else:
            logger.info(f"Found spotread: {self.spotread_path}")
            
        instruments = self.detect_instruments(force_refresh=True)
        if not instruments["has_hardware"]:
            logger.warning("No physical colorimeter probe detected. Please ensure USB probe is plugged in.")
        else:
            logger.info(f"Hardware colorimeter connected: {instruments['instruments']}")

    def _find_spotread(self) -> Optional[str]:
        """Locates the spotread binary on macOS, Windows, or Linux."""
        for path in DEFAULT_SPOTREAD_SEARCH_PATHS:
            if os.path.isfile(path) and os.access(path, os.X_OK):
                return path
        
        bin_name = "spotread.exe" if os.name == "nt" else "spotread"
        which_path = shutil.which(bin_name) or shutil.which("spotread")
        if which_path:
            return which_path
            
        # Recursive search in DisplayCAL directories
        if os.name == "nt":
            appdata = os.environ.get("APPDATA", "")
            if appdata:
                pattern = os.path.join(appdata, "DisplayCAL", "dl", "**", "spotread.exe")
                matches = glob.glob(pattern, recursive=True)
                if matches:
                    return matches[0]
        else:
            pattern = os.path.expanduser("~/Library/Application Support/DisplayCAL/dl/**/spotread")
            matches = glob.glob(pattern, recursive=True)
            if matches:
                return matches[0]
                
        return None

    def detect_instruments(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Detects connected colorimeters via spotread, caching results to avoid USB bus collisions."""
        if not force_refresh and self._cached_instruments is not None:
            return self._cached_instruments

        if not self.spotread_path:
            res = {
                "spotread_found": False,
                "has_hardware": False,
                "instruments": [],
                "error": "spotread executable not found"
            }
            self._cached_instruments = res
            return res

        try:
            proc = subprocess.run(
                [self.spotread_path, "-c", "999"],
                capture_output=True,
                text=True,
                timeout=4
            )
            output = proc.stdout + proc.stderr
            instruments = []
            
            in_list = False
            for line in output.splitlines():
                if "following list" in line:
                    in_list = True
                    continue
                if in_list:
                    match = re.match(r"^\s*(\d+)\s*=\s*'([^']+)'", line)
                    if match:
                        idx = int(match.group(1))
                        name = match.group(2)
                        is_colorimeter = any(k in name.lower() for k in ["i1", "display", "x-rite", "calibrite", "munki", "spyder"])
                        instruments.append({
                            "index": idx,
                            "name": name,
                            "is_colorimeter": is_colorimeter
                        })
                    else:
                        if line.strip().startswith("-"):
                            break
            
            has_hw = any(i["is_colorimeter"] for i in instruments)
            res = {
                "spotread_found": True,
                "spotread_path": self.spotread_path,
                "has_hardware": has_hw,
                "instruments": instruments
            }
            self._cached_instruments = res
            return res
        except Exception as e:
            logger.error(f"Failed to detect instruments: {e}")
            res = {
                "spotread_found": True,
                "spotread_path": self.spotread_path,
                "has_hardware": False,
                "instruments": [],
                "error": str(e)
            }
            self._cached_instruments = res
            return res

    def get_available_ccss_files(self) -> List[Dict[str, str]]:
        """Returns list of available CCSS display correction profiles."""
        res = []
        if os.path.isdir(CCSS_DIR):
            for fname in sorted(os.listdir(CCSS_DIR)):
                if fname.endswith(".ccss"):
                    res.append({
                        "name": fname.replace(".ccss", ""),
                        "path": os.path.join(CCSS_DIR, fname)
                    })
        return res

    def measure(
        self,
        target_x: float,
        target_y: float,
        is_black: bool = False,
    ) -> Dict[str, Any]:
        """
        Takes a STRICTLY PHYSICAL colorimeter optical measurement.
        Raises RuntimeError if the probe fails or is not connected.
        NO SIMULATION OR MOCK DATA IS PERMITTED.
        """
        if not self.spotread_path:
            raise RuntimeError("ArgyllCMS spotread binary not found. Real hardware required.")

        result = self._measure_hardware(is_black=is_black)
        if not result:
            raise RuntimeError("Colorimeter returned no reading. Please check probe placement and USB connection.")

        return result

    def _measure_hardware(self, is_black: bool = False) -> Dict[str, Any]:
        """
        Cross-platform optical reading capture.
        Uses PTY on POSIX (macOS/Linux) and unbuffered subprocess pipe reader on Windows.
        """
        cmd = [self.spotread_path, "-v", "-e", "-x", "-Q", "1931_2", "-y", "n"]
        if self.selected_ccss and os.path.isfile(self.selected_ccss):
            cmd.extend(["-X", self.selected_ccss])
        
        # Default to port 1 (the USB colorimeter)
        port = self.selected_port if self.selected_port else 1
        cmd.extend(["-c", str(port)])

        logger.info(f"Triggering probe sampling: {' '.join(cmd)}")
        
        if os.name == "nt":
            return self._measure_hardware_windows(cmd, is_black=is_black)
        else:
            return self._measure_hardware_posix(cmd, is_black=is_black)

    def _measure_hardware_posix(self, cmd: List[str], is_black: bool = False) -> Dict[str, Any]:
        """POSIX PTY-based interactive communication with spotread."""
        master, slave = pty.openpty()
        proc = subprocess.Popen(
            cmd,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            close_fds=True
        )
        os.close(slave)

        output_accum = b""
        start_time = time.time()
        triggered = False
        result = None

        timeout = 30.0 if is_black else 20.0
        try:
            while time.time() - start_time < timeout:
                r, _, _ = select.select([master], [], [], 0.1)
                if master in r:
                    try:
                        chunk = os.read(master, 1024)
                        if not chunk:
                            break
                        output_accum += chunk
                        text = output_accum.decode("utf-8", errors="ignore")

                        if "any other key to take a reading" in text and not triggered:
                            os.write(master, b" \n")
                            triggered = True

                        match = re.search(
                            r"Result is XYZ:\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+),\s*Yxy:\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)",
                            text
                        )
                        if match:
                            X, Y_xyz, Z = float(match.group(1)), float(match.group(2)), float(match.group(3))
                            Y, x, y = float(match.group(4)), float(match.group(5)), float(match.group(6))
                            
                            result = {
                                "simulated": False,
                                "x": round(x, 4),
                                "y": round(y, 4),
                                "Y": round(Y, 4),
                                "XYZ": (round(X, 4), round(Y_xyz, 4), round(Z, 4)),
                                "timestamp": time.time(),
                                "is_black": is_black,
                                "leakage_warning": is_black and (Y > 0.3)
                            }
                            os.write(master, b"q\n")
                            break
                    except Exception as err:
                        logger.error(f"PTY read error: {err}")
                        break
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=1.0)
            except Exception:
                proc.kill()
            try:
                os.close(master)
            except Exception:
                pass

        if not result:
            err_text = output_accum.decode("utf-8", errors="ignore")
            logger.error(f"Probe measurement produced no result. Log:\n{err_text}")
            if "Opening HID device" in err_text and "failed" in err_text:
                raise RuntimeError("Failed to open USB HID device! Another calibration software might be occupying the probe.")
            raise RuntimeError(f"Measurement timed out or probe did not respond: {err_text[-200:] if err_text else 'no data'}")

        return result

    def _measure_hardware_windows(self, cmd: List[str], is_black: bool = False) -> Dict[str, Any]:
        """Windows threaded-pipe interactive communication with spotread."""
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0
        )

        q: queue.Queue = queue.Queue()
        def reader_worker():
            try:
                while True:
                    chunk = proc.stdout.read(1024)
                    if not chunk:
                        break
                    q.put(chunk)
            except Exception:
                pass

        t = threading.Thread(target=reader_worker, daemon=True)
        t.start()

        output_accum = b""
        start_time = time.time()
        triggered = False
        result = None

        timeout = 30.0 if is_black else 20.0
        try:
            while time.time() - start_time < timeout:
                try:
                    chunk = q.get(timeout=0.1)
                    output_accum += chunk
                    text = output_accum.decode("utf-8", errors="ignore")

                    if "any other key to take a reading" in text and not triggered:
                        proc.stdin.write(b" \n")
                        proc.stdin.flush()
                        triggered = True

                    match = re.search(
                        r"Result is XYZ:\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+),\s*Yxy:\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)",
                        text
                    )
                    if match:
                        X, Y_xyz, Z = float(match.group(1)), float(match.group(2)), float(match.group(3))
                        Y, x, y = float(match.group(4)), float(match.group(5)), float(match.group(6))
                        
                        result = {
                            "simulated": False,
                            "x": round(x, 4),
                            "y": round(y, 4),
                            "Y": round(Y, 4),
                            "XYZ": (round(X, 4), round(Y_xyz, 4), round(Z, 4)),
                            "timestamp": time.time(),
                            "is_black": is_black,
                            "leakage_warning": is_black and (Y > 0.3)
                        }
                        try:
                            proc.stdin.write(b"q\n")
                            proc.stdin.flush()
                        except Exception:
                            pass
                        break
                except queue.Empty:
                    if proc.poll() is not None:
                        break
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=1.0)
            except Exception:
                proc.kill()

        if not result:
            err_text = output_accum.decode("utf-8", errors="ignore")
            logger.error(f"Probe measurement produced no result. Log:\n{err_text}")
            if "Opening HID device" in err_text and "failed" in err_text:
                raise RuntimeError("Failed to open USB HID device! Another calibration software might be occupying the probe.")
            raise RuntimeError(f"Measurement timed out or probe did not respond: {err_text[-200:] if err_text else 'no data'}")

        return result
