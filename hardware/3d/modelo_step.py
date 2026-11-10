#!/usr/bin/env python3
"""OmniHarp hardware: full assembly as a STEP file (opens in Onshape, Fusion, FreeCAD).

Reads hardware/painel/out/model.json (written by hardware/painel/gerar.cjs) and
builds every solid with OpenCascade (the `OCP` package, installed with
`pip install cadquery-ocp`): the wood frame and base, cleats and rail, the
panel with its real cut-outs, silicone pads, slider knobs, encoder, power
button, all boards, connectors and parts inside, the rear connectors, and every
cable along its route. Each solid keeps its name and colour.

Usage:  python3 hardware/3d/modelo_step.py
Output: hardware/3d/out/omniharp.step

CAD axes: X to the right, Y towards the back, Z up; millimetres. The origin is
the front-left corner of the panel opening, on the bench.
"""

import json
import math
import os
import sys

from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeEdge, BRepBuilderAPI_MakeFace, BRepBuilderAPI_MakeWire, BRepBuilderAPI_Transform
from OCP.BRepFilletAPI import BRepFilletAPI_MakeFillet2d
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder, BRepPrimAPI_MakePrism, BRepPrimAPI_MakeSphere
from OCP.Quantity import Quantity_Color, Quantity_TOC_RGB
from OCP.STEPCAFControl import STEPCAFControl_Writer
from OCP.STEPControl import STEPControl_AsIs
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_VERTEX
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS, TopoDS_Compound
from OCP.BRep import BRep_Builder
from OCP.XCAFDoc import XCAFDoc_ColorSurf, XCAFDoc_DocumentTool
from OCP.gp import gp_Ax2, gp_Ax3, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec

def static(cls, name):
    """OCP's static methods carry a `_s` suffix in older releases and none in newer ones."""
    return getattr(cls, name + '_s', None) or getattr(cls, name)


HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, '..', 'painel', 'out', 'model.json')))
OUT = os.path.join(HERE, 'out')

P, F = M['panel'], M['frame']
W, H, T = P['w'], P['h'], F['t']
TOP = F['h'] - P['recess']          # panel top surface
BASE = F['base']


def Y(y):
    """Panel y (0 = back edge) to CAD Y (0 = front edge, growing towards the back)."""
    return H - y


def box(x0, x1, y0, y1, z0, z1):
    """Box from panel-coordinate extents (y in panel coordinates)."""
    ya, yb = sorted((Y(y0), Y(y1)))
    return BRepPrimAPI_MakeBox(gp_Pnt(x0, ya, z0), x1 - x0, yb - ya, z1 - z0).Shape()


def cylinder(x, y, z, r, h, axis=(0, 0, 1)):
    return BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(x, Y(y), z), gp_Dir(*axis)), r, h).Shape()


def rounded_prism(cx, cy, w, d, r, z0, h):
    """Rounded rectangle (centre in panel coordinates) extruded upwards."""
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, Y(cy) - d / 2, Y(cy) + d / 2
    pts = [gp_Pnt(x0, y0, z0), gp_Pnt(x1, y0, z0), gp_Pnt(x1, y1, z0), gp_Pnt(x0, y1, z0)]
    wire = BRepBuilderAPI_MakeWire()
    for i in range(4):
        wire.Add(BRepBuilderAPI_MakeEdge(pts[i], pts[(i + 1) % 4]).Edge())
    face = BRepBuilderAPI_MakeFace(wire.Wire()).Face()
    if r > 0:
        fil = BRepFilletAPI_MakeFillet2d(face)
        exp = TopExp_Explorer(face, TopAbs_VERTEX)
        seen = set()
        while exp.More():
            v = static(TopoDS, 'Vertex')(exp.Current())
            key = v.__hash__()
            if key not in seen:
                seen.add(key)
                fil.AddFillet(v, r)
            exp.Next()
        fil.Build()
        face = fil.Shape()
    return BRepPrimAPI_MakePrism(face, gp_Vec(0, 0, h)).Shape()


