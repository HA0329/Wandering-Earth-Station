/* ============================================================
   流浪地球 · 领航员国际空间站 —— 精细程序化重建（v2）
   依据公开设定资料：旋转环舱 + 桁架辐条 + 中央轴体 +
   前端指挥舱（MOSS）+ 尾部发动机组 + 太阳翼
   纯本地离线：three.js r128 UMD + OrbitControls + Bloom 后期
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  // 全局错误捕获：任何运行时错误显示在 #err，便于排查
  window.addEventListener('error', function (ev) {
    var errEl = $('err');
    if (!errEl) return;
    errEl.style.display = 'block';
    errEl.textContent = '页面运行时错误：\n' + (ev.message || ev.error || 'unknown') +
      '\n' + (ev.filename || '') + (ev.lineno ? ':' + ev.lineno : '');
  });

  // ---------- 确定性随机 ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 渲染器 ----------
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
  } catch (e) {
    var errEl = $('err');
    errEl.style.display = 'block';
    errEl.textContent = '无法初始化 WebGL：\n' + (e && e.message ? e.message : e) +
      '\n\n请使用支持 WebGL 的现代浏览器（Chrome / Edge / Firefox / Safari）打开本页。';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 9000);
  camera.position.set(620, 330, 700); // 开场运镜起点

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 2600;
  controls.enabled = false; // 开场运镜期间锁定

  // ================= 程序化纹理 =================
  function canvasTex(w, h, draw) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    draw(ctx, w, h);
    var t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }

  // 船体盖板纹理（铝白 + 板缝 + 铆钉 + 检修口）
  var hullTex = canvasTex(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#dfe6ee'; ctx.fillRect(0, 0, w, h);
    var rnd = mulberry32(11);
    for (var y = 0; y < h; y += 128) {
      ctx.fillStyle = 'rgba(90,105,125,.55)';
      ctx.fillRect(0, y + 126, w, 2);
      for (var x = 0; x < w; x += 64) {
        ctx.fillStyle = 'rgba(70,85,105,.5)';
        ctx.fillRect(x + 30, y + 118, 3, 3); // 铆钉
      }
    }
    for (var i = 0; i < 26; i++) {
      var px = rnd() * w, py = rnd() * h;
      ctx.fillStyle = 'rgba(120,135,155,' + (0.25 + rnd() * 0.3).toFixed(2) + ')';
      ctx.fillRect(px, py, 3 + rnd() * 6, 3 + rnd() * 6);
    }
    // 检修口格栅
    for (i = 0; i < 6; i++) {
      var gx = rnd() * w, gy = rnd() * h;
      ctx.fillStyle = 'rgba(70,84,104,.7)';
      ctx.fillRect(gx, gy, 26, 18);
      ctx.fillStyle = 'rgba(150,160,175,.9)';
      for (var g = 0; g < 4; g++) ctx.fillRect(gx + 3 + g * 6, gy + 2, 2, 14);
    }
  });
  hullTex.wrapS = hullTex.wrapT = THREE.RepeatWrapping;
  hullTex.repeat.set(2, 2);

  // 舷窗带（emissiveMap 用：黑底 + 亮窗）
  var windowTex = canvasTex(1024, 128, function (ctx, w, h) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 44; i++) {
      var x = 6 + i * ((w - 12) / 44);
      ctx.fillStyle = 'rgba(150,210,255,.9)';
      ctx.fillRect(x, 34, 13, 56);
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.fillRect(x + 2, 38, 5, 48);
    }
  });

  // 太阳翼电池板（深蓝 + 金色栅格）
  var solarTex = canvasTex(256, 256, function (ctx, w, h) {
    ctx.fillStyle = '#12294d'; ctx.fillRect(0, 0, w, h);
    var rnd = mulberry32(23);
    for (var y = 0; y < h; y += 32) {
      ctx.fillStyle = '#c9a35c';
      ctx.fillRect(0, y, w, 2);
      for (var x = 0; x < w; x += 32) ctx.fillRect(x, 0, 2, h);
    }
    for (var i = 0; i < 60; i++) {
      var cx = Math.floor(rnd() * 8) * 32, cy = Math.floor(rnd() * 8) * 32;
      ctx.fillStyle = 'rgba(8,18,40,.8)';
      ctx.fillRect(cx + 4, cy + 4, 24, 24);
    }
    for (i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + rnd() * 0.12).toFixed(2) + ')';
      ctx.fillRect(rnd() * w, rnd() * h, 8, 2);
    }
  });

  // 轴体标识带（中文 + 英文 + UEG）
  var markTex = canvasTex(1024, 160, function (ctx, w, h) {
    ctx.fillStyle = '#141a26'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b8272c'; ctx.fillRect(0, 0, 30, h); ctx.fillRect(w - 30, 0, 30, h);
    ctx.fillStyle = '#2e6fb0'; ctx.fillRect(30, 0, 12, h); ctx.fillRect(w - 42, 0, 12, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2f6fb';
    ctx.font = 'bold 52px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.fillText('领航员国际空间站', w / 2, 62);
    ctx.fillStyle = '#9fb4cc';
    ctx.font = '18px Consolas,monospace';
    ctx.fillText('NAVIGATOR INTERNATIONAL SPACE STATION · UEG', w / 2, 100);
    ctx.fillStyle = '#7d93b0';
    ctx.font = '13px Consolas,monospace';
    ctx.fillText('THE WANDERING EARTH · CN-01 · 联合政府地球联合政府', w / 2, 130);
    for (var i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(80 + i * 22, 10, 8, 140);
    }
  });

  // 地球表面
  var earthTex = canvasTex(1024, 512, function (ctx, w, h) {
    var rnd = mulberry32(2024);
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a2e5c'); g.addColorStop(0.5, '#124f90'); g.addColorStop(1, '#0a2e5c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 海面噪点
    for (var i = 0; i < 2400; i++) {
      ctx.fillStyle = 'rgba(20,80,140,' + (0.04 + rnd() * 0.1).toFixed(2) + ')';
      ctx.fillRect(rnd() * w, rnd() * h, 3, 3);
    }
    // 大陆块（双层描边）
    for (i = 0; i < 30; i++) {
      var cx = rnd() * w, cy = h * 0.14 + rnd() * h * 0.72;
      var r0 = 16 + rnd() * 46;
      var isLand = rnd() > 0.4;
      var col = isLand ? '#3f7a45' : '#8a7a4a';
      var drawBlob = function (rr, cc, alpha) {
        ctx.fillStyle = cc;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (var k = 0; k < 10; k++) {
          var a = (k / 10) * Math.PI * 2;
          var r = rr * (0.5 + rnd() * 0.85);
          var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * (0.5 + rnd() * 0.55);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      };
      drawBlob(r0, col, 0.85);
      drawBlob(r0 * 0.55, isLand ? '#5d9a52' : '#b09a63', 0.55);
    }
    // 极冠
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#eef6fd';
    ctx.fillRect(0, 0, w, 24); ctx.fillRect(0, h - 24, w, 24);
    ctx.globalAlpha = 1;
  });

  // 云层
  var cloudTex = canvasTex(512, 256, function (ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    var rnd = mulberry32(99);
    for (var i = 0; i < 90; i++) {
      var x = rnd() * w, y = rnd() * h;
      var r = 12 + rnd() * 42;
      var rg = ctx.createRadialGradient(x, y, 1, x, y, r);
      var al = (0.08 + rnd() * 0.22).toFixed(2);
      rg.addColorStop(0, 'rgba(255,255,255,' + al + ')');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (i = 0; i < 40; i++) {
      var sx = rnd() * w, sy = rnd() * h, sw = 30 + rnd() * 90;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.04 + rnd() * 0.1).toFixed(2) + ')';
      ctx.fillRect(sx, sy, sw, 2 + rnd() * 3);
    }
  });

  // 星点 / 星云精灵
  var starSpriteTex = canvasTex(64, 64, function (ctx, w, h) {
    var rg = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.25, 'rgba(255,255,255,.8)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  });
  function nebulaSprite(r, g, b) {
    return canvasTex(256, 256, function (ctx, w, h) {
      var rg = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
      rg.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',.5)');
      rg.addColorStop(0.5, 'rgba(' + r + ',' + g + ',' + b + ',.16)');
      rg.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    });
  }
  var nebulaTex = [nebulaSprite(70, 90, 220), nebulaSprite(40, 160, 190),
                   nebulaSprite(150, 80, 210), nebulaSprite(220, 120, 70)];

  // ================= 材质 =================
  var M = {
    hull:  new THREE.MeshStandardMaterial({ map: hullTex, metalness: 0.5, roughness: 0.42 }),
    hullD: new THREE.MeshStandardMaterial({ color: 0x9fb0c6, metalness: 0.55, roughness: 0.45 }),
    dark:  new THREE.MeshStandardMaterial({ color: 0x232a36, metalness: 0.55, roughness: 0.55 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff7a1a, metalness: 0.35, roughness: 0.5,
                                             emissive: 0x662200, emissiveIntensity: 0.4 }),
    windowBand: new THREE.MeshStandardMaterial({
      map: hullTex, emissive: 0x9fd8ff, emissiveMap: windowTex, emissiveIntensity: 1.6,
      metalness: 0.4, roughness: 0.4
    }),
    window: new THREE.MeshStandardMaterial({ color: 0x0a2a4a, emissive: 0x38b0ff, emissiveIntensity: 1.5 }),
    solar:  new THREE.MeshStandardMaterial({ map: solarTex, metalness: 0.25, roughness: 0.5 }),
    mark:   new THREE.MeshStandardMaterial({ map: markTex, metalness: 0.4, roughness: 0.5 }),
    beacon: new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2.4 }),
    glow:   new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.7,
                                          blending: THREE.AdditiveBlending, depthWrite: false,
                                          side: THREE.DoubleSide }),
    glowIn: new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85,
                                          blending: THREE.AdditiveBlending, depthWrite: false,
                                          side: THREE.DoubleSide }),
    tinyFlame: new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7,
                                             blending: THREE.AdditiveBlending, depthWrite: false,
                                             side: THREE.DoubleSide })
  };

  function mesh(geo, mat, x, y, z, rx, ry, rz, parent) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    (parent || scene).add(m);
    return m;
  }

  // ================= 灯光 =================
  scene.add(new THREE.AmbientLight(0x405060, 0.75));
  var sun = new THREE.DirectionalLight(0xfff4e0, 1.12);
  sun.position.set(600, 400, 900);
  scene.add(sun);
  var keyF = new THREE.DirectionalLight(0xffffff, 0.5);
  keyF.position.set(-350, 150, -700);
  scene.add(keyF);
  var fill = new THREE.DirectionalLight(0x6688cc, 0.35);
  fill.position.set(-600, -200, -500);
  scene.add(fill);

  // ================= 空间站 =================
  var stationGroup = new THREE.Group();
  scene.add(stationGroup);

  // ---- 中央轴体（轴线 Z，前端 -Z）----
  var CORE_R = 7, CORE_LEN = 52;
  mesh(new THREE.CylinderGeometry(CORE_R, CORE_R, CORE_LEN, 48), M.hull, 0, 0, 0, Math.PI / 2, 0, 0, stationGroup);
  mesh(new THREE.CylinderGeometry(7.15, 7.15, 9, 48), M.mark, 0, 0, 0, Math.PI / 2, 0, 0, stationGroup); // 标识带
  // 分段环
  [-21, -10.5, 10.5, 21].forEach(function (z) {
    mesh(new THREE.TorusGeometry(7.2, 0.3, 8, 48), M.hullD, 0, 0, z, 0, 0, 0, stationGroup);
  });
  // 橙黑警示环
  [-13, 13].forEach(function (z) {
    mesh(new THREE.TorusGeometry(7.2, 0.5, 8, 48), M.orange, 0, 0, z, 0, 0, 0, stationGroup);
  });
  // 停靠环 ×2（含对接块）
  [-20, 20].forEach(function (z) {
    mesh(new THREE.TorusGeometry(9, 0.7, 12, 48), M.hullD, 0, 0, z, 0, 0, 0, stationGroup);
    for (var d = 0; d < 4; d++) {
      var da = (d / 4) * Math.PI * 2;
      mesh(new THREE.BoxGeometry(1.2, 2.6, 1.2), M.dark,
           Math.cos(da) * 9, Math.sin(da) * 9, z, 0, 0, 0, stationGroup);
    }
  });
  // 姿态推进器（轴体前后端）
  for (var th = 0; th < 4; th++) {
    var tha = (th / 4) * Math.PI * 2 + Math.PI / 4;
    [-24.5, 24.5].forEach(function (z) {
      mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 8), M.dark,
           Math.cos(tha) * 6.5, Math.sin(tha) * 6.5, z, 0, 0, 0, stationGroup);
    });
  }

  // ---- 旋转环舱 ----
  var RING_R = 52, RING_OUT = 8.6, RING_IN = 6.8;
  var ringGroup = new THREE.Group();
  stationGroup.add(ringGroup);

  // 外环壳（盖板 + 舷窗带）
  mesh(new THREE.TorusGeometry(RING_R, RING_OUT, 32, 180), M.windowBand, 0, 0, 0, 0, 0, 0, ringGroup);
  // 内环壁（骨架感）
  mesh(new THREE.TorusGeometry(RING_R, RING_IN, 20, 144), M.dark, 0, 0, 0, 0, 0, 0, ringGroup);
  // 环端面接缝环
  [8.55, -8.55].forEach(function (z) {
    mesh(new THREE.TorusGeometry(RING_R, 0.35, 8, 144), M.dark, 0, 0, z, 0, 0, 0, ringGroup);
  });
  // 外表面竖向加强筋 ×20
  for (var rb = 0; rb < 20; rb++) {
    var rba = (rb / 20) * Math.PI * 2;
    mesh(new THREE.BoxGeometry(1.6, 1.4, 17), M.hullD,
         Math.cos(rba) * 59.4, Math.sin(rba) * 59.4, 0, 0, 0, rba, ringGroup);
  }
  // 居住舱 ×6（外挂，含舷窗）
  for (var hb = 0; hb < 6; hb++) {
    var hba = (hb / 6) * Math.PI * 2;
    var hx = Math.cos(hba) * 66, hy = Math.sin(hba) * 66;
    mesh(new THREE.BoxGeometry(13, 9, 10), M.hull, hx, hy, 0, 0, 0, hba + Math.PI / 2, ringGroup);
    for (var wn = -1; wn <= 1; wn++) {
      var off = wn * 4.2;
      mesh(new THREE.BoxGeometry(1.3, 0.6, 1.8), M.window,
           hx + Math.cos(hba) * 4.4 - Math.sin(hba) * off,
           hy + Math.sin(hba) * 4.4 + Math.cos(hba) * off, 0, 0, 0, hba + Math.PI / 2, ringGroup);
    }
    mesh(new THREE.BoxGeometry(13, 0.8, 0.8), M.orange, hx, hy, 5.2, 0, 0, hba + Math.PI / 2, ringGroup);
  }
  // 环上小天线 ×3
  [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 3 / 2].forEach(function (aa) {
    var ax = Math.cos(aa) * 60.8, ay = Math.sin(aa) * 60.8;
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), M.dark,
         ax, ay, 0, 0, 0, aa - Math.PI / 2, ringGroup);
    mesh(new THREE.SphereGeometry(0.5, 10, 8), M.orange,
         Math.cos(aa) * 62.6, Math.sin(aa) * 62.6, 0, 0, 0, 0, ringGroup);
  });

  // ---- 桁架辐条 ×4 ----
  var spokeLen = RING_R - RING_IN - CORE_R; // 52-6.8-7 = 38.2
  for (var sp = 0; sp < 4; sp++) {
    var sa = (sp / 4) * Math.PI * 2;
    var spoke = new THREE.Group();
    spoke.rotation.z = sa;
    ringGroup.add(spoke);
    var sStart = CORE_R + 0.5, sEnd = RING_R - RING_IN - 0.4;
    var sLen = sEnd - sStart, sMid = sStart + sLen / 2;
    // 两根平行主梁
    [-1.15, 1.15].forEach(function (off) {
      mesh(new THREE.BoxGeometry(sLen, 0.85, 0.85), M.hullD, sMid, off, 0, 0, 0, 0, spoke);
    });
    // 横撑 ×5
    for (var c = 0; c < 5; c++) {
      var cx = sStart + (c + 0.5) * (sLen / 5);
      mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), M.dark, cx, 0, 0, 0, 0, 0, spoke);
    }
    // 斜撑 ×4（正反交替）
    for (var dg = 0; dg < 4; dg++) {
      var dx = sStart + (dg + 0.5) * (sLen / 4);
      mesh(new THREE.BoxGeometry(5.6, 0.4, 0.4), M.dark, dx, 0, 0, 0, 0,
           (dg % 2 === 0 ? 1 : -1) * 0.65, spoke);
    }
    // 拉索 ×2（对角细缆）
    [-1.15, 1.15].forEach(function (so) {
      var xa = sMid - 7, xb = sMid + 7;
      var ddx = xb - xa, ddy = -so * 2.3;
      var len = Math.sqrt(ddx * ddx + ddy * ddy);
      // 单轴 Z 旋转：将 Y 轴圆柱转到 (ddx, ddy, 0) 方向
      mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 5), M.dark,
           xa + ddx / 2, so, 0, 0, 0, Math.atan2(-ddx, ddy), spoke);
    });
  }

  // ---- 前端指挥舱 ----
  mesh(new THREE.CylinderGeometry(7, 5.2, 6, 40), M.hull, 0, 0, -29, Math.PI / 2, 0, 0, stationGroup); // 过渡锥台
  mesh(new THREE.CylinderGeometry(5.2, 5.2, 12, 40), M.hull, 0, 0, -38, Math.PI / 2, 0, 0, stationGroup); // 指挥舱段
  mesh(new THREE.CylinderGeometry(5.45, 5.45, 2.6, 40), M.windowBand, 0, 0, -38, Math.PI / 2, 0, 0, stationGroup); // 环形大窗
  mesh(new THREE.CylinderGeometry(2.8, 5.2, 4, 32), M.hull, 0, 0, -47, Math.PI / 2, 0, 0, stationGroup); // 前鼻锥
  mesh(new THREE.SphereGeometry(2.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.hullD,
       0, 0, -50.5, Math.PI / 2, 0, 0, stationGroup); // 鼻锥半球
  // MOSS 监视塔（前端中心）
  mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.2, 12), M.dark, 0, 0, -53.6, Math.PI / 2, 0, 0, stationGroup);
  var mossEye = mesh(new THREE.SphereGeometry(0.8, 20, 14), M.beacon, 0, 0, -55.8, 0, 0, 0, stationGroup);
  // 侧面传感器 ×2
  [-1, 1].forEach(function (side) {
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 10), M.dark, 0, side * 5.6, -42, Math.PI / 2, 0, 0, stationGroup);
    mesh(new THREE.SphereGeometry(0.38, 10, 8), M.window, 0, side * 6.1, -42.6, 0, 0, 0, stationGroup);
  });
  // 顶部碟形天线
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), M.dark, 0, 6.6, -34, 0, 0, 0, stationGroup);
  mesh(new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hullD,
       0, 8.2, -34, 0, 0, 0, stationGroup);

  var mossLight = new THREE.PointLight(0xff4040, 2, 45);
  mossLight.position.set(0, 0, -57);
  stationGroup.add(mossLight);

  // ---- 尾部发动机组 ----
  mesh(new THREE.CylinderGeometry(8.5, 10.5, 14, 48), M.hull, 0, 0, 33, Math.PI / 2, 0, 0, stationGroup);
  mesh(new THREE.TorusGeometry(10.2, 0.5, 10, 48), M.dark, 0, 0, 40, 0, 0, 0, stationGroup);
  // 散热鳍片 ×4
  [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4].forEach(function (fa) {
    mesh(new THREE.BoxGeometry(0.6, 5, 9), M.hullD,
         Math.cos(fa) * 8.5, Math.sin(fa) * 8.5, 27.5, 0, 0, fa, stationGroup);
  });
  var glowMeshes = [], engineLights = [];
  // 三台主发动机
  for (var en = 0; en < 3; en++) {
    var ea = (en / 3) * Math.PI * 2 + Math.PI / 2;
    var ex = Math.cos(ea) * 4.6, ey = Math.sin(ea) * 4.6;
    mesh(new THREE.CylinderGeometry(3.4, 4.8, 7, 28), M.hullD, ex, ey, 44.5, Math.PI / 2, 0, 0, stationGroup);
    mesh(new THREE.TorusGeometry(4.4, 0.45, 10, 32), M.dark, ex, ey, 48, 0, 0, 0, stationGroup);
    mesh(new THREE.ConeGeometry(3.2, 5, 24, 1, true), M.dark, ex, ey, 46.5, -Math.PI / 2, 0, 0, stationGroup);
    var fO = mesh(new THREE.ConeGeometry(3.2, 34, 24, 1, true), M.glow, ex, ey, 60, -Math.PI / 2, 0, 0, stationGroup);
    var fI = mesh(new THREE.ConeGeometry(1.6, 18, 16, 1, true), M.glowIn, ex, ey, 52, -Math.PI / 2, 0, 0, stationGroup);
    glowMeshes.push(fO, fI);
    var pl = new THREE.PointLight(0xff8c3a, 1.6, 500);
    pl.position.set(ex, ey, 72);
    stationGroup.add(pl);
    engineLights.push(pl);
  }
  // 姿态推进器 ×6（尾部外圈）+ 微型喷焰
  for (var at = 0; at < 6; at++) {
    var ata = (at / 6) * Math.PI * 2;
    var ax = Math.cos(ata) * 8.2, ay = Math.sin(ata) * 8.2;
    mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10), M.dark, ax, ay, 39.5, Math.PI / 2, 0, 0, stationGroup);
    mesh(new THREE.ConeGeometry(0.45, 5, 8, 1, true), M.tinyFlame, ax, ay, 42.5, -Math.PI / 2, 0, 0, stationGroup);
  }

  // ---- 太阳翼 ×2 ----
  for (var side = 1; side >= -1; side -= 2) {
    var wing = new THREE.Group();
    wing.position.set(side * 11, 0, 0);
    stationGroup.add(wing);
    mesh(new THREE.BoxGeometry(1.4, 1.4, 44), M.hullD, 0, 0, 0, 0, 0, 0, wing);
    [-3, 0, 3].forEach(function (zs) { // 连接桁
      mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), M.dark, -side * 2.7, 0, zs * 6.5, 0, 0, 0, wing);
    });
    [-16.5, -5.5, 5.5, 16.5].forEach(function (pz) {
      mesh(new THREE.BoxGeometry(15.4, 0.55, 7.8), M.dark, side * 8.5, 0, pz, 0, 0, 0, wing); // 框架
      mesh(new THREE.BoxGeometry(15, 0.4, 7.4), M.solar, side * 8.5, 0, pz, 0, 0, 0, wing);    // 电池板
    });
  }

  // ================= 地球 =================
  var EARTH_R = 950;
  var earthGroup = new THREE.Group();
  earthGroup.position.set(1000, -800, -1800);
  scene.add(earthGroup);
  var earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R, 64, 48),
    new THREE.MeshPhongMaterial({ map: earthTex, specular: 0x112233, shininess: 10 })
  );
  earthGroup.add(earth);
  var clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.012, 48, 32),
    new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false })
  );
  earthGroup.add(clouds);
  function atmoSphere(scale, color, power, mult) {
    return new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * scale, 48, 32),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: [
          'varying vec3 vN; varying vec3 vV;',
          'void main(){',
          '  vN = normalize(normalMatrix * normal);',
          '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
          '  vV = normalize(-mv.xyz);',
          '  gl_Position = projectionMatrix * mv;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying vec3 vN; varying vec3 vV;',
          'void main(){',
          '  float i = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), ' + power.toFixed(2) + ');',
          '  gl_FragColor = vec4(' + color.join(',') + ', 1.0) * i * ' + mult.toFixed(2) + ';',
          '}'
        ].join('\n')
      }));
  }
  earthGroup.add(atmoSphere(1.03, [0.4, 0.7, 1.0], 2.2, 1.2));
  earthGroup.add(atmoSphere(1.065, [0.2, 0.45, 0.9], 3.2, 0.55));

  // ================= 星空 / 银河 / 星云 =================
  function starField(count, rMin, rMax, size, colorFn) {
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);
    var rnd = mulberry32(count * 31 + 7);
    for (var i = 0; i < count; i++) {
      var u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
      var sq = Math.sqrt(1 - u * u);
      var R = rMin + rnd() * (rMax - rMin);
      pos[i * 3] = R * sq * Math.cos(th);
      pos[i * 3 + 1] = R * u;
      pos[i * 3 + 2] = R * sq * Math.sin(th);
      var c = colorFn(rnd);
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var pts = new THREE.Points(g, new THREE.PointsMaterial({
      size: size, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95
    }));
    scene.add(pts);
    return pts;
  }
  starField(2600, 3600, 4700, 2.1, function (r) {
    var b = 0.82 + r * 0.18;
    return [b, b * (0.9 + r * 0.1), b * (0.92 + r * 0.08)];
  });
  // 银河带（倾斜星盘）
  var gpos = new Float32Array(2200 * 3);
  var gcol = new Float32Array(2200 * 3);
  var grnd = mulberry32(555);
  for (var gi = 0; gi < 2200; gi++) {
    var th2 = grnd() * Math.PI * 2;
    var R = 3200 + (grnd() + grnd() + grnd() - 1.5) * 260;
    var x = Math.cos(th2) * R, z = Math.sin(th2) * R, y = (grnd() + grnd() - 1) * 130;
    var tilt = 0.55;
    var y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
    var z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    gpos[gi * 3] = x; gpos[gi * 3 + 1] = y2; gpos[gi * 3 + 2] = z2;
    var bl = 0.7 + grnd() * 0.5;
    gcol[gi * 3] = bl; gcol[gi * 3 + 1] = bl * (0.92 + grnd() * 0.08); gcol[gi * 3 + 2] = bl * (1.0 + grnd() * 0.15);
  }
  var gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  gg.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
  scene.add(new THREE.Points(gg, new THREE.PointsMaterial({
    size: 1.7, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9
  })));
  // 星云精灵
  var nebRnd = mulberry32(321);
  for (var nb = 0; nb < 14; nb++) {
    var u3 = nebRnd() * 2 - 1, th3 = nebRnd() * Math.PI * 2;
    var s3 = Math.sqrt(1 - u3 * u3);
    var R3 = 1500 + nebRnd() * 1900;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nebulaTex[Math.floor(nebRnd() * nebulaTex.length)],
      blending: THREE.AdditiveBlending, transparent: true, opacity: 0.3, depthWrite: false
    }));
    sp.position.set(R3 * s3 * Math.cos(th3), R3 * u3 * 0.6, R3 * s3 * Math.sin(th3));
    var sc = 420 + nebRnd() * 520;
    sp.scale.set(sc, sc * 0.72, 1);
    scene.add(sp);
  }
  // 亮星精灵
  for (var bs = 0; bs < 16; bs++) {
    var u4 = nebRnd() * 2 - 1, th4 = nebRnd() * Math.PI * 2;
    var s4 = Math.sqrt(1 - u4 * u4);
    var R4 = 3800 + nebRnd() * 700;
    var bp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: starSpriteTex, blending: THREE.AdditiveBlending, transparent: true,
      opacity: 0.95, depthWrite: false
    }));
    bp.position.set(R4 * s4 * Math.cos(th4), R4 * u4, R4 * s4 * Math.sin(th4));
    var bs2 = 9 + nebRnd() * 22;
    bp.scale.set(bs2, bs2, 1);
    scene.add(bp);
  }

  // ================= 后期（Bloom） =================
  var composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  var bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.68);
  composer.addPass(bloomPass);
  composer.setSize(window.innerWidth, window.innerHeight);

  // ================= 交互状态与 UI =================
  var state = { autoRotate: true, ringSpin: true, engine: true, bloom: true, wire: false, speed: 1 };

  function bindToggle(id, key) {
    $(id).addEventListener('click', function (e) {
      state[key] = !state[key];
      e.currentTarget.classList.toggle('on', state[key]);
      if (key === 'engine') {
        for (var i = 0; i < glowMeshes.length; i++) glowMeshes[i].visible = state.engine;
        for (var j = 0; j < engineLights.length; j++) engineLights[j].visible = state.engine;
      }
      if (key === 'bloom') bloomPass.enabled = state.bloom;
    });
  }
  bindToggle('bRotate', 'autoRotate');
  bindToggle('bSpin', 'ringSpin');
  bindToggle('bEngine', 'engine');
  bindToggle('bBloom', 'bloom');
  $('bWire').addEventListener('click', function (e) {
    state.wire = !state.wire;
    e.currentTarget.classList.toggle('on', state.wire);
    stationGroup.traverse(function (o) {
      if (!o.isMesh) return;
      if (state.wire) {
        o.userData._mat = o.material;
        o.material = new THREE.MeshBasicMaterial({
          color: 0x67c8ff, wireframe: true, transparent: true, opacity: 0.75
        });
      } else if (o.userData._mat) {
        o.material = o.userData._mat;
        delete o.userData._mat;
      }
    });
  });
  $('bReset').addEventListener('click', function () {
    camera.position.set(150, 85, 235);
    controls.target.set(0, 0, 0);
    controls.update();
  });
  $('bShot').addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png');
    a.download = 'wandering-earth-navigator-station.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  $('spd').addEventListener('input', function (e) {
    state.speed = parseFloat(e.target.value);
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // ================= 开场运镜 =================
  var introStart = new THREE.Vector3(620, 330, 700);
  var introEnd = new THREE.Vector3(150, 85, 235);
  var introT = 0, INTRO_LEN = 5.2;
  // 调试/特写支持：?pos=x,y,z 直接设定视角，?noIntro 跳过运镜
  try {
    var qp = new URLSearchParams(location.search);
    var p = qp.get('pos');
    if (p) {
      var pv = p.split(',').map(parseFloat);
      if (pv.length === 3 && pv.every(isFinite)) {
        introEnd.set(pv[0], pv[1], pv[2]);
        camera.position.copy(introEnd);
      }
    }
    if (qp.get('noIntro') !== null) { introT = INTRO_LEN; controls.enabled = true; }
  } catch (e) { /* 忽略参数解析错误 */ }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ================= 动画循环 =================
  var clock = new THREE.Clock();
  var fpsAcc = 0, fpsFrames = 0, fpsLast = performance.now();
  var teleT = 0;

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    // 开场运镜
    if (introT < INTRO_LEN) {
      introT += dt;
      var k = easeInOutCubic(Math.min(introT / INTRO_LEN, 1));
      camera.position.lerpVectors(introStart, introEnd, k);
      if (introT >= INTRO_LEN) controls.enabled = true;
    }
    if (state.ringSpin) ringGroup.rotation.z += 0.12 * state.speed * dt;
    if (state.autoRotate) stationGroup.rotation.y += 0.05 * dt;
    earth.rotation.y += 0.01 * dt;
    clouds.rotation.y += 0.013 * dt;

    // 喷焰闪烁
    for (var i = 0; i < glowMeshes.length; i++) {
      var fl = 1 + 0.12 * Math.sin(t * 19 + i * 2.1) * Math.sin(t * 6.7 + i);
      glowMeshes[i].scale.z = fl;
      glowMeshes[i].material.opacity = 0.65 + 0.12 * Math.sin(t * 13 + i * 1.7);
    }
    for (var j = 0; j < engineLights.length; j++) {
      engineLights[j].intensity = 1.4 + 0.5 * Math.sin(t * 24 + j * 3);
    }
    // MOSS 红眼闪烁
    mossEye.material.emissiveIntensity = 2.0 + 1.4 * Math.sin(t * 5.2);
    mossLight.intensity = 1.6 + 1.4 * Math.sin(t * 5.2);

    controls.update();

    // 遥测（0.5s 刷新）
    teleT += dt;
    if (teleT >= 0.5) {
      var now = performance.now();
      fpsAcc += fpsFrames / Math.max((now - fpsLast) / 1000, 0.001);
      fpsLast = now;
      fpsFrames = 0;
      $('tFps').textContent = Math.round(fpsAcc);
      fpsAcc = 0;
      $('tSpin').textContent = (state.ringSpin ? 0.12 * state.speed : 0).toFixed(2);
      $('tDist').textContent = Math.round(camera.position.length() / 10) * 10;
      teleT = 0;
    }
    fpsFrames++;

    composer.render();
  }
  animate();
})();
