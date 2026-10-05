/* =========================================================
   KEEPER LAB — Tactical Pad (three.js r128)

   골키퍼 코치가 일지에 그리듯: 고정된 '박스 비스듬히' 시점 위에
   3D 선수·도구를 놓고, 선·번호·텍스트·영역은 2D로 겹쳐 그립니다.

   월드 좌표 (미터)
     x : 터치라인 방향. 골키퍼 기준 왼쪽이 +x
     z : 우리 골라인 0 → 필드 쪽
     y : 높이
   선수·도구는 로컬 +z 방향을 바라보고, rot(라디안)만큼 y축 회전합니다.
   ========================================================= */
(function () {
  if (!window.THREE) { window.Tactics3D = null; return; }
  const T = THREE;
  const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const FOV = 34;
  const ASPECT = 16 / 10; // 보드 비율 고정 (어떤 화면에서도 같은 구도)
  const r2 = (n) => Math.round(n * 100) / 100;
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- 경기장 범위 · 시점 ---------- */
  const BOARD = { x: [-37, 37], z: [-6, 111] }; // 선수를 놓을 수 있는 범위 (풀코트)
  // 골키퍼 코치가 일지에 그리듯 — 골대를 바라보는 거리별 + 비스듬히 + 위 + 하프
  const ANGLES = {
    fnear: { name: "골대 정면 · 가까이", p: [0, 4.4, 11.5], t: [0, 0.7, 1.6] },
    fbox:  { name: "골대 정면 · 박스", p: [0, 10.5, 25.5], t: [0, 0, 6.8] },
    ffar:  { name: "골대 정면 · 멀리", p: [0, 17, 45], t: [0, 0, 11] },
    L:     { name: "박스 · 왼쪽에서", p: [15.5, 11.5, 18], t: [-1.8, 0, 5.6] },
    R:     { name: "박스 · 오른쪽에서", p: [-15.5, 11.5, 18], t: [1.8, 0, 5.6] },
    top:   { name: "위에서", p: [0, 40, 25], t: [0, 0, 9] },
    half:  { name: "하프 코트", p: [0, 33, 78], t: [0, 0, 25], fig: 1.5 },
    full:  { name: "풀 코트", p: [104, 82, 52.5], t: [-2, 0, 52.5] },
  };
  const TURFS = { green: "초록 잔디", dark: "블랙" };

  function makeCamera(angle) {
    const a = ANGLES[angle] || ANGLES.L;
    const cam = new T.PerspectiveCamera(FOV, ASPECT, 0.1, 600);
    cam.position.set(...a.p);
    cam.lookAt(V3(...a.t));
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    return cam;
  }

  /* ---------- 경기장 텍스처 (초록 잔디 / 블랙) ---------- */
  const TURF_STYLE = {
    green: { base: "#3f7a33", a: "#4a873c", b: "#437f36", line: "#f2f4ee", tint: 0xb4b4b4, floor: 0x24421e },
    dark:  { base: "#070707", a: "#0b0b0b", b: "#0f0f0f", line: "#e6e6e6", tint: 0x585858, floor: 0x020202 },
  };
  // 경기장 그림은 앞(골대 쪽)·뒤(반대편) 두 장으로 나눠서 가까운 시점도 선명하게
  const PITCH_PARTS = { near: { x: [-37, 37], z: [-6, 60] }, far: { x: [-37, 37], z: [60, 111] } };
  const texCache = new Map();
  function pitchTexture(turf, part = "near") {
    const key = turf + part;
    if (texCache.has(key)) return texCache.get(key);
    const st = TURF_STYLE[turf] || TURF_STYLE.green;
    const R = PITCH_PARTS[part];
    const W = R.x[1] - R.x[0], H = R.z[1] - R.z[0];
    const ppm = Math.min(64, 4096 / Math.max(W, H));
    const c = document.createElement("canvas");
    c.width = Math.round(W * ppm); c.height = Math.round(H * ppm);
    const g = c.getContext("2d");
    g.scale(ppm, ppm);
    g.translate(-R.x[0], -R.z[0]);
    g.fillStyle = st.base; g.fillRect(R.x[0], R.z[0], W, H);
    for (let i = -2; i < 23; i++) { g.fillStyle = i % 2 ? st.a : st.b; g.fillRect(R.x[0], i * 5.25, W, 5.25); }
    g.strokeStyle = st.line; g.fillStyle = st.line;
    g.lineWidth = 0.12;
    g.strokeRect(-34, 0, 68, 105);
    g.beginPath(); g.moveTo(-34, 52.5); g.lineTo(34, 52.5); g.stroke();
    g.beginPath(); g.arc(0, 52.5, 9.15, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 52.5, 0.22, 0, Math.PI * 2); g.fill();
    const a = Math.asin(5.5 / 9.15);
    [0, 1].forEach((farEnd) => {
      const z = (d) => (farEnd ? 105 - d : d);
      g.strokeRect(-20.16, Math.min(z(0), z(16.5)), 40.32, 16.5);
      g.strokeRect(-9.16, Math.min(z(0), z(5.5)), 18.32, 5.5);
      g.beginPath(); g.arc(0, z(11), 0.2, 0, Math.PI * 2); g.fill();
      g.beginPath();
      if (farEnd) g.arc(0, z(11), 9.15, Math.PI + a, Math.PI * 2 - a); else g.arc(0, z(11), 9.15, a, Math.PI - a);
      g.stroke();
      const corners = farEnd ? [[-34, -Math.PI / 2, 0], [34, Math.PI, Math.PI * 1.5]] : [[-34, 0, Math.PI / 2], [34, Math.PI / 2, Math.PI]];
      corners.forEach(([x, a0, a1]) => { g.beginPath(); g.arc(x, z(0), 1, a0, a1); g.stroke(); });
    });
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 8;
    texCache.set(key, tex);
    return tex;
  }

  /* ---------- 공유 재질 ---------- */
  const matCache = new Map();
  const cached = (k, make) => { if (!matCache.has(k)) matCache.set(k, make()); return matCache.get(k); };
  const std = (c, rough = 0.68) => cached("s" + c + rough, () => new T.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 }));
  const flat = (c, o = 1) => cached("b" + c + o, () => new T.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o }));
  function ballMat() {
    return cached("ball", () => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, 256, 128);
      g.fillStyle = "#111";
      [[30, 30], [95, 64], [160, 30], [225, 64], [30, 100], [160, 100], [95, 4], [225, 4], [95, 124], [225, 124]].forEach(([x, y]) => {
        g.beginPath();
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; g[i ? "lineTo" : "moveTo"](x + Math.cos(a) * 14, y + Math.sin(a) * 14); }
        g.fill();
      });
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
      return new T.MeshStandardMaterial({ map: t, roughness: 0.5 });
    });
  }

  /* ---------- 지오메트리 ---------- */
  // 위(0)에서 아래(-len)로 내려가는 팔다리. radii는 위→아래 반지름
  function limbGeo(len, radii, seg = 16) {
    const n = radii.length, pts = [];
    pts.push(new T.Vector2(0.0001, -len - radii[n - 1] * 0.7));
    for (let i = n - 1; i >= 0; i--) pts.push(new T.Vector2(radii[i], -len * i / (n - 1)));
    pts.push(new T.Vector2(0.0001, radii[0] * 0.7));
    return new T.LatheGeometry(pts, seg);
  }
  // 아래(y0)에서 위(y1)로 올라가는 몸통. radii는 아래→위 반지름 (균일 간격 → 등번호가 찌그러지지 않음)
  function trunkGeo(y0, y1, radii, seg = 28) {
    const n = radii.length, pts = [];
    for (let i = 0; i < n; i++) pts.push(new T.Vector2(radii[i], y0 + (y1 - y0) * i / (n - 1)));
    return new T.LatheGeometry(pts, seg);
  }
  const shift = (g, x, y, z) => { g.translate(x, y, z); return g; };

  let G;
  function geos() {
    if (G) return G;
    G = {
      // 사람
      pelvis: trunkGeo(-0.13, 0.1, [0.02, 0.12, 0.155, 0.162, 0.155, 0.145]),
      chest: trunkGeo(0, 0.46, [0.14, 0.148, 0.16, 0.172, 0.18, 0.178, 0.165, 0.125, 0.05]),
      neck: shift(new T.CylinderGeometry(0.046, 0.05, 0.12, 14), 0, 0.04, 0),
      head: new T.SphereGeometry(0.105, 24, 18),
      hair: new T.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      nose: new T.SphereGeometry(0.02, 10, 8),
      ear: new T.SphereGeometry(0.022, 10, 8),
      shoulder: new T.SphereGeometry(0.058, 18, 14),
      uArm: limbGeo(0.29, [0.054, 0.051, 0.045, 0.039]),
      sleeveShort: limbGeo(0.13, [0.062, 0.06, 0.057]),
      elbow: new T.SphereGeometry(0.04, 12, 10),
      fArm: limbGeo(0.26, [0.039, 0.041, 0.034, 0.027]),
      hand: shift(new T.BoxGeometry(0.075, 0.1, 0.032), 0, -0.05, 0),
      thumb: shift(new T.BoxGeometry(0.022, 0.05, 0.024), 0, -0.025, 0),
      glove: shift(new T.BoxGeometry(0.105, 0.16, 0.05), 0, -0.07, 0),
      gloveThumb: shift(new T.BoxGeometry(0.035, 0.08, 0.04), 0, -0.04, 0),
      cuff: new T.CylinderGeometry(0.045, 0.045, 0.05, 14),
      thigh: limbGeo(0.45, [0.088, 0.084, 0.074, 0.063, 0.053]),
      shortsLeg: limbGeo(0.21, [0.1, 0.097, 0.093]),
      pantsLeg: limbGeo(0.45, [0.098, 0.093, 0.083, 0.072, 0.064]),
      knee: new T.SphereGeometry(0.056, 14, 10),
      shin: limbGeo(0.44, [0.054, 0.06, 0.052, 0.04, 0.034]),
      pantsShin: limbGeo(0.44, [0.066, 0.066, 0.06, 0.054, 0.05]),
      boot: (() => { const g = new T.SphereGeometry(1, 22, 14); g.scale(0.05, 0.04, 0.135); g.translate(0, -0.032, 0.058); return g; })(),
      // 공 · 도구
      ball: new T.SphereGeometry(0.11, 28, 20),
      unitCyl: new T.CylinderGeometry(1, 1, 1, 8),
      unitCone: new T.ConeGeometry(1, 1, 16),
      floor: new T.PlaneGeometry(800, 800).rotateX(-Math.PI / 2),
      ring: new T.RingGeometry(0.52, 0.64, 48).rotateX(-Math.PI / 2),
      ringTip: new T.CircleGeometry(0.16, 3).rotateX(-Math.PI / 2),
      saucer: shift(new T.CylinderGeometry(0.03, 0.1, 0.065, 24), 0, 0.0325, 0),
      marker: shift(new T.CylinderGeometry(0.115, 0.115, 0.006, 28), 0, 0.003, 0),
      bigCone: shift(new T.CylinderGeometry(0.018, 0.13, 0.46, 24), 0, 0.25, 0),
      bigConeBand: shift(new T.CylinderGeometry(0.075, 0.09, 0.08, 24), 0, 0.26, 0),
      bigConeBase: shift(new T.BoxGeometry(0.3, 0.03, 0.3), 0, 0.015, 0),
      bosuDome: shift(new T.SphereGeometry(0.3, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.045, 0),
      bosuBase: shift(new T.CylinderGeometry(0.3, 0.3, 0.045, 28), 0, 0.0225, 0),
      poleBase: shift(new T.CylinderGeometry(0.11, 0.13, 0.04, 20), 0, 0.02, 0),
      pole: shift(new T.CylinderGeometry(0.016, 0.016, 1.7, 10), 0, 0.85, 0),
      rail: new T.BoxGeometry(0.03, 0.012, 1),
      proxyBox: new T.BoxGeometry(1, 1, 1),
    };
    return G;
  }

  /* ---------- 유니폼 ---------- */
  const SKIN = 0xc59a7c, HAIR = 0x1b1714;
  const KITS = {
    gk:    { name: "골키퍼", jersey: "#f2c230", ink: "#111111", sleeves: "long", shorts: 0x151515, socks: 0xf2c230, boots: 0x111111, gloves: 0xf4f4f4, chip: ["#f2c230", "#111"] },
    own:   { name: "우리 팀", jersey: "#f4f4f2", ink: "#111111", sleeves: "short", shorts: 0x151515, socks: 0xf4f4f2, boots: 0x111111, chip: ["#f4f4f2", "#111"] },
    opp:   { name: "상대 팀", jersey: "#c8202f", ink: "#ffffff", sleeves: "short", shorts: 0xf4f4f2, socks: 0xc8202f, boots: 0x111111, chip: ["#c8202f", "#fff"] },
    coach: { name: "코치", jersey: "#2e2e30", ink: "#ffffff", sleeves: "long", pants: 0x2e2e30, boots: 0xf4f4f2, text: "C", chip: ["#111", "#fff"] },
  };
  const hex = (s) => parseInt(s.slice(1), 16);
  // 스키닝 메시용 재질 (r128은 skinning: true 필요)
  const skinStd = (c, rough = 0.68) => cached("k" + c + rough, () => new T.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, skinning: true }));

  // 상의 텍스처: 등번호(뒤) / COACH(앞·뒤). u=0 앞, u=0.5 뒤
  const jerseyCache = new Map();
  function jerseyMat(kind, label) {
    const kit = KITS[kind];
    const key = kind + "|" + label;
    if (jerseyCache.has(key)) return jerseyCache.get(key);
    const c = document.createElement("canvas"); c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = kit.jersey; g.fillRect(0, 0, 512, 256);
    g.fillStyle = kit.ink; g.globalAlpha = 0.85; g.fillRect(0, 0, 512, 14); g.globalAlpha = 1;
    g.fillStyle = kit.ink;
    g.textAlign = "center"; g.textBaseline = "middle";
    if (kit.text) {
      g.font = `900 46px "Arial Black", Arial, sans-serif`;
      g.fillText(kit.text, 256, 100);
      g.fillText(kit.text, 0, 100); g.fillText(kit.text, 512, 100);
      g.fillRect(0, 230, 512, 8);
    } else if (label) {
      g.font = `900 ${label.length > 2 ? 64 : 96}px "Arial Black", Arial, sans-serif`;
      g.fillText(label, 256, 112);
      g.font = `900 34px "Arial Black", Arial, sans-serif`;
      g.fillText(label, 470, 70);
    }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    const m = new T.MeshStandardMaterial({ map: t, roughness: 0.72, skinning: true });
    jerseyCache.set(key, m);
    return m;
  }

  /* ---------- 사람: 스키닝 모델 (관절에서 살이 부드럽게 휘어짐) ----------
     뼈대는 차렷 자세(팔·다리 아래로)로 만들고, 각 부위 정점마다 가까운 뼈 2개의 가중치를 줘요. */
  const BONES = [
    ["hips", null, [0, 0, 0]],
    ["spine1", "hips", [0, 0.08, 0]],
    ["spine2", "spine1", [0, 0.2, 0]],
    ["neck", "spine2", [0, 0.24, 0]],
    ["head", "neck", [0, 0.1, 0]],
    ["lClav", "spine2", [0.05, 0.18, 0]], ["lArm", "lClav", [0.15, 0, 0]], ["lFore", "lArm", [0, -0.29, 0]], ["lHand", "lFore", [0, -0.26, 0]],
    ["rClav", "spine2", [-0.05, 0.18, 0]], ["rArm", "rClav", [-0.15, 0, 0]], ["rFore", "rArm", [0, -0.29, 0]], ["rHand", "rFore", [0, -0.26, 0]],
    ["lThigh", "hips", [0.095, -0.02, 0]], ["lShin", "lThigh", [0, -0.45, 0]], ["lFoot", "lShin", [0, -0.44, 0]],
    ["rThigh", "hips", [-0.095, -0.02, 0]], ["rShin", "rThigh", [0, -0.45, 0]], ["rFoot", "rShin", [0, -0.44, 0]],
  ];
  const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
  const BIND = {};
  BONES.forEach(([n, p, pos]) => { const o = p ? BIND[p] : [0, 0, 0]; BIND[n] = [o[0] + pos[0], o[1] + pos[1], o[2] + pos[2]]; });
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // 아래로 내려가는 부위: 관절(위쪽) 근처는 부모 뼈와 반반, 멀어질수록 자기 뼈
  const hangW = (bone, parent, L = 0.07) => { const jy = BIND[bone][1]; return (x, y) => { const wp = 0.5 - 0.5 * Math.max(-1, Math.min(1, (jy - y) / L)); return [BI[bone], 1 - wp, BI[parent], wp]; }; };
  const upW = (bone, parent, L = 0.06) => { const jy = BIND[bone][1]; return (x, y) => { const wp = 0.5 - 0.5 * Math.max(-1, Math.min(1, (y - jy) / L)); return [BI[bone], 1 - wp, BI[parent], wp]; }; };
  const rigidW = (bone) => () => [BI[bone], 1, 0, 0];
  const mixW = (a, wa, b) => () => [BI[a], wa, BI[b], 1 - wa];
  const torsoW = (x, y) => {
    if (y < 0.17) { const t = smooth(0.02, 0.17, y); return [BI.hips, 1 - t, BI.spine1, t]; }
    const t = smooth(0.17, 0.38, y); return [BI.spine1, 1 - t, BI.spine2, t];
  };
  const pelvisW = (x, y) => { const t = smooth(0.02, 0.1, y) * 0.6; return [BI.hips, 1 - t, BI.spine1, t]; };

  function place(base, { s, rx, rz, t } = {}) {
    const g = base.clone();
    if (s) g.scale(s[0], s[1], s[2]);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (t) g.translate(t[0], t[1], t[2]);
    return g;
  }

  function mergeSkinned(parts) {
    let vc = 0, ic = 0;
    parts.forEach(({ geo }) => { vc += geo.attributes.position.count; ic += geo.index ? geo.index.count : geo.attributes.position.count; });
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
    const si = new Uint16Array(vc * 4), sw = new Float32Array(vc * 4), idx = new Uint32Array(ic);
    let vo = 0, io = 0;
    for (const { geo, w } of parts) {
      const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = vo + i;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        nor[k * 3] = N.getX(i); nor[k * 3 + 1] = N.getY(i); nor[k * 3 + 2] = N.getZ(i);
        if (U) { uv[k * 2] = U.getX(i); uv[k * 2 + 1] = U.getY(i); }
        const [b1, w1, b2, w2] = w(x, y, z);
        si[k * 4] = b1; si[k * 4 + 1] = b2; sw[k * 4] = w1; sw[k * 4 + 1] = w2;
      }
      if (geo.index) { for (let j = 0; j < geo.index.count; j++) idx[io + j] = geo.index.getX(j) + vo; io += geo.index.count; }
      else { for (let j = 0; j < P.count; j++) idx[io + j] = vo + j; io += P.count; }
      vo += P.count;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.BufferAttribute(nor, 3));
    g.setAttribute("uv", new T.BufferAttribute(uv, 2));
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    g.setIndex(new T.BufferAttribute(idx, 1));
    return g;
  }

  // 종류별(골키퍼·필드·코치) 몸 지오메트리 — 재질 슬롯별로 하나씩 합쳐서 캐시
  const humanGeoCache = new Map();
  function humanGeo(kind) {
    if (humanGeoCache.has(kind)) return humanGeoCache.get(kind);
    const kit = KITS[kind], g = geos();
    const slots = {};
    const put = (slot, geo, w) => (slots[slot] = slots[slot] || []).push({ geo, w });
    const long = kit.sleeves === "long", pants = kit.pants != null;

    put("lower", place(g.pelvis, { s: [1.08, 1, 0.72] }), pelvisW);
    put("jersey", place(g.chest, { s: [1.08, 1, 0.66], t: [0, 0.08, 0] }), torsoW);
    put("skin", place(g.neck, { t: [0, 0.52, 0] }), upW("neck", "spine2", 0.05));
    const hc = [0, 0.67, 0];
    put("skin", place(g.head, { s: [0.9, 1.08, 0.98], t: hc }), rigidW("head"));
    put("hair", place(g.hair, { s: [0.93, 1.05, 1.02], rx: -0.32, t: [0, hc[1] + 0.012, -0.008] }), rigidW("head"));
    put("skin", place(g.nose, { t: [0, hc[1] - 0.01, 0.1] }), rigidW("head"));
    [1, -1].forEach((s) => put("skin", place(g.ear, { s: [0.5, 1, 0.8], t: [0.093 * s, hc[1], 0] }), rigidW("head")));

    [[1, "l"], [-1, "r"]].forEach(([s, p]) => {
      const sh = [0.2 * s, 0.46, 0], el = [0.2 * s, 0.17, 0], wr = [0.2 * s, -0.09, 0];
      put("kit", place(g.shoulder, { t: sh }), mixW(p + "Arm", 0.55, p + "Clav"));
      put(long ? "kit" : "skin", place(g.uArm, { t: sh }), hangW(p + "Arm", p + "Clav", 0.08));
      if (!long) put("kit", place(g.sleeveShort, { t: sh }), hangW(p + "Arm", p + "Clav", 0.08));
      put(long ? "kit" : "skin", place(g.fArm, { t: el }), hangW(p + "Fore", p + "Arm", 0.05));
      if (kind === "gk") {
        put("cuff", place(g.cuff, { t: [wr[0], wr[1] + 0.005, 0] }), hangW(p + "Hand", p + "Fore", 0.03));
        put("gloves", place(g.glove, { t: wr }), rigidW(p + "Hand"));
        put("gloves", place(g.gloveThumb, { rz: 0.5 * s, t: [wr[0] - 0.05 * s, wr[1] - 0.015, 0.025] }), rigidW(p + "Hand"));
      } else {
        put("skin", place(g.hand, { t: wr }), hangW(p + "Hand", p + "Fore", 0.03));
        put("skin", place(g.thumb, { rz: 0.45 * s, t: [wr[0] - 0.035 * s, wr[1] - 0.01, 0.015] }), rigidW(p + "Hand"));
      }
      const hp = [0.095 * s, -0.02, 0], kn = [0.095 * s, -0.47, 0], ft = [0.095 * s, -0.91, 0];
      if (pants) put("lower", place(g.pantsLeg, { t: hp }), hangW(p + "Thigh", "hips", 0.08));
      else { put("skin", place(g.thigh, { t: hp }), hangW(p + "Thigh", "hips", 0.08)); put("lower", place(g.shortsLeg, { t: hp }), hangW(p + "Thigh", "hips", 0.08)); }
      put(pants ? "lower" : "legs", place(pants ? g.pantsShin : g.shin, { t: kn }), hangW(p + "Shin", p + "Thigh", 0.06));
      put("boots", place(g.boot, { t: ft }), hangW(p + "Foot", p + "Shin", 0.03));
    });

    const out = {};
    for (const [slot, parts] of Object.entries(slots)) out[slot] = mergeSkinned(parts);
    humanGeoCache.set(kind, out);
    return out;
  }

  // 땅에 닿는 높이·머리 위치를 계산하는 기준점 (뼈에 붙어서 같이 움직임)
  const MARKERS = [
    ["lFoot", [0, -0.068, -0.07]], ["lFoot", [0, -0.068, 0.2]], ["lFoot", [0.05, -0.068, 0.06]],
    ["rFoot", [0, -0.068, -0.07]], ["rFoot", [0, -0.068, 0.2]], ["rFoot", [-0.05, -0.068, 0.06]],
    ["lShin", [0, 0, 0.06]], ["rShin", [0, 0, 0.06]], ["lShin", [0, 0, -0.05]], ["rShin", [0, 0, -0.05]],
    ["lShin", [0, -0.22, -0.06]], ["rShin", [0, -0.22, -0.06]], ["lShin", [0.06, -0.2, 0]], ["rShin", [-0.06, -0.2, 0]],
    ["lHand", [0, -0.17, 0]], ["rHand", [0, -0.17, 0]], ["lFore", [0, 0, -0.04]], ["rFore", [0, 0, -0.04]],
    ["head", [0, 0.16, 0]], ["head", [0, 0.05, 0.11]], ["head", [0, 0.05, -0.11]], ["head", [0.1, 0.05, 0]], ["head", [-0.1, 0.05, 0]],
    ["spine2", [0.2, 0.18, 0]], ["spine2", [-0.2, 0.18, 0]], ["spine2", [0, 0.12, 0.13]], ["spine2", [0, 0.12, -0.13]],
    ["spine1", [0.17, 0.02, 0]], ["spine1", [-0.17, 0.02, 0]], ["spine1", [0, 0.05, 0.11]], ["spine1", [0, 0.05, -0.11]],
    ["hips", [0, -0.13, 0]], ["hips", [0.17, -0.03, 0]], ["hips", [-0.17, -0.03, 0]], ["hips", [0, -0.02, -0.12]], ["hips", [0, -0.02, 0.12]],
    ["lThigh", [0.09, -0.2, 0]], ["rThigh", [-0.09, -0.2, 0]], ["lThigh", [0, -0.2, 0.09]], ["rThigh", [0, -0.2, 0.09]],
    ["lThigh", [0, -0.2, -0.09]], ["rThigh", [0, -0.2, -0.09]], ["lArm", [0.06, -0.1, 0]], ["rArm", [-0.06, -0.1, 0]],
  ];
  const proxyMat = new T.MeshBasicMaterial({ visible: false });

  function makeHuman(kind, label) {
    const kit = KITS[kind], geo = humanGeo(kind);
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const bones = BONES.map(([n, , pos]) => { const b = new T.Bone(); b.name = n; b.position.set(pos[0], pos[1], pos[2]); return b; });
    BONES.forEach(([, p], i) => { if (p) bones[BI[p]].add(bones[i]); });
    body.add(bones[0]);
    root.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(bones);
    const mats = {
      skin: skinStd(SKIN, 0.6), jersey: jerseyMat(kind, label), kit: skinStd(hex(kit.jersey), 0.72),
      lower: skinStd(kit.pants != null ? kit.pants : kit.shorts, 0.75), legs: skinStd(kit.socks != null ? kit.socks : 0x222222, 0.75),
      boots: skinStd(kit.boots, 0.5), hair: skinStd(HAIR, 0.9), gloves: skinStd(kit.gloves || 0xffffff, 0.55), cuff: skinStd(0x111111),
    };
    for (const [slot, g] of Object.entries(geo)) {
      const m = new T.SkinnedMesh(g, mats[slot]);
      m.frustumCulled = false;
      m.castShadow = true;
      m.raycast = () => {}; // 클릭 판정은 아래 proxy 상자로
      body.add(m);
      m.bind(skeleton, new T.Matrix4());
    }
    const B = Object.fromEntries(bones.map((b) => [b.name, b]));
    const markers = MARKERS.map(([bone, p]) => { const o = new T.Object3D(); o.position.set(p[0], p[1], p[2]); B[bone].add(o); return o; });
    const proxy = new T.Mesh(geos().proxyBox, proxyMat);
    root.add(proxy);
    const tag = new T.Sprite(new T.SpriteMaterial({ depthTest: false, transparent: true, sizeAttenuation: false }));
    tag.center.set(0.5, 0);
    tag.renderOrder = 10;
    root.add(tag);
    return { root, body, B, markers, proxy, tag };
  }

  /* 포즈: 관절 각도(라디안), 왼쪽 = +x
     sp=[척추 앞숙임, 옆기울기] hd=머리 끄덕임(−는 고개 듦)
     la/ra=[어깨: 앞으로 듦(−) / 뒤로(+), 벌림(왼팔 +, 오른팔 −)] le/re=팔꿈치(− 굽힘)
     ll/rl=[엉덩이: 앞(−)/뒤(+), 벌림] lk/rk=무릎(+ 굽힘)
     b=[몸통 앞숙임, 몸 회전(yaw), 옆으로 눕기(roll, −면 왼쪽으로)] air=공중 높이(m) */
  const POSES = {
    // 골키퍼
    set_low:    { n: "기본자세 · 낮음", g: "기본자세", sp: [0.7, 0], hd: -0.75, la: [-0.35, 0.22], le: -0.25, ra: [-0.35, -0.22], re: -0.25, ll: [-1.05, 0.42], lk: 1.75, rl: [-1.05, -0.42], rk: 1.75 },
    set_high:   { n: "기본자세 · 높음", g: "기본자세", sp: [0.2, 0], hd: -0.2, la: [-0.85, 0.3], le: -1.25, ra: [-0.85, -0.3], re: -1.25, ll: [-0.36, 0.12], lk: 0.6, rl: [-0.36, -0.12], rk: 0.6 },
    gkpass:     { n: "패스", g: "배급", b: [0, 0, -0.08], sp: [0.3, -0.05], hd: -0.55, la: [-0.35, 0.8], le: -0.4, ra: [-0.25, -0.7], re: -0.35, ll: [-0.85, 0.24, 0], lk: 1.45, rl: [-0.5, -0.75, -1.2], rk: 0.95 },
    control:    { n: "컨트롤", g: "배급", sp: [0.42, 0], hd: -0.6, la: [-0.3, 0.6], le: -0.4, ra: [-0.25, -0.55], re: -0.35, ll: [-0.7, 0.1], lk: 1.25, rl: [-0.6, -0.4], rk: 0.75 },
    set:        { n: "기본자세 · 중간", g: "기본자세", sp: [0.42, 0], hd: -0.42, la: [-0.72, 0.3], le: -0.95, ra: [-0.72, -0.3], re: -0.95, ll: [-0.88, 0.13], lk: 1.5, rl: [-0.88, -0.13], rk: 1.5 },
    sidestep:   { n: "사이드 스텝", g: "준비·이동", sp: [0.36, 0.04], hd: -0.36, la: [-0.68, 0.38], le: -0.85, ra: [-0.68, -0.38], re: -0.85, ll: [-0.5, 0.36], lk: 0.9, rl: [-0.62, -0.1], rk: 1.1 },
    run:        { n: "달리기", g: "준비·이동", sp: [0.22, 0], hd: -0.2, la: [0.6, 0.1], le: -1.4, ra: [-0.8, -0.1], re: -1.35, ll: [-0.95, 0.02], lk: 0.8, rl: [0.4, -0.02], rk: 1.3 },
    jump:       { n: "크로스 자세", g: "준비·이동", air: 0.45, sp: [0.04, 0], hd: -0.15, la: [-2.8, 0.14], le: -0.2, ra: [-2.8, -0.14], re: -0.2, ll: [-1.45, 0.06], lk: 1.75, rl: [0.08, -0.03], rk: 0.35 },

    catch_low:  { n: "땅볼 · 서서", g: "캐칭", sp: [1.12, 0], hd: -0.85, la: [-1.25, -0.06], le: -0.18, ra: [-1.25, 0.06], re: -0.18, ll: [-0.45, 0.04], lk: 0.6, rl: [-0.45, -0.04], rk: 0.6 },
    catch_knee: { n: "땅볼 캐칭", g: "캐칭", sp: [1.05, 0], hd: -0.07, la: [-1.3, -0.12], le: -0.2, ra: [-1.3, 0.12], re: -0.2, ll: [-1.2, 0.12], lk: 1.6, rl: [-0.3, 0.32, 0.55], rk: 2.1 },
    catch_mid:  { n: "배 캐칭", g: "캐칭", sp: [1.0, 0], hd: -0.02, la: [-0.75, -0.04], le: [-2.15, -0.24], ra: [-0.75, 0.04], re: [-2.15, 0.24], ll: [-0.95, 0.1], lk: 1.4, rl: [-0.95, -0.1], rk: 1.4 },
    catch_high: { n: "얼굴 캐칭", g: "캐칭", sp: [0.1, 0], hd: -0.35, la: [-1.2, -0.25], le: -1.65, ra: [-1.2, 0.25], re: -1.65, ll: [-0.4, 0.08], lk: 0.65, rl: [-0.4, -0.08], rk: 0.65 },

    dive_low:   { n: "로우 세이빙", g: "세이빙", b: [0.12, 0, -1.47], sp: [0.12, 0.06], hd: -0.1, la: [-2.95, 0.1], le: -0.12, ra: [-2.75, -0.28], re: -0.28, ll: [-0.18, 0.06], lk: 0.32, rl: [-0.85, -0.04], rk: 1.15 },
    dive_mid:   { n: "미들 세이빙", g: "세이빙", air: 0.5, b: [0.08, 0, -1.38], sp: [0.08, 0.1], hd: -0.1, la: [-3.0, 0.08], le: -0.1, ra: [-2.85, -0.2], re: -0.18, ll: [-0.25, 0.08], lk: 0.42, rl: [-0.95, -0.04], rk: 1.25 },
    dive_high:  { n: "하이 세이빙", g: "세이빙", air: 0.95, b: [0, 0, -0.95], sp: [0, 0.16], hd: 0, la: [-3.05, 0.14], le: -0.08, ra: [-2.95, -0.12], re: -0.15, ll: [-0.12, 0.1], lk: 0.38, rl: [-1.0, -0.05], rk: 1.3 },

    kblock:     { n: "블락", g: "1:1", sp: [0.38, 0], hd: -0.35, la: [-0.5, 0.75], le: -0.3, ra: [-0.5, -0.75], re: -0.3, ll: [-0.45, 0.95], lk: 1.0, rl: [0.1, -0.05], rk: 1.62 },
    spread:     { n: "X블락", g: "1:1", sp: [0.45, 0], hd: -0.45, la: [-0.5, 1.2], le: -0.15, ra: [-0.5, -1.2], re: -0.15, ll: [-0.4, 0.7], lk: 0.45, rl: [-0.4, -0.7], rk: 0.45 },
    punch:      { n: "펀칭", g: "1:1", air: 0.4, sp: [0.02, 0], hd: -0.45, la: [-2.85, -0.14], le: -0.08, ra: [-2.85, 0.14], re: -0.08, ll: [-1.35, 0.05], lk: 1.6, rl: [0.02, -0.03], rk: 0.3 },

    throw:      { n: "오버스로우", g: "배급", b: [0, -0.55, 0], sp: [-0.05, 0.12], hd: 0.1, la: [-1.45, 0.3], le: -0.1, ra: [0.3, -1.45], re: [-0.15, -1.6], ll: [-0.6, 0.08], lk: 0.42, rl: [0.45, -0.08], rk: 0.4 },
    roll:       { n: "언더스로우", g: "배급", sp: [0.6, 0], hd: -0.55, la: [-0.6, 0.35], le: -0.35, ra: [-0.25, -0.1], re: -0.15, ll: [-1.1, 0.08], lk: 1.35, rl: [0.25, -0.08], rk: 1.5 },
    kick:       { n: "킥", g: "배급", b: [0, 0, -0.2], sp: [0.12, -0.12], hd: -0.25, la: [-0.85, 1.1], le: -0.35, ra: [0.35, -0.75], re: -0.3, ll: [-0.25, 0.14], lk: 0.5, rl: [0.75, -0.08], rk: 1.45 },

    // 필드 · 코치
    stand:      { n: "서있기", g: "기본", sp: [0.04, 0], hd: 0, la: [0.04, 0.1], le: -0.2, ra: [0.04, -0.1], re: -0.2, ll: [-0.03, 0.05], lk: 0.07, rl: [-0.03, -0.05], rk: 0.07 },
    jockey:     { n: "수비 자세", g: "기본", b: [0, 0.5, 0], sp: [0.35, 0], hd: -0.32, la: [-0.45, 0.5], le: -0.5, ra: [-0.35, -0.48], re: -0.5, ll: [-0.75, 0.2], lk: 1.2, rl: [-0.3, -0.22], rk: 1.05 },
    shoot:      { n: "킥", g: "공격", b: [0, 0, -0.2], sp: [0.12, -0.12], hd: -0.25, la: [-0.85, 1.1], le: -0.35, ra: [0.35, -0.75], re: -0.3, ll: [-0.25, 0.14], lk: 0.5, rl: [0.75, -0.08], rk: 1.45 },
    cross:      { n: "크로스", g: "공격", b: [0, -0.3, -0.06], sp: [0.02, -0.08], hd: -0.1, la: [-0.35, 1.2], le: -0.35, ra: [0.25, -0.6], re: -0.3, ll: [-0.12, 0.06], lk: 0.32, rl: [-1.05, 0.28], rk: 0.4 },
    header:     { n: "헤딩", g: "공격", air: 0.45, sp: [0.32, 0], hd: 0.2, la: [-1.25, 0.55], le: -0.75, ra: [-1.25, -0.55], re: -0.75, ll: [-0.35, 0.05], lk: 1.35, rl: [0.2, -0.05], rk: 1.4 },
    point:      { n: "지시하기", g: "코치", sp: [0.04, 0], hd: -0.05, la: [0.05, 0.12], le: -0.25, ra: [-1.5, -0.12], re: -0.05, ll: [-0.02, 0.07], lk: 0.08, rl: [-0.02, -0.07], rk: 0.08 },
    feed:       { n: "공 던져주기", g: "코치", sp: [0.3, 0], hd: -0.25, la: [-0.9, 0.2], le: -0.55, ra: [-0.85, -0.2], re: -0.55, ll: [-0.6, 0.08], lk: 0.65, rl: [0.25, -0.08], rk: 0.38 },
  };
  // 골키퍼 동작 (팔레트 순서)
  const GK_POSES = ["set_low", "set", "set_high", "catch_high", "catch_mid", "catch_knee", "jump", "dive_low", "dive_mid", "dive_high", "gkpass", "kick", "roll", "throw", "kblock"];
  const FIELD_POSES = ["stand", "run", "jockey", "gkpass", "shoot", "cross", "header", "jump"];
  const COACH_POSES = ["stand", "point", "feed", "gkpass", "shoot", "run"];
  const POSE_LIST = { gk: GK_POSES, own: FIELD_POSES, opp: FIELD_POSES, coach: COACH_POSES };
  const BASE = { b: [0, 0, 0], sp: [0, 0], hd: 0, la: [0, 0], le: [0, 0], ra: [0, 0], re: [0, 0], ll: [0, 0], lk: 0, rl: [0, 0], rk: 0, air: 0 };
  const POSE_KEYS = Object.keys(BASE);

  // 좌우 반전: 왼쪽·오른쪽 관절을 바꾸고 옆 방향 값의 부호를 뒤집음 (등번호가 거꾸로 보이지 않게)
  function mirrorPose(p) {
    const nz = ([x, z]) => [x, -z];
    return {
      ...p,
      b: [p.b[0], -p.b[1], -p.b[2]], sp: nz(p.sp),
      la: nz(p.ra), le: nz(p.re), ra: nz(p.la), re: nz(p.le),
      ll: [p.rl[0], -p.rl[1], -(p.rl[2] || 0)], lk: p.rk, rl: [p.ll[0], -p.ll[1], -(p.ll[2] || 0)], rk: p.lk,
    };
  }
  const RIG_ALIAS = {
    stance_low: "set_low", stance_mid: "set", stance_high: "set_high", catch_face: "catch_high", catch_belly: "catch_mid", catch_ground: "catch_knee",
    cross_ready: "set_high", cross_jump: "jump", cross_catch: "jump", save_low: "dive_low", save_mid: "dive_mid", save_high: "dive_high",
    pass_front: "gkpass", throw_front: "throw", under_front: "roll", kick_long: "kick", kick_forward: "kick", kick_side: "kick",
  };
  function poseParams(id, mirror) {
    const src = POSES[id] || POSES[RIG_ALIAS[id]] || POSES.stand, p = {};
    POSE_KEYS.forEach((k) => { p[k] = src[k] != null ? src[k] : BASE[k]; });
    // 팔꿈치: 숫자 = 앞으로 굽힘, [앞, 옆] = 옆으로도 굽힘
    ["le", "re"].forEach((k) => { if (!Array.isArray(p[k])) p[k] = [p[k], 0]; });
    // 엉덩이: [앞뒤, 벌림, 돌림(발끝 방향)]
    ["ll", "rl"].forEach((k) => { if (p[k].length < 3) p[k] = [p[k][0], p[k][1], 0]; });
    return mirror ? mirrorPose(p) : p;
  }
  function lerpParams(a, b, t) {
    const o = {};
    POSE_KEYS.forEach((k) => { o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => v + (b[k][i] - v) * t) : a[k] + (b[k] - a[k]) * t; });
    return o;
  }

  const _v = V3(), _box = new T.Box3();
  function markerBox(fig, space) {
    _box.makeEmpty();
    fig.markers.forEach((m) => { m.getWorldPosition(_v); if (space) space.worldToLocal(_v); _box.expandByPoint(_v); });
    return _box;
  }

  function applyPoseParams(fig, p) {
    const B = fig.B, body = fig.body;
    body.rotation.set(p.b[0], p.b[1], p.b[2]);
    body.position.set(0, 0, 0);
    B.spine1.rotation.set(p.sp[0] * 0.45, 0, p.sp[1] * 0.5);
    B.spine2.rotation.set(p.sp[0] * 0.55, 0, p.sp[1] * 0.5);
    B.neck.rotation.x = p.hd * 0.45; B.head.rotation.x = p.hd * 0.55;
    // 팔을 높이 들거나 크게 벌리면 어깨(쇄골)도 같이 올라감
    const clav = (a) => 0.18 * Math.max(0, Math.min(1, (-a[0] - 1.4) / 1.5)) + 0.12 * Math.max(0, Math.abs(a[1]) - 0.7);
    B.lClav.rotation.set(0, 0, clav(p.la)); B.rClav.rotation.set(0, 0, -clav(p.ra));
    B.lArm.rotation.set(p.la[0], 0, p.la[1]); B.lFore.rotation.set(p.le[0], 0, p.le[1]); B.lHand.rotation.x = -0.12;
    B.rArm.rotation.set(p.ra[0], 0, p.ra[1]); B.rFore.rotation.set(p.re[0], 0, p.re[1]); B.rHand.rotation.x = -0.12;
    B.lThigh.rotation.set(p.ll[0], p.ll[2] || 0, p.ll[1]); B.lShin.rotation.x = p.lk;
    B.rThigh.rotation.set(p.rl[0], p.rl[2] || 0, p.rl[1]); B.rShin.rotation.x = p.rk;
    // 발은 땅과 평평하게 (옆으로 눕는 다이빙은 자연스럽게 따라감)
    const lying = Math.abs(p.b[2]) > 0.6;
    B.lFoot.rotation.set(lying ? 0.3 : -(p.b[0] + p.ll[0] + p.lk), 0, lying ? 0 : -p.ll[1]);
    B.rFoot.rotation.set(lying ? 0.3 : -(p.b[0] + p.rl[0] + p.rk), 0, lying ? 0 : -p.rl[1]);
    // 땅을 딛는 발(다리를 돌리지 않은 쪽)은 바닥에 평평하게, 발끝은 정면으로
    if (!lying) {
      fig.root.updateMatrixWorld(true);
      const want = fig.root.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(UP, p.b[1]));
      [["lFoot", p.ll], ["rFoot", p.rl]].forEach(([f, leg]) => {
        if (leg[2]) return; // 인사이드로 돌린 발은 그대로
        const parentQ = B[f].parent.getWorldQuaternion(new T.Quaternion());
        B[f].quaternion.copy(parentQ.invert().multiply(want));
      });
    }
    fig.root.updateMatrixWorld(true);
    const box = markerBox(fig, fig.root);
    const lift = -box.min.y + 0.004 + p.air;
    body.position.y = lift;
    // 클릭 판정 상자 · 머리 위 표시
    const c = box.getCenter(V3()), s = box.getSize(V3());
    if (fig.proxy) {
      fig.proxy.position.set(c.x, c.y + lift, c.z);
      fig.proxy.scale.set(Math.max(0.5, s.x + 0.2), s.y + 0.2, Math.max(0.5, s.z + 0.2));
    }
    if (fig.tag) fig.tag.position.y = box.max.y + lift + 0.12;
  }
  const applyPose = (fig, id, mirror) => applyPoseParams(fig, poseParams(id, mirror));

  /* ---------- 2D 인물 ----------
     동작(관절 각도)으로 뼈대 위치를 계산하고, 일지 시점에 맞춰 납작한 일러스트로 그려요.
     디자이너 그림이 생기면 POSE_ART에 "종류:동작" → 이미지 경로를 넣으면 그 그림으로 바뀌어요.
     예) POSE_ART["gk:set"] = "assets/poses/gk-set.png" (오른쪽을 보는 그림 기준) */
  const POSE_ART = {};
  const artCache = new Map();
  function artImage(it) {
    const src = POSE_ART[it.kind + ":" + it.pose];
    if (!src) return null;
    if (!artCache.has(src)) { const im = new Image(); im.src = src; artCache.set(src, im); }
    const im = artCache.get(src);
    return im.complete && im.naturalWidth ? im : null;
  }

  function makeRig() {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const bones = BONES.map(([n, , pos]) => { const b = new T.Bone(); b.name = n; b.position.set(pos[0], pos[1], pos[2]); return b; });
    BONES.forEach(([, p], i) => { if (p) bones[BI[p]].add(bones[i]); });
    body.add(bones[0]);
    const B = Object.fromEntries(bones.map((b) => [b.name, b]));
    const markers = MARKERS.map(([bone, p]) => { const o = new T.Object3D(); o.position.set(p[0], p[1], p[2]); B[bone].add(o); return o; });
    const pts = {
      lTip: ["lHand", [0, -0.15, 0.01]], rTip: ["rHand", [0, -0.15, 0.01]],
      lToe: ["lFoot", [0, -0.055, 0.19]], rToe: ["rFoot", [0, -0.055, 0.19]],
      lHeel: ["lFoot", [0, -0.055, -0.05]], rHeel: ["rFoot", [0, -0.055, -0.05]],
      headC: ["head", [0, 0.06, 0]], nose: ["head", [0, 0.06, 0.25]], headUp: ["head", [0, 0.3, 0]],
      lHipO: ["hips", [0.15, -0.03, 0]], rHipO: ["hips", [-0.15, -0.03, 0]],
      lWaist: ["spine1", [0.15, 0.02, 0]], rWaist: ["spine1", [-0.15, 0.02, 0]],
      chest: ["spine2", [0, 0.1, 0]], chestF: ["spine2", [0, 0.1, 0.3]],
    };
    const X = {};
    for (const [k, [b, p]] of Object.entries(pts)) { const o = new T.Object3D(); o.position.set(p[0], p[1], p[2]); B[b].add(o); X[k] = o; }
    return { root, body, B, markers, X };
  }
  function poseRig(rig, it, params) {
    rig.root.position.set(it.x, 0, it.z);
    rig.root.rotation.y = it.rot || 0;
    applyPoseParams(rig, params || poseParams(it.pose || DEFAULT_POSE[it.kind], it.mirror));
    rig.root.updateMatrixWorld(true);
    return rig;
  }

  const FIG_BOX = new WeakMap(); // 클릭 판정용 화면 영역
  function shade(hexStr, k) {
    const n = parseInt(hexStr.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  const css = (c) => (typeof c === "number" ? "#" + c.toString(16).padStart(6, "0") : c);

  // g: 2D 캔버스, cam: 카메라, proj: 월드→화면, rig: 포즈 적용된 뼈대
  function drawFigure(g, cam, proj, it, rig, opts = {}) {
    const kit = KITS[it.kind];
    const B = rig.B, X = rig.X;
    const wp = (o) => o.getWorldPosition(V3());
    const J = {
      hip: wp(B.hips), neck: wp(B.neck), head: wp(X.headC), nose: wp(X.nose), headUp: wp(X.headUp), chest: wp(X.chest), chestF: wp(X.chestF),
      lSh: wp(B.lArm), rSh: wp(B.rArm), lEl: wp(B.lFore), rEl: wp(B.rFore), lWr: wp(B.lHand), rWr: wp(B.rHand), lTip: wp(X.lTip), rTip: wp(X.rTip),
      lHp: wp(B.lThigh), rHp: wp(B.rThigh), lKn: wp(B.lShin), rKn: wp(B.rShin), lAn: wp(B.lFoot), rAn: wp(B.rFoot),
      lToe: wp(X.lToe), rToe: wp(X.rToe), lHeel: wp(X.lHeel), rHeel: wp(X.rHeel), lHipO: wp(X.lHipO), rHipO: wp(X.rHipO), lWaist: wp(X.lWaist), rWaist: wp(X.rWaist),
    };
    // 선수는 원근 왜곡 없이 그림: 발밑 위치만 실제 원근으로 잡고, 몸은 카메라 방향 기준으로 평행 투영
    // → 화면 어디로 드래그해도 같은 방향이면 같은 모습(얼굴·몸이 돌아가 보이지 않음)
    {
      const proj0 = proj;
      const R = V3().setFromMatrixColumn(cam.matrixWorld, 0).normalize(), U = V3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
      const gp = V3(it.x, 0, it.z), base = proj0(gp), br = proj0(gp.clone().add(R));
      const sc = Math.hypot(br[0] - base[0], br[1] - base[1]);
      proj = (v) => { const d = v.clone().sub(gp); return [base[0] + d.dot(R) * sc, base[1] - d.dot(U) * sc]; };
    }
    const S = {};
    for (const k in J) S[k] = proj(J[k]);
    const depth = (v) => v.clone().applyMatrix4(cam.matrixWorldInverse).z;
    const up = J.hip.clone(); up.y += 1;
    const pu = proj(up);
    const m = Math.hypot(pu[0] - S.hip[0], pu[1] - S.hip[1]); // 1m = m px
    const OL = "#151515", ow = Math.max(1.2, m * 0.018);
    const op = it.op == null ? 1 : it.op;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    Object.values(S).forEach(([x, y]) => { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); });
    const pad = m * 0.12;
    FIG_BOX.set(it, [box[0] - pad, box[1] - m * 0.18, box[2] + pad, box[3] + pad, depth(J.hip)]);

    g.save();
    g.globalAlpha = op;
    const sh = proj(V3(J.hip.x, 0.01, J.hip.z));
    // 넓은 경기장(하프·풀)에서는 선수를 크게 그려서 전술판처럼 알아보기 쉽게
    const k = opts.scale || 1;
    if (k !== 1) {
      g.translate(sh[0], sh[1]); g.scale(k, k); g.translate(-sh[0], -sh[1]);
      const b = FIG_BOX.get(it);
      FIG_BOX.set(it, [sh[0] + (b[0] - sh[0]) * k, sh[1] + (b[1] - sh[1]) * k, sh[0] + (b[2] - sh[0]) * k, sh[1] + (b[3] - sh[1]) * k, b[4]]);
    }
    // 그림자
    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath(); g.ellipse(sh[0], sh[1], m * 0.34, m * 0.13, 0, 0, Math.PI * 2); g.fill();

    // 디자이너 그림이 있으면 그것으로
    const art = artImage(it);
    if (art) {
      const h = m * 1.9, w = h * art.naturalWidth / art.naturalHeight;
      const facingRight = S.nose[0] >= S.head[0];
      g.translate(sh[0], sh[1]);
      if (!facingRight) g.scale(-1, 1);
      g.drawImage(art, -w / 2, -h, w, h);
      g.restore();
      FIG_BOX.set(it, [sh[0] - w / 2, sh[1] - h, sh[0] + w / 2, sh[1], depth(J.hip)]);
      return;
    }

    // 납작한 벡터 일러스트: 굵기가 변하는 팔다리 + 테두리 없음 + 뒤쪽 팔다리는 조금 어둡게
    const jersey = kit.jersey, ink = kit.ink;
    const SKC = "#eab18c";
    const lower = css(kit.pants != null ? kit.pants : kit.shorts);
    const socks = css(kit.pants != null ? kit.pants : kit.socks), boots = "#1b1b1b";
    const long = kit.sleeves === "long", pants = kit.pants != null;
    const far = depth(J.lHp) + depth(J.lSh) < depth(J.rHp) + depth(J.rSh) ? "l" : "r";
    const toHex = (c) => { const m2 = /rgb\((\d+),(\d+),(\d+)\)/.exec(c); return m2 ? "#" + [m2[1], m2[2], m2[3]].map((v) => (+v).toString(16).padStart(2, "0")).join("") : c; };
    const tone = (c, p) => (p === far ? toHex(shade(c, 0.86)) : c);
    const parts = [];
    const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const add = (d, fn) => parts.push({ d, fn });
    // 일러스트 스타일: 얇은 남색 외곽선 + 한쪽 그늘(셀 음영)
    const OUT = "#141a28", LW = Math.max(0.9, m * 0.015);
    // rm: 가운데 근육 볼륨(허벅지·종아리·이두) — 옆선을 곡선으로
    const limbPath = (a, b, ra, rb, ox = 0, oy = 0, rm = 0) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 0.001;
      const nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
      const mx = (a[0] + b[0]) / 2 + ox, my = (a[1] + b[1]) / 2 + oy;
      const ctl = (sg) => { const r = rm || (ra + rb) / 2; const q = 2 * r - (ra + rb) / 2; return [mx + nx * q * sg, my + ny * q * sg]; };
      g.beginPath();
      g.moveTo(a[0] + nx * ra + ox, a[1] + ny * ra + oy);
      const c1 = ctl(1); g.quadraticCurveTo(c1[0], c1[1], b[0] + nx * rb + ox, b[1] + ny * rb + oy);
      g.arc(b[0] + ox, b[1] + oy, rb, an, an - Math.PI, true);
      const c2 = ctl(-1); g.quadraticCurveTo(c2[0], c2[1], a[0] - nx * ra + ox, a[1] - ny * ra + oy);
      g.arc(a[0] + ox, a[1] + oy, ra, an - Math.PI, an - 2 * Math.PI, true);
      g.closePath();
      return [nx, ny];
    };
    // 부위(다리·팔·몸통·머리)마다 바깥 윤곽선을 먼저 그리고 그 위에 색을 칠해서, 관절 이음새 선이 생기지 않게
    let pass = "fill";
    const TH = 1.22; // 몸 두께 (일러스트 비율)
    // 끝이 반듯하게 잘린 조각: 반바지 · 양말 · 소매 끝단 (a쪽 둥글게 여부 선택)
    const piece = (a, b, ra, rb, color, roundA = true) => {
      ra *= m * TH; rb *= m * TH;
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 0.001;
      const nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
      const path = (k) => {
        g.beginPath();
        g.moveTo(a[0] + nx * (ra + k), a[1] + ny * (ra + k));
        g.lineTo(b[0] + nx * (rb + k), b[1] + ny * (rb + k));
        g.lineTo(b[0] - nx * (rb + k), b[1] - ny * (rb + k));
        g.lineTo(a[0] - nx * (ra + k), a[1] - ny * (ra + k));
        if (roundA) g.arc(a[0], a[1], ra + k, an - Math.PI, an - 2 * Math.PI, true);
        g.closePath();
      };
      if (pass === "out") { path(0); g.fillStyle = OUT; g.lineWidth = LW * 2; g.strokeStyle = OUT; g.lineJoin = "round"; g.fill(); g.stroke(); return; }
      path(0); g.fillStyle = color; g.fill();
      // 끝단 선
      g.strokeStyle = OUT; g.lineWidth = LW; g.beginPath(); g.moveTo(b[0] + nx * rb, b[1] + ny * rb); g.lineTo(b[0] - nx * rb, b[1] - ny * rb); g.stroke();
    };
    // 축구화: 발 모양 + 밑창 + 스터드
    const boot = (heel, toe, an, color) => {
      const dx = toe[0] - heel[0], dy = toe[1] - heel[1], L = Math.hypot(dx, dy) || 0.001;
      const ux = dx / L, uy = dy / L;
      let vx = an[0] - heel[0], vy = an[1] - heel[1];
      const along = vx * ux + vy * uy; vx -= ux * along; vy -= uy * along;
      const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl; // 발등 방향
      const h = m * 0.085 * TH, Lx = L * 1.3;
      const P = (a, b) => [heel[0] + ux * a * Lx + vx * b * h, heel[1] + uy * a * Lx + vy * b * h];
      const shape = () => {
        g.beginPath();
        let q = P(-0.12, -0.45); g.moveTo(q[0], q[1]);
        q = P(0.92, -0.45); g.lineTo(q[0], q[1]);
        let c = P(1.12, -0.4), e = P(1.05, 0.15); g.quadraticCurveTo(c[0], c[1], e[0], e[1]);
        c = P(0.75, 0.75); e = P(0.35, 0.95); g.quadraticCurveTo(c[0], c[1], e[0], e[1]);
        q = P(-0.02, 1.15); g.lineTo(q[0], q[1]);
        c = P(-0.22, 0.4); e = P(-0.12, -0.45); g.quadraticCurveTo(c[0], c[1], e[0], e[1]);
        g.closePath();
      };
      if (pass === "out") { shape(); g.fillStyle = OUT; g.lineWidth = LW * 2; g.strokeStyle = OUT; g.lineJoin = "round"; g.fill(); g.stroke(); return; }
      shape(); g.fillStyle = color; g.fill();
      // 밑창 · 스터드
      const s0 = P(-0.1, -0.28), s1 = P(0.95, -0.28);
      g.strokeStyle = "#555"; g.lineWidth = Math.max(0.7, h * 0.18); g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); g.stroke();
      g.fillStyle = OUT; [0.1, 0.45, 0.8].forEach((t) => { const st = P(t, -0.62); g.beginPath(); g.arc(st[0], st[1], Math.max(0.6, h * 0.14), 0, Math.PI * 2); g.fill(); });
    };
    // 손: 손바닥 + 네 손가락(구분선) + 엄지. 골키퍼는 크고 두툼한 장갑
    // p: "l"|"r". 손바닥 방향(3D)을 계산해서 손바닥/손등, 손 폭(옆으로 보이면 좁게), 엄지 쪽을 정함
    const handView = (p) => {
      const wr3 = J[p + "Wr"], tip3 = J[p + "Tip"];
      const along = tip3.clone().sub(wr3).normalize();
      // 캐칭·세이빙·준비 자세는 손바닥이 공(몸 앞)을 향함, 그 외에는 몸 안쪽을 향함
      const catching = it.kind === "gk" && !/^(run|throw|roll|gkpass|kick)$/.test(it.pose || "");
      const bodyFwd = fwdV.clone(); bodyFwd.y = 0; bodyFwd.normalize();
      const inward = J.chest.clone().sub(wr3); inward.y = 0; inward.normalize();
      let palm = (catching ? bodyFwd : inward).clone().addScaledVector(along, -along.dot(catching ? bodyFwd : inward));
      if (palm.lengthSq() < 1e-4) palm = inward; palm.normalize();
      const toCam = cam.getWorldDirection(V3()).negate();
      const facing = palm.dot(toCam);                       // + 손바닥이 보임, − 손등이 보임
      // 엄지: 손바닥 방향과 손가락 방향에 수직, 몸 안쪽(왼손은 −x쪽)
      let th3 = new T.Vector3().crossVectors(along, palm).normalize();
      if (th3.dot(inward) < 0) th3.negate();
      if (catching) { const up = V3(0, 1, 0); if (Math.abs(along.dot(up)) > 0.5 && th3.dot(inward) < 0) th3.negate(); }
      const a2 = proj(wr3), b2 = proj(wr3.clone().addScaledVector(th3, 0.1));
      return { facing, thumbScreen: [b2[0] - a2[0], b2[1] - a2[1]] };
    };
    const hand = (wr, tip, side, color, gk, hv) => {
      const dx = tip[0] - wr[0], dy = tip[1] - wr[1], Lr = Math.hypot(dx, dy) || 1;
      const ux = dx / Lr, uy = dy / Lr;
      if (hv) side = (hv.thumbScreen[0] * -uy + hv.thumbScreen[1] * ux) >= 0 ? 1 : -1;
      const vx = -uy * side, vy = ux * side;
      const wk = hv ? 0.5 + 0.5 * Math.abs(hv.facing) : 1;   // 옆으로 보이면 손이 좁게
      const L = m * (gk ? 0.23 : 0.17), Wd = m * (gk ? 0.145 : 0.085) * wk;
      const P = (a, b) => [wr[0] + ux * a * L + vx * b * Wd, wr[1] + uy * a * L + vy * b * Wd];
      const shape = () => {
        g.beginPath();
        let q = P(0, -0.42); g.moveTo(q[0], q[1]);
        q = P(0.5, -0.52); g.lineTo(q[0], q[1]);
        let c = P(1.05, -0.55), e = P(1.08, 0); g.quadraticCurveTo(c[0], c[1], e[0], e[1]);
        c = P(1.05, 0.55); e = P(0.5, 0.52); g.quadraticCurveTo(c[0], c[1], e[0], e[1]);
        q = P(0, 0.42); g.lineTo(q[0], q[1]);
        c = P(-0.08, 0); e = P(0, -0.42); g.quadraticCurveTo(c[0], c[1], e[0], e[1]);
        g.closePath();
      };
      const thumb = () => {
        const a = P(0.25, 0.4), b = P(0.62, 0.9);
        const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / tl, ty = (b[1] - a[1]) / tl, r = Wd * 0.22;
        g.beginPath(); g.moveTo(a[0] - ty * r, a[1] + tx * r); g.lineTo(b[0] - ty * r, b[1] + tx * r);
        g.arc(b[0], b[1], r, Math.atan2(tx, -ty), Math.atan2(tx, -ty) + Math.PI, true);
        g.lineTo(a[0] + ty * r, a[1] - tx * r); g.closePath();
      };
      if (pass === "out") {
        g.fillStyle = OUT; g.strokeStyle = OUT; g.lineWidth = LW * 2; g.lineJoin = "round";
        shape(); g.fill(); g.stroke(); thumb(); g.fill(); g.stroke();
        return;
      }
      const palmSide = !hv || hv.facing >= 0;
      // 손등이 보이면 엄지가 손 뒤로 → 먼저(아래에) 그림, 손바닥이 보이면 엄지가 앞으로
      if (!palmSide) { thumb(); g.fillStyle = toHex(shade(color, 0.85)); g.fill(); }
      shape(); g.fillStyle = color; g.fill();
      g.strokeStyle = gk ? "rgba(20,26,40,.45)" : "rgba(120,60,40,.45)"; g.lineWidth = Math.max(0.6, LW * 0.7); g.lineCap = "round";
      [-0.26, 0, 0.26].forEach((b) => { const a0 = P(palmSide ? 0.66 : 0.72, b * 0.95), a1 = P(1.0, b * 1.05); g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke(); });
      if (palmSide) {
        // 손바닥: 장갑은 넓은 손바닥 패드 + 주름, 맨손은 손바닥 주름
        if (gk) {
          g.fillStyle = "rgba(160,170,185,.35)";
          g.beginPath(); const c0 = P(0.42, 0); g.ellipse(c0[0], c0[1], Wd * 0.38, L * 0.2, Math.atan2(uy, ux), 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = gk ? "rgba(20,26,40,.35)" : "rgba(120,60,40,.4)";
        const c1 = P(0.3, -0.25), c2 = P(0.5, 0.05), c3 = P(0.42, 0.3);
        g.beginPath(); g.moveTo(c1[0], c1[1]); g.quadraticCurveTo(c2[0], c2[1], c3[0], c3[1]); g.stroke();
        thumb(); g.fillStyle = color; g.fill(); g.lineWidth = Math.max(0.7, LW * 0.8); g.strokeStyle = OUT; g.stroke();
      } else if (gk) {
        // 장갑 손등: 브랜드 띠
        const a0 = P(0.35, -0.4), a1 = P(0.35, 0.4); g.strokeStyle = "#1c1c1c"; g.lineWidth = Math.max(1, m * 0.02); g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke();
      }
      if (gk) { const a0 = P(0.18, -0.46), a1 = P(0.18, 0.46); g.strokeStyle = "rgba(20,26,40,.5)"; g.lineWidth = Math.max(0.8, LW); g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke(); }
    };
    const limb = (a, b, ra, rb, color, opt = {}) => {
      ra *= m * TH; rb *= m * TH;
      const rm = (opt.rm || 0) * m * TH;
      if (pass === "out") { limbPath(a, b, ra, rb, 0, 0, rm); g.fillStyle = OUT; g.fill(); g.lineWidth = LW * 2; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke(); return; }
      const [nx, ny] = limbPath(a, b, ra, rb, 0, 0, rm);
      if (opt.flat) { g.fillStyle = color; g.fill(); return; }
      // 원통처럼: 빛 받는 쪽 밝게 → 반대쪽 어둡게 (팔다리 방향에 수직)
      const sg = nx * -0.55 + ny * -0.83 > 0 ? 1 : -1, R = Math.max(ra, rb, rm || 0);
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      const gr = g.createLinearGradient(cx + nx * sg * R, cy + ny * sg * R, cx - nx * sg * R, cy - ny * sg * R);
      gr.addColorStop(0, toHex(shade(color, 1.13))); gr.addColorStop(0.42, color); gr.addColorStop(1, toHex(shade(color, 0.7)));
      g.fillStyle = gr; g.fill();
    };

    // 팔·다리를 관절마다 끊지 않고 한 덩어리 실루엣(부드러운 곡선)으로 그림
    const chainPath = (pts, rads) => {
      const n = pts.length, L = [], R = [];
      for (let k = 0; k < n; k++) {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const r = rads[k] * m * TH;
        L.push([pts[k][0] - dy * r, pts[k][1] + dx * r]); R.push([pts[k][0] + dy * r, pts[k][1] - dx * r]);
      }
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const side = (A) => { for (let k = 1; k < A.length - 1; k++) { const e = mid(A[k], A[k + 1]); g.quadraticCurveTo(A[k][0], A[k][1], e[0], e[1]); } g.lineTo(A[A.length - 1][0], A[A.length - 1][1]); };
      const cap = (c, r, from, to) => { const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]), a1 = Math.atan2(to[1] - c[1], to[0] - c[0]); let d = a1 - a0; while (d <= 0) d += Math.PI * 2; g.arc(c[0], c[1], r, a0, a0 + d - Math.PI * 2 * (d > Math.PI * 1.5 ? 1 : 0), d > Math.PI * 1.5); };
      g.beginPath();
      g.moveTo(L[0][0], L[0][1]); side(L);
      g.arc(pts[n - 1][0], pts[n - 1][1], rads[n - 1] * m * TH, Math.atan2(L[n - 1][1] - pts[n - 1][1], L[n - 1][0] - pts[n - 1][0]), Math.atan2(R[n - 1][1] - pts[n - 1][1], R[n - 1][0] - pts[n - 1][0]), true);
      const RR = R.slice().reverse(); g.lineTo(RR[0][0], RR[0][1]); side(RR);
      g.arc(pts[0][0], pts[0][1], rads[0] * m * TH, Math.atan2(R[0][1] - pts[0][1], R[0][0] - pts[0][0]), Math.atan2(L[0][1] - pts[0][1], L[0][0] - pts[0][0]), true);
      g.closePath();
      void cap;
    };
    // 팔다리 축을 따라 t0~t1 구간만 색칠 (반바지·양말·소매)
    const band = (pts, t0, t1, color) => {
      const seg = []; let tot = 0;
      for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(l); tot += l; }
      const at = (t) => { let d = t * tot; for (let k = 0; k < seg.length; k++) { if (d <= seg[k] || k === seg.length - 1) return [lerp2(pts[k], pts[k + 1], Math.min(1, d / (seg[k] || 1))), [pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]]]; d -= seg[k]; } };
      const W = m * 0.6, quad = [];
      [[t0, 1], [t1, 1], [t1, -1], [t0, -1]].forEach(([t, sg]) => { const [p0, d] = at(t); const l = Math.hypot(d[0], d[1]) || 1; quad.push([p0[0] - d[1] / l * W * sg + (t === 0 ? -d[0] / l * W : t === 1 ? d[0] / l * W : 0), p0[1] + d[0] / l * W * sg + (t === 0 ? -d[1] / l * W : t === 1 ? d[1] / l * W : 0)]); });
      g.beginPath(); quad.forEach((q, k) => g[k ? "lineTo" : "moveTo"](q[0], q[1])); g.closePath(); g.fillStyle = color; g.fill();
    };
    const chain = (pts, rads, base, bands = []) => {
      if (pass === "out") { chainPath(pts, rads); g.fillStyle = OUT; g.fill(); g.lineWidth = LW * 2; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke(); return; }
      g.save(); chainPath(pts, rads); g.clip();
      chainPath(pts, rads); g.fillStyle = base; g.fill();
      bands.forEach(([t0, t1, c]) => band(pts, t0, t1, c));
      // 원통 명암
      const a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, sg = nx * -0.55 + ny * -0.83 > 0 ? 1 : -1, R = Math.max(...rads) * m * TH;
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      const gr = g.createLinearGradient(cx + nx * sg * R, cy + ny * sg * R, cx - nx * sg * R, cy - ny * sg * R);
      gr.addColorStop(0, "rgba(255,255,255,.16)"); gr.addColorStop(0.45, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.26)");
      chainPath(pts, rads); g.fillStyle = gr; g.fill();
      g.restore();
    };

    ["l", "r"].forEach((p) => {
      const hp = S[p + "Hp"], kn = S[p + "Kn"], an = S[p + "An"];
      const skin = tone(SKC, p);
      add((depth(J[p + "Hp"]) + depth(J[p + "An"])) / 2, () => {
        // 허벅지(근육) → 무릎 → 종아리 → 발목 을 하나의 다리로
        const legPts = [hp, lerp2(hp, kn, 0.45), kn, lerp2(kn, an, 0.32), an];
        const legR = [0.088, 0.088, 0.058, 0.064, 0.038];
        chain(legPts, legR, skin, pants ? [[0, 1, tone(lower, p)]] : [[0, 0.24, tone(lower, p)], [0.55, 1, tone(socks, p)]]);
        boot(S[p + "Heel"], S[p + "Toe"], an, boots);
      });
      const sh = S[p + "Sh"], el = S[p + "El"], wr = S[p + "Wr"], tip = S[p + "Tip"];
      add((depth(J[p + "Sh"]) + depth(J[p + "Wr"])) / 2 + 0.001, () => {
        const armPts = [sh, lerp2(sh, el, 0.45), el, lerp2(el, wr, 0.4), wr];
        const armR = [0.062, 0.05, 0.036, 0.039, 0.028]; // 어깨는 살짝, 팔은 가늘게
        chain(armPts, armR, long ? tone(jersey, p) : skin, long ? [] : [[0, 0.24, tone(jersey, p)]]);
        if (it.kind === "gk") hand(wr, tip, p === "l" ? 1 : -1, tone("#f4f4f4", p), true, handView(p));
        else hand(wr, tip, p === "l" ? 1 : -1, skin, false, handView(p));
      });
    });
    // 몸통: 가슴·등 두께를 가진 3D 상자를 화면에 투영해 외곽(볼록 껍질)을 만듦 → 돌려도 두께가 보임
    const fwdV = J.chestF.clone().sub(J.chest).normalize();
    const VIEW = cam.getWorldDirection(V3()).negate(); // 카메라를 향하는 방향 (선수 위치와 무관)
    const T3 = [];
    {
      const sideV = J.lSh.clone().sub(J.rSh).normalize(), upV = J.neck.clone().sub(J.chest).normalize();
      [[1, "lSh"], [-1, "rSh"]].forEach(([sg, k]) => {
        // 어깨 끝(삼각근)을 바깥·위로, 목 옆 승모근 라인
        const tip = J[k].clone().addScaledVector(sideV, sg * 0.04).addScaledVector(upV, 0.02);
        const trap = J[k].clone().addScaledVector(sideV, -sg * 0.09).addScaledVector(upV, 0.06);
        [tip, trap].forEach((q) => T3.push(q.clone().addScaledVector(fwdV, 0.06), q.clone().addScaledVector(fwdV, -0.05)));
      });
    }
    [["lSh", 0.075, 0.06], ["rSh", 0.075, 0.06], ["lWaist", 0.085, 0.07], ["rWaist", 0.085, 0.07], ["lHipO", 0.085, 0.065], ["rHipO", 0.085, 0.065]].forEach(([k, f, b]) => {
      T3.push(J[k].clone().addScaledVector(fwdV, f), J[k].clone().addScaledVector(fwdV, -b));
    });
    const hull = (P) => {
      const a = P.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
      const lo = [], up = [];
      a.forEach((p) => { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
      a.slice().reverse().forEach((p) => { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
      return lo.slice(0, -1).concat(up.slice(0, -1));
    };
    const tcen = proj(J.chest);
    const tpts = hull(T3.map(proj)).map((pt) => { const dx = pt[0] - tcen[0], dy = pt[1] - tcen[1], l = Math.hypot(dx, dy) || 1; return [pt[0] + dx / l * m * 0.03, pt[1] + dy / l * m * 0.03]; });
    const midP = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const torsoPath = () => {
      const st = midP(tpts[tpts.length - 1], tpts[0]);
      g.beginPath(); g.moveTo(st[0], st[1]);
      tpts.forEach((pt, k) => { const nx = midP(pt, tpts[(k + 1) % tpts.length]); g.quadraticCurveTo(pt[0], pt[1], nx[0], nx[1]); });
      g.closePath();
    };
    // 빛 방향(화면): 왼쪽 위에서. 원통 음영용 그라데이션
    const LX = -0.55, LY = -0.83;
    const volume = (cx, cy, rad, color) => {
      const gr = g.createLinearGradient(cx + LX * rad, cy + LY * rad, cx - LX * rad, cy - LY * rad);
      gr.addColorStop(0, toHex(shade(color, 1.12)));
      gr.addColorStop(0.45, color);
      gr.addColorStop(1, toHex(shade(color, 0.72)));
      return gr;
    };
    add(depth(J.chest), () => {
      limb(S.lHipO, S.rHipO, 0.072, 0.072, lower);
      if (pass === "out") { torsoPath(); g.fillStyle = OUT; g.fill(); g.lineWidth = LW * 2; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke(); return; }
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      tpts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      torsoPath(); g.fillStyle = volume((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2, jersey); g.fill();
      // 옆구리 면(몸이 돌면 넓어지는 측면)을 조금 더 어둡게
      const sideAmt = 1 - Math.abs(fwdV.dot(VIEW));
      if (sideAmt > 0.15) {
        g.save(); torsoPath(); g.clip();
        const rs = proj(J.chest.clone().addScaledVector(fwdV, -0.12));
        g.fillStyle = `rgba(0,0,0,${0.16 * sideAmt})`;
        g.beginPath(); g.ellipse(rs[0], rs[1], m * 0.12, m * 0.35, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      const pts = tpts, st = midP(tpts[tpts.length - 1], tpts[0]), mid = midP; void pts; void st; void mid;
      // 골키퍼 상의: 대각선 띠
      if (kit.sash) {
        g.save(); torsoPath(); g.clip();
        const a0 = lerp2(S.lSh, S.rSh, -0.1), b0 = lerp2(S.rHipO, S.lHipO, -0.15);
        g.lineCap = "butt"; g.lineWidth = m * 0.075; g.strokeStyle = kit.sash;
        g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(b0[0], b0[1]); g.stroke();
        g.restore();
      }

      // 칼라 (앞에서 보일 때만 V넥)
      const frontVis = fwdV.dot(VIEW) > 0.15;
      const nk = lerp2(S.lSh, S.rSh, 0.5), cw = Math.hypot(S.lSh[0] - S.rSh[0], S.lSh[1] - S.rSh[1]) * 0.22;
      const dn = lerp2(nk, lerp2(S.lHipO, S.rHipO, 0.5), 0.12);
      if (frontVis) { g.beginPath(); g.moveTo(nk[0] - cw, nk[1]); g.lineTo(dn[0], dn[1]); g.lineTo(nk[0] + cw, nk[1]);
        g.lineWidth = LW * 1.6; g.strokeStyle = toHex(shade(jersey, 0.6)); g.stroke(); }
      const camDir = VIEW, fwd = J.chestF.clone().sub(J.chest);
      const back = fwd.dot(camDir) < 0;
      const label = kit.text || it.label;
      if (kit.text && back) { // 등번호 없음 · 코치만 등에 C
        const c = lerp2(lerp2(S.lSh, S.rSh, 0.5), lerp2(S.lHipO, S.rHipO, 0.5), 0.4);
        const tw = Math.hypot(S.lSh[0] - S.rSh[0], S.lSh[1] - S.rSh[1]);
        // 몸을 숙여 등이 짧게 보이면 번호도 작게, 몸통 밖으로는 안 나가게
        const th = Math.hypot(lerp2(S.lSh, S.rSh, 0.5)[0] - lerp2(S.lHipO, S.rHipO, 0.5)[0], lerp2(S.lSh, S.rSh, 0.5)[1] - lerp2(S.lHipO, S.rHipO, 0.5)[1]);
        const fs = Math.min(kit.text && kit.text.length > 1 ? Math.min(m * 0.11, tw / (kit.text.length * 0.62)) : m * 0.2, th * 0.42, tw * 0.6);
        if (fs < 4) return;
        g.save(); torsoPath(); g.clip();
        g.fillStyle = ink;
        g.font = `900 ${fs}px "Arial Black", Arial, sans-serif`;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(kit.text ? kit.text : label, c[0], c[1]);
        g.restore();
      }
    });
    // 목 · 머리 — 일러스트 스타일 (갸름한 얼굴 · 턱 · 귀 · 머리카락 · 눈 · 눈썹 · 코 · 입)
    add(depth(J.head), () => {
      limb(lerp2(S.lSh, S.rSh, 0.5), lerp2(lerp2(S.lSh, S.rSh, 0.5), S.head, 0.85), 0.07, 0.06, toHex(shade(SKC, 0.86)), { flat: true });
      const r = m * 0.152; // 머리 크기는 모든 자세에서 똑같이 (기본자세 낮음 기준)
      const camDir = VIEW, fwd = J.nose.clone().sub(J.head).normalize();
      // 고개 숙임(tilt)과 좌우 돌림(fr)을 따로 계산 → 숙여도 옆모습으로 바뀌지 않음
      const camUp = V3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
      const tilt = Math.max(0, Math.min(1, -fwd.dot(camUp) * 1.8));
      // 좌우 방향은 고개(코)가 아니라 몸(골반) 기준 → 깊이 숙인 자세에서도 얼굴이 돌아가 보이지 않음
      const hipLine = J.lHp.clone().sub(J.rHp); hipLine.y = 0;
      const fwdH = new T.Vector3().crossVectors(hipLine, V3(0, 1, 0)).normalize().negate();
      if (fwdH.dot(fwd) < 0) fwdH.negate();
      const frH = fwdH.dot(camDir);  // 고개 숙임을 뺀 좌우 방향
      // 몸이 카메라를 거의 정면으로 보면 고개를 숙여도 항상 정면(정수리 보임)으로, 그 외 측면·대각선은 예전 방식
      const fr = frH > 0.85 ? frH : fwd.dot(camDir);
      // 얼굴이 화면 왼쪽/오른쪽 중 어디를 보는지: 카메라 기준 3D 방향으로 판단 → 드래그로 옮겨도 바뀌지 않음
      const camRight = V3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      const faceSide = fwdH.dot(camRight) >= 0 ? 1 : -1;
      const upv = [S.headUp[0] - S.head[0], S.headUp[1] - S.head[1]], ul = Math.hypot(upv[0], upv[1]) || 1;
      const ux = upv[0] / ul, uy = upv[1] / ul, px = -uy, py = ux;          // 화면에서 머리 위 · 옆 방향
      const n = [S.nose[0] - S.head[0], S.nose[1] - S.head[1]];
      const turn = Math.max(-1, Math.min(1, (n[0] * px + n[1] * py) / (r * 1.4))); // 얼굴이 옆으로 돈 정도
      const H = (x, y) => [S.head[0] + px * x * r + ux * y * r, S.head[1] + py * x * r + uy * y * r];
      // 옆으로 돌면(정면도 뒤도 아니면) 확실한 옆모습: 이마 · 코 · 입술 · 턱 실루엣 + 귀 + 눈 하나
      if (Math.abs(fr) < 0.5) {
        const sg = faceSide;
        const P = (x, y) => H(x * sg, y);
        const prof = [[-0.95, 0.1], [-0.82, 0.62], [-0.35, 0.98], [0.2, 1.02], [0.62, 0.8], [0.84, 0.42], [0.86, 0.14], [0.84, 0.02], [1.08, -0.22], [1.1, -0.27], [0.88, -0.33], [0.9, -0.44], [0.85, -0.52], [0.86, -0.6], [0.8, -0.78], [0.55, -0.92], [0.18, -0.9], [-0.25, -0.72], [-0.6, -0.55], [-0.88, -0.25]];
        const sharp = new Set([8, 9, 10, 12]); // 코끝 · 입술은 각지게
        const profPath = () => {
          const pts = prof.map(([x, y]) => P(x, y)), mid = (A, B) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
          g.beginPath(); let st = mid(pts[pts.length - 1], pts[0]); g.moveTo(st[0], st[1]);
          pts.forEach((pt, i) => { const nx = mid(pt, pts[(i + 1) % pts.length]); if (sharp.has(i)) { g.lineTo(pt[0], pt[1]); g.lineTo(nx[0], nx[1]); } else g.quadraticCurveTo(pt[0], pt[1], nx[0], nx[1]); });
          g.closePath();
        };
        if (pass === "out") { g.fillStyle = OUT; g.strokeStyle = OUT; g.lineWidth = LW * 2; g.lineJoin = "round"; profPath(); g.fill(); g.stroke(); return; }
        profPath(); g.fillStyle = SKC; g.fill();
        g.save(); profPath(); g.clip();
        g.fillStyle = "rgba(120,60,30,.12)"; const jc = P(0.1, -0.7); g.beginPath(); g.ellipse(jc[0], jc[1], r * 0.7, r * 0.3, 0, 0, Math.PI * 2); g.fill();
        // 머리카락: 뒤통수 · 정수리 · 구레나룻
        g.fillStyle = "#3b2a1e";
        const hair = [[-1.3, -0.5], [-1.3, 1.4], [1.3, 1.4], [0.82, 0.6], [0.45, 0.62], [0.1, 0.5], [-0.12, 0.3], [-0.05, -0.05], [-0.3, -0.2], [-0.62, -0.3], [-0.85, -0.5]].map(([x, y]) => P(x, y));
        g.beginPath(); hair.forEach((q, i) => g[i ? "lineTo" : "moveTo"](q[0], q[1])); g.closePath(); g.fill();
        g.restore();
        // 귀
        const ec = P(-0.18, -0.02);
        g.beginPath(); g.ellipse(ec[0], ec[1], r * 0.16, r * 0.25, Math.atan2(uy, ux), 0, Math.PI * 2); g.fillStyle = toHex(shade(SKC, 0.92)); g.fill();
        g.lineWidth = Math.max(0.7, LW * 0.8); g.strokeStyle = OUT; g.stroke();
        if (r > 3) {
          g.lineCap = "round";
          const e = P(0.58, 0.04);
          if (r > 9) { g.fillStyle = "#fff"; g.beginPath(); g.ellipse(e[0], e[1], r * 0.09, r * 0.08, 0, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = "#1f1712"; g.beginPath(); g.arc(e[0] + px * sg * r * 0.03, e[1] + py * sg * r * 0.03, Math.max(0.8, r * 0.06), 0, Math.PI * 2); g.fill();
          const b0 = P(0.42, 0.22), b1 = P(0.76, 0.2);
          g.strokeStyle = "#3b2a1e"; g.lineWidth = Math.max(0.8, r * 0.07); g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
          const m0 = P(0.66, -0.5), m1 = P(0.86, -0.48);
          g.strokeStyle = "#8a4a3a"; g.lineWidth = Math.max(0.6, r * 0.05); g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
        }
        return;
      }
      // 정면 ~ 비스듬히(3/4): k = 0 정면, 1 = 옆모습 직전. sg = 얼굴이 향한 화면 방향
      const sg = faceSide;
      const k = fr > 0 ? Math.max(0, Math.min(1, (1 - fr) / 0.5)) : 0;
      const kH = frH > 0 ? Math.max(0, Math.min(1, (1 - frH) / 0.5)) : 1;
      const tiltF = fr > 0.35 ? tilt * Math.max(0, 1 - kH * 1.6) : 0; // 정수리 보이기는 정면에서만 (대각선·측면은 그대로)
      const F = (x, y) => H(x * sg, y);           // x+ = 얼굴이 향한 쪽
      const headPath = () => {
        const pts = [[0, 1.05], [0.68, 0.86], [0.86, 0.32], [0.84, -0.2], [0.66, -0.66], [0.32, -0.98], [-0.05, -1.04], [-0.42, -0.92], [-0.74, -0.5], [-0.86, 0.1], [-0.72, 0.7]]
          .map(([x, y]) => F(x * 0.9 + (y < 0 ? 0.1 * k * (-y) : 0), y));   // 비스듬하면 턱이 얼굴 쪽으로
        const mid = (A, B) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        g.beginPath();
        let st = mid(pts[pts.length - 1], pts[0]); g.moveTo(st[0], st[1]);
        pts.forEach((pt, i) => { const nx = mid(pt, pts[(i + 1) % pts.length]); g.quadraticCurveTo(pt[0], pt[1], nx[0], nx[1]); });
        g.closePath();
      };
      // 귀: 정면이면 양쪽, 비스듬하면 뒤쪽 귀 하나 (머리 안쪽에 붙게)
      const earXs = fr < 0 ? [-0.82, 0.82] : k < 0.3 ? [-0.84, 0.84] : [-0.84 + 0.25 * k];
      const ear = (x) => { const c = F(x, -0.05 - tiltF * 0.45); g.beginPath(); g.ellipse(c[0], c[1], r * 0.16, r * 0.26, Math.atan2(uy, ux), 0, Math.PI * 2); };
      if (pass === "out") {
        g.fillStyle = OUT; g.strokeStyle = OUT; g.lineWidth = LW * 2; g.lineJoin = "round";
        earXs.forEach((x) => { ear(x); g.fill(); g.stroke(); });
        headPath(); g.fill(); g.stroke();
        return;
      }
      earXs.forEach((x) => { ear(x); g.fillStyle = toHex(shade(SKC, 0.9)); g.fill(); });
      headPath();
      { const hc = F(0.2, 0.25), rg = g.createRadialGradient(hc[0], hc[1], r * 0.1, S.head[0], S.head[1], r * 1.15); rg.addColorStop(0, toHex(shade(SKC, 1.08))); rg.addColorStop(0.65, SKC); rg.addColorStop(1, toHex(shade(SKC, 0.82))); g.fillStyle = rg; }
      g.fill();
      g.save(); headPath(); g.clip();
      // 얼굴 반대편(뒤쪽 볼) 그늘
      if (k > 0.1) { g.fillStyle = `rgba(120,60,30,${0.16 * k})`; const sc = F(-0.75, -0.15); g.beginPath(); g.ellipse(sc[0], sc[1], r * 0.4, r * 1.05, Math.atan2(uy, ux), 0, Math.PI * 2); g.fill(); }
      // 머리카락: 앞에서 보면 이마 위, 비스듬하면 뒤쪽·옆머리까지, 뒤에서 보면 대부분
      g.fillStyle = "#3b2a1e";
      if (fr >= 0) {
        const hy = 0.44 + 0.08 * k - tiltF * 0.85;  // 숙이면 정수리가 보이도록 머리카락이 내려옴
        const hp = [F(-1.2, -0.2 * k), F(-0.78 + 0.1 * k, hy - 0.2 * k), F(-0.4, hy + 0.06), F(0.2, hy), F(0.9, hy + 0.1), F(1.2, hy), F(1.2, 1.4), F(-1.2, 1.4)];
        g.beginPath(); hp.forEach((q, i) => g[i ? "lineTo" : "moveTo"](q[0], q[1])); g.closePath(); g.fill();
      } else {
        const hy = -0.6 * Math.min(1, -fr * 2);
        const hp = [H(-1.2, hy), H(1.2, hy), H(1.2, 1.4), H(-1.2, 1.4)];
        g.beginPath(); hp.forEach((q, i) => g[i ? "lineTo" : "moveTo"](q[0], q[1])); g.closePath(); g.fill();
      }
      g.restore();
      // 머리 윗부분 볼륨
      g.fillStyle = "#3b2a1e";
      if (tiltF < 0.3) {g.beginPath(); const tc = F(-0.05 * k, 0.62); g.ellipse(tc[0], tc[1], r * 0.84, r * 0.5 * (1 - tiltF), Math.atan2(uy, ux) + Math.PI / 2, Math.PI, 2 * Math.PI); g.fill();}
      if (fr > 0.05 && r > 3) {
        const shiftX = 0.3 * k, dy = -tiltF * 0.62;      // 숙이면 이목구비가 아래로
        const FF = (x, y) => F(x, y * (1 - tiltF * 0.45) + dy);                      // 이목구비가 얼굴 쪽으로 이동
        const ink = "#1f1712";
        g.lineCap = "round"; g.lineJoin = "round";
        // 가까운 눈(-) 과 먼 눈(+): 먼 눈은 좁고 가장자리 쪽으로
        [[-0.32, 1], [0.32, 1 - 0.55 * k]].forEach(([ex0, wk]) => {
          const ex = ex0 * (ex0 > 0 ? 1 - 0.35 * k : 1 - 0.1 * k) + shiftX;
          const e = FF(ex, 0.02);
          if (r > 9) {
            const rot = Math.atan2(uy, ux) + Math.PI / 2;
            g.fillStyle = "#fff"; g.beginPath(); g.ellipse(e[0], e[1], r * 0.14 * wk, r * 0.08, rot, 0, Math.PI * 2); g.fill();
            g.fillStyle = "#5a4630"; g.beginPath(); g.arc(e[0] + px * sg * r * 0.03 * k, e[1] + py * sg * r * 0.03 * k, r * 0.065 * Math.max(0.6, wk), 0, Math.PI * 2); g.fill();
            g.lineWidth = Math.max(0.6, r * 0.035); g.strokeStyle = ink; g.beginPath(); g.ellipse(e[0], e[1], r * 0.14 * wk, r * 0.08, rot, Math.PI, 2 * Math.PI); g.stroke();
          } else { g.fillStyle = ink; g.beginPath(); g.arc(e[0], e[1], Math.max(0.8, r * 0.075), 0, Math.PI * 2); g.fill(); }
          const b0 = FF(ex - 0.16 * wk, 0.2), b1 = FF(ex + 0.16 * wk, 0.23);
          g.strokeStyle = "#3b2a1e"; g.lineWidth = Math.max(0.8, r * 0.07); g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
        });
        if (r > 6) {
          // 코: 비스듬하면 얼굴 쪽으로 살짝 나옴
          const n0 = FF(shiftX + 0.02, -0.04), n1 = FF(shiftX + 0.1 + 0.18 * k, -0.32), n2 = FF(shiftX - 0.06, -0.36);
          g.strokeStyle = toHex(shade(SKC, 0.62)); g.lineWidth = Math.max(0.6, r * 0.045);
          g.beginPath(); g.moveTo(n0[0], n0[1]); g.lineTo(n1[0], n1[1]); g.lineTo(n2[0], n2[1]); g.stroke();
        }
        const mw = 0.19 * (1 - 0.35 * k), mx = shiftX + 0.06 * k;
        const m0 = FF(mx - mw, -0.6), m1 = FF(mx + mw, -0.6), mc = FF(mx, -0.63);
        g.strokeStyle = "#8a4a3a"; g.lineWidth = Math.max(0.6, r * 0.05);
        g.beginPath(); g.moveTo(m0[0], m0[1]); g.quadraticCurveTo(mc[0], mc[1], m1[0], m1[1]); g.stroke();
      }
    });
    parts.sort((a, b) => a.d - b.d).forEach((pt) => { pass = "out"; pt.fn(); pass = "fill"; pt.fn(); });
    if (opts.selected) {
      g.globalAlpha = 1;
      g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeStyle = "#fff";
      g.beginPath(); g.ellipse(sh[0], sh[1], m * 0.5, m * 0.2, 0, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  // 팔레트 아이콘 (비스듬히 앞에서 본 모습, 칸에 맞춤)
  const figIconCache = new Map();
  function figureIcon(kind, id, size = 112, rot = 0.55) {
    const key = kind + id + size + "|" + rot;
    if (figIconCache.has(key)) return figIconCache.get(key);
    const it = { kind, pose: id, x: 0, z: 0, rot, label: kind === "gk" ? "1" : "7" };
    const rig = poseRig(makeRig(), it);
    const cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(1.6, 1.6, 5.2); cam.lookAt(0, 0.8, 0); cam.updateMatrixWorld(true);
    const raw = (v) => { const p = v.clone().project(cam); return [p.x, -p.y]; };
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    rig.root.traverse((o) => { if (o === rig.root) return; const [x, y] = raw(o.getWorldPosition(V3())); mnx = Math.min(mnx, x); mny = Math.min(mny, y); mxx = Math.max(mxx, x); mxy = Math.max(mxy, y); });
    const span = Math.max(mxx - mnx, mxy - mny) * 1.25, cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
    const proj = (v) => { const [x, y] = raw(v); return [((x - cx) / span + 0.5) * size, ((y - cy) / span + 0.5) * size]; };
    const c = document.createElement("canvas"); c.width = c.height = size;
    drawFigure(c.getContext("2d"), cam, proj, it, rig);
    const url = c.toDataURL("image/png");
    figIconCache.set(key, url);
    return url;
  }

  /* ---------- 라벨 · 텍스트 ---------- */
  const spriteTexCache = new Map();
  function chipTexture(text, bg, fg) {
    const key = "chip|" + text + bg + fg;
    if (spriteTexCache.has(key)) return spriteTexCache.get(key);
    const wide = text.length > 3;
    const c = document.createElement("canvas"); c.width = wide ? 256 : 128; c.height = 128;
    const g = c.getContext("2d");
    const w = c.width;
    g.beginPath();
    if (wide) { g.moveTo(64, 10); g.arcTo(w - 10, 10, w - 10, 118, 54); g.arcTo(w - 10, 118, 10, 118, 54); g.arcTo(10, 118, 10, 10, 54); g.arcTo(10, 10, w - 10, 10, 54); }
    else g.arc(64, 64, 54, 0, Math.PI * 2);
    g.closePath();
    g.fillStyle = bg; g.fill();
    g.lineWidth = 6; g.strokeStyle = fg; g.stroke();
    g.fillStyle = fg;
    g.font = `800 ${wide ? 50 : text.length > 2 ? 40 : 56}px "Pretendard Variable", Pretendard, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, 68);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    spriteTexCache.set(key, { t, aspect: w / 128 });
    return spriteTexCache.get(key);
  }
  function textTexture(text) {
    const key = "text|" + text;
    if (spriteTexCache.has(key)) return spriteTexCache.get(key);
    const lines = String(text || " ").split("\n").slice(0, 4);
    const fs = 54, pad = 26, lh = fs * 1.3;
    const m = document.createElement("canvas").getContext("2d");
    m.font = `700 ${fs}px "Pretendard Variable", Pretendard, sans-serif`;
    const tw = Math.max(...lines.map((l) => m.measureText(l).width), fs);
    const c = document.createElement("canvas");
    c.width = Math.ceil(tw + pad * 2); c.height = Math.ceil(lines.length * lh + pad * 1.4);
    const g = c.getContext("2d");
    const r = 22;
    g.fillStyle = "rgba(255,255,255,.94)";
    g.beginPath(); g.moveTo(r, 0); g.arcTo(c.width, 0, c.width, c.height, r); g.arcTo(c.width, c.height, 0, c.height, r); g.arcTo(0, c.height, 0, 0, r); g.arcTo(0, 0, c.width, 0, r); g.fill();
    g.fillStyle = "#0b0b0b";
    g.font = m.font; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, i) => g.fillText(l, c.width / 2, pad * 0.7 + lh * (i + 0.5)));
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    spriteTexCache.set(key, { t, aspect: c.width / c.height });
    return spriteTexCache.get(key);
  }

  /* ---------- 도구 ---------- */
  const EQUIP = {
    dummy:    { name: "더미", rot: true },
    cone:     { name: "콘" },
    marker:   { name: "마커" },
    bigcone:  { name: "큰콘" },
    balance:  { name: "밸런스 볼" },
    pole:     { name: "폴대" },
    minigoal: { name: "미니골대", rot: true },
    hurdle:   { name: "허들", rot: true },
    ladder:   { name: "사다리", rot: true },
  };
  const ORANGE = 0xff6a1a, YELLOW = 0xffcf1f, BLUE = 0x2f6fdc, WHITE = 0xf4f4f2;

  function mesh(geo, mat, parent, pos) {
    const m = new T.Mesh(geo, mat);
    m.castShadow = true;
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    parent.add(m);
    return m;
  }
  function stick(a, b, r, mat) {
    const d = V3().subVectors(b, a), len = d.length();
    const m = new T.Mesh(geos().unitCyl, mat);
    m.scale.set(r, len, r);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    m.castShadow = true;
    return m;
  }

  // 그물 있는 골대 (W=반폭, H=높이, D=깊이)
  const netCache = new Map();
  function goalFrame(W, H, D, postR) {
    const grp = new T.Group(), white = std(0xf6f6f6);
    grp.add(stick(V3(-W, 0, 0), V3(-W, H, 0), postR, white), stick(V3(W, 0, 0), V3(W, H, 0), postR, white), stick(V3(-W - postR, H, 0), V3(W + postR, H, 0), postR, white));
    const key = [W, H, D].join();
    if (!netCache.has(key)) {
      const DT = D * 0.5, s = Math.max(0.12, H / 8), v = [];
      const seg = (x1, y1, z1, x2, y2, z2) => v.push(x1, y1, z1, x2, y2, z2);
      const zAt = (y) => -D + (D - DT) * (y / H);
      for (let x = -W; x <= W + 0.01; x += s) { seg(x, 0, -D, x, H, -DT); seg(x, H, 0, x, H, -DT); }
      for (let y = 0; y <= H + 0.01; y += s) { seg(-W, y, zAt(y), W, y, zAt(y)); seg(-W, y, 0, -W, y, zAt(y)); seg(W, y, 0, W, y, zAt(y)); }
      for (let z = 0; z >= -D; z -= s) { const yTop = z >= -DT ? H : H * (D + z) / (D - DT); seg(-W, 0, z, -W, yTop, z); seg(W, 0, z, W, yTop, z); }
      for (let z = 0; z >= -DT; z -= s) seg(-W, H, z, W, H, z);
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(v, 3));
      netCache.set(key, geo);
    }
    grp.add(new T.LineSegments(netCache.get(key), cached("net", () => new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }))));
    return grp;
  }

  function makeEquip(type) {
    const g = geos(), grp = new T.Group();
    const add = (geo, mat, pos) => mesh(geo, mat, grp, pos);
    switch (type) {
      case "cone": add(g.saucer, std(ORANGE, 0.5)); break;
      case "marker": add(g.marker, std(YELLOW, 0.5)); break;
      case "bigcone":
        add(g.bigConeBase, std(ORANGE, 0.5)); add(g.bigCone, std(ORANGE, 0.5)); add(g.bigConeBand, std(WHITE, 0.4)); break;
      case "balance": add(g.bosuBase, std(0x151515)); add(g.bosuDome, std(BLUE, 0.45)); break;
      case "pole": add(g.poleBase, std(0x151515)); add(g.pole, std(YELLOW, 0.45)); break;
      case "minigoal": grp.add(goalFrame(0.9, 1.2, 0.8, 0.03)); grp.children[0].position.z = 0.4; break;
      case "hurdle": {
        const m = std(ORANGE, 0.5);
        [-0.3, 0.3].forEach((x) => { grp.add(stick(V3(x, 0, 0), V3(x, 0.3, 0), 0.015, m)); grp.add(stick(V3(x, 0.005, -0.12), V3(x, 0.005, 0.12), 0.012, m)); });
        grp.add(stick(V3(-0.3, 0.3, 0), V3(0.3, 0.3, 0), 0.015, m));
        break;
      }
      case "ladder": {
        const m = std(YELLOW, 0.5), L = 4, Wd = 0.5;
        [-Wd / 2, Wd / 2].forEach((x) => { const r = add(g.rail, m, [x, 0.006, L / 2]); r.scale.z = L; });
        for (let i = 0; i <= 9; i++) { const r = add(g.rail, m, [0, 0.008, (i * L) / 9]); r.scale.set(1, 1, Wd); r.rotation.y = Math.PI / 2; }
        break;
      }
      case "dummy": {
        const m = std(BLUE, 0.5);
        const s = new T.Shape();
        s.moveTo(-0.12, 0.32); s.lineTo(-0.22, 1.28);
        s.quadraticCurveTo(-0.23, 1.44, -0.08, 1.46); s.lineTo(0.08, 1.46);
        s.quadraticCurveTo(0.23, 1.44, 0.22, 1.28); s.lineTo(0.12, 0.32); s.closePath();
        const geo = new T.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
        geo.translate(0, 0, -0.025);
        const bodyM = add(geo, m); bodyM.userData.ownGeo = true;
        const headM = add(new T.CylinderGeometry(0.11, 0.11, 0.05, 24), m, [0, 1.6, 0]); headM.rotation.x = Math.PI / 2; headM.userData.ownGeo = true;
        const sm = std(0x222222);
        grp.add(stick(V3(-0.08, 0, 0), V3(-0.08, 0.34, 0), 0.015, sm), stick(V3(0.08, 0, 0), V3(0.08, 0.34, 0), 0.015, sm));
        break;
      }
    }
    return grp;
  }

  /* ---------- 아이템 (3D: 선수 · 공 · 도구) ---------- */
  const DEFAULT_POSE = { gk: "set", own: "stand", opp: "run", coach: "stand" };
  const KIND_NAME = { gk: "골키퍼", own: "우리 팀", opp: "상대 팀", coach: "코치", ball: "공", ...Object.fromEntries(Object.entries(EQUIP).map(([k, v]) => [k, v.name])) };
  const isPerson = (k) => k === "gk" || k === "own" || k === "opp" || k === "coach";
  const canRotate = (k) => isPerson(k) || (EQUIP[k] && EQUIP[k].rot);
  const canSequence = (k) => isPerson(k) || k === "ball";

  // 코치만 머리 위에 작은 'C' 표시 (선수는 등번호로 충분)
  function setTag(fig, it) {
    if (it.kind !== "coach") { fig.tag.visible = false; return; }
    const { t, aspect } = chipTexture(it.label && it.label !== "COACH" ? it.label : "C", "#ffd23f", "#111");
    fig.tag.material.map = t;
    fig.tag.scale.set(0.03 * aspect, 0.03, 1);
    fig.tag.visible = true;
  }

  // 반투명: 재질을 복제해서 이 아이템에만 적용
  function setOpacity(root, op) {
    if (op == null || op >= 0.999) return;
    root.traverse((o) => {
      if ((!o.isMesh && !o.isSprite && !o.isLineSegments) || o.material === proxyMat) return;
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = (o.material.opacity != null ? o.material.opacity : 1) * op;
      if (op < 0.95) o.material.depthWrite = false;
      o.castShadow = op > 0.6;
    });
  }

  let ITEM_SCALE = 1; // 넓은 경기장에서 공·도구도 크게
  function makeItem(it) {
    const g = geos();
    let root;
    if (isPerson(it.kind)) {
      root = new T.Group(); // 사람은 2D로 그림 (drawFigure)
    } else if (it.kind === "ball") {
      root = new T.Group();
      const b = new T.Mesh(g.ball, ballMat());
      b.castShadow = true;
      b.position.y = 0.11 + (it.h || 0);
      root.add(b);
    } else {
      root = makeEquip(it.kind);
    }
    setOpacity(root, it.op);
    if (!isPerson(it.kind)) root.scale.setScalar(ITEM_SCALE);
    root.position.set(it.x, 0, it.z);
    root.rotation.y = it.rot || 0;
    root.userData.itemId = it.id;
    return root;
  }

  /* ---------- 2D 오버레이: 선 · 번호 · 텍스트 · 영역 ----------
     위치는 모두 경기장 좌표(미터)로 저장하고, 그릴 때 화면 좌표로 변환해요.
     공 = 빨간 실선 · 선수 움직임 = 노란 점선 */
  const LINE_TYPES = {
    pass:  { name: "공 이동", dashed: false, color: "#e5383b" },
    passc: { name: "공 곡선", dashed: false, color: "#e5383b", curve: true, as: "pass" },
    lob:   { name: "공중볼", dashed: false, color: "#e5383b", arc: true },
    run:   { name: "선수 이동", dashed: true, color: "#ffd23f" },
    runc:  { name: "선수 곡선", dashed: true, color: "#ffd23f", curve: true, as: "run" },
    pen:   { name: "펜", dashed: false, color: "#ffffff", free: true, noArrow: true },
  };
  const LINE_COLORS = ["#e5383b", "#ffd23f", "#ffffff", "#111111", "#2f6fdc"];
  const ZONE_COLORS = ["#ffd23f", "#e5383b", "#ffffff", "#2f6fdc"];
  const LINE_Y = 0.03;
  const UP = V3(0, 1, 0);
  const lineDashed = (l) => (l.dashed != null ? l.dashed : (LINE_TYPES[l.type] || LINE_TYPES.pass).dashed);
  const lineColor = (l) => l.color || (LINE_TYPES[l.type] || LINE_TYPES.pass).color;
  const bendable = (l) => l.pts.length === 2 && l.type !== "pen";

  function linePath(line, n = 36) {
    const st = LINE_TYPES[line.type] || LINE_TYPES.pass;
    const raw = line.pts.map(([x, z]) => V3(x, LINE_Y, z));
    if (raw.length > 2) return new T.CatmullRomCurve3(raw, false, "centripetal").getPoints(Math.min(300, raw.length * 6));
    const a = raw[0], b = raw[raw.length - 1];
    let pts;
    if (line.c) {
      const h = V3(line.c[0], LINE_Y, line.c[1]);
      const q = h.clone().multiplyScalar(2).sub(a.clone().add(b).multiplyScalar(0.5));
      pts = new T.QuadraticBezierCurve3(a, q, b).getPoints(n);
    } else pts = st.arc ? Array.from({ length: n + 1 }, (_, i) => a.clone().lerp(b, i / n)) : [a, b];
    if (st.arc) {
      const peak = Math.min(8, Math.max(1.5, a.distanceTo(b) * 0.25));
      pts.forEach((p, i) => { const t = i / (pts.length - 1); p.y = LINE_Y + 4 * peak * t * (1 - t); });
    }
    return pts;
  }
  const midOf = (l) => { const a = l.pts[0], b = l.pts[l.pts.length - 1]; return l.c || [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };

  const TEXT_BOX = new WeakMap();
  const hatchCache = new Map();
  function hatch(ctx, color) {
    const key = color;
    if (!hatchCache.has(key)) {
      const c = document.createElement("canvas"); c.width = c.height = 14;
      const g = c.getContext("2d");
      g.strokeStyle = color; g.globalAlpha = 0.85; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-2, 16); g.lineTo(16, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(12, 16); g.lineTo(16, 12); g.stroke();
      hatchCache.set(key, c);
    }
    return ctx.createPattern(hatchCache.get(key), "repeat");
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // 영역 모양: 네모 · 동그라미 · 세모 (a, b = 끌어서 만든 대각선 두 점)
  const ZONE_SHAPES = { rect: "네모", circle: "동그라미", tri: "세모" };
  function zonePts(zn) {
    const [ax, az] = zn.a, [bx, bz] = zn.b;
    if (zn.shape === "circle") {
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, rx = Math.abs(bx - ax) / 2, rz = Math.abs(bz - az) / 2;
      return Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return [cx + Math.cos(t) * rx, cz + Math.sin(t) * rz]; });
    }
    if (zn.shape === "tri") return [[(ax + bx) / 2, az], [bx, bz], [ax, bz]];
    return [[ax, az], [bx, az], [bx, bz], [ax, bz]];
  }

  // proj(V3) → [px, py] · u = 화면 크기 기준 단위(px)
  // o: { sel, draft, cam, rigOf(it), hide:Set(id), actors:[{it, rig}] }
  function drawOverlay(g, proj, s, u, o = {}) {
    const sel = o.sel, draft = o.draft;
    const P = (x, z, y = LINE_Y) => proj(V3(x, y, z));
    // 영역
    (s.zones || []).forEach((zn, i) => {
      const pts = zonePts(zn).map(([x, z]) => P(x, z, 0.01));
      g.beginPath(); pts.forEach(([x, y], k) => g[k ? "lineTo" : "moveTo"](x, y)); g.closePath();
      g.save();
      if (zn.fill) { g.globalAlpha = 0.3; g.fillStyle = zn.color; g.fill(); g.globalAlpha = 1; }
      if (zn.hatch) { g.fillStyle = hatch(g, zn.color); g.fill(); }
      g.restore();
      g.lineWidth = u * 1.6; g.strokeStyle = zn.color; g.setLineDash([]); g.stroke();
      if (sel && sel.t === "zone" && sel.i === i) {
        g.lineWidth = u * 1.2; g.strokeStyle = "#fff"; g.setLineDash([u * 5, u * 4]); g.stroke(); g.setLineDash([]);
        [zn.a, zn.b].forEach(([x, z]) => { const [hx, hy] = P(x, z, 0.01); g.beginPath(); g.arc(hx, hy, u * 6, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.lineWidth = u * 2; g.strokeStyle = "#111"; g.stroke(); });
      }
    });
    // 사람 · 공 · 도구 (순서 지정 → 먼 쪽부터)
    if (o.cam) {
      const all = (s.items || []).filter((it) => !(o.hide && o.hide.has(it.id))).map((it) => (isPerson(it.kind) ? { it, rig: o.rigOf(it) } : { it }));
      (o.actors || []).forEach((a) => all.push(a));
      const inv = o.cam.matrixWorldInverse;
      const dz = (f) => (f.rig ? f.rig.B.hips.getWorldPosition(V3()) : V3(f.it.x, 0.3, f.it.z)).applyMatrix4(inv).z;
      all.forEach((f) => { f.d = dz(f); });
      all.sort((a, b) => ((a.it.layer || 0) - (b.it.layer || 0)) || (a.d - b.d)).forEach((f) => {
        const picked = sel && sel.t === "item" && sel.it === f.it;
        if (f.rig) return drawFigure(g, o.cam, proj, f.it, f.rig, { scale: o.figScale, selected: picked });
        const sp = thingSprite(f.it, o.cam, o.w, o.h);
        if (!sp) return;
        g.save();
        g.globalAlpha = f.it.op == null ? 1 : f.it.op;
        g.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);
        g.restore();
        THING_BOX.set(f.it, [...sp.hit, f.d]);
        if (picked) {
          const [a0, b0, a1, b1] = sp.hit, cx = (a0 + a1) / 2, cy = b1 - 6;
          g.save(); g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeStyle = "#fff";
          g.beginPath(); g.ellipse(cx, cy, Math.max(14, (a1 - a0) / 2), Math.max(6, (a1 - a0) / 6), 0, 0, Math.PI * 2); g.stroke(); g.restore();
        }
      });
    }
    // 선
    const lines = draft ? [...(s.lines || []), draft] : s.lines || [];
    lines.forEach((l, i) => {
      const pts = linePath(l).map(proj);
      if (pts.length < 2) return;
      const st = LINE_TYPES[l.type] || LINE_TYPES.pass;
      const color = lineColor(l), w = u * 2.6, head = u * 11;
      // 화살촉이 들어갈 만큼 끝을 잘라냄
      let end = pts.length - 1, tip = pts[end], k = end - 1;
      while (k > 0 && Math.hypot(pts[k][0] - tip[0], pts[k][1] - tip[1]) < head * 0.9) k--;
      const base = pts[Math.max(0, k)];
      const ang = Math.atan2(tip[1] - base[1], tip[0] - base[0]);
      g.save();
      g.globalAlpha = l === draft ? 0.7 : 1;
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
      g.setLineDash(lineDashed(l) ? [u * 9, u * 7] : []);
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = u * 2;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      const stop = st.noArrow ? end : Math.max(1, k);
      for (let j = 1; j <= stop; j++) g.lineTo(pts[j][0], pts[j][1]);
      if (!st.noArrow) g.lineTo(tip[0] - Math.cos(ang) * head * 0.6, tip[1] - Math.sin(ang) * head * 0.6);
      g.stroke();
      g.setLineDash([]);
      if (!st.noArrow) {
        g.beginPath();
        g.moveTo(tip[0], tip[1]);
        g.lineTo(tip[0] - Math.cos(ang - 0.42) * head, tip[1] - Math.sin(ang - 0.42) * head);
        g.lineTo(tip[0] - Math.cos(ang + 0.42) * head, tip[1] - Math.sin(ang + 0.42) * head);
        g.closePath(); g.fill();
      }
      g.restore();
      if (sel && sel.t === "line" && sel.i === i) {
        const hs = [["a", l.pts[0]], ["b", l.pts[l.pts.length - 1]]];
        if (bendable(l)) hs.push(["c", midOf(l)]);
        hs.forEach(([key, [x, z]]) => {
          const [px, py] = P(x, z);
          g.beginPath(); g.arc(px, py, key === "c" ? u * 8 : u * 6, 0, Math.PI * 2);
          g.fillStyle = key === "c" ? "rgba(255,255,255,.9)" : "#fff"; g.fill();
          g.lineWidth = u * 2; g.strokeStyle = "#111"; g.stroke();
          if (key === "c") { g.beginPath(); g.arc(px, py, u * 2.5, 0, Math.PI * 2); g.fillStyle = "#111"; g.fill(); }
        });
      }
    });
    // 번호 · 텍스트
    (s.marks || []).forEach((m, i) => {
      const [px, py] = P(m.x, m.z, 0.02);
      const picked = sel && sel.t === "mark" && sel.i === i;
      if (m.kind === "num") {
        const r = u * 10;
        g.save();
        g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = u * 3;
        g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fillStyle = m.color || "#e5383b"; g.fill();
        g.restore();
        g.lineWidth = u * 1.6; g.strokeStyle = "#fff"; g.stroke();
        g.fillStyle = "#fff"; g.font = `800 ${u * 11}px "Pretendard Variable", Pretendard, sans-serif`;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(m.n), px, py + u * 0.6);
        if (picked) { g.beginPath(); g.arc(px, py, r + u * 4, 0, Math.PI * 2); g.lineWidth = u * 1.4; g.setLineDash([u * 4, u * 3]); g.strokeStyle = "#fff"; g.stroke(); g.setLineDash([]); }
      } else {
        const fs = u * ({ s: 11, m: 14, l: 19 }[m.size || "m"]);
        g.font = `700 ${fs}px "Pretendard Variable", Pretendard, sans-serif`;
        const lines = String(m.label || " ").split("\n");
        const tw = Math.max(...lines.map((t) => g.measureText(t).width), fs);
        const pad = fs * 0.5, lh = fs * 1.3, bw = tw + pad * 2, bh = lines.length * lh + pad;
        const bx = px - bw / 2, by = py - bh - u * 6;
        g.save();
        g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = u * 4;
        roundRect(g, bx, by, bw, bh, fs * 0.35); g.fillStyle = "rgba(255,255,255,.95)"; g.fill();
        g.restore();
        g.beginPath(); g.moveTo(px - u * 5, by + bh); g.lineTo(px + u * 5, by + bh); g.lineTo(px, py); g.closePath(); g.fillStyle = "rgba(255,255,255,.95)"; g.fill();
        g.fillStyle = "#0b0b0b"; g.textAlign = "center"; g.textBaseline = "middle";
        lines.forEach((t, k) => g.fillText(t, px, by + pad / 2 + lh * (k + 0.5)));
        if (picked) { roundRect(g, bx - u * 3, by - u * 3, bw + u * 6, bh + u * 6, fs * 0.45); g.lineWidth = u * 1.4; g.setLineDash([u * 4, u * 3]); g.strokeStyle = "#fff"; g.stroke(); g.setLineDash([]); }
        TEXT_BOX.set(m, [bx, by, bw, bh]); // 클릭 판정용 (저장 안 함)
      }
    });
  }

  /* ---------- 월드 ---------- */
  function createWorld(turf = "green") {
    const g = geos();
    const scene = new T.Scene();
    const sun = new T.DirectionalLight(0xffffff, 0.95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.position.set(14, 40, -10);
    sun.target.position.set(0, 0, 10);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -36; sc.right = sc.top = 36; sc.near = 1; sc.far = 120;
    scene.add(sun, sun.target);
    const hemi = new T.HemisphereLight(0xffffff, 0x101010, 0.62);
    scene.add(hemi);
    const fill = new T.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-30, 20, 40);
    scene.add(fill);
    const floorMat = new T.MeshStandardMaterial({ color: 0x020202, roughness: 1 });
    const floor = new T.Mesh(g.floor, floorMat);
    floor.position.y = -0.03; floor.receiveShadow = true;
    scene.add(floor);
    const pitchMats = {};
    Object.entries(PITCH_PARTS).forEach(([k, R]) => {
      const mat = (pitchMats[k] = new T.MeshStandardMaterial({ roughness: 1 }));
      const W = R.x[1] - R.x[0], H = R.z[1] - R.z[0];
      const plane = new T.Mesh(new T.PlaneGeometry(W, H).rotateX(-Math.PI / 2), mat);
      plane.position.set((R.x[0] + R.x[1]) / 2, 0, (R.z[0] + R.z[1]) / 2);
      plane.receiveShadow = true;
      scene.add(plane);
    });
    scene.add(goalFrame(3.66, 2.44, 2.0, 0.06));
    const farGoal = goalFrame(3.66, 2.44, 2.0, 0.06); farGoal.rotation.y = Math.PI; farGoal.position.z = 105; scene.add(farGoal);
    const itemsG = new T.Group();
    scene.add(itemsG);

    function setTurf(t) {
      const st = TURF_STYLE[t] || TURF_STYLE.green;
      Object.entries(pitchMats).forEach(([k, mat]) => { mat.map = pitchTexture(t, k); mat.color.setHex(st.tint); mat.needsUpdate = true; });
      // 경기장 밖 바닥도 잔디와 같은 색·조명으로 이어지게
      const fc = document.createElement("canvas"); fc.width = fc.height = 2;
      const fg = fc.getContext("2d"); fg.fillStyle = st.b; fg.fillRect(0, 0, 2, 2);
      const ft = new T.CanvasTexture(fc); ft.encoding = T.sRGBEncoding;
      floorMat.map = ft; floorMat.color.setHex(st.tint); floorMat.needsUpdate = true;
      scene.background = new T.Color(st.floor);
      void floor;
      scene.fog = null;
      hemi.intensity = t === "green" ? 0.7 : 0.62;
    }
    function clearGroup(grp) {
      grp.children.slice().forEach((c) => {
        grp.remove(c);
        c.traverse((o) => {
          if (o.userData.ownGeo) o.geometry.dispose();
          if (o.isSprite) o.material.dispose();
        });
      });
    }
    setTurf(turf);
    return { scene, itemsG, setTurf, clearGroup };
  }

  /* ---------- 오프스크린 렌더 (보드 썸네일, 아이콘) ---------- */
  let offR;
  function offRenderer(w, h) {
    if (!offR) {
      offR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      offR.outputEncoding = T.sRGBEncoding;
      offR.shadowMap.enabled = true;
      offR.shadowMap.type = T.PCFSoftShadowMap;
      offR.setPixelRatio(1);
    }
    const sz = offR.getSize(new T.Vector2());
    if (sz.x !== w || sz.y !== h) offR.setSize(w, h, false);
    return offR;
  }
  /* 공·도구를 하나씩 따로 그려서(그림자 포함) 사람과 같은 순서로 겹치게 함 */
  let thingScene = null;
  const THING_BOX = new WeakMap();
  const thingCache = new Map();
  function thingSprite(it, cam, w, h) {
    const key = [it.kind, it.x, it.z, it.rot, it.h, ITEM_SCALE, w, h, cam.position.toArray().join(), cam.aspect].join("|");
    if (thingCache.has(key)) return thingCache.get(key);
    if (!thingScene) {
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0x101010, 0.7));
      const sun = new T.DirectionalLight(0xffffff, 0.95);
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004;
      const c = sun.shadow.camera; c.left = c.bottom = -5; c.right = c.top = 5; c.near = 1; c.far = 80;
      sc.add(sun, sun.target);
      const fill = new T.DirectionalLight(0xffffff, 0.25); fill.position.set(-30, 20, 40); sc.add(fill);
      const catcher = new T.Mesh(new T.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new T.ShadowMaterial({ opacity: 0.32 }));
      catcher.receiveShadow = true; sc.add(catcher);
      thingScene = { sc, sun, catcher, obj: null };
    }
    const TS = thingScene;
    if (TS.obj) TS.sc.remove(TS.obj);
    const obj = makeItem({ ...it, op: 1 });
    TS.obj = obj; TS.sc.add(obj);
    TS.sun.position.set(it.x + 14, 40, it.z - 10); TS.sun.target.position.set(it.x, 0, it.z);
    TS.catcher.position.set(it.x, 0.002, it.z);
    obj.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(obj);
    box.expandByVector(V3(1.2, 0, 1.2)); box.min.y = 0;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const cx of [box.min.x, box.max.x]) for (const cy of [box.min.y, box.max.y]) for (const cz of [box.min.z, box.max.z]) {
      const p = V3(cx, cy, cz).project(cam); const sx = (p.x + 1) / 2 * w, sy = (1 - p.y) / 2 * h;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2); x1 = Math.min(w, Math.ceil(x1) + 2); y1 = Math.min(h, Math.ceil(y1) + 2);
    let out = null;
    if (x1 > x0 && y1 > y0) {
      const k = Math.min(window.devicePixelRatio || 1, 2);
      const r = offRenderer(Math.round(w * k), Math.round(h * k));
      r.setClearColor(0x000000, 0);
      r.render(TS.sc, cam);
      const c = document.createElement("canvas"); c.width = Math.round((x1 - x0) * k); c.height = Math.round((y1 - y0) * k);
      c.getContext("2d").drawImage(r.domElement, x0 * k, y0 * k, c.width, c.height, 0, 0, c.width, c.height);
      // 실제 물체 영역(그림자 제외)만 클릭 판정
      const tb = new T.Box3().setFromObject(obj);
      let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
      for (const cx of [tb.min.x, tb.max.x]) for (const cy of [tb.min.y, tb.max.y]) for (const cz of [tb.min.z, tb.max.z]) {
        const p = V3(cx, cy, cz).project(cam); const sx = (p.x + 1) / 2 * w, sy = (1 - p.y) / 2 * h;
        a0 = Math.min(a0, sx); b0 = Math.min(b0, sy); a1 = Math.max(a1, sx); b1 = Math.max(b1, sy);
      }
      out = { c, x: x0, y: y0, w: x1 - x0, h: y1 - y0, hit: [a0 - 6, b0 - 6, a1 + 6, b1 + 6] };
    }
    TS.sc.remove(obj); TS.obj = null;
    if (thingCache.size > 400) thingCache.clear();
    thingCache.set(key, out);
    return out;
  }

  const projector = (cam, w, h) => (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h]; };

  const imgCache = new Map();
  function boardImage(state, w = 640, h = 400) {
    const s = normalize(state);
    const key = JSON.stringify(s) + w + "x" + h;
    if (imgCache.has(key)) return imgCache.get(key);
    const world = createWorld(s.turf);
    ITEM_SCALE = (ANGLES[s.angle] || {}).fig || 1;
    const cam = makeCamera(s.angle);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    const r = offRenderer(w, h);
    r.render(world.scene, cam);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.drawImage(r.domElement, 0, 0);
    drawOverlay(g, projector(cam, w, h), s, w / 1000, { cam, w, h, figScale: (ANGLES[s.angle] || {}).fig, rigOf: (it) => poseRig(makeRig(), it) });
    const url = c.toDataURL("image/jpeg", 0.86);
    world.clearGroup(world.itemsG);
    imgCache.set(key, url);
    return url;
  }

  // 팔레트 아이콘: 선수 동작 / 공 · 도구
  const iconCache = new Map();
  function renderIcon(key, build) {
    if (iconCache.has(key)) return iconCache.get(key);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xffffff, 0x333333, 0.95));
    const d = new T.DirectionalLight(0xffffff, 0.75); d.position.set(3, 5, 4); scene.add(d);
    const { obj, box } = build();
    scene.add(obj);
    const c = box.getCenter(V3()), sz = box.getSize(V3());
    const s = Math.max(sz.x, sz.y, sz.z) * 0.6;
    const cam = new T.OrthographicCamera(-s, s, s, -s, 0.1, 50);
    cam.position.copy(c).add(V3(0.55, 0.38, 1).normalize().multiplyScalar(12));
    cam.lookAt(c);
    const r = offRenderer(112, 112);
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    const url = r.domElement.toDataURL("image/png");
    iconCache.set(key, url);
    return url;
  }
  function poseIcon(kind, id) {
    return renderIcon("p" + kind + id, () => {
      const fig = makeHuman(kind, kind === "gk" ? "1" : kind === "coach" ? "" : "7");
      fig.tag.visible = false;
      applyPose(fig, id, false);
      fig.root.updateMatrixWorld(true);
      return { obj: fig.root, box: markerBox(fig).clone().expandByScalar(0.1) };
    });
  }
  function equipIcon(type) {
    return renderIcon("e" + type, () => {
      const obj = type === "ball" ? makeItem({ kind: "ball", x: 0, z: 0, h: 0 }) : makeEquip(type);
      obj.rotation.y = 0.5;
      obj.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(obj).expandByScalar(0.06);
      return { obj, box };
    });
  }

  /* ---------- 상태 ---------- */
  function normalize(s) {
    s = s || {};
    const items = [], marks = Array.isArray(s.marks) ? s.marks.map((m) => ({ ...m })) : [];
    (Array.isArray(s.items) ? s.items : []).forEach((i) => {
      if (i.kind === "text") marks.push({ kind: "text", x: i.x, z: i.z, label: i.label, size: i.size || "m" }); // 이전 버전 텍스트
      else items.push({ ...i, id: i.id || uid() });
    });
    return {
      v: 3,
      angle: ANGLES[s.angle] ? s.angle : "fbox",
      turf: TURF_STYLE[s.turf] ? s.turf : "green",
      items,
      lines: Array.isArray(s.lines) ? s.lines.map((l) => ({ ...l, pts: l.pts.map((p) => p.slice()) })) : [],
      marks,
      zones: Array.isArray(s.zones) ? s.zones.map((z) => z.a ? { ...z, a: z.a.slice(), b: z.b.slice() }
        : { shape: "rect", a: z.pts[0].slice(), b: z.pts[2].slice(), color: z.color, hatch: z.style !== "fill", fill: z.style === "fill" }) : [],
    };
  }

  /* =========================================================
     인터랙티브 패드
     ========================================================= */
  const TABS = [
    { id: "gk", name: "골키퍼" }, { id: "own", name: "우리 팀" }, { id: "opp", name: "상대 팀" }, { id: "coach", name: "코치" },
    { id: "gear", name: "공·도구" }, { id: "line", name: "선" }, { id: "num", name: "번호" }, { id: "text", name: "텍스트" }, { id: "zone", name: "영역" },
  ];
  const GEAR = ["ball", ...Object.keys(EQUIP)];
  const STEP_T = 1.2;
  const LINE_ICON = {
    pass: '<path d="M4 18L18 6" stroke="#e5383b" stroke-width="2.4"/><path d="M19 5l-6 1.6 4.4 4.4z" fill="#e5383b"/>',
    passc: '<path d="M4 19C6 9 12 7 17.5 6.5" fill="none" stroke="#e5383b" stroke-width="2.4"/><path d="M20 6.2l-5.6-2.3.3 5.4z" fill="#e5383b"/>',
    lob: '<path d="M3 19C7 3 15 3 19.5 16" fill="none" stroke="#e5383b" stroke-width="2.2"/><path d="M20.4 19l.4-6.2-4.8 2.6z" fill="#e5383b"/>',
    run: '<path d="M4 18L17 7" stroke="#ffd23f" stroke-width="2.4" stroke-dasharray="3.5 3"/><path d="M19 5l-6 1.6 4.4 4.4z" fill="#ffd23f"/>',
    runc: '<path d="M4 19C6 9 12 7 17.5 6.5" fill="none" stroke="#ffd23f" stroke-width="2.4" stroke-dasharray="3.5 3"/><path d="M20 6.2l-5.6-2.3.3 5.4z" fill="#ffd23f"/>',
    pen: '<path d="M4 17c3-6 5 2 8-3s4 2 8-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  };
  const HINT = {
    select: "아래에서 골키퍼·선수·도구를 누르면 경기장에 놓여요 · 끌어서 옮기고, 누르면 메뉴가 떠요",
    line: "경기장 위를 끌어서 선을 그으세요 · 다 그리면 가운데 동그라미로 휘게 할 수 있어요",
    num: "경기장을 누를 때마다 번호가 1, 2, 3… 순서대로 붙어요",
    text: "글자를 넣을 곳을 누르세요",
    zone: "경기장 위를 끌어서 영역을 그리세요",
    play: "재생 중… ■ 정지를 누르면 원래대로 돌아와요",
  };
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  function createPad({ stage, palette, hint, onPlayChange, onChange }) {
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-label", "택티컬 보드");
    const fill = "position:absolute;inset:0;width:100%;height:100%;display:block";
    canvas.style.cssText = fill;
    stage.prepend(canvas);
    const over = document.createElement("canvas");
    over.className = "pad-over";
    over.style.cssText = fill + ";pointer-events:none";
    stage.appendChild(over);
    const og = over.getContext("2d");
    const ftb = document.createElement("div");
    ftb.className = "ftb"; ftb.hidden = true;
    stage.appendChild(ftb);

    let state = normalize({});
    const world = createWorld(state.turf);
    world.itemsG.visible = false; // 공·도구도 2D 레이어로 그림 (drawOverlay)
    let camera = makeCamera(state.angle);
    let tab = "gk", mode = "select", lineType = "pass";
    let zoneShape = "rect", zoneHatch = true, zoneFill = false, zoneColor = "#ffd23f";
    const rigs = new Map();
    const rigOf = (it) => { let r = rigs.get(it.id); if (!r) { r = makeRig(); rigs.set(it.id, r); } return poseRig(r, it); };
    let sel = null;           // { t: "item", it } | { t: "line" | "mark" | "zone", i }
    let undoS = [], redoS = [];
    let needs = true, overNeeds = true, playing = null;
    let W = 1, H = 1;
    let nextNum = 1;
    let down = null, draft = null;

    /* ----- 기록 ----- */
    const snap = () => JSON.stringify(state);
    const pushUndo = (s = snap()) => { undoS.push(s); if (undoS.length > 80) undoS.shift(); redoS = []; onChange && onChange(); };
    const dirty = () => { needs = true; overNeeds = true; };

    /* ----- 렌더 ----- */
    const proj = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
    const unit = () => W / 1000;
    const findObj = (id) => world.itemsG.children.find((o) => o.userData.itemId === id);
    const syncScale = () => { ITEM_SCALE = (ANGLES[state.angle] || {}).fig || 1; };
    function rebuildItem(it) {
      syncScale();
      const old = findObj(it.id);
      if (old) world.clearGroup({ children: [old], remove: () => world.itemsG.remove(old) });
      world.itemsG.add(makeItem(it));
      dirty();
    }
    function rebuildAll() {
      syncScale();
      world.clearGroup(world.itemsG);
      state.items.forEach((it) => world.itemsG.add(makeItem(it)));
      dirty();
    }
    function drawOver() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (over.width !== Math.round(W * dpr)) { over.width = Math.round(W * dpr); over.height = Math.round(H * dpr); }
      og.setTransform(dpr, 0, 0, dpr, 0, 0);
      og.clearRect(0, 0, W, H);
      drawOverlay(og, proj, state, unit(), { sel: playing ? null : sel, draft: draft && draft.line, cam: camera, w: W, h: H, figScale: (ANGLES[state.angle] || {}).fig, rigOf, hide: playing && playing.hide, actors: playing ? playing.figs : [] });
      if (draft && draft.zone) {
        const pts = zonePts({ shape: zoneShape, a: draft.zone.a, b: draft.zone.b }).map(([x, z]) => proj(V3(x, 0.01, z)));
        og.beginPath(); pts.forEach(([x, y], k) => og[k ? "lineTo" : "moveTo"](x, y)); og.closePath();
        og.setLineDash([6, 5]); og.lineWidth = 2; og.strokeStyle = "#fff"; og.stroke(); og.setLineDash([]);
      }
      placeToolbar();
    }
    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return false;
      W = w; H = h;
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      dirty();
      return true;
    }
    new ResizeObserver(() => resize()).observe(stage);
    window.addEventListener("resize", () => resize());
    (function loop() {
      requestAnimationFrame(loop);
      // 페이지가 숨겨졌다 보이거나 창 크기가 바뀌면 다시 맞춤
      if (stage.clientWidth && (stage.clientWidth !== W || stage.clientHeight !== H)) resize();
      if (W < 2) return;
      if (playing) stepPlayback();
      if (needs) { renderer.render(world.scene, camera); needs = false; }
      if (overNeeds) { drawOver(); overNeeds = false; }
    })();

    /* ----- 좌표 ----- */
    const ray = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Plane(UP, 0);
    function local(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function groundAtPx(px, py) {
      ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const p = V3();
      return ray.ray.intersectPlane(ground, p) ? clampXZ(p.x, p.z) : null;
    }
    function clampXZ(x, z) {
      return [r2(Math.min(BOARD.x[1] - 1, Math.max(BOARD.x[0] + 1, x))), r2(Math.min(BOARD.z[1] - 1, Math.max(BOARD.z[0] + 0.5, z)))];
    }
    function pickItemPx(px, py) {
      let best = null;
      const boxOf = (it) => (isPerson(it.kind) ? FIG_BOX : THING_BOX).get(it);
      const above = (x, y) => ((x.layer || 0) - (y.layer || 0)) || (boxOf(x)[4] - boxOf(y)[4]);
      state.items.forEach((it) => {
        const b = boxOf(it);
        if (b && px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3] && (!best || above(it, best) > 0)) best = it;
      });
      if (best) return best;
      ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (const h of ray.intersectObjects(world.itemsG.children, true)) {
        let o = h.object;
        while (o && !o.userData.itemId) o = o.parent;
        if (o && o.visible) return state.items.find((i) => i.id === o.userData.itemId) || null;
      }
      return null;
    }
    const P2 = (x, z, y = LINE_Y) => proj(V3(x, y, z));
    const dSeg = (px, py, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
    };
    const inPoly = (px, py, pts) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    function hitOverlay(px, py) {
      const u = unit();
      if (sel && sel.t === "line") {
        const l = state.lines[sel.i];
        const hs = [["a", l.pts[0]], ["b", l.pts[l.pts.length - 1]]];
        if (bendable(l)) hs.push(["c", midOf(l)]);
        for (const [k, [x, z]] of hs) { const [hx, hy] = P2(x, z); if (Math.hypot(px - hx, py - hy) < u * 12) return { t: "handle", k }; }
      }
      if (sel && sel.t === "zone") {
        const zn = state.zones[sel.i];
        for (const k of ["a", "b"]) { const [hx, hy] = P2(zn[k][0], zn[k][1], 0.01); if (Math.hypot(px - hx, py - hy) < u * 12) return { t: "handle", k: "z" + k }; }
      }
      for (let i = state.marks.length - 1; i >= 0; i--) {
        const m = state.marks[i];
        if (m.kind === "num") { const [mx, my] = P2(m.x, m.z, 0.02); if (Math.hypot(px - mx, py - my) < u * 13) return { t: "mark", i }; }
        else { const b = TEXT_BOX.get(m); if (b && px >= b[0] && px <= b[0] + b[2] && py >= b[1] && py <= b[1] + b[3] + u * 8) return { t: "mark", i }; }
      }
      return null;
    }
    function hitLineOrZone(px, py) {
      const tol = unit() * 9;
      for (let i = state.lines.length - 1; i >= 0; i--) {
        const pts = linePath(state.lines[i], 24).map(proj);
        for (let j = 0; j < pts.length - 1; j++) if (dSeg(px, py, pts[j], pts[j + 1]) < tol) return { t: "line", i };
      }
      for (let i = state.zones.length - 1; i >= 0; i--) {
        if (inPoly(px, py, zonePts(state.zones[i]).map(([x, z]) => P2(x, z, 0.01)))) return { t: "zone", i };
      }
      return null;
    }

    /* ----- 선택 ----- */
    function select(s) {
      sel = s;
      renderToolbar();
      overNeeds = true;
      if (s && s.t === "item") syncPalette();
    }
    const selItem = () => (sel && sel.t === "item" ? sel.it : null);

    /* ----- 포인터 ----- */
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || playing || e.target.closest(".ftb")) return;
      const [px, py] = local(e);
      const g = groundAtPx(px, py);
      if (!g) return;
      stage.setPointerCapture(e.pointerId);
      down = { px, py, g, moved: false, snap: snap() };
      if (mode === "line") { draft = { line: { type: lineType, pts: [g, g] } }; return; }
      if (mode === "zone") { draft = { zone: { a: g, b: g } }; return; }
      if (mode === "num") {
        pushUndo();
        state.marks.push({ kind: "num", n: nextNum++, x: g[0], z: g[1] });
        select({ t: "mark", i: state.marks.length - 1 });
        down = null; renderPalette(); return;
      }
      if (mode === "text") {
        pushUndo();
        state.marks.push({ kind: "text", label: "텍스트", size: "m", x: g[0], z: g[1] });
        select({ t: "mark", i: state.marks.length - 1 });
        setMode("select");
        down = null;
        const inp = ftb.querySelector("[data-f='label']"); if (inp) { inp.focus(); inp.select(); }
        return;
      }
      // 선택 모드: 번호·텍스트 → 선 손잡이 → 선수·도구 → 선·영역
      const ho = hitOverlay(px, py);
      if (ho && ho.t === "handle") { down.handle = ho.k; return; }
      if (ho) { select(ho); down.drag = ho; return; }
      const it = pickItemPx(px, py);
      if (it) { select({ t: "item", it }); down.drag = { t: "item", it, off: [it.x - g[0], it.z - g[1]] }; return; }
      const hl = hitLineOrZone(px, py);
      if (hl) { select(hl); down.drag = hl; return; }
      select(null);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!down) return;
      const [px, py] = local(e);
      if (Math.hypot(px - down.px, py - down.py) > 4) down.moved = true;
      if (!down.moved) return;
      const g = groundAtPx(px, py); if (!g) return;
      if (draft && draft.line) {
        const d = draft.line;
        if (d.type === "pen") { const last = d.pts[d.pts.length - 1]; if (Math.hypot(g[0] - last[0], g[1] - last[1]) > 0.3) d.pts.push(g); }
        else d.pts = [d.pts[0], g];
        overNeeds = true; return;
      }
      if (draft && draft.zone) { draft.zone.b = g; overNeeds = true; return; }
      if (down.snap) { pushUndo(down.snap); down.snap = null; }
      const dx = g[0] - down.g[0], dz = g[1] - down.g[1];
      if (down.handle) {
        if (down.handle[0] === "z") { state.zones[sel.i][down.handle[1]] = g; overNeeds = true; return; }
        const l = state.lines[sel.i];
        if (down.handle === "a") l.pts[0] = g; else if (down.handle === "b") l.pts[l.pts.length - 1] = g; else l.c = g;
        overNeeds = true; return;
      }
      const d = down.drag; if (!d) return;
      if (d.t === "item") {
        [d.it.x, d.it.z] = clampXZ(g[0] + d.off[0], g[1] + d.off[1]);
        const o = findObj(d.it.id); if (o) o.position.set(d.it.x, 0, d.it.z);
        dirty();
      } else {
        const shift = (p) => { p[0] = r2(p[0] + dx); p[1] = r2(p[1] + dz); };
        if (d.t === "mark") { const m = state.marks[d.i]; m.x = r2(m.x + dx); m.z = r2(m.z + dz); }
        else if (d.t === "line") { const l = state.lines[d.i]; l.pts.forEach(shift); if (l.c) shift(l.c); }
        else if (d.t === "zone") { shift(state.zones[d.i].a); shift(state.zones[d.i].b); }
        down.g = g;
        overNeeds = true;
      }
    });
    const up = () => {
      if (!down) return;
      const d = down; down = null;
      if (draft && draft.line) {
        const l = draft.line; draft = null;
        const a = l.pts[0], b = l.pts[l.pts.length - 1];
        if (d.moved && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.8) {
          pushUndo(d.snap);
          const st = LINE_TYPES[l.type];
          const line = { type: st.as || l.type, pts: l.pts };
          if (st.curve) {
            const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
            line.c = [r2((a[0] + b[0]) / 2 - (dz / len) * len * 0.25), r2((a[1] + b[1]) / 2 + (dx / len) * len * 0.25)];
          }
          state.lines.push(line);
          select({ t: "line", i: state.lines.length - 1 });
          setMode("select");
        }
        overNeeds = true; return;
      }
      if (draft && draft.zone) {
        const z = draft.zone; draft = null;
        if (Math.abs(z.b[0] - z.a[0]) > 0.8 && Math.abs(z.b[1] - z.a[1]) > 0.8) {
          pushUndo(d.snap);
          state.zones.push({ shape: zoneShape, a: z.a, b: z.b, color: zoneColor, hatch: zoneHatch, fill: zoneFill });
          select({ t: "zone", i: state.zones.length - 1 });
          setMode("select");
        }
        overNeeds = true; return;
      }
      if (d.moved) renderToolbar();
    };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);

    /* ----- 아이템 ----- */
    function spawnPoint(kind) {
      const n = state.items.length;
      const jitter = [((n * 37) % 7 - 3) * 0.8, ((n * 53) % 5 - 2) * 0.8];
      if (kind === "gk") return clampXZ(jitter[0] * 0.6, 2.2 + Math.abs(jitter[1]) * 0.4);
      const c = groundAtPx(W * 0.5, H * 0.58) || [0, 9];
      return clampXZ(c[0] + jitter[0], c[1] + jitter[1]);
    }
    function nextLabel(kind) {
      if (kind === "gk") return "1";
      if (kind === "coach" || !isPerson(kind)) return "";
      const used = new Set(state.items.filter((i) => i.kind === kind).map((i) => i.label));
      let n = kind === "own" ? 2 : 7;
      while (used.has(String(n))) n++;
      return String(n);
    }
    function faceGoal(it) { it.rot = r2(Math.atan2(0 - it.x, 0 - it.z)); }
    function addItem(kind, pose) {
      pushUndo();
      const [x, z] = spawnPoint(kind);
      const it = { id: uid(), kind, x, z, rot: 0, label: nextLabel(kind) };
      if (isPerson(kind)) { it.pose = pose || DEFAULT_POSE[kind]; it.mirror = false; }
      if (kind !== "gk" && isPerson(kind)) faceGoal(it);
      if (kind === "ball") it.h = 0;
      state.items.push(it);
      syncScale();
      world.itemsG.add(makeItem(it));
      select({ t: "item", it });
      dirty();
    }
    function update(it, patch) { Object.assign(it, patch); rebuildItem(it); renderToolbar(); }
    function copySelected() {
      const src = selItem(); if (!src) return;
      pushUndo();
      const fwd = [Math.sin(src.rot || 0), Math.cos(src.rot || 0)];
      const [x, z] = clampXZ(src.x + fwd[0] * 1.6 + 0.4, src.z + fwd[1] * 1.6);
      const copy = { ...src, id: uid(), x, z, op: 1 };
      if (canSequence(src.kind)) {
        const pid = src.pid || src.id;
        src.pid = pid; copy.pid = pid;
        if (!src.step) src.step = 1;
        copy.step = Math.max(...state.items.filter((i) => (i.pid || i.id) === pid).map((i) => i.step || 0)) + 1;
        if (src.op == null || src.op >= 0.999) src.op = 0.45;
        rebuildItem(src);
      } else { delete copy.pid; delete copy.step; }
      state.items.push(copy);
      world.itemsG.add(makeItem(copy));
      select({ t: "item", it: copy });
      dirty();
    }
    // 똑같이 하나 더: 선수·코치·공·도구·선·번호·텍스트·영역 모두 (조금 옆에 놓임, 애니메이션 순서는 없음)
    let clip = null;
    function cloneOf(s0) {
      if (!s0) return null;
      if (s0.t === "item") return { t: "item", v: JSON.parse(JSON.stringify(s0.it)) };
      const arr = { line: state.lines, mark: state.marks, zone: state.zones }[s0.t];
      return { t: s0.t, v: JSON.parse(JSON.stringify(arr[s0.i])) };
    }
    function pasteClone(c, dx = 1.2, dz = 0.6) {
      if (!c) return;
      pushUndo();
      const v = JSON.parse(JSON.stringify(c.v));
      const mv = (p) => { p[0] = r2(p[0] + dx); p[1] = r2(p[1] + dz); };
      if (c.t === "item") {
        [v.x, v.z] = clampXZ(v.x + dx, v.z + dz);
        v.id = uid(); delete v.pid; delete v.step; delete v.layer;
        state.items.push(v);
        world.itemsG.add(makeItem(v));
        select({ t: "item", it: v });
      } else if (c.t === "line") {
        v.pts.forEach(mv); if (v.c) mv(v.c);
        state.lines.push(v); select({ t: "line", i: state.lines.length - 1 });
      } else if (c.t === "mark") {
        v.x = r2(v.x + dx); v.z = r2(v.z + dz);
        if (v.kind === "num") v.n = nextNum++;
        state.marks.push(v); select({ t: "mark", i: state.marks.length - 1 });
      } else if (c.t === "zone") {
        mv(v.a); mv(v.b);
        state.zones.push(v); select({ t: "zone", i: state.zones.length - 1 });
      }
      clip = cloneOf(sel);
      dirty();
    }
    function duplicateSelected() { pasteClone(cloneOf(sel)); }
    function copyToClip() { clip = cloneOf(sel); return !!clip; }
    function pasteClip() { pasteClone(clip); }
    function deleteSelected() {
      if (!sel) return;
      pushUndo();
      if (sel.t === "item") { state.items = state.items.filter((i) => i !== sel.it); rebuildAll(); }
      else if (sel.t === "line") state.lines.splice(sel.i, 1);
      else if (sel.t === "mark") state.marks.splice(sel.i, 1);
      else if (sel.t === "zone") state.zones.splice(sel.i, 1);
      select(null);
      dirty();
    }

    /* ----- 떠 있는 작은 메뉴 ----- */
    const B = (act, label, title, extra = "") => `<button type="button" data-a="${act}" title="${title || label}" ${extra}>${label}</button>`;
    function renderToolbar() {
      if (!sel || playing) { ftb.hidden = true; return; }
      let html = "";
      if (sel.t === "item") {
        const it = sel.it, person = isPerson(it.kind);
        html += `<span class="ftb-name">${KIND_NAME[it.kind]}${it.step ? ` · 순서 ${it.step}` : ""}</span>`;
        if (canRotate(it.kind)) html += B("rotL", "⟲", "왼쪽으로 돌리기") + B("rotR", "⟳", "오른쪽으로 돌리기");
        if (person) html += B("mirror", "⇋", "좌우 반전");
        html += B("front", "⤒ 앞으로", "겹칠 때 맨 앞으로") + B("back", "⤓ 뒤로", "겹칠 때 맨 뒤로");
        if (canSequence(it.kind)) html += B("copy", "＋ 다음 위치", "같은 선수를 복사해서 다음 순서로 (애니메이션)");
        if (person || it.kind === "ball") html += B("op", "◐", "투명도 바꾸기");
        if (it.kind === "ball") html += B("ballH", it.h > 0.3 ? "⬇" : "⬆", it.h > 0.3 ? "땅으로" : "공중으로");
        if (it.step) html += B("unseq", "순서 빼기", "애니메이션 순서에서 빼기");
      } else if (sel.t === "line") {
        const l = state.lines[sel.i];
        html += `<span class="ftb-name">선</span>`;
        html += LINE_COLORS.map((c) => `<button type="button" class="sw ${lineColor(l) === c ? "on" : ""}" data-a="color" data-v="${c}" style="--c:${c}" title="색"></button>`).join("");
        if (l.type !== "pen") html += B("dash", lineDashed(l) ? "점선" : "실선", "실선 / 점선 바꾸기");
        if (bendable(l)) html += l.c ? B("straight", "곧게", "곧게 펴기") : B("bend", "휘기", "휘게 만들기");
      } else if (sel.t === "mark") {
        const m = state.marks[sel.i];
        if (m.kind === "num") {
          html += B("numDown", "−", "번호 줄이기") + `<span class="ftb-name">${m.n}</span>` + B("numUp", "+", "번호 늘리기");
          html += ["#e5383b", "#111111", "#2f6fdc"].map((c) => `<button type="button" class="sw ${(m.color || "#e5383b") === c ? "on" : ""}" data-a="numColor" data-v="${c}" style="--c:${c}"></button>`).join("");
        } else {
          html += `<input data-f="label" value="${esc(m.label)}" maxlength="60" aria-label="텍스트 내용" />`;
          html += ["s", "m", "l"].map((v, k) => B("size", ["가", "가", "가"][k], ["작게", "보통", "크게"][k], `data-v="${v}" class="sz sz-${v} ${m.size === v ? "on" : ""}"`)).join("");
        }
      } else if (sel.t === "zone") {
        const z = state.zones[sel.i];
        html += Object.entries(ZONE_SHAPES).map(([k, n]) => B("zoneShape", { rect: "▢", circle: "◯", tri: "△" }[k], n, `data-v="${k}" class="${z.shape === k ? "on" : ""}"`)).join("");
        html += B("zoneHatch", "▨ 빗금", "빗금 켜기 / 끄기", `class="tg ${z.hatch ? "on" : ""}"`);
        html += B("zoneFill", "■ 채우기", "채우기 켜기 / 끄기", `class="tg ${z.fill ? "on" : ""}"`);
        html += ZONE_COLORS.map((c) => `<button type="button" class="sw ${z.color === c ? "on" : ""}" data-a="zoneColor" data-v="${c}" style="--c:${c}"></button>`).join("");
      }
      html += B("dup", "⧉ 복사", "똑같이 하나 더 만들기 (⌘D)") + B("del", "🗑", "삭제", 'class="danger"');
      ftb.innerHTML = html;
      ftb.hidden = false;
      placeToolbar();
    }
    function anchorOf() {
      if (!sel) return null;
      if (sel.t === "item") return P2(sel.it.x, sel.it.z, isPerson(sel.it.kind) ? 2.2 : sel.it.kind === "minigoal" ? 1.5 : 0.8);
      if (sel.t === "line") { const l = state.lines[sel.i]; const pts = linePath(l, 12); return proj(pts[Math.floor(pts.length / 2)]); }
      if (sel.t === "mark") { const m = state.marks[sel.i]; const [x, y] = P2(m.x, m.z); return [x, y - (m.kind === "text" ? unit() * 46 : unit() * 14)]; }
      if (sel.t === "zone") { const pts = zonePts(state.zones[sel.i]).map(([x, z]) => P2(x, z, 0.01)); return [pts.reduce((s, p) => s + p[0], 0) / pts.length, Math.min(...pts.map((p) => p[1]))]; }
    }
    function placeToolbar() {
      if (ftb.hidden) return;
      const a = anchorOf(); if (!a) return;
      const w = ftb.offsetWidth, h = ftb.offsetHeight;
      const x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, a[0]));
      const y = Math.max(h + 6, a[1] - 10);
      ftb.style.left = x + "px"; ftb.style.top = y + "px";
    }
    ftb.addEventListener("pointerdown", (e) => e.stopPropagation());
    ftb.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b || !sel) return;
      const a = b.dataset.a, v = b.dataset.v;
      if (a === "del") return deleteSelected();
      if (a === "copy") return copySelected();
      if (a === "dup") return duplicateSelected();
      pushUndo();
      if (sel.t === "item") {
        const it = sel.it;
        if (a === "rotL" || a === "rotR") update(it, { rot: r2((it.rot || 0) + (a === "rotL" ? -1 : 1) * Math.PI / 4) });
        else if (a === "mirror") update(it, { mirror: !it.mirror });
        else if (a === "front" || a === "back") {
          const ls = state.items.map((x) => x.layer || 0);
          it.layer = a === "front" ? Math.max(...ls) + 1 : Math.min(...ls) - 1;
          overNeeds = true;
        }
        else if (a === "op") update(it, { op: it.op == null || it.op > 0.8 ? 0.45 : it.op > 0.3 ? 0.2 : 1 });
        else if (a === "ballH") update(it, { h: it.h > 0.3 ? 0 : 1.6 });
        else if (a === "unseq") update(it, { step: undefined, op: 1 });
      } else if (sel.t === "line") {
        const l = state.lines[sel.i];
        if (a === "color") l.color = v;
        else if (a === "dash") l.dashed = !lineDashed(l);
        else if (a === "straight") delete l.c;
        else if (a === "bend") { const [p, q] = [l.pts[0], l.pts[1]]; const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz) || 1; l.c = [r2((p[0] + q[0]) / 2 - dz * 0.25), r2((p[1] + q[1]) / 2 + dx * 0.25)]; void len; }
        renderToolbar();
      } else if (sel.t === "mark") {
        const m = state.marks[sel.i];
        if (a === "numUp") m.n = Math.min(99, m.n + 1);
        else if (a === "numDown") m.n = Math.max(1, m.n - 1);
        else if (a === "numColor") m.color = v;
        else if (a === "size") m.size = v;
        renderToolbar();
      } else if (sel.t === "zone") {
        const z = state.zones[sel.i];
        if (a === "zoneColor") z.color = v;
        else if (a === "zoneShape") z.shape = v;
        else if (a === "zoneHatch") z.hatch = !z.hatch;
        else if (a === "zoneFill") z.fill = !z.fill;
        renderToolbar();
      }
      overNeeds = true;
    });
    let typing = false;
    ftb.addEventListener("input", (e) => {
      if (e.target.dataset.f !== "label" || !sel || sel.t !== "mark") return;
      if (!typing) { pushUndo(); typing = true; }
      state.marks[sel.i].label = e.target.value;
      overNeeds = true;
    });
    ftb.addEventListener("change", () => { typing = false; });

    /* ----- 아래 탭 · 팔레트 ----- */
    function setMode(m) {
      mode = m;
      stage.dataset.mode = m;
      if (hint) hint.textContent = playing ? HINT.play : HINT[m] || HINT.select;
      syncPalette();
    }
    function renderPalette() {
      if (!palette) return;
      const tabs = TABS.map((t) => `<button type="button" role="tab" class="pt ${tab === t.id ? "on" : ""}" data-tab="${t.id}" aria-selected="${tab === t.id}">${t.name}</button>`).join("");
      let body = "";
      if (POSE_LIST[tab]) {
        const FRONT_ICON = new Set(["catch_mid", "catch_knee"]); // 정수리가 보이는 정면 모습으로 보여줌
        body = POSE_LIST[tab].map((id) => `<button type="button" class="pi" data-pose="${id}" title="${POSES[id].n}"><img src="${figureIcon(tab, id, 112, FRONT_ICON.has(id) ? -0.28 : 0.55)}" alt="" width="56" height="56" /><span>${POSES[id].n}</span></button>`).join("");
      } else if (tab === "gear") {
        body = GEAR.map((k) => `<button type="button" class="pi" data-gear="${k}" title="${KIND_NAME[k]}"><img src="${equipIcon(k)}" alt="" width="56" height="56" /><span>${KIND_NAME[k]}</span></button>`).join("");
      } else if (tab === "line") {
        body = Object.entries(LINE_TYPES).map(([k, v]) => `<button type="button" class="pi pi-line" data-line="${k}" title="${v.name}"><svg viewBox="0 0 24 24" width="40" height="40">${LINE_ICON[k]}</svg><span>${v.name}</span></button>`).join("")
          + `<p class="pal-note">빨간 실선 = 공 · 노란 점선 = 선수 움직임 (그은 뒤 색·모양을 바꿀 수 있어요)</p>`;
      } else if (tab === "num") {
        body = `<div class="pal-row"><span class="pal-badge">${nextNum}</span><p class="pal-note">경기장을 누를 때마다 다음 번호가 붙어요.</p><button type="button" class="pal-btn" data-numreset>1부터 다시</button></div>`;
      } else if (tab === "text") {
        body = `<div class="pal-row"><p class="pal-note">글자를 넣을 곳을 경기장에서 누르세요. 위에 뜨는 칸에 바로 입력할 수 있어요.</p></div>`;
      } else if (tab === "zone") {
        body = `<div class="pal-row">
          ${Object.entries(ZONE_SHAPES).map(([k, n]) => `<button type="button" class="pi pi-shape ${zoneShape === k ? "on" : ""}" data-zone="${k}"><span class="shp">${{ rect: "▢", circle: "◯", tri: "△" }[k]}</span><span>${n}</span></button>`).join("")}
          <span class="pal-sep"></span>
          <button type="button" class="pal-btn ${zoneHatch ? "on" : ""}" data-zhatch>▨ 빗금 ${zoneHatch ? "켬" : "끔"}</button>
          <button type="button" class="pal-btn ${zoneFill ? "on" : ""}" data-zfill>■ 채우기 ${zoneFill ? "켬" : "끔"}</button>
          ${ZONE_COLORS.map((c) => `<button type="button" class="pal-sw ${zoneColor === c ? "on" : ""}" data-zcolor="${c}" style="--c:${c}" aria-label="색"></button>`).join("")}
          <p class="pal-note">모양을 고르고 경기장 위를 끌어서 그리세요. 그린 뒤에도 메뉴에서 바꿀 수 있어요.</p>
        </div>`;
      }
      const MODE_OF = { num: "num", text: "text", zone: "zone", line: "line" };
      if (MODE_OF[tab]) {
        const pick = `<button type="button" class="pi pi-shape pal-pick ${mode === "select" ? "on" : ""}" data-pick title="선택 · 이동 (ESC)"><span class="shp"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 3l14 8-6 2-2 6z" fill="#fff"/></svg></span><span>선택·이동</span></button>`;
        const draw = `<button type="button" class="pi pi-shape ${mode === MODE_OF[tab] ? "on" : ""}" data-drawmode="${MODE_OF[tab]}"><span class="shp">${{ num: "①", text: "T", zone: "▨", line: "↗" }[tab]}</span><span>${{ num: "번호 붙이기", text: "글자 넣기", zone: "영역 그리기", line: "선 그리기" }[tab]}</span></button>`;
        body = `<div class="pal-row">${pick}${tab === "line" ? "" : draw}<span class="pal-sep"></span>${body}</div>`;
      }
      palette.innerHTML = `<div class="pal-tabs" role="tablist">${tabs}</div><div class="pal-body">${body}</div>`;
      syncPalette();
    }
    function syncPalette() {
      if (!palette) return;
      const it = selItem();
      palette.querySelectorAll("[data-pose]").forEach((b) => b.classList.toggle("on", !!it && it.kind === tab && it.pose === b.dataset.pose));
      palette.querySelectorAll("[data-line]").forEach((b) => b.classList.toggle("on", mode === "line" && lineType === b.dataset.line));
      palette.querySelectorAll("[data-pick]").forEach((b) => b.classList.toggle("on", mode === "select"));
      palette.querySelectorAll("[data-drawmode]").forEach((b) => b.classList.toggle("on", mode === b.dataset.drawmode));
    }
    palette && palette.addEventListener("click", (e) => {
      if (playing) return;
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.tab) {
        tab = b.dataset.tab;
        setMode(tab === "num" ? "num" : tab === "text" ? "text" : tab === "zone" ? "zone" : "select");
        renderPalette();
        return;
      }
      if (b.dataset.pose) {
        const it = selItem();
        if (it && it.kind === tab) { pushUndo(); update(it, { pose: b.dataset.pose }); syncPalette(); }
        else addItem(tab, b.dataset.pose);
        return;
      }
      if (b.dataset.gear) return addItem(b.dataset.gear);
      if (b.dataset.line) { lineType = b.dataset.line; setMode("line"); return; }
      if ("numreset" in b.dataset) { nextNum = 1; renderPalette(); return; }
      if ("pick" in b.dataset) { setMode("select"); renderPalette(); return; }
      if (b.dataset.drawmode) { setMode(b.dataset.drawmode); renderPalette(); return; }
      if (b.dataset.zone) { zoneShape = b.dataset.zone; setMode("zone"); renderPalette(); return; }
      if ("zhatch" in b.dataset) { zoneHatch = !zoneHatch; if (!zoneHatch && !zoneFill) zoneFill = true; renderPalette(); return; }
      if ("zfill" in b.dataset) { zoneFill = !zoneFill; if (!zoneHatch && !zoneFill) zoneHatch = true; renderPalette(); return; }
      if (b.dataset.zcolor) { zoneColor = b.dataset.zcolor; renderPalette(); }
    });

    /* ----- 재생: 같은 선수(복사본)를 순서대로 이어서 움직임 ----- */
    const ease = (t) => t * t * (3 - 2 * t);
    const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
    function play() {
      if (playing) { stop(); return true; }
      const groups = new Map();
      state.items.forEach((it) => {
        if (!it.step || !canSequence(it.kind)) return;
        const k = it.pid || it.id;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(it);
      });
      if (![...groups.values()].some((g) => g.length > 1)) return false;
      select(null);
      const hidden = new Set(state.items.filter((i) => groups.has(i.pid || i.id)).map((i) => i.id));
      world.itemsG.children.forEach((o) => { if (hidden.has(o.userData.itemId)) o.visible = false; });
      const steps = [], figs = [];
      const actors = [...groups.values()].map((keys) => {
        keys.sort((a, b) => a.step - b.step);
        keys.forEach((k) => steps.push(k.step));
        const first = keys[0];
        if (isPerson(first.kind)) {
          const fig = { it: { ...first, op: 1 }, rig: makeRig() };
          figs.push(fig);
          return { keys, fig };
        }
        const obj = makeItem({ ...first, op: 1, h: 0 });
        world.scene.add(obj);
        return { keys, obj };
      });
      playing = { actors, figs, hide: hidden, min: Math.min(...steps), max: Math.max(...steps), start: performance.now() };
      setMode(mode); overNeeds = true;
      onPlayChange && onPlayChange(true);
      return true;
    }
    function stepPlayback() {
      const p = playing;
      const s = p.min + (performance.now() - p.start) / 1000 / STEP_T;
      p.actors.forEach(({ keys, obj, fig }) => {
        const tgt = obj ? obj : null;
        let k0 = keys[0], k1 = keys[0], f = 0;
        if (s >= keys[keys.length - 1].step) k0 = k1 = keys[keys.length - 1];
        else if (s > keys[0].step) {
          for (let i = 0; i < keys.length - 1; i++) if (s >= keys[i].step && s < keys[i + 1].step) { k0 = keys[i]; k1 = keys[i + 1]; break; }
          f = (s - k0.step) / (k1.step - k0.step);
        }
        const m = ease(f);
        const x = k0.x + (k1.x - k0.x) * m, z = k0.z + (k1.z - k0.z) * m, rot = lerpAngle(k0.rot || 0, k1.rot || 0, m);
        if (fig) {
          Object.assign(fig.it, { x, z, rot });
          poseRig(fig.rig, fig.it, lerpParams(poseParams(k0.pose, k0.mirror), poseParams(k1.pose, k1.mirror), ease(Math.min(1, Math.max(0, (f - 0.3) / 0.7)))));
          return;
        }
        void tgt;
        obj.position.set(x, 0, z);
        obj.rotation.y = rot;
        if (obj.children[0]) { const h0 = k0.h || 0, h1 = k1.h || 0; obj.children[0].position.y = 0.11 + h0 + (h1 - h0) * m + Math.sin(Math.PI * m) * (k0 === k1 ? 0 : Math.max(h0, h1) > 0.3 ? 1.2 : 0); }
      });
      needs = true; overNeeds = true;
      if (s > p.max + 0.9) stop();
    }
    function stop() {
      if (!playing) return;
      playing.actors.forEach(({ obj }) => { if (obj) world.scene.remove(obj); });
      playing = null;
      world.itemsG.children.forEach((o) => { o.visible = true; });
      setMode(mode); dirty();
      onPlayChange && onPlayChange(false);
    }

    renderPalette();
    setMode("select");

    const load = (s) => {
      stop();
      state = normalize(JSON.parse(JSON.stringify(s)));
      camera = makeCamera(state.angle); camera.aspect = W / H; camera.updateProjectionMatrix();
      world.setTurf(state.turf);
      nextNum = Math.max(0, ...state.marks.filter((m) => m.kind === "num").map((m) => m.n)) + 1;
      select(null);
      rebuildAll();
    };

    return {
      get state() { return state; },
      get isPlaying() { return !!playing; },
      get canUndo() { return undoS.length > 0; },
      get canRedo() { return redoS.length > 0; },
      setAngle(a) {
        if (!ANGLES[a]) return;
        pushUndo(); state.angle = a;
        camera = makeCamera(a); camera.aspect = W / H; camera.updateProjectionMatrix();
        rebuildAll(); renderToolbar();
      },
      setTurf(t) { if (!TURF_STYLE[t]) return; pushUndo(); state.turf = t; world.setTurf(t); dirty(); },
      getState: () => JSON.parse(snap()),
      load(s) { pushUndo(); load(s); },
      undo() { const prev = undoS.pop(); if (!prev) return false; redoS.push(snap()); load(JSON.parse(prev)); onChange && onChange(); return true; },
      redo() { const next = redoS.pop(); if (!next) return false; undoS.push(snap()); load(JSON.parse(next)); onChange && onChange(); return true; },
      clear() { stop(); if (this.isEmpty()) return; pushUndo(); state.items = []; state.lines = []; state.marks = []; state.zones = []; nextNum = 1; select(null); rebuildAll(); renderPalette(); },
      play, stop, copySelected, deleteSelected, duplicateSelected, copyToClip, pasteClip,
      escape() { if (mode !== "select") setMode("select"); else select(null); },
      refresh() { resize(); },
      hasSelection: () => !!sel,
      isEmpty: () => !state.items.length && !state.lines.length && !state.marks.length && !state.zones.length,
    };
  }

  window.Tactics3D = { ready: Promise.resolve(), createPad, boardImage, figureIcon, ANGLES, TURFS, POSES, EQUIP, POSE_ART, normalize };
})();
