// log.js — saves each finished step on the phone (localStorage).
// Nothing is uploaded yet; log.html shows what is saved.

const Log = (() => {
  const KEY = 'arsc.logs.v1';

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }

  function save(record) {
    const list = all();
    list.push(record);
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  const COLUMNS = [
    'savedAt', 'step', 'mode', 'lang', 'prediction', 'predictionCorrect',
    'predictionSeconds', 'stepSeconds', 'fps', 'sensorLost', 'carLost', 'device',
    'coneExits', 'outsideSeconds',   // Blind spot step only; empty for other steps
  ];

  function toCsv(list = all()) {
    const cell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    return [COLUMNS.join(',')]
      .concat(list.map((r) => COLUMNS.map((c) => cell(r[c])).join(',')))
      .join('\n');
  }

  return { all, save, clear, toCsv, COLUMNS };
})();
