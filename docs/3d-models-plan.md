# 3D models plan

Status (16 Nov 2026): models built in Blender 5.2 and wired into the Echo pages. Not yet tried on a phone.

| Model | Triangles | File |
|---|---|---|
| sensor | 290 | 15.1 KB |
| car | 228 | 12.2 KB |
| buzzer | 116 | 5.9 KB |

Done: build order steps 1, 3 and 4; `ar.html` loads the sensor and car; `2d.html` draws the top-down pictures. Picture: `docs/models-preview.png`. Laptop check without a camera: `models/view.html`.

Not done: step 2 and 5 (real card, Redmi frame rate); the buzzer is built but not in `ar.html` (the Echo step has no buzzer); the pulse still starts at the card edge, not at `tx`; renderer settings are unchanged.

Notes from the build:
- Blender exports the emission material as a lit one, which three.js would draw white. `build_models.py` rewrites the material inside each `.glb` to `KHR_materials_unlit` after export.
- Faces lying on the card are removed; normals and UVs are not exported.
- `ar.html?models=0` hides the models, for the with/without frame rate comparison.

## Goal

Three small models that sit on the cards in `ar.html`, and top-down pictures of the same models for `2d.html`. They must cost almost nothing on a Xiaomi Redmi Note: the camera and marker tracking already use most of the phone.

Everything that teaches (pulse, cone, threshold line, controller box, data dots) stays as shapes drawn in code. Models are only for the three real objects.

## Budget (hard limits)

| Item | Limit | Why |
|---|---|---|
| Triangles | sensor 600, car 1,200, buzzer 200 (2,000 total) | Keeps drawing cost far below the tracking cost |
| Draw calls | 1 per model (one joined mesh, one material) | Draw calls cost more than triangles on cheap phones |
| Textures | none | No image decode, no texture memory |
| Colour | vertex colours, with soft shading painted in | Looks lit without any lights in the scene |
| Material | one shared unlit material (`KHR_materials_unlit`) | Cheapest shader three.js has |
| File size | under 30 KB each, under 100 KB total | The page is already about 3 MB of libraries |
| Compression | none (no Draco, no Meshopt) | The decoder is bigger than the models |
| Height | at most 2.5 cm | Marker jitter is amplified at the top of tall models |
| Animation in file | none | Moved in code (buzzer shake) |

Fallback if the unlit export does not work from Blender: standard material, roughness 1, metallic 0, with one ambient and one directional light in the scene.

## The models

Modelled at real size in metres. The page scales them: `scale = 100 / CONFIG.MARKER_CM` (16.67 for the 6 cm marker), so the 8 cm cards work without re-exporting.

| File | Object | Size (cm) | Parts | Named points for code |
|---|---|---|---|---|
| `models/sensor.glb` | Ultrasonic sensor (HC-SR04 style) | 4.5 x 2.0 x 1.5 | blue board, two silver cylinders with dark mesh faces, crystal, four pins | `tx` (left eye), `rx` (right eye) |
| `models/car.glb` | Toy car | 6.0 x 3.0 x 2.5 | body, cabin, four wheels (8-sided) | `hit` (centre of the side) |
| `models/buzzer.glb` | Buzzer | 2.5 across x 1.5 | black cylinder, top hole, two pins | `cap` |

The named points are empty objects exported as nodes. The buzzer is drawn about twice its real size so it can be seen.

## Orientation

- Blender: Z up, the sensor's eyes face +Y. Exported with "+Y up", this becomes glTF -Z, which is the direction `ar.html` already calls forward.
- Origin at the centre of the base, resting on the card (z = 0).
- Car length runs along X.
- Apply all transforms before export.

## Files

```
models/
  sensor.glb  car.glb  buzzer.glb     used by ar.html
  top/sensor.png  car.png  buzzer.png  256 px, transparent, used by 2d.html
  src/build_models.py                  builds everything from code
  src/cards.blend                      saved result, for hand edits
```

The models are built by a script so they can be rebuilt and described exactly in the paper. Hand edits go in `cards.blend`; if the two disagree, say so in this file.

The top-down pictures come from the same models (orthographic camera, straight down), so AR and 2D show the same objects. This keeps "AR looked nicer" out of the comparison.

## Build order

1. `build_models.py`: sensor first, export, check triangle count and file size.
2. Load `sensor.glb` in `ar.html` inside the sensor marker; check size and facing on a real card.
3. Car and buzzer.
4. Top-down pictures; swap them into `2d.html`.
5. Measure on the Redmi with `tracking.html`: frame rate with and without models.

## Page changes

- `ar.html`: preload the three files in `<a-assets>`; one `<a-entity gltf-model>` per marker; add the buzzer marker (value 4).
- Measurement does not change. Distance stays the gap between card edges from `core.js`.
- The pulse may start at `tx` and end at `rx`; this is drawing only.
- Remove `logarithmicDepthBuffer: true` from the renderer (it is slow on phone GPUs and not needed at this scale). Add `antialias: false; precision: mediump` and cap the canvas size (`maxCanvasWidth: 1280; maxCanvasHeight: 1280`). Check each against the A-Frame 1.6 docs and measure before keeping it.

## Pass line

- Frame rate on the Redmi drops by less than 2 fps with all three models shown.
- Page weight grows by less than 100 KB.
- Models do not visibly wobble more than the pulse arcs do.

If any of these fail, drop the buzzer model first, then the car, and keep flat shapes.

## Open

- Car colour (blue is reserved for AR-drawn teaching content; suggest orange or red).
- Whether the buzzer card stays (still undecided: two cards or three).
- Whether the pulse should leave from one eye and return to the other, or stay centred.
