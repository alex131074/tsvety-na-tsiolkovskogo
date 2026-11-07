/* 3D-вывеска «Цветы»: круглый чёрный щит с гирляндой хризантем качается на кронштейне, на прокрутке поворачивается обратной стороной. Чистый WebGL, без библиотек. */
(function () {
  var cv = document.getElementById('zv');
  var gl = cv && (cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || cv.getContext('experimental-webgl'));
  if (!gl) { document.documentElement.classList.add('no-gl'); window.ZV = { scroll: function () {}, live: function () {} }; return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PI = Math.PI;

  /* ---------- математика ---------- */
  function mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function trans(x, y, z) { var m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function scl(x, y, z) { var m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(e, t) { var z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); }
  function basis(d) { var y = norm(d), up = Math.abs(y[2]) < .9 ? [0, 0, 1] : [1, 0, 0], x = norm(cross(up, y)), z = cross(x, y); return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); }
  function chain() { var m = arguments[0]; for (var i = 1; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }

  /* ---------- геометрия ---------- */
  function Geo() { this.d = []; }
  Geo.prototype.surf = function (F, nu, nv, M) { // F(u,v) -> [x,y,z,m], нормали по разностям
    M = M || ident(); var P = [], i, j, e = 1e-3;
    for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
      var u = i / nu, v = j / nv, p = F(u, v), pu = F(Math.min(1, u + e), v), pu2 = F(Math.max(0, u - e), v), pv = F(u, Math.min(1, v + e)), pv2 = F(u, Math.max(0, v - e));
      var n = cross([pu[0] - pu2[0], pu[1] - pu2[1], pu[2] - pu2[2]], [pv[0] - pv2[0], pv[1] - pv2[1], pv[2] - pv2[2]]);
      if (!(n[0] || n[1] || n[2])) n = [0, 1, 0];
      P.push([p, norm(n)]);
    }
    var w = nu + 1;
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = P[j * w + i], b = P[j * w + i + 1], c = P[(j + 1) * w + i + 1], d = P[(j + 1) * w + i];
      this.tri(a, b, c, M); this.tri(a, c, d, M);
    }
  };
  Geo.prototype.tri = function () {
    var M = arguments[3], self = this;
    for (var k = 0; k < 3; k++) {
      var q = arguments[k], p = q[0], n = q[1];
      self.d.push(M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14],
        M[0] * n[0] + M[4] * n[1] + M[8] * n[2], M[1] * n[0] + M[5] * n[1] + M[9] * n[2], M[2] * n[0] + M[6] * n[1] + M[10] * n[2], p[3]);
    }
  };
  Geo.prototype.upload = function () {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.d), gl.STATIC_DRAW);
    var n = this.d.length / 7; this.d = null; return { b: b, n: n };
  };

  /* лепесток: растёт вдоль y, края загибаются к центру цветка, кончик отгибается наружу */
  function petal(g, o) {
    var F = function (u, v) {
      var s = u * 2 - 1, w = o.w * Math.pow(Math.sin(PI * (.08 + .86 * v)), o.sh || .6);
      var x = s * w, y = o.l * v, z = -o.cup * s * s * w + o.curl * v * v * v * o.l;
      y -= o.tipDip ? o.tipDip * s * s * v * v : 0;
      return [x, y, z, o.m === undefined ? v : o.m];
    };
    g.surf(F, o.nu || 7, o.nv || 8, chain(rotY(o.a), trans(0, o.y || 0, o.r), rotX(o.t)));
  }
  function disc(g, r, h, m, M) { // приплюснутая полусфера: серединка, чашелистик
    g.surf(function (u, v) { var a = u * 2 * PI, b = v * PI / 2; return [Math.cos(a) * Math.cos(b) * r, Math.sin(b) * h, Math.sin(a) * Math.cos(b) * r, m]; }, 18, 5, M);
  }

  /* роза: тугой бутон внутри, раскрытые лепестки снаружи */
  var rose = new Geo(), GA = 2.39996;
  [[5, .14, .32, .5, .2, .25, .02], [5, .45, .42, .62, .3, .4, .06], [6, .8, .52, .72, .38, .5, .12], [6, 1.12, .6, .76, .44, .55, .22]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(rose, { a: k / L[0] * 2 * PI + li * .7, t: L[1], w: L[2], l: L[3], r: L[4] * .35, cup: L[5], curl: L[6], y: -li * .05 });
  });
  disc(rose, .34, -.28, .1, ident());
  var roseB = rose.upload();

  /* кустовая роза: маленькая и раскрытая */
  var spray = new Geo();
  [[5, .5, .3, .4, .2, .35, .05], [6, 1.0, .36, .46, .3, .3, .15]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(spray, { a: k / L[0] * 2 * PI + li * .6, t: L[1], w: L[2], l: L[3], r: L[4] * .3, cup: L[5], curl: L[6] });
  });
  disc(spray, .2, -.18, .1, ident());
  var sprayB = spray.upload();

  /* хризантема-ромашка: серединка и два ряда узких лепестков */
  var daisy = new Geo();
  [[18, 1.25, .1, .78, .02], [16, 1.5, .09, .7, .1]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(daisy, { a: (k + li * .5) / L[0] * 2 * PI, t: L[1], w: L[2], l: L[3], r: .18, cup: .5, curl: L[4], sh: .45, nu: 3, nv: 6, y: .04 - li * .03 });
  });
  disc(daisy, .24, .14, 2, trans(0, .02, 0));
  var daisyB = daisy.upload();

  /* лист эвкалипта/зелени */
  var leaf = new Geo();
  petal(leaf, { a: 0, t: 0, w: .26, l: 1.25, r: 0, cup: .25, curl: .25, sh: .9, nv: 9 });
  var leafB = leaf.upload();

  /* обёртка: два слоя бумаги с волнистым краем, спереди ниже, чтобы цветы были видны */
  function wrapGeo(rot, lift, waves, m) {
    var g = new Geo();
    g.surf(function (u, v) {
      var a = u * 2 * PI, t = v;
      var front = Math.max(0, Math.cos(a - PI / 2 + rot));
      var top = .55 + lift - 1.0 * front * front + .16 * Math.sin(a * waves);
      var y = -3.3 + (top + 3.3) * t;
      var r = (.32 + Math.pow(t, 1.25) * .98) * (1 + .05 * Math.sin(a * waves + 1) * t);
      return [Math.cos(a) * r, y, Math.sin(a) * r, m + t * .9];
    }, 72, 14);
    return g.upload();
  }
  var wrapA = wrapGeo(0, 0, 5, 0), wrapB = wrapGeo(.5, .22, 4, 0);
  var ribbon = new Geo();
  ribbon.surf(function (u, v) { var a = u * 2 * PI, b = v * 2 * PI, R = .52, r = .07; return [Math.cos(a) * (R + Math.cos(b) * r), Math.sin(b) * r * 1.6, Math.sin(a) * (R + Math.cos(b) * r), 2]; }, 40, 8);
  [-1, 1].forEach(function (s) { // хвосты ленты
    ribbon.surf(function (u, v) { var x = s * (.1 + v * .5), y = -v * 1.2, z = .55 + Math.sin(v * 3) * .08; return [x + (u - .5) * .22, y, z + (u - .5) * .02 * s, 2]; }, 2, 8);
  });
  var ribbonB = ribbon.upload();
  var stem = new Geo();
  stem.surf(function (u, v) { var a = u * 2 * PI; return [Math.cos(a) * .05, -v * 1.1, Math.sin(a) * .05, .5]; }, 8, 1);
  var stemB = stem.upload();
  /* ---------- шейдеры: объёмные тела ---------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aM;uniform mat4 uVP;uniform mat4 uW;varying vec3 vW;varying vec3 vN;varying float vM;' +
    'void main(){vec4 w=uW*vec4(aP,1.);vW=w.xyz;vN=mat3(uW[0].xyz,uW[1].xyz,uW[2].xyz)*aN;vM=aM;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;varying vec3 vW;varying vec3 vN;varying float vM;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uE;uniform float uFade;uniform float uGl;' +
    'void main(){vec3 N=normalize(vN);vec3 V=normalize(uE-vW);if(dot(N,V)<0.)N=-N;' +
    'vec3 base=vM<1.5?uC1*mix(.6,1.,smoothstep(0.,.95,vM)):uC2;' +
    'vec3 L1=normalize(vec3(-.5,.8,.7));vec3 L2=normalize(vec3(.85,.1,.45));' +
    'float d1=max(0.,dot(N,L1)*.62+.38);float d2=max(0.,dot(N,L2))*.3;' +
    'float rim=pow(1.-max(dot(N,V),0.),2.4);' +
    'float sp=pow(max(dot(N,normalize(L1+V)),0.),70.)*uGl;float sp2=pow(max(dot(N,normalize(L2+V)),0.),40.)*uGl*.5;' +
    'vec3 c=base*(.3+d1*.74+d2)+vec3(sp)+vec3(.9,.22,.55)*sp2+mix(vec3(1.,.9,.95),base,.35)*rim*(.1+uGl*.22);' +
    'gl_FragColor=vec4(min(c,vec3(1.))*uFade,uFade);}';
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
  var pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg);
  var A = { p: gl.getAttribLocation(pg, 'aP'), n: gl.getAttribLocation(pg, 'aN'), m: gl.getAttribLocation(pg, 'aM') };
  var U = {}; ['uVP', 'uW', 'uC1', 'uC2', 'uE', 'uFade', 'uGl'].forEach(function (n) { U[n] = gl.getUniformLocation(pg, n); });

  /* ---------- шейдеры: надпись на вывеске (картинка) ---------- */
  var VT = 'attribute vec3 aP;attribute vec2 aT;uniform mat4 uVP;uniform mat4 uW;varying vec2 vT;void main(){vT=aT;gl_Position=uVP*uW*vec4(aP,1.);}';
  var FT = 'precision mediump float;varying vec2 vT;uniform sampler2D uTex;uniform float uB;uniform float uFade;void main(){vec4 t=texture2D(uTex,vT);gl_FragColor=vec4(t.rgb*uB,t.a)*uFade;}';
  var pt = gl.createProgram(); gl.attachShader(pt, sh(gl.VERTEX_SHADER, VT)); gl.attachShader(pt, sh(gl.FRAGMENT_SHADER, FT)); gl.linkProgram(pt);
  var AT = { p: gl.getAttribLocation(pt, 'aP'), t: gl.getAttribLocation(pt, 'aT') };
  var UT = {}; ['uVP', 'uW', 'uTex', 'uB', 'uFade'].forEach(function (n) { UT[n] = gl.getUniformLocation(pt, n); });

  gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);

  function draw(buf, W, c1, c2, gloss) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
    gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(A.m, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(U.uW, false, W); gl.uniform3fv(U.uC1, c1); gl.uniform3fv(U.uC2, c2 || c1); gl.uniform1f(U.uGl, gloss || 0);
    gl.drawArrays(gl.TRIANGLES, 0, buf.n);
  }

  /* ---------- вывеска: круглый чёрный щит, как логотип магазина ---------- */
  var R = 1.7, TH = .11, HANG = 2.05;
  var shield = new Geo();
  shield.surf(function (u, v) { var a = u * 2 * PI; return [Math.cos(a) * R * v, Math.sin(a) * R * v, TH, .95]; }, 64, 2);
  shield.surf(function (u, v) { var a = -u * 2 * PI; return [Math.cos(a) * R * v, Math.sin(a) * R * v, -TH, .95]; }, 64, 2);
  shield.surf(function (u, v) { var a = u * 2 * PI, z = TH * (v * 2 - 1), b = 1 + .03 * Math.sin(v * PI); return [Math.cos(a) * R * b, Math.sin(a) * R * b, z, .95]; }, 64, 4);
  var discB = shield.upload();
  var cyl = new Geo(); // единичный цилиндр вдоль y от 0 до -1
  cyl.surf(function (u, v) { var a = u * 2 * PI; return [Math.cos(a), -v, Math.sin(a), .95]; }, 12, 1);
  var cylB = cyl.upload();
  var ring = new Geo(); // колечко подвеса
  ring.surf(function (u, v) { var a = u * 2 * PI, b = v * 2 * PI, r1 = .12, r2 = .03; return [Math.cos(a) * (r1 + Math.cos(b) * r2), Math.sin(a) * (r1 + Math.cos(b) * r2), Math.sin(b) * r2, .95]; }, 20, 6);
  var ringB = ring.upload();
  /* хризантема-помпон: много коротких лепестков по полусфере */
  var pom = new Geo();
  [[5, .2, .14, .3], [9, .55, .15, .36], [13, .9, .16, .4], [16, 1.22, .16, .42], [19, 1.5, .15, .42], [20, 1.75, .14, .38]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(pom, { a: (k + li * .37) / L[0] * 2 * PI, t: L[1], w: L[2], l: L[3], r: .05, cup: .7, curl: -.12, sh: .5, nu: 4, nv: 5, y: .12 - li * .03 });
  });
  disc(pom, .14, .12, .7, trans(0, .02, 0));
  var pomB = pom.upload();

  /* надписи рисуем на холсте и кладём на щит */
  function quad(back) {
    var d = [], z = back ? -TH - .006 : TH + .006, s = R * 1.0;
    function V(x, y) { var u = (x + s) / (2 * s), v = (s - y) / (2 * s); d.push(x, y, z, back ? 1 - u : u, v); }
    V(-s, -s); V(s, -s); V(s, s); V(-s, -s); V(s, s); V(-s, s);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW); return b;
  }
  var qF = quad(false), qB = quad(true);
  var texF = gl.createTexture(), texB = gl.createTexture();
  function paint(tex, fn) {
    var c = document.createElement('canvas'); c.width = c.height = 1024; var x = c.getContext('2d');
    x.clearRect(0, 0, 1024, 1024); x.translate(512, 512);
    x.strokeStyle = '#fff'; x.lineWidth = 16; x.beginPath(); x.arc(0, 0, 452, 0, 2 * PI); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle'; fn(x);
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  function fit(x, txt, wt, max, w) { var s = max; x.font = wt + ' ' + s + 'px Oswald, "Arial Narrow", sans-serif'; var m = x.measureText(txt).width; if (m > w) { s = s * w / m; x.font = wt + ' ' + s + 'px Oswald, "Arial Narrow", sans-serif'; } return s; }
  function paintAll() {
    paint(texF, function (x) { fit(x, 'ЦВЕТЫ', 700, 330, 700); x.fillStyle = '#fff'; x.fillText('ЦВЕТЫ', 0, 14); });
    paint(texB, function (x) {
      fit(x, 'ОТКРЫТО', 500, 96, 420); x.fillStyle = '#fff'; x.fillText('ОТКРЫТО', 0, -190);
      fit(x, '24/7', 700, 360, 620); x.fillStyle = '#ff4f9e'; x.fillText('24/7', 0, 40);
      fit(x, 'КРУГЛОСУТОЧНО', 500, 64, 470); x.fillStyle = '#fff'; x.fillText('КРУГЛОСУТОЧНО', 0, 262);
    });
    kick();
  }

  /* гирлянда цветов по нижнему краю щита */
  var COL = { white: [.97, .96, .93], cream: [.98, .9, .72], pink: [.97, .55, .72], hot: [.9, .22, .54], yellow: [.98, .82, .3], yolk: [.95, .78, .3], green: [.27, .47, .32], euc: [.52, .66, .58], black: [.05, .05, .055], steel: [.12, .12, .13] };
  var FL = [], LV = [], NF = 19;
  for (var i = 0; i < NF; i++) {
    var t = i / (NF - 1), th = -PI * (.04 + .92 * t) + Math.sin(i * 2.3) * .04, side = i % 3 === 2 ? -1 : 1;
    var rr = R + .12 + .06 * Math.sin(i * 1.7), z = side * (.12 + .05 * ((i * 5) % 3));
    var kind = [['pom', 'white', .78], ['daisy', 'white', .62], ['pom', 'pink', .7], ['spray', 'hot', .82], ['pom', 'yellow', .58], ['daisy', 'white', .55], ['pom', 'cream', .7]][i % 7];
    FL.push({ p: [Math.cos(th) * rr, Math.sin(th) * rr, z], d: norm([Math.cos(th) * .75, Math.sin(th) * .75, side * .75]), b: kind[0] === 'pom' ? pomB : kind[0] === 'daisy' ? daisyB : sprayB, c: COL[kind[1]], s: kind[2] * 1.25 * (.9 + .12 * Math.sin(i * 3.1)), spin: i * 1.9, delay: .045 * i });
  }
  for (i = 0; i < 12; i++) { var a = -PI * (.02 + .96 * i / 11); LV.push({ p: [Math.cos(a) * (R + .05), Math.sin(a) * (R + .05), (i % 2 ? .06 : -.06)], d: norm([Math.cos(a), Math.sin(a), i % 2 ? .45 : -.45]), c: i % 3 ? COL.green : COL.euc, s: .4 + .08 * (i % 3), delay: .04 * i }); }

  /* ---------- кадр ---------- */
  var W = 0, H = 0, live = true, last = 0, time = 0, mx = 0, tmx = 0, fade = 0, scr = 0, scrT = 0, prevScr = 0;
  var up = 0, upV = 0, sw = reduce ? 0 : .42, swV = 0, grow = reduce ? 1 : 0;
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
  }
  addEventListener('resize', function () { resize(); kick(); });
  if (matchMedia('(hover:hover)').matches) addEventListener('pointermove', function (e) {
    var n = e.clientX / innerWidth - .5; if (!reduce) swV += (n - tmx) * 1.6; tmx = n;
  }, { passive: true });

  function step(dt) {
    var k = 1 - Math.exp(-dt * 5);
    fade += (1 - fade) * (1 - Math.exp(-dt * 3));
    mx += (tmx - mx) * k; scr += (scrT - scr) * k;
    if (reduce) { up = 1; sw = 0; grow = 1; return; }
    upV += ((1 - up) * 60 - upV * 9) * dt; up += upV * dt; // вывеска опускается на место с отскоком
    var push = Math.sin(time * .8) * .35 + Math.sin(time * 1.9 + 1) * .12 + (scr - prevScr) * 40; prevScr = scr;
    swV += (-sw * 11 - swV * 1.1 + push) * dt; sw += swV * dt; // маятник
    sw = Math.max(-.7, Math.min(.7, sw));
    grow = Math.min(1, grow + dt * .8);
  }
  function E(f, base) { return chain(base, trans(f.p[0], f.p[1], f.p[2]), basis(f.d)); }
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  function render() {
    if (!W) resize();
    var asp = W / H, d = 12 * Math.max(1, .95 / asp);
    var az = -.18 + mx * .35, el = .1, tg = [0, .55, 0];
    var eye = [Math.sin(az) * Math.cos(el) * d, tg[1] + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d];
    var VP = mul(persp(.5, asp, 1, 80), lookAt(eye, tg));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(pg); [A.p, A.n, A.m].forEach(function (l) { gl.enableVertexAttribArray(l); });
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uE, eye[0], eye[1], eye[2]); gl.uniform1f(U.uFade, fade);

    var PY = 2.75, drop = (1 - up) * 5;
    /* кронштейн из стены справа */
    draw(cylB, chain(trans(4.2, PY, 0), basis([1, 0, 0]), scl(.055, 4.9, .055)), COL.steel, null, 1);
    draw(cylB, chain(trans(4.2, PY - 1.5, 0), basis([1.8, -1.45, 0]), scl(.04, 2.3, .04)), COL.steel, null, 1);
    draw(cylB, chain(trans(4.2, PY + .35, 0), scl(.09, 2.3, .4)), COL.steel, null, .6);

    var twist = (reduce ? .2 : mx * .5) + Math.min(1, scr / .35) * PI;
    var S = chain(trans(0, PY + drop, 0), rotY(twist), rotX(sw));
    [-.62, .62].forEach(function (x) {
      draw(ringB, chain(S, trans(x, 0, 0), rotY(PI / 2)), COL.steel, null, 1);
      draw(cylB, chain(S, trans(x, -.1, 0), scl(.022, .44, .022)), COL.steel, null, 1);
    });
    var C = chain(S, trans(0, -HANG, 0));
    draw(discB, C, COL.black, null, 1.4);
    LV.forEach(function (f) { var g = ease((grow - f.delay) * 2.2); if (g > .01) draw(leafB, chain(E(f, C), scl(f.s * g, f.s * g, f.s * g)), f.c); });
    FL.forEach(function (f) { var g = ease((grow - .15 - f.delay) * 2.4); if (g > .01) draw(f.b, chain(E(f, C), rotY(f.spin), scl(f.s * g, f.s * g, f.s * g)), f.c, COL.yolk); });

    /* надписи */
    gl.useProgram(pt); [A.p, A.n, A.m].forEach(function (l) { gl.disableVertexAttribArray(l); });
    gl.enableVertexAttribArray(AT.p); gl.enableVertexAttribArray(AT.t);
    gl.uniformMatrix4fv(UT.uVP, false, VP); gl.uniformMatrix4fv(UT.uW, false, C); gl.uniform1i(UT.uTex, 0); gl.uniform1f(UT.uFade, fade);
    var nz = [C[8], C[9], C[10]], L = norm([-.5, .8, .7]), lit = dotG(nz, L);
    [[qF, texF, lit], [qB, texB, -lit]].forEach(function (q) {
      gl.bindBuffer(gl.ARRAY_BUFFER, q[0]); gl.vertexAttribPointer(AT.p, 3, gl.FLOAT, false, 20, 0); gl.vertexAttribPointer(AT.t, 2, gl.FLOAT, false, 20, 12);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, q[1]); gl.uniform1f(UT.uB, .78 + .22 * Math.max(0, q[2]));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
    gl.disableVertexAttribArray(AT.p); gl.disableVertexAttribArray(AT.t);
  }
  function dotG(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function frame_(now) {
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; time += dt;
    step(dt); render();
    if (live) requestAnimationFrame(frame_);
  }
  var pending = false;
  function kick() {
    if (!reduce || pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; for (var i = 0; i < 60; i++) step(.05); render(); });
  }
  window.ZV = {
    scroll: function (p) { scrT = Math.max(0, Math.min(1, p)); kick(); },
    live: function (v) { if (reduce || v === live) return; live = v; if (v) { last = performance.now(); requestAnimationFrame(frame_); } }
  };
  paintAll();
  if (document.fonts && document.fonts.load) document.fonts.load('700 100px Oswald').then(paintAll, function () {});
  resize();
  if (reduce) { live = false; kick(); } else requestAnimationFrame(frame_);
})();
