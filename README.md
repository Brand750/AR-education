# AR-education

AR Sensor Cards: students move printed cards under a phone camera to see how an ultrasonic sensor measures distance. This repository holds the prototype, a static page served by GitHub Pages.

Built so far: the tracking test page, the Echo step and the Blind spot step. Each step runs in two modes (real cards, or a finger on a flat screen).

## Pages

| Page | What it is |
|---|---|
| `index.html` | Researcher menu |
| `ar.html` | A step with cards (AR.js barcode markers, A-Frame) |
| `2d.html` | The same step with a finger, on a top view of the desk |
| `cards.html` | Printable card sheet, 6 cm and 8 cm markers |
| `tracking.html` | Tracking test: seen or lost, frame rate, lost count, distance; records the test table |
| `log.html` | Shows the log saved on the phone |
| `test.html` | Checks for `core.js` |

Both step pages open the Echo step. Add `?step=blind` for the Blind spot step.

Add `?lang=en` to a step page or the card sheet for English (`?step=blind&lang=en` for both). The default is Bahasa Indonesia.

## How it is built

One core, two inputs. `core.js` only sees the car's position measured from the sensor (forward and sideways). `ar.html` gets that position from two tracked cards; `2d.html` gets it from a dragged picture. `echo.js` runs the step itself (question, numbers, wording, log) and is the same file for both pages. `blind.js` does the same for the Blind spot step.

| File | Job |
|---|---|
| `core.js` | Position in; distance, echo time and pulse timing out. Constants to set after the tracking test are at the top. |
| `echo.js` | The Echo step, shared by both modes |
| `blind.js` | The Blind spot step, shared by both modes: the sensor only hears inside a cone (15° each side), so a car beside it gives no reading |
| `text.js` | Every word the student sees |
| `log.js` | Saves finished steps to the phone |
| `app.css` | Student screen styles |
| `vendor/` | Fixed copies of A-Frame 1.6.0, AR.js 3.4.8 and its camera file, so nothing loads from another site |
| `markers/` | Barcode markers 1 (Sensor), 2 (Car), 4 (Buzzer) from the 3×3 Hamming set; every pair differs in four cells |

There is no build step.

## Run it

On a phone, open the GitHub Pages address in Chrome or Safari (a link opened inside a chat app may not get the camera).

On a laptop, from this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The 2D page and the checks work on a laptop; the AR pages need a camera.

## Tracking test

Print `cards.html` at 100% on matte paper and check the 10 cm line with a ruler. Open `tracking.html`, pick the marker size, type the condition, and press Record. Each 20-second recording adds a row; Copy table gives CSV.

Proposed pass line: each card seen in at least 90% of frames, at least 15 frames per second on the cheapest phone, and a reading that moves less than 1 cm while the cards are still. If it fails, use the 8 cm cards before anything else.

Test phones: Samsung Galaxy A55 (personal), and a Xiaomi Redmi Note as the cheapest target. Infinix or Motorola phones are possible extras.