def cut_all(shape, tools):
    """Cut every tool out of `shape` in one boolean (the tools go in as one compound)."""
    op = BRepAlgoAPI_Cut(shape, compound(tools))
    if not op.IsDone():
        raise RuntimeError('boolean cut failed')
    return op.Shape()


def compound(shapes):
    c, b = TopoDS_Compound(), BRep_Builder()
    b.MakeCompound(c)
    for s in shapes:
        b.Add(c, s)
    return c


def segment_box(a, b, width, thick):
    """Flat strip from a to b (CAD points), width lying horizontally (or along X when vertical)."""
    ax, ay, az = a
    dx, dy, dz = b[0] - ax, b[1] - ay, b[2] - az
    L = math.sqrt(dx * dx + dy * dy + dz * dz)
    if L < 0.01:
        return None
    d = (dx / L, dy / L, dz / L)
    if abs(d[2]) > 0.7:
        side = (1, 0, 0)
    else:
        side = (-d[1], d[0], 0)
        n = math.hypot(*side)
        side = (side[0] / n, side[1] / n, 0)
    # Local frame: X = side, Z = along the cable
    s = BRepPrimAPI_MakeBox(gp_Pnt(-width / 2, -thick / 2, 0), width, thick, L).Shape()
    tr = gp_Trsf()
    tr.SetTransformation(gp_Ax3(gp_Pnt(ax, ay, az), gp_Dir(*d), gp_Dir(*side)), gp_Ax3())
    return BRepBuilderAPI_Transform(s, tr, True).Shape()


def tube(points, r):
    """Round cable: a cylinder per straight run plus a ball at each bend."""
    shapes = []
    for a, b in zip(points, points[1:]):
        dx, dy, dz = (b[i] - a[i] for i in range(3))
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        if L < 0.01:
            continue
        shapes.append(BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(*a), gp_Dir(dx / L, dy / L, dz / L)), r, L).Shape())
    for p in points[1:-1]:
        shapes.append(BRepPrimAPI_MakeSphere(gp_Pnt(*p), r).Shape())
    return compound(shapes)


# ── Build every solid: (name, shape, colour) ──

items = []


def add(name, shape, color):
    items.append((name, shape, color))


WOOD, CLEAT, PLY = '#c39158', '#c8a06e', '#d8b98c'
PCB, ELEC, CONN, JACK = '#1f5d3a', '#5f9cc9', '#2b2b2b', '#b8b8b8'
PANEL, KNOB, METAL, RUBBER = '#141414', '#c9995e', '#8a8a8a', '#151515'

# Frame: back and front run the full width; the sides fit between them
add('Parede de trás', box(-T, W + T, -T, 0, 0, F['h']), WOOD)
add('Parede da frente', box(-T, W + T, H, H + T, 0, F['h']), WOOD)
add('Lateral esquerda', box(-T, 0, 0, H, 0, F['h']), WOOD)
add('Lateral direita', box(W, W + T, 0, H, 0, F['h']), WOOD)
add('Base de compensado', box(0, W, 0, H, 0, BASE), PLY)
for i, (x, y) in enumerate([(20, 20), (W - 20, 20), (20, H - 20), (W - 20, H - 20)]):
    add(f'Pé de borracha {i + 1}', cylinder(x, y, -4, 10, 4), RUBBER)

# Inside: every part, board and connector at its height above the base
for p in M['parts']:
    z0, z1 = BASE + p['z0'], BASE + p['z1']
    color = {'wood': CLEAT, 'board': PCB, 'conn': CONN, 'jack': JACK}.get(p['kind'], ELEC)
    add(p['label'], box(p['x'], p['x'] + p['w'], p['y'], p['y'] + p['d'], z0, z1), color)
    if p['kind'] == 'jack':
        # The part that shows through the back wall
        cx, cz = p['x'] + p['w'] / 2, (z0 + z1) / 2
        if p['name'] == 'USB-C':
            add(p['label'] + ' (frente)', box(cx - 6, cx + 6, -T - 3, -T, cz - 3.25, cz + 3.25), METAL)
        else:
            r = 9 if p['w'] >= 20 else 5.5
            add(p['label'] + ' (frente)', cylinder(cx, -T, cz, r, 3, (0, 1, 0)), METAL)

