#!/usr/bin/env python3
"""
CLI Tool for Wide Gamut Target Testing & Offset Analysis System.
Runs 15-point target coordinate calibration & analysis directly from terminal.
"""

import sys
import time
import argparse
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from backend.color_engine import DEFAULT_15_POINTS, calculate_point_result, COLOR_SPACES
from backend.meter_driver import MeterDriver

console = Console()

def run_cli_test(delay: float = 3.0, offset_x: float = 0.0, offset_y: float = 0.0):
    console.print(Panel.fit(
        "[bold cyan]Wide Gamut Target Testing & Offset Analysis System[/bold cyan]\n"
        "[dim]Display Plus HL (ArgyllCMS spotread) / CIE 1931 xyY / DCI-P3 Boundary Analysis[/dim]",
        border_style="cyan"
    ))

    meter = MeterDriver()

    # 1. Probe & Environment Check
    inst = meter.detect_instruments()
    if inst["has_hardware"]:
        name = next((i["name"] for i in inst["instruments"] if i["is_colorimeter"]), "Display Plus HL")
        console.print(f"[green]● Probe:[/] [bold green]Connected: {name}[/bold green]")
    else:
        console.print("[red]● Error:[/] No physical colorimeter probe detected. Please connect USB probe.")
        sys.exit(1)

    # 2. Step 1: Pre-test Black Level Calibration
    console.print("\n[bold]Step 1/2: Measuring Black Baseline & Light Leakage...[/bold]")
    black_res = meter.measure(0.3127, 0.3290, is_black=True)
    b_y = black_res["Y"]
    leak_txt = "[red]Warning: Potential Light Leakage (>0.3 nits)[/red]" if b_y > 0.3 else "[green]OK (No significant leakage)[/green]"
    console.print(f"  └─ Black Luminance: [bold]{b_y:.4f} cd/m²[/bold] | Status: {leak_txt}\n")

    # 3. Step 2: Test 15 Key Coordinates
    console.print(f"[bold]Step 2/2: Measuring 15 Target Coordinates (Interval: {delay:.1f}s)...[/bold]")
    results = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console
    ) as progress:
        task = progress.add_task("[cyan]Measuring...", total=len(DEFAULT_15_POINTS))
        
        for pt in DEFAULT_15_POINTS:
            progress.update(task, description=f"[cyan]Measuring {pt['name']} ({pt['target_x']:.4f}, {pt['target_y']:.4f})...")
            meas = meter.measure(pt["target_x"], pt["target_y"], is_black=False)
            
            calc = calculate_point_result(
                target_x=pt["target_x"],
                target_y=pt["target_y"],
                measured_x=meas["x"],
                measured_y=meas["y"],
                offset_x=offset_x,
                offset_y=offset_y,
                measured_Y=meas["Y"]
            )
            calc["id"] = pt["id"]
            calc["name"] = pt["name"]
            results.append(calc)
            
            time.sleep(delay)
            progress.advance(task)

    # 4. Render Results Table
    table = Table(title="Target Coordinates Measurement & Color Difference Report", border_style="blue", show_header=True, header_style="bold cyan")
    table.add_column("Point", style="dim", width=6)
    table.add_column("Target (x, y)", justify="center", width=18)
    table.add_column("Measured (x, y)", justify="center", width=18)
    table.add_column("Luminance (Y)", justify="center", width=14)
    table.add_column("Offset (dx, dy)", justify="center", width=16)
    table.add_column("Delta xy", justify="right", width=10)
    table.add_column("Delta u'v'", justify="right", width=11)
    table.add_column("Verdict", justify="center", width=14)

    exceeded_count = 0
    for r in results:
        is_exceeded = r["pass_status"] == "EXCEEDED_P3"
        if is_exceeded:
            exceeded_count += 1
            status_badge = "[bold green]EXCEEDED_P3[/bold green]"
        elif r["pass_status"] == "INSIDE_P3":
            status_badge = "[red]INSIDE_P3[/red]"
        elif r["pass_status"] == "PASS":
            status_badge = "[cyan]PASS[/cyan]"
        else:
            status_badge = "[yellow]DEVIATION[/yellow]"

        table.add_row(
            f"P{r['id']}",
            f"({r['target_x']:.4f}, {r['target_y']:.4f})",
            f"({r['measured_x']:.4f}, {r['measured_y']:.4f})",
            f"{r.get('measured_Y', 0.0):.1f} nits",
            f"({r['offset_x']:+.4f}, {r['offset_y']:+.4f})",
            f"{r['delta_xy']:.4f}",
            f"{r['delta_uv']:.4f}",
            status_badge
        )

    console.print(table)

    # 5. Summary Statistics
    avg_dxy = sum(r["delta_xy"] for r in results) / len(results)
    avg_duv = sum(r["delta_uv"] for r in results) / len(results)
    console.print(Panel(
        f"Measurement Summary:\n"
        f"• Exceeded DCI-P3 Gamut Points: [bold green]{exceeded_count} / {len(results)}[/bold green] ({(exceeded_count/len(results))*100:.1f}%)\n"
        f"• Global Average Delta xy: [bold cyan]{avg_dxy:.4f}[/bold cyan]\n"
        f"• Global Average Delta u'v': [bold cyan]{avg_duv:.4f}[/bold cyan]\n"
        f"• Black Baseline: {b_y:.4f} cd/m²\n"
        f"[dim]Tip: Run start.sh (or start.bat on Windows) to launch the dual-window web console.[/dim]",
        title="[bold green]Gamut Test Results[/bold green]",
        border_style="green"
    ))

def main():
    parser = argparse.ArgumentParser(description="Wide Gamut Target Testing & Offset Analysis CLI")
    parser.add_argument("--delay", type=float, default=3.0, help="Interval delay between points in seconds (default: 3.0s)")
    parser.add_argument("--offset-x", type=float, default=0.0, help="Global X-axis offset compensation (e.g. 0.002)")
    parser.add_argument("--offset-y", type=float, default=0.0, help="Global Y-axis offset compensation (e.g. -0.001)")
    args = parser.parse_args()

    run_cli_test(delay=args.delay, offset_x=args.offset_x, offset_y=args.offset_y)

if __name__ == "__main__":
    main()
