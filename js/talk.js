/* =========================================================
   FOR COACH — GK 코치 대화방 (게시판 + 댓글)
   - 누구나 이름(소속)과 글 비밀번호만 적으면 바로 올라가요
   - 글/댓글 수정·삭제는 그 비밀번호로 (비밀번호는 암호화된 값만 저장, 아무도 못 읽어요)
   - 관리자(트레이닝·아카이브와 같은 관리자 로그인)는 어떤 글이든 삭제할 수 있어요
   ========================================================= */
(function () {
  const root = document.getElementById("talkPanel");
  if (!root) return;

  const CATS = ["GK코치 공고", "GK코치 자리 찾기", "GK선수 모집 및 팀 모집", "GK코치들의 이야기"];
  const PER_PAGE = 10;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const paras = (t = "") => t.trim() ? t.trim().split(/\n\s*\n/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("") : "";
  const ms = (ts) => (ts && ts.toMillis ? ts.toMillis() : Date.now());
  const when = (ts) => {
    const t = ms(ts), d = Date.now() - t;
    if (d < 60e3) return "방금";
    if (d < 3600e3) return `${Math.floor(d / 60e3)}분 전`;
    if (d < 86400e3) return `${Math.floor(d / 3600e3)}시간 전`;
    return new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  };
  const byline = (o) => (o.org ? `${o.author} (${o.org})` : o.author);
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");
  function openModal(html, wide = false) {
    modalBody.innerHTML = `<button class="icon-btn modal-close" data-close aria-label="닫기">✕</button>${html}`;
    modal.classList.toggle("wide", wide);
    if (!modal.open) modal.showModal();
    return modalBody;
  }
  const closeModal = () => { if (modal.open) modal.close(); };
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400);
  }
  // 비밀번호는 글마다 다른 값과 섞어서 암호화한 결과만 보내요
  async function hashPw(key, pw) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`keeperlab-talk:${key}:${pw}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  let fb = null, posts = [], notices = [], cat = "all", search = "", page = 1, loaded = false;
  const boot = () => KLFB.boot().then((x) => (fb = x));

  async function load() {
    if (!KLFB.ready()) { root.innerHTML = `<div class="fb-empty">대화방 준비 중이에요.</div>`; return; }
    if (!loaded) root.innerHTML = `<div class="fb-empty">불러오는 중…</div>`;
    try {
      await boot();
      const snap = await fb.db.collection("talk").orderBy("createdAt", "desc").limit(300).get();
      posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      try { // 공지 (관리자만 쓰고, 고른 탭에만 보여요)
        const ns = await fb.db.collection("talkNotice").orderBy("createdAt", "desc").get();
        notices = ns.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error(e); notices = []; }
      loaded = true;
      render();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="fb-empty">글을 불러오지 못했어요. 새로고침해 주세요.</div>`;
    }
  }

  function render() {
    const q = search.toLowerCase();
    const found = posts.filter((p) => (cat === "all" || p.cat === cat)
      && (!q || `${p.title} ${p.body} ${p.author} ${p.org || ""} ${p.region || ""}`.toLowerCase().includes(q)));
    const pages = Math.max(1, Math.ceil(found.length / PER_PAGE));
    if (page > pages) page = pages;
    const shown = found.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const admin = KLFB.isAdmin();
    root.innerHTML = `
      <div class="fb-bar">${admin
        ? `<span class="fb-admin-on">관리자 모드 · 모든 글 삭제 가능</span><button class="btn btn-ghost btn-sm" data-talk="out">관리자 나가기</button>`
        : `<button class="fb-admin-link" data-talk="admin">관리자</button>`}</div>
      <div class="chips talk-cats" role="tablist" aria-label="말머리">
        ${["all", ...CATS].map((c) => `<button class="chip ${c === cat ? "is-active" : ""}" data-cat="${esc(c)}" role="tab" aria-selected="${c === cat}">${c === "all" ? "전체" : esc(c)}</button>`).join("")}
      </div>
      ${(() => {
        const here = notices.filter((n) => (n.where || []).includes(cat));
        return here.length ? `<div class="talk-notices">${here.map((n) => `
          <div class="talk-notice"><b>공지</b><p>${esc(n.text).replace(/\n/g, "<br>")}</p>
            ${admin ? `<span class="tn-acts"><button data-notice-edit="${n.id}">수정</button><button data-notice-del="${n.id}">삭제</button></span>` : ""}
          </div>`).join("")}</div>` : "";
      })()}
      <form class="fb-search talk-search" role="search">
        <input name="q" type="search" value="${esc(search)}" placeholder="제목 · 내용 · 이름 · 지역 검색" aria-label="대화방 검색" autocomplete="off" />
        <button class="btn btn-ghost btn-sm">검색</button>
        ${search ? `<button type="button" class="btn btn-ghost btn-sm" data-talk="clear">전체 보기</button>` : ""}
      </form>
      ${shown.length ? `<ul class="talk-list">${shown.map((p) => `
        <li><button class="talk-row" data-post="${p.id}">
          <span class="talk-cat">${esc(p.cat)}</span>
          <span class="talk-title">${esc(p.title)}${p.region ? `<em>${esc(p.region)}</em>` : ""}</span>
          <span class="talk-meta">${p.byAdmin ? `<i class="talk-official">운영자</i>` : ""}${esc(byline(p))} · ${when(p.createdAt)}</span>
        </button></li>`).join("")}</ul>`
        : `<div class="fb-empty">${search || cat !== "all" ? "조건에 맞는 글이 없어요." : "아직 글이 없어요. 첫 글을 남겨주세요!"}</div>`}
      ${pages > 1 ? `<nav class="fb-pages" aria-label="페이지">
        <button class="fb-pg" data-pg="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="이전 페이지">‹</button>
        ${Array.from({ length: pages }, (_, i) => i + 1).map((n) => `<button class="fb-pg${n === page ? " is-on" : ""}" data-pg="${n}">${n}</button>`).join("")}
        <button class="fb-pg" data-pg="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="다음 페이지">›</button>
      </nav>` : ""}
      <p class="fb-help">연락처를 적을 때는 공개되는 글이라는 점을 꼭 생각해 주세요. 광고 · 비방 글은 관리자가 지울 수 있어요.</p>`;
  }

  root.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-cat]");
    if (c) { cat = c.dataset.cat; page = 1; return render(); }
    const pg = e.target.closest("[data-pg]");
    if (pg && !pg.disabled) { page = +pg.dataset.pg; render(); root.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const ne = e.target.closest("[data-notice-edit]");
    if (ne && KLFB.isAdmin()) return noticeForm(notices.find((n) => n.id === ne.dataset.noticeEdit));
    const nd = e.target.closest("[data-notice-del]");
    if (nd && KLFB.isAdmin()) {
      if (nd.dataset.sure !== "1") { nd.dataset.sure = "1"; nd.textContent = "한 번 더 누르면 삭제"; return; }
      await fb.db.doc(`talkNotice/${nd.dataset.noticeDel}`).delete();
      toast("공지를 내렸어요"); return load();
    }
    const row = e.target.closest("[data-post]");
    if (row) return openPost(row.dataset.post);
    const b = e.target.closest("[data-talk]"); if (!b) return;
    if (b.dataset.talk === "clear") { search = ""; page = 1; return render(); }
    if (b.dataset.talk === "admin") return KLFB.adminLogin({ openModal: (h) => openModal(h), closeModal, toast });
    if (b.dataset.talk === "out") { await KLFB.signOut(); toast("관리자 모드를 나왔어요"); }
  });
  root.addEventListener("submit", (e) => {
    const f = e.target.closest(".talk-search"); if (!f) return;
    e.preventDefault(); search = f.q.value.trim(); page = 1; render();
  });

  /* ---------- 글쓰기 · 수정 ---------- */
  // 지역은 크게 (서울 · 경기 …)
  const REGIONS_BIG = ["서울", "경기", "인천", "강원", "충청", "전라", "경상", "제주", "전국", "해외", "온라인"];
  const regionOptions = (cur = "") => `<option value="">선택 안 함</option>
      ${REGIONS_BIG.map((a) => `<option ${a === cur ? "selected" : ""}>${a}</option>`).join("")}
      ${cur && !REGIONS_BIG.includes(cur) ? `<option selected>${esc(cur)}</option>` : ""}`;

  // 말머리마다 쓰는 법 (제목 예시 · 안내 · 내용 양식)
  const GUIDE = {
    "GK코치 공고": {
      title: "예) OO FC U12 골키퍼 코치 구합니다",
      tip: "팀에서 GK 코치를 구할 때 써요. 아래 항목을 채워주세요.",
      body: "■ 지역 : \n■ 팀 이름 : \n■ 대상 · 연령 : \n■ 요일 · 시간 : \n■ 급여 : \n■ 자격 요건 : \n■ 우대 사항 : \n■ 지원 방법 : \n\n■ 추가 내용 : ",
    },
    "GK코치 자리 찾기": {
      title: "예) 경기 지역 팀 구해요 (주말 가능)",
      tip: "GK 코치가 일할 팀을 찾을 때 써요. 프로필을 함께 적어주세요.",
      body: "■ 희망 지역 : \n■ 가능 요일 · 시간 : \n■ 희망 급여 : \n■ 지도 가능 연령 : \n■ 경력 : \n■ 자격증 : \n\n■ 자기소개 : ",
    },
    // 이 말머리는 누가 쓰는지에 따라 양식이 둘로 나뉘어요
    "GK선수 모집 및 팀 모집|team": {
      title: "예) OO FC U15 골키퍼 선수 모집합니다",
      tip: "팀 작성 시 — 우리 팀에서 뛸 GK 선수를 모집해요. 제목 앞에 [선수 모집]이 붙어요.",
      body: "■ 팀 이름 : \n■ 지역 : \n■ 모집 연령 · 학년 : \n■ 모집 인원 : \n■ 팀 소개 : \n■ 지원 방법 : \n\n■ 추가 내용 : ",
      prefix: "[선수 모집]",
    },
    "GK선수 모집 및 팀 모집|player": {
      title: "예) 서울 지역 GK 선수, 뛸 팀 찾아요",
      tip: "선수 작성 시 — GK 선수가 뛸 팀을 찾아요. 제목 앞에 [팀 찾기]가 붙어요.",
      body: "[선수 프로필]\n■ 희망 지역 : \n■ 나이 · 학년 : \n■ 키 · 주발 : \n■ 경력 · 소속 : \n\n■ 하고 싶은 말 : ",
      prefix: "[팀 찾기]",
    },
    "GK코치들의 이야기": {
      title: "예) 겨울철 GK 훈련, 어떻게 하세요?",
      tip: "훈련 방법, 장비, 경기 이야기 등 골키퍼와 관련된 무엇이든 자유롭게 나눠요.",
      body: "",
    },
  };
  const isTemplate = (t) => !t.trim() || Object.values(GUIDE).some((g) => g.body && t.trim() === g.body.trim());

  function writeForm(post) {
    const v = (k) => esc(post ? post[k] || "" : "");
    const admin = KLFB.isAdmin(); // 관리자는 비밀번호 없이 쓰고 고쳐요
    const body = openModal(`
      <h3>${post ? "글 수정" : "글쓰기"}</h3><div class="meta">GK 코치 대화방</div>
      ${admin && !post ? modeTabs("post") : ""}
      <form class="form" id="talkForm">
        <div class="form-row">
          <label>말머리<select name="cat" required>${CATS.map((c) => `<option ${post && post.cat === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
          <label>지역<select name="region">${regionOptions(post ? post.region : "")}</select></label>
        </div>
        <div class="talk-kind" hidden role="radiogroup" aria-label="누가 쓰나요">
          <label class="kind-opt"><input type="radio" name="kind" value="team" checked /><span><b>팀 작성 시</b>선수 모집</span></label>
          <label class="kind-opt"><input type="radio" name="kind" value="player" /><span><b>선수 작성 시</b>팀 찾기</span></label>
        </div>
        <p class="form-hint talk-tip"></p>
        <label>제목<input name="title" required maxlength="80" value="${v("title")}" /></label>
        <label>내용<textarea name="body" required maxlength="5000" rows="12">${v("body")}</textarea></label>
        <label>연락 방법 (선택 · 모두에게 공개돼요)<input name="contact" maxlength="80" value="${v("contact")}" placeholder="예) 카카오 오픈채팅 링크, 이메일" /></label>
        ${post ? "" : `<div class="form-row">
          <label>이름<input name="author" required maxlength="20" value="${esc(admin ? "KEEPER LAB" : localStorage.getItem("kl_name") || "")}" placeholder="예) 유수영" /></label>
          <label>소속 (선택)<input name="org" maxlength="30" value="${esc(admin ? "" : localStorage.getItem("kl_org") || "")}" placeholder="예) KEEPER LAB" /></label>
        </div>`}
        ${admin
          ? `<p class="form-hint">관리자 모드라 비밀번호 없이 올라가요. 글에 <b>운영자</b> 표시가 붙어요.</p>`
          : `<label>${post ? "글 비밀번호 (쓸 때 정한 비밀번호)" : "글 비밀번호 (수정 · 삭제할 때 필요해요, 4자 이상)"}<input name="pw" type="password" required minlength="4" maxlength="30" autocomplete="new-password" /></label>`}
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">${post ? "수정하기" : "올리기"}</button></div>
      </form>`, true);
    const f = $("#talkForm", body);
    // 말머리를 바꾸면 제목 예시 · 안내 · 내용 양식이 바뀌어요 (이미 쓴 내용은 그대로 둬요)
    const kindBox = $(".talk-kind", f);
    const guideKey = () => (f.cat.value === "GK선수 모집 및 팀 모집" ? `${f.cat.value}|${f.kind.value}` : f.cat.value);
    const applyGuide = () => {
      kindBox.hidden = f.cat.value !== "GK선수 모집 및 팀 모집";
      const g = GUIDE[guideKey()] || GUIDE["GK코치들의 이야기"];
      f.title.placeholder = g.title;
      $(".talk-tip", f).textContent = g.tip;
      f.body.placeholder = g.body ? "" : "자유롭게 적어주세요";
      if (isTemplate(f.body.value)) f.body.value = g.body;
    };
    f.cat.addEventListener("change", applyGuide);
    $$("[name=kind]", f).forEach((r) => r.addEventListener("change", applyGuide));
    if (post && post.cat === "GK선수 모집 및 팀 모집" && post.title.startsWith("[팀 찾기]")) f.kind.value = "player";
    applyGuide();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = (n) => (f[n] ? f[n].value.trim() : "");
      if (!val("title") || isTemplate(val("body"))) return toast("제목과 내용을 적어주세요");
      // 양식에서 비워둔 줄(■ 항목 : )은 빼고 올려요
      const cleanBody = val("body").split("\n").filter((l) => !/^■[^:]*:\s*$/.test(l.trim())).join("\n").replace(/\n{3,}/g, "\n\n").trim();
      // 선수 모집 / 팀 찾기는 제목 앞에 구분 표시를 붙여요
      const g = GUIDE[guideKey()] || {};
      let title = val("title").replace(/^\[(선수 모집|팀 찾기)\]\s*/, "");
      if (g.prefix) title = `${g.prefix} ${title}`;
      const data = { cat: val("cat"), title: title.slice(0, 80), body: cleanBody, contact: val("contact"), region: val("region") };
      if (!data.body) return toast("내용을 적어주세요");
      const btn = $(".btn-solid", f); btn.disabled = true;
      try {
        await boot();
        const batch = fb.db.batch();
        if (!post) {
          const ref = fb.db.collection("talk").doc();
          const author = val("author"), org = val("org");
          if (admin) {
            batch.set(ref, { ...data, author, org, byAdmin: true, createdAt: fb.FV.serverTimestamp() });
          } else {
            try { localStorage.setItem("kl_name", author); localStorage.setItem("kl_org", org); } catch {}
            batch.set(ref, { ...data, author, org, createdAt: fb.FV.serverTimestamp() });
            batch.set(fb.db.doc(`talkLock/${ref.id}`), { h: await hashPw(ref.id, val("pw")) });
          }
          await batch.commit();
          toast("글을 올렸어요");
          await load(); openPost(ref.id); // 창을 닫지 않고 바로 올린 글로 바꿔요
        } else {
          if (!admin) batch.set(fb.db.doc(`talkUnlock/${post.id}`), { h: await hashPw(post.id, val("pw")), t: fb.FV.serverTimestamp() });
          batch.update(fb.db.doc(`talk/${post.id}`), { ...data, updatedAt: fb.FV.serverTimestamp() });
          await batch.commit();
          toast("수정했어요");
          await load(); openPost(post.id);
        }
      } catch (err) {
        console.error(err); btn.disabled = false;
        toast(post && /permission/.test(err.code || "") ? "비밀번호가 맞지 않아요" : "올리지 못했어요. 잠시 후 다시 해주세요");
      }
    });
  }
  /* ---------- 공지 (관리자 전용) ---------- */
  const modeTabs = (on) => `<div class="talk-mode" role="tablist" aria-label="글 종류">
      <button type="button" class="${on === "post" ? "is-on" : ""}" data-mode="post" role="tab" aria-selected="${on === "post"}">일반 글</button>
      <button type="button" class="${on === "notice" ? "is-on" : ""}" data-mode="notice" role="tab" aria-selected="${on === "notice"}">공지</button>
    </div>`;
  const PLACES = [["all", "전체"], ...CATS.map((c) => [c, c])];
  function noticeForm(n) {
    const where = n ? n.where || [] : ["all"];
    const body = openModal(`
      <h3>${n ? "공지 수정" : "글쓰기"}</h3><div class="meta">공지는 고른 곳 목록 맨 위에 보여요 · 관리자만 지울 수 있어요</div>
      ${n ? "" : modeTabs("notice")}
      <form class="form" id="noticeForm">
        <label>공지 내용<textarea name="text" required maxlength="500" rows="5" placeholder="예) GK 코치 대화방이 열렸어요! 공고 글은 양식에 맞춰 써주세요.">${esc(n ? n.text : "")}</textarea></label>
        <fieldset class="sec-row notice-where">
          <legend>공지를 띄울 곳</legend>
          <div class="nw-list">
            ${PLACES.map(([k, label]) => `<label class="check"><input type="checkbox" name="where" value="${esc(k)}" ${where.includes(k) ? "checked" : ""} /> <span>${esc(label)}</span></label>`).join("")}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-where-all>모두 선택</button>
        </fieldset>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">${n ? "공지 저장" : "공지 올리기"}</button></div>
      </form>`, true);
    const f = $("#noticeForm", body);
    $("[data-where-all]", f).addEventListener("click", () => {
      const boxes = $$("[name=where]", f), all = boxes.every((b) => b.checked);
      boxes.forEach((b) => { b.checked = !all; });
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = f.text.value.trim();
      const places = $$("[name=where]:checked", f).map((b) => b.value);
      if (!text) return toast("공지 내용을 적어주세요");
      if (!places.length) return toast("공지를 띄울 곳을 하나 이상 골라주세요");
      const btn = $(".btn-solid", f); btn.disabled = true;
      try {
        if (n) await fb.db.doc(`talkNotice/${n.id}`).update({ text, where: places });
        else await fb.db.collection("talkNotice").add({ text, where: places, createdAt: fb.FV.serverTimestamp() });
        closeModal(); toast(n ? "공지를 고쳤어요" : "공지를 올렸어요"); load();
      } catch (err) { console.error(err); btn.disabled = false; toast("공지를 올리지 못했어요"); }
    });
  }
  // 글쓰기 창의 [일반 글 | 공지] 전환
  modalBody.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mode]"); if (!m || !KLFB.isAdmin()) return;
    if (m.dataset.mode === "notice" && !$("#noticeForm", modalBody)) noticeForm();
    if (m.dataset.mode === "post" && !$("#talkForm", modalBody)) writeForm();
  });

  document.getElementById("talkWrite").addEventListener("click", () => {
    if (!KLFB.ready()) return toast("대화방 준비 중이에요");
    writeForm();
  });

  /* ---------- 글 보기 · 댓글 ---------- */
  let openId = null;
  async function openPost(id) {
    const p = posts.find((x) => x.id === id); if (!p) return;
    openId = id;
    let comments = [];
    try {
      const snap = await fb.db.collection(`talk/${id}/comments`).orderBy("createdAt", "asc").get();
      comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error(e); }
    const admin = KLFB.isAdmin();
    openModal(`
      <div class="talk-view">
        <span class="talk-cat">${esc(p.cat)}</span>
        <h3>${esc(p.title)}</h3>
        <div class="meta">${p.byAdmin ? `<i class="talk-official">운영자</i>` : ""}${esc(byline(p))} · ${when(p.createdAt)}${p.updatedAt ? " · 수정됨" : ""}</div>
        ${p.region || p.contact ? `<dl class="talk-info">${p.region ? `<dt>지역</dt><dd>${esc(p.region)}</dd>` : ""}${p.contact ? `<dt>연락</dt><dd>${esc(p.contact)}</dd>` : ""}</dl>` : ""}
        <div class="article talk-body">${paras(p.body)}</div>
        <div class="talk-own" data-own>
          ${admin
            ? `<button class="btn btn-ghost btn-sm" data-admin-edit>수정</button><button class="btn btn-ghost btn-sm fb-danger" data-admin-del>삭제</button>`
            : p.byAdmin ? "" : `<button class="btn btn-ghost btn-sm" data-own-act="edit">수정</button><button class="btn btn-ghost btn-sm" data-own-act="del">삭제</button>`}
        </div>
        <section class="talk-comments">
          <h4>댓글 ${comments.length}</h4>
          ${comments.length ? `<ul>${comments.map((c) => `
            <li data-cid="${c.id}">
              <div class="tc-head">${c.byAdmin ? `<i class="talk-official">운영자</i>` : ""}<b>${esc(byline(c))}</b><span>${when(c.createdAt)}</span>
                <button class="tc-del" data-cdel="${c.id}">삭제</button></div>
              <div class="tc-body">${esc(c.body).replace(/\n/g, "<br>")}</div>
            </li>`).join("")}</ul>` : `<p class="fb-help">첫 댓글을 남겨보세요.</p>`}
          <form class="form talk-cform${admin ? " is-admin" : ""}" id="talkCForm">
            <textarea name="body" required maxlength="1000" rows="3" placeholder="댓글을 적어주세요"></textarea>
            <div class="talk-cfields">
              <input name="author" required maxlength="20" value="${esc(admin ? "KEEPER LAB" : localStorage.getItem("kl_name") || "")}" placeholder="이름" aria-label="이름" />
              <input name="org" maxlength="30" value="${esc(localStorage.getItem("kl_org") || "")}" placeholder="소속 (선택)" aria-label="소속" />
              ${admin ? "" : `<input name="pw" type="password" required minlength="4" maxlength="30" placeholder="비밀번호 (삭제용)" aria-label="댓글 비밀번호" autocomplete="new-password" />`}
              <button class="btn btn-solid btn-sm">댓글 달기</button>
            </div>
          </form>
        </section>
      </div>`, true);

    $("#talkCForm", modalBody).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, val = (n) => f[n].value.trim();
      if (!val("body")) return;
      const btn = $(".btn-solid", f); btn.disabled = true;
      try {
        const ref = fb.db.collection(`talk/${id}/comments`).doc();
        const batch = fb.db.batch();
        if (KLFB.isAdmin()) {
          batch.set(ref, { author: val("author"), org: val("org"), body: val("body"), byAdmin: true, createdAt: fb.FV.serverTimestamp() });
        } else {
          batch.set(ref, { author: val("author"), org: val("org"), body: val("body"), createdAt: fb.FV.serverTimestamp() });
          batch.set(fb.db.doc(`talkLock/${id}__${ref.id}`), { h: await hashPw(`${id}__${ref.id}`, val("pw")) });
        }
        await batch.commit();
        try { localStorage.setItem("kl_name", val("author")); localStorage.setItem("kl_org", val("org")); } catch {}
        openPost(id);
      } catch (err) { console.error(err); btn.disabled = false; toast("댓글을 올리지 못했어요"); }
    });
  }

  // 글/댓글 비밀번호 확인 칸 (창 안에서 바로)
  function askPw(anchor, label, onOk) {
    const old = $(".pw-ask", modalBody); if (old) old.remove();
    anchor.insertAdjacentHTML("afterend", `<form class="pw-ask"><input type="password" required minlength="4" maxlength="30" placeholder="${label}" aria-label="${label}" /><button class="btn btn-solid btn-sm">확인</button><button type="button" class="btn btn-ghost btn-sm" data-pw-cancel>취소</button></form>`);
    const f = $(".pw-ask", modalBody), input = $("input", f);
    input.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $(".btn-solid", f); btn.disabled = true;
      try { await onOk(input.value); } catch (err) {
        console.error(err); btn.disabled = false;
        toast(/permission/.test(err.code || "") ? "비밀번호가 맞지 않아요" : "처리하지 못했어요. 잠시 후 다시 해주세요");
      }
    });
    $("[data-pw-cancel]", f).addEventListener("click", () => f.remove());
  }

  modalBody.addEventListener("click", async (e) => {
    if (!openId || !$(".talk-view", modalBody)) return;
    const id = openId, p = posts.find((x) => x.id === id);
    const own = e.target.closest("[data-own-act]");
    if (own && own.dataset.ownAct === "edit") {
      return askPw($("[data-own]", modalBody), "글 비밀번호", async (pw) => {
        // 비밀번호가 맞는지 먼저 확인 (내용은 그대로 다시 저장)
        const batch = fb.db.batch();
        batch.set(fb.db.doc(`talkUnlock/${id}`), { h: await hashPw(id, pw), t: fb.FV.serverTimestamp() });
        batch.update(fb.db.doc(`talk/${id}`), { title: p.title });
        await batch.commit();
        writeForm(p);
        const f = $("#talkForm", modalBody); if (f) f.pw.value = pw;
      });
    }
    if (own && own.dataset.ownAct === "del") {
      return askPw($("[data-own]", modalBody), "글 비밀번호 (삭제)", async (pw) => {
        const batch = fb.db.batch();
        batch.set(fb.db.doc(`talkUnlock/${id}`), { h: await hashPw(id, pw), t: fb.FV.serverTimestamp() });
        batch.delete(fb.db.doc(`talk/${id}`));
        batch.delete(fb.db.doc(`talkLock/${id}`));
        await batch.commit();
        closeModal(); toast("삭제했어요"); load();
      });
    }
    if (e.target.closest("[data-admin-edit]") && KLFB.isAdmin()) return writeForm(p);
    if (e.target.closest("[data-admin-del]")) {
      const b = e.target.closest("[data-admin-del]");
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "한 번 더 누르면 삭제"; return; }
      await fb.db.doc(`talk/${id}`).delete();
      closeModal(); toast("삭제했어요"); load();
      return;
    }
    const cd = e.target.closest("[data-cdel]");
    if (cd) {
      const cid = cd.dataset.cdel;
      if (KLFB.isAdmin()) { await fb.db.doc(`talk/${id}/comments/${cid}`).delete(); toast("댓글을 지웠어요"); return openPost(id); }
      return askPw(cd.closest("li"), "댓글 비밀번호", async (pw) => {
        const key = `${id}__${cid}`;
        const batch = fb.db.batch();
        batch.set(fb.db.doc(`talkUnlock/${key}`), { h: await hashPw(key, pw), t: fb.FV.serverTimestamp() });
        batch.delete(fb.db.doc(`talk/${id}/comments/${cid}`));
        batch.delete(fb.db.doc(`talkLock/${key}`));
        await batch.commit();
        toast("댓글을 지웠어요"); openPost(id);
      });
    }
  });
  new MutationObserver(() => { if (!modal.open) openId = null; }).observe(modal, { attributes: true, attributeFilter: ["open"] });

  /* 대화방 페이지를 열 때 불러와요 */
  KLFB.onAuth(() => { if (loaded) render(); });
  const maybeLoad = () => { if (location.hash.startsWith("#/talk")) load(); };
  window.addEventListener("hashchange", maybeLoad);
  maybeLoad();
})();
