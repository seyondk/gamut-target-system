"""
Color science calculation engine for CIE 1931 xyY, XYZ, RGB (BT.2020, DCI-P3, sRGB, Native),
CIE 1976 UCS (u', v'), Delta E / Delta u'v', and Gamut Boundary analysis.
"""

import math
from typing import Dict, List, Tuple, Optional, Any

# Standard CIE Illuminants
D65_XY = (0.3127, 0.3290)

# Primaries: (xr, yr), (xg, yg), (xb, yb), (xw, yw)
COLOR_SPACES = {
    "bt2020": {
        "name": "BT.2020 / Rec.2020",
        "red": (0.708, 0.292),
        "green": (0.170, 0.797),
        "blue": (0.131, 0.046),
        "white": D65_XY,
        "gamma": 2.4,
    },
    "p3": {
        "name": "DCI-P3 (D65)",
        "red": (0.680, 0.320),
        "green": (0.265, 0.690),
        "blue": (0.150, 0.060),
        "white": D65_XY,
        "gamma": 2.2,
    },
    "srgb": {
        "name": "sRGB / Rec.709",
        "red": (0.640, 0.330),
        "green": (0.300, 0.600),
        "blue": (0.150, 0.060),
        "white": D65_XY,
        "gamma": 2.2,
    },
    "native": {
        "name": "Native 原生直通 (极限物理色域)",
        "red": (0.708, 0.292),
        "green": (0.170, 0.797),
        "blue": (0.131, 0.046),
        "white": D65_XY,
        "gamma": 2.2,
    }
}

# 15 Key Target Coordinates from User (Corrected P11)
DEFAULT_15_POINTS = [
    {"id": 1, "target_x": 0.6940, "target_y": 0.3060, "name": "P1"},
    {"id": 2, "target_x": 0.5987, "target_y": 0.3935, "name": "P2"},
    {"id": 3, "target_x": 0.5034, "target_y": 0.4810, "name": "P3"},
    {"id": 4, "target_x": 0.4081, "target_y": 0.5685, "name": "P4"},
    {"id": 5, "target_x": 0.3128, "target_y": 0.6560, "name": "P5"},
    {"id": 6, "target_x": 0.2175, "target_y": 0.7435, "name": "P6"},
    {"id": 7, "target_x": 0.5833, "target_y": 0.2554, "name": "P7"},
    {"id": 8, "target_x": 0.4726, "target_y": 0.2048, "name": "P8"},
    {"id": 9, "target_x": 0.3619, "target_y": 0.1542, "name": "P9"},
    {"id": 10, "target_x": 0.2512, "target_y": 0.1036, "name": "P10"},
    {"id": 11, "target_x": 0.1405, "target_y": 0.0530, "name": "P11"},
    {"id": 12, "target_x": 0.2021, "target_y": 0.6054, "name": "P12"},
    {"id": 13, "target_x": 0.1867, "target_y": 0.4673, "name": "P13"},
    {"id": 14, "target_x": 0.1713, "target_y": 0.3292, "name": "P14"},
    {"id": 15, "target_x": 0.1559, "target_y": 0.1911, "name": "P15"},
]

# CIE 1931 Spectral Locus (Wavelength 380nm to 700nm at 5nm intervals)
SPECTRAL_LOCUS_380_700 = [
    (0.1741, 0.0050), (0.1740, 0.0050), (0.1738, 0.0049), (0.1736, 0.0049), (0.1733, 0.0048),
    (0.1730, 0.0048), (0.1726, 0.0048), (0.1721, 0.0048), (0.1714, 0.0051), (0.1703, 0.0058),
    (0.1689, 0.0069), (0.1669, 0.0086), (0.1644, 0.0109), (0.1611, 0.0138), (0.1566, 0.0177),
    (0.1510, 0.0227), (0.1440, 0.0297), (0.1355, 0.0399), (0.1241, 0.0578), (0.1096, 0.0868),
    (0.0913, 0.1327), (0.0687, 0.2007), (0.0454, 0.2950), (0.0235, 0.4127), (0.0082, 0.5384),
    (0.0039, 0.6548), (0.0139, 0.7502), (0.0389, 0.8120), (0.0743, 0.8338), (0.1142, 0.8262),
    (0.1547, 0.8059), (0.1929, 0.7816), (0.2296, 0.7543), (0.2658, 0.7243), (0.3016, 0.6923),
    (0.3373, 0.6589), (0.3731, 0.6245), (0.4087, 0.5896), (0.4441, 0.5547), (0.4790, 0.5202),
    (0.5125, 0.4866), (0.5448, 0.4544), (0.5752, 0.4242), (0.6029, 0.3965), (0.6270, 0.3725),
    (0.6482, 0.3514), (0.6658, 0.3340), (0.6801, 0.3197), (0.6915, 0.3083), (0.7006, 0.2993),
    (0.7079, 0.2920), (0.7140, 0.2859), (0.7190, 0.2809), (0.7230, 0.2770), (0.7260, 0.2740),
    (0.7283, 0.2717), (0.7300, 0.2700), (0.7311, 0.2689), (0.7320, 0.2680), (0.7327, 0.2673),
    (0.7334, 0.2666), (0.7340, 0.2660), (0.7344, 0.2656), (0.7346, 0.2654), (0.7347, 0.2653)
]


