/* PixGen workshop site: glass navigation + the pixel field. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Navigation ---------------- */
  var nav = document.querySelector('.nav');
  var tabsBox = document.querySelector('.tabs');
  var blob = document.querySelector('.tab-blob');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs a'));
  var sections = tabs.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var hero = document.querySelector('.hero');
  var activeTab = null;
  var settleTimer = null;

  function placeBlob(tab, animate) {
    var r = tab.getBoundingClientRect();
    var p = tabsBox.getBoundingClientRect();
    var x = r.left - p.left + tabsBox.scrollLeft;
    if (!animate || reduceMotion) {
      blob.style.transition = 'none';
      blob.style.width = r.width + 'px';
      blob.style.transform = 'translateX(' + x + 'px)';
      blob.style.opacity = '1';
      void blob.offsetWidth;
      blob.style.transition = '';
      return;
    }
    blob.style.width = r.width + 'px';
    blob.style.transform = 'translateX(' + x + 'px) scaleX(1.14)';
    blob.style.opacity = '1';
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      blob.style.transform = 'translateX(' + x + 'px) scaleX(1)';
    }, 180);
  }

  function setActive(tab) {
    if (tab === activeTab) return;
    tabs.forEach(function (a) { a.removeAttribute('aria-current'); });
    if (tab) {
      tab.setAttribute('aria-current', 'true');
      placeBlob(tab, activeTab !== null);
      if (tab.scrollIntoView && tabsBox.scrollWidth > tabsBox.clientWidth + 2) {
        tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    } else {
      blob.style.opacity = '0';
    }
    activeTab = tab;
  }

  function updateNav() {
    var y = window.scrollY || window.pageYOffset;
    var probe = y + window.innerHeight * 0.34;
    var current = null;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (s && s.offsetTop <= probe) current = tabs[i];
    }
    var nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 2;
    if (nearBottom) current = tabs[tabs.length - 1];
    if (hero && y < hero.offsetHeight * 0.45) current = null;
    setActive(current);
    nav.classList.toggle('scrolled', y > 40);
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { updateNav(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (activeTab) placeBlob(activeTab, false);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (activeTab) placeBlob(activeTab, false); });
  }
  updateNav();

  /* ---------------- Pixel field ----------------
     The hero generates a colour field in pixel space: it starts as noise and
     resolves over eight discrete steps, coarse to fine, the way a few-step
     sampler does. Moving the pointer re-noises nearby pixels, which then
     re-generate. */
  var canvas = document.getElementById('field');
  if (!canvas || !hero) return;
  var ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  var off = document.createElement('canvas');
  var octx = off.getContext('2d');

  var stops = ['#eef3ff', '#c3cdff', '#dcc3ff', '#ffc8dc', '#ffd9b8', '#cdf2e6', '#bfe3ff']
    .map(function (h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; });

  var cell = 14, cols = 0, rows = 0, img = null, data = null;
  var local = null, grain = null;
  var time = 0, lastT = 0, running = false, visible = true, frame = 0;

  // generation schedule: sigma per step, and the step boundaries in seconds
  var schedule = [1.0, 0.82, 0.66, 0.5, 0.36, 0.24, 0.13, 0.05, 0.0];
  var stepAt = [0, 0.22, 0.44, 0.66, 0.9, 1.16, 1.44, 1.76, 2.1];
  var startAt = -1, stepIndex = 0, sigma = reduceMotion ? 0 : 1, stepSeed = 1;
  var done = reduceMotion;

  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 1013904223) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var tx = smooth(x - xi), ty = smooth(y - yi);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  function fieldValue(cx, cy, t) {
    var x = cx / cols * 2.6, y = cy / rows * 1.8;
    var wx = x + 0.55 * vnoise(x * 0.8 + t * 0.21, y * 0.8 + 3.1, 11);
    var wy = y + 0.55 * vnoise(x * 0.8 + 7.7, y * 0.8 - t * 0.17, 12);
    var n = vnoise(wx + t * 0.05, wy, 1) * 0.62 + vnoise(wx * 2.1 + 5.2, wy * 2.1 + 1.3, 2) * 0.26 + vnoise(wx * 4.2 + 9.1, wy * 4.2 + 7.4, 3) * 0.12;
    return Math.min(1, Math.max(0, (n - 0.22) / 0.56));
  }
  function ramp(v, out) {
    var f = v * (stops.length - 1);
    var i = Math.min(stops.length - 2, Math.floor(f));
    var t = f - i;
    var a = stops[i], b = stops[i + 1];
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
  }
  function blockSize(s) { return s > 0.72 ? 8 : s > 0.46 ? 4 : s > 0.2 ? 2 : 1; }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = hero.clientWidth, h = hero.clientHeight;
    cell = w < 640 ? 10 : w < 1100 ? 12 : 14;
    cols = Math.ceil(w / cell);
    rows = Math.ceil(h / cell);
    var dev = Math.max(1, Math.round(cell * dpr));
    off.width = cols; off.height = rows;
    canvas.width = cols * dev; canvas.height = rows * dev;
    canvas.style.width = (cols * cell) + 'px';
    canvas.style.height = (rows * cell) + 'px';
    ctx.imageSmoothingEnabled = false;
    img = octx.createImageData(cols, rows);
    data = img.data;
    local = new Float32Array(cols * rows);
    grain = new Float32Array(cols * rows);
    for (var i = 0; i < grain.length; i++) grain[i] = 0.94 + 0.12 * hash(i % cols, (i / cols) | 0, 99);
    render(true);
  }

  var tmp = [0, 0, 0], tmpN = [0, 0, 0];
  function render(force) {
    if (!data) return;
    var hasLocal = false;
    var t = time;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        var l = local[i];
        if (l > 0.004) { hasLocal = true; } else { l = 0; }
        var s = Math.max(sigma, l);
        var o = i * 4;
        if (s <= 0) {
          ramp(fieldValue(c, r, t), tmp);
          var g = grain[i];
          data[o] = tmp[0] * g; data[o + 1] = tmp[1] * g; data[o + 2] = tmp[2] * g; data[o + 3] = 255;
          continue;
        }
        var B = blockSize(s);
        var bc = Math.floor(c / B) * B, br = Math.floor(r / B) * B;
        ramp(fieldValue(bc + B / 2, br + B / 2, t), tmp);
        var seed = stepSeed + (l > sigma ? Math.floor(l * 37) : 0);
        var nv = hash(bc, br, seed);
        ramp(nv, tmpN);
        var lum = 0.72 + 0.56 * hash(bc + 1, br + 7, seed + 3);
        var k = s * s * (3 - 2 * s);
        data[o] = Math.min(255, (tmp[0] * (1 - k) + tmpN[0] * lum * k));
        data[o + 1] = Math.min(255, (tmp[1] * (1 - k) + tmpN[1] * lum * k));
        data[o + 2] = Math.min(255, (tmp[2] * (1 - k) + tmpN[2] * lum * k));
        data[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    return hasLocal;
  }

  function tick(now) {
    if (!running) return;
    if (startAt < 0) { startAt = now; lastT = now; }
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    var elapsed = (now - startAt) / 1000;

    if (!done) {
      while (stepIndex < stepAt.length - 1 && elapsed >= stepAt[stepIndex + 1]) {
        stepIndex++;
        stepSeed++;
      }
      sigma = schedule[stepIndex];
      if (stepIndex >= schedule.length - 1) { done = true; sigma = 0; }
    }

    // the field keeps drifting slowly after generation, like a liquid
    time += dt * (done ? 0.11 : 0.06);

    var hasLocal = false;
    if (local) {
      for (var i = 0; i < local.length; i++) {
        if (local[i] > 0.004) { local[i] *= 0.9; hasLocal = true; } else { local[i] = 0; }
      }
    }
    render(false);
    frame++;

    if (!visible || document.hidden) { running = false; return; }
    requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    lastT = 0;
    requestAnimationFrame(function (now) { lastT = now; if (startAt < 0) startAt = now; tick(now); });
  }

  // pointer re-noises nearby pixels; they re-generate over the next half second
  hero.addEventListener('pointermove', function (e) {
    if (reduceMotion || !local || e.pointerType === 'touch') return;
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / cell, cy = (e.clientY - rect.top) / cell;
    var R = 4.5;
    var c0 = Math.max(0, Math.floor(cx - R)), c1 = Math.min(cols - 1, Math.ceil(cx + R));
    var r0 = Math.max(0, Math.floor(cy - R)), r1 = Math.min(rows - 1, Math.ceil(cy + R));
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        var dx = c + 0.5 - cx, dy = r + 0.5 - cy;
        var d = Math.sqrt(dx * dx + dy * dy) / R;
        if (d < 1) {
          var v = (1 - d) * 0.9;
          var i = r * cols + c;
          if (v > local[i]) local[i] = v;
        }
      }
    }
    start();
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }, { threshold: 0.02 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) start(); });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  resize();
  if (reduceMotion) { render(true); } else { start(); }
})();
