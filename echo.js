// echo.js — the Echo step. Both pages (ar.html and 2d.html) run this same code.
// Each page gives it two functions:
//   read()      -> { sensorSeen, carSeen, forward, sideways }   (shown cm, from core.js)
//   draw(view)  -> draws the pulse for that page
// Everything else — the question, the numbers, the wording, the log — is shared.

const EchoStep = (() => {
  function start({ mode, read, draw }) {
    const t = Text.t;
    const CORRECT = 'later';

    const ui = document.createElement('div');
    ui.className = 'ui';
    ui.innerHTML = `
      <div class="numbers">
        <div class="num"><span class="label">${t.echoTime}</span><span class="value"><b id="n-ms">–</b> ${t.ms}</span></div>
        <div class="num"><span class="label">${t.distance}</span><span class="value"><b id="n-cm">–</b> ${t.cm}</span></div>
      </div>
      <div class="panel">
        <p id="instruction"></p>
        <button id="done" hidden>${t.done}</button>
      </div>
      <div class="scrim" id="predict">
        <div class="card">
          <p class="question">${t.predictQuestion}</p>
          ${Object.entries(t.predictOptions)
            .map(([key, label]) => `<button class="option" data-answer="${key}">${label}</button>`)
            .join('')}
        </div>
      </div>
      <div class="scrim" id="finish" hidden>
        <div class="card"><p class="question">${t.finished}</p></div>
      </div>`;
    document.body.appendChild(ui);

    const $ = (id) => ui.querySelector('#' + id);
    const elMs = $('n-ms'), elCm = $('n-cm'), elText = $('instruction'), elDone = $('done');

    let state = 'predict'; // predict -> intro -> explore -> done
    const startedAt = performance.now();
    let prediction = null, predictionSeconds = null;

    const smoother = Core.makeSmoother();
    const hold = Core.makeHold();
    let phase = 0;
    let frames = 0, activeMs = 0;
    const lost = { sensor: 0, car: 0 };
    let wasSeen = { sensor: false, car: false };
    let lastTick = null, lastNumbers = 0, lastText = '';

    ui.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        prediction = btn.dataset.answer;
        predictionSeconds = (performance.now() - startedAt) / 1000;
        $('predict').hidden = true;
        state = 'intro';
      });
    });

    elDone.addEventListener('click', () => {
      state = 'done';
      Log.save({
        savedAt: new Date().toISOString(),
        step: 'echo',
        mode,
        lang: Text.lang,
        prediction,
        predictionCorrect: prediction === CORRECT,
        predictionSeconds: round(predictionSeconds, 1),
        stepSeconds: round((performance.now() - startedAt) / 1000, 1),
        fps: activeMs > 0 ? round((frames * 1000) / activeMs, 1) : null,
        sensorLost: lost.sensor,
        carLost: lost.car,
        device: navigator.userAgent,
      });
      elDone.hidden = true;
      $('finish').hidden = false;
    });

    function round(v, digits) {
      const k = 10 ** digits;
      return Math.round(v * k) / k;
    }

    function setText(s) {
      if (s !== lastText) { elText.textContent = s; lastText = s; }
    }

    function tick(now) {
      requestAnimationFrame(tick);
      const dt = lastTick === null ? 0 : Math.min(now - lastTick, 100);
      lastTick = now;
      if (state === 'predict' || state === 'done') { draw({ pulse: null }); return; }

      const raw = read();
      frames++; activeMs += dt;
      if (wasSeen.sensor && !raw.sensorSeen) lost.sensor++;
      if (wasSeen.car && !raw.carSeen) lost.car++;
      wasSeen = { sensor: raw.sensorSeen, car: raw.carSeen };

      const both = raw.sensorSeen && raw.carSeen;
      const held = hold.update(both, both ? smoother.push(raw.forward, raw.sideways) : null, now);
      if (held.state === 'lost') smoother.reset();

      const m = held.value ? Core.measure(held.value.forward, held.value.sideways) : null;
      const reading = m && m.inRange;

      // The two numbers, refreshed ten times a second so they stay readable.
      if (now - lastNumbers > 100) {
        lastNumbers = now;
        elMs.textContent = reading ? m.echoMs.toFixed(1) : '–';
        elCm.textContent = reading ? Math.round(m.cm) : '–';
      }

      // The pulse only runs while there is a reading.
      let pulse = null;
      if (reading) {
        phase = Core.advancePulse(phase, dt, m.cm, state === 'intro');
        if (phase >= 1) {
          phase -= 1;
          if (state === 'intro') { state = 'explore'; elDone.hidden = false; }
        }
        pulse = Core.pulseAt(phase);
      }

      // One instruction at a time.
      if (held.state === 'lost') {
        setText(!raw.sensorSeen && !raw.carSeen ? t.lostBoth : !raw.sensorSeen ? t.lostSensor : t.lostCar);
      } else if (m && !m.inRange) {
        setText(t.tooFar);
      } else if (state === 'intro') {
        setText(pulse && pulse.leg === 'out' ? t.introOut : t.introBack);
      } else {
        setText(t.explore);
      }

      draw({
        pulse,
        forward: held.value ? held.value.forward : null,
        sideways: held.value ? held.value.sideways : null,
        cm: m ? m.cm : null,
      });
    }
    requestAnimationFrame(tick);
  }

  return { start };
})();