def invert_3x3(m: List[List[float]]) -> List[List[float]]:
    """Inverts a 3x3 matrix."""
    det = (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    )
    if abs(det) < 1e-12:
        raise ValueError("Matrix is singular")
    invdet = 1.0 / det
    return [
        [
            (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invdet,
            (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invdet,
            (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invdet,
        ],
        [
            (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invdet,
            (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invdet,
            (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invdet,
        ],
        [
            (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invdet,
            (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invdet,
            (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invdet,
        ],
    ]


def mat_vec_mul(m: List[List[float]], v: List[float]) -> List[float]:
    """Multiplies 3x3 matrix by 3-vector."""
    return [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ]


def compute_rgb_to_xyz_matrix(
    red_xy: Tuple[float, float],
    green_xy: Tuple[float, float],
    blue_xy: Tuple[float, float],
    white_xy: Tuple[float, float],
) -> Tuple[List[List[float]], List[List[float]]]:
    """Computes M (RGB -> XYZ) and M_inv (XYZ -> RGB) matrices."""
    xr, yr = red_xy
    xg, yg = green_xy
    xb, yb = blue_xy
    xw, yw = white_xy

    zr = 1.0 - xr - yr
    zg = 1.0 - xg - yg
    zb = 1.0 - xb - yb
    zw = 1.0 - xw - yw

    base = [
        [xr / yr, xg / yg, xb / yb],
        [1.0, 1.0, 1.0],
        [zr / yr, zg / yg, zb / yb],
    ]
    base_inv = invert_3x3(base)
    white_xyz = [xw / yw, 1.0, zw / yw]
    s = mat_vec_mul(base_inv, white_xyz)

    m = [
        [base[0][0] * s[0], base[0][1] * s[1], base[0][2] * s[2]],
        [base[1][0] * s[0], base[1][1] * s[1], base[1][2] * s[2]],
        [base[2][0] * s[0], base[2][1] * s[1], base[2][2] * s[2]],
    ]
    m_inv = invert_3x3(m)
    return m, m_inv


# Precompute standard matrices
MATRICES = {}
for space_key in ["bt2020", "p3", "srgb"]:
    space_data = COLOR_SPACES[space_key]
    m, m_inv = compute_rgb_to_xyz_matrix(
        space_data["red"],
        space_data["green"],
        space_data["blue"],
        space_data["white"],
    )
    MATRICES[space_key] = {"M": m, "M_inv": m_inv}

MATRICES["native"] = MATRICES["bt2020"]


def xyY_to_XYZ(x: float, y: float, Y: float = 1.0) -> Tuple[float, float, float]:
    """Converts CIE 1931 xyY to XYZ."""
    if y <= 1e-9:
        return (0.0, 0.0, 0.0)
    X = (x / y) * Y
    Z = ((1.0 - x - y) / y) * Y
    return (X, Y, Z)


def XYZ_to_xyY(X: float, Y: float, Z: float) -> Tuple[float, float, float]:
    """Converts XYZ to CIE 1931 xyY."""
    total = X + Y + Z
    if total <= 1e-9:
        return (0.0, 0.0, 0.0)
    return (X / total, Y / total, Y)


def xy_to_uv_prime(x: float, y: float) -> Tuple[float, float]:
    """Converts CIE 1931 (x, y) to CIE 1976 UCS (u', v')."""
    denom = -2.0 * x + 12.0 * y + 3.0
    if abs(denom) < 1e-9:
        return (0.0, 0.0)
    u_prime = (4.0 * x) / denom
    v_prime = (9.0 * y) / denom
    return (u_prime, v_prime)


def delta_xy(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculates Euclidean distance in CIE 1931 xy chromaticity space."""
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def delta_uv_prime(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculates Euclidean distance in perceptually uniform CIE 1976 UCS (u', v') space."""
    u1, v1 = xy_to_uv_prime(x1, y1)
    u2, v2 = xy_to_uv_prime(x2, y2)
    return math.sqrt((u1 - u2) ** 2 + (v1 - v2) ** 2)


def is_point_in_triangle(
    pt: Tuple[float, float],
    v1: Tuple[float, float],
    v2: Tuple[float, float],
    v3: Tuple[float, float],
) -> bool:
    """Checks if a 2D point (x, y) lies inside a triangle with vertices v1, v2, v3."""
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

    d1 = sign(pt, v1, v2)
    d2 = sign(pt, v2, v3)
    d3 = sign(pt, v3, v1)

    has_neg = (d1 < -1e-7) or (d2 < -1e-7) or (d3 < -1e-7)
    has_pos = (d1 > 1e-7) or (d2 > 1e-7) or (d3 > 1e-7)

    return not (has_neg and has_pos)


def xy_to_container_rgb(
    x: float,
    y: float,
    container_space: str = "bt2020",
    amplitude: float = 1.0,
) -> Tuple[float, float, float, bool]:
    """Converts target (x, y) to displayable RGB in specified container."""
    if container_space not in MATRICES:
        container_space = "bt2020"

    xyz = xyY_to_XYZ(x, y, 1.0)
    m_inv = MATRICES[container_space]["M_inv"]
    lin_rgb = mat_vec_mul(m_inv, list(xyz))

    if container_space == "native":
        # Native mode does not alarm on clipping
        max_c = max(lin_rgb)
        scaled_rgb = [(max(0.0, c) / max_c) * amplitude for c in lin_rgb] if max_c > 1e-9 else [0.0, 0.0, 0.0]
        gamma = 2.2
        enc_r = max(0.0, min(1.0, scaled_rgb[0] ** (1.0 / gamma)))
        enc_g = max(0.0, min(1.0, scaled_rgb[1] ** (1.0 / gamma)))
        enc_b = max(0.0, min(1.0, scaled_rgb[2] ** (1.0 / gamma)))
        return (enc_r, enc_g, enc_b, False)

    is_clipped = any(c < -1e-4 for c in lin_rgb)

    max_c = max(lin_rgb)
    scaled_rgb = [(max(0.0, c) / max_c) * amplitude for c in lin_rgb] if max_c > 1e-9 else [0.0, 0.0, 0.0]

    gamma = COLOR_SPACES[container_space]["gamma"]
    enc_r = max(0.0, min(1.0, scaled_rgb[0] ** (1.0 / gamma)))
    enc_g = max(0.0, min(1.0, scaled_rgb[1] ** (1.0 / gamma)))
    enc_b = max(0.0, min(1.0, scaled_rgb[2] ** (1.0 / gamma)))

    return (enc_r, enc_g, enc_b, is_clipped)


def calculate_point_result(
    target_x: float,
    target_y: float,
    measured_x: Optional[float] = None,
    measured_y: Optional[float] = None,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    measured_Y: Optional[float] = None,
    black_XYZ: Optional[Tuple[float, float, float]] = None,
    apply_flare_comp: bool = False,
) -> Dict[str, Any]:
    """Computes all analysis metrics for a test coordinate."""
    target_in_p3 = is_point_in_triangle(
        (target_x, target_y),
        COLOR_SPACES["p3"]["red"],
        COLOR_SPACES["p3"]["green"],
        COLOR_SPACES["p3"]["blue"],
    )
    target_exceeds_p3 = not target_in_p3

    if measured_x is None or measured_y is None:
        return {
            "has_measured": False,
            "target_x": target_x,
            "target_y": target_y,
            "target_exceeds_p3": target_exceeds_p3,
            "offset_x": offset_x,
            "offset_y": offset_y,
            "final_x": None,
            "final_y": None,
            "measured_Y": None,
            "delta_xy": None,
            "delta_uv": None,
            "measured_exceeds_p3": None,
            "pass_status": "PENDING",
        }

    raw_x = measured_x
    raw_y = measured_y
    raw_Y = measured_Y if measured_Y is not None else 100.0

    if apply_flare_comp and black_XYZ is not None and raw_Y > 0:
        raw_XYZ = xyY_to_XYZ(raw_x, raw_y, raw_Y)
        net_X = max(0.001, raw_XYZ[0] - black_XYZ[0])
        net_Y = max(0.001, raw_XYZ[1] - black_XYZ[1])
        net_Z = max(0.001, raw_XYZ[2] - black_XYZ[2])
        comp_xyY = XYZ_to_xyY(net_X, net_Y, net_Z)
        calc_x, calc_y = comp_xyY[0], comp_xyY[1]
    else:
        calc_x, calc_y = raw_x, raw_y

    final_x = round(calc_x, 4)
    final_y = round(calc_y, 4)
    effective_target_x = round(target_x + offset_x, 4)
    effective_target_y = round(target_y + offset_y, 4)

    d_xy = round(delta_xy(target_x, target_y, final_x, final_y), 4)
    d_uv = round(delta_uv_prime(target_x, target_y, final_x, final_y), 4)

    meas_in_p3 = is_point_in_triangle(
        (final_x, final_y),
        COLOR_SPACES["p3"]["red"],
        COLOR_SPACES["p3"]["green"],
        COLOR_SPACES["p3"]["blue"],
    )
    measured_exceeds_p3 = not meas_in_p3

    if target_exceeds_p3:
        pass_status = "EXCEEDED_P3" if measured_exceeds_p3 else "INSIDE_P3"
    else:
        pass_status = "PASS" if d_uv <= 0.010 else "WARN"

    return {
        "has_measured": True,
        "target_x": target_x,
        "target_y": target_y,
        "effective_target_x": effective_target_x,
        "effective_target_y": effective_target_y,
        "target_exceeds_p3": target_exceeds_p3,
        "measured_x": raw_x,
        "measured_y": raw_y,
        "offset_x": offset_x,
        "offset_y": offset_y,
        "final_x": final_x,
        "final_y": final_y,
        "measured_Y": raw_Y,
        "delta_xy": d_xy,
        "delta_uv": d_uv,
        "measured_exceeds_p3": measured_exceeds_p3,
        "pass_status": pass_status,
    }