# Panel with its real cut-outs
panel = box(0, W, 0, H, TOP - P['t'], TOP)
tools = []
for c in M['cuts']:
    z0, h = TOP - P['t'] - 1, P['t'] + 2
    if c['type'] == 'circle':
        tools.append(cylinder(c['cx'], c['cy'], z0, c['r'], h))
    elif c['type'] == 'slot':
        r = c['w'] / 2
        tools.append(rounded_prism(c['cx'], (c['y1'] + c['y2']) / 2, c['w'], c['y2'] - c['y1'], r - 0.01, z0, h))
    else:
        tools.append(rounded_prism(c['x'] + c['w'] / 2, c['y'] + c['h'] / 2, c['w'], c['h'], min(c['r'], c['w'] / 2 - 0.01), z0, h))
print(f'panel: cutting {len(tools)} holes…', file=sys.stderr)
add('Painel (placa de circuito preta)', cut_all(panel, tools), PANEL)

# Silicone pads, slider knobs, encoder, power button
for k in M['keys']:
    color = '#9a9a9a' if k['color'] == '#3a3a3a' else k['color']
    add('Pad de silicone', rounded_prism(k['x'], k['y'], M['cap'], M['cap'], 2.2, TOP - P['t'] - 1, M['padH'] + P['t'] + 1), color)
cw, ch = M['sliderCap']
for s in M['sliders']:
    y = (s['y1'] + s['y2']) / 2
    add(f"Botão do slider {s['setting']}", rounded_prism(s['x'], y, cw, ch, 1.5, TOP + 3, 8), KNOB)
    add(f"Alavanca do slider {s['setting']}", box(s['x'] - 0.6, s['x'] + 0.6, y - 2, y + 2, TOP - P['t'], TOP + 3), RUBBER)
e = M['encoder']
add('Botão do encoder MENU', cylinder(e['x'], e['y'], TOP, e['r'], 16), KNOB)
pw = M['power']
add('Botão liga/desliga (capa)', cylinder(pw['x'], pw['y'], TOP, pw['d'] / 2, 3), METAL)

# Cables
for c in M['cables']:
    pts = [(x, Y(y), BASE + z) for x, y, z in c['path']]
    name = f"Cabo: {c['name']} ({c['length']} mm)"
    if c['kind'] == 'ribbon':
        segs = [segment_box(a, b, c['width'], 0.9) for a, b in zip(pts, pts[1:])]
        add(name, compound([s for s in segs if s is not None]), '#9a9a9a')
    else:
        color = '#151515' if c['kind'] == 'usb' else c['colors'][0]
        add(name, tube(pts, c['radius']), color)

# ── Write the STEP file with names and colours ──

doc = TDocStd_Document(TCollection_ExtendedString('XmlOcaf'))
shape_tool = static(XCAFDoc_DocumentTool, 'ShapeTool')(doc.Main())
color_tool = static(XCAFDoc_DocumentTool, 'ColorTool')(doc.Main())


def qcolor(hexcol):
    h = hexcol.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return Quantity_Color(r, g, b, Quantity_TOC_RGB)


for name, shape, color in items:
    label = shape_tool.AddShape(shape, False)
    static(TDataStd_Name, 'Set')(label, TCollection_ExtendedString(name))
    color_tool.SetColor(label, qcolor(color), XCAFDoc_ColorSurf)

os.makedirs(OUT, exist_ok=True)
writer = STEPCAFControl_Writer()
writer.SetNameMode(True)
writer.SetColorMode(True)
writer.Transfer(doc, STEPControl_AsIs)
path = os.path.join(OUT, 'omniharp.step')
writer.Write(path)
print(f'{len(items)} solids → {os.path.relpath(path)} ({os.path.getsize(path) // 1024} kB)')
