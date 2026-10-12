/* =========================================================
   FOR COACH — GK 코치 대화방 (게시판 + 댓글)
   - 아이디로 코치 가입 신청 → 관리자가 승인하면 글을 보고 쓸 수 있어요
   - 내 글 · 댓글은 내 계정으로 수정 · 삭제 (글 비밀번호 없음)
   - 관리자(트레이닝 · 아카이브와 같은 관리자 로그인)는 가입 승인, 공지, 모든 글 관리
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

  /* ---------- 코치 계정 ---------- */
  // 아이디는 화면에서만 쓰고, 로그인은 아이디로 만든 내부 주소로 해요 (이메일 필요 없음)
  const coachEmail = (id) => `c-${id}@coaches.keeperlab.co.kr`;
  const ID_RE = /^[a-z0-9_]{4,20}$/;
  let fb = null, me = { uid: null, coach: null }, posts = [], notices = [], coaches = [];
  let cat = "all", search = "", page = 1, opened = false;
  const boot = () => KLFB.boot().then((x) => (fb = x));
  const access = () => {
    if (KLFB.isAdmin()) return "admin";
    if (!me.coach) return me.uid && me.isCoachAccount ? "nodata" : "none";
    return { approved: "coach", pending: "pending" }[me.coach.status] || "rejected";
  };
  async function refreshMe() {
    const u = fb && fb.auth.currentUser;
    me = { uid: u ? u.uid : null, coach: null, isCoachAccount: !!(u && /@coaches\.keeperlab\.co\.kr$/.test(u.email || "")) };
    if (me.isCoachAccount) {
      try { const d = await fb.db.doc(`coaches/${u.uid}`).get(); me.coach = d.exists ? d.data() : null; } catch (e) { console.error(e); }
    }
  }

  async function load() {
    if (!KLFB.ready()) { root.innerHTML = `<div class="fb-empty">대화방 준비 중이에요.</div>`; return; }
    if (!opened) root.innerHTML = `<div class="fb-empty">불러오는 중…</div>`;
    opened = true;
    try {
      await boot();
      await refreshMe();
      const a = access();
      $("#talkWrite").hidden = !(a === "admin" || a === "coach");
      if (a !== "admin" && a !== "coach") return renderGate(a);
      const snap = await fb.db.collection("talk").orderBy("createdAt", "desc").limit(300).get();
      posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      try {
        const ns = await fb.db.collection("talkNotice").orderBy("createdAt", "desc").get();
        notices = ns.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error(e); notices = []; }
      coaches = [];
      if (a === "admin") {
        try { coaches = (await fb.db.collection("coaches").get()).docs.map((d) => ({ uid: d.id, ...d.data() })); } catch (e) { console.error(e); }
      }
      render();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="fb-empty">불러오지 못했어요. 새로고침해 주세요.</div>`;
    }
  }

  /* ---------- 잠금 화면 (로그인 · 가입 신청) ---------- */
  function renderGate(a) {
    const msg = {
      pending: `<h3>가입 신청을 확인하고 있어요</h3><p>${esc(me.coach ? me.coach.name : "")} 코치님, 관리자가 승인하면 바로 대화방을 볼 수 있어요. 조금만 기다려 주세요.</p>`,
      rejected: `<h3>대화방을 이용할 수 없는 계정이에요</h3><p>가입이 승인되지 않았거나 이용이 중지됐어요. 궁금한 점은 카카오톡 채널로 문의해 주세요.</p>`,
      nodata: `<h3>가입 정보가 없어요</h3><p>가입 신청이 끝나지 않았거나 삭제된 계정이에요. 카카오톡 채널로 문의해 주세요.</p>`,
    }[a];
    root.innerHTML = `
      <div class="fb-bar"><button class="fb-admin-link" data-talk="admin">관리자</button></div>
      <div class="talk-gate">
        <div class="tg-lock" aria-hidden="true">🔒</div>
        ${msg ? `${msg}<button class="btn btn-ghost btn-sm" data-talk="logout">로그아웃</button>` : `
        <h3>승인된 GK 코치만 볼 수 있어요</h3>
        <p>GK 코치 대화방은 KEEPER LAB이 확인한 골키퍼 코치들의 공간이에요.<br />가입 신청 후 관리자가 승인하면 글을 보고 쓸 수 있어요.</p>
        <form class="form tg-login" id="talkLogin">
          <label>아이디<input name="id" required autocomplete="username" autocapitalize="none" spellcheck="false" /></label>
          <label>비밀번호<input name="pw" type="password" required autocomplete="current-password" /></label>
          <label class="check"><input type="checkbox" name="keep" checked /> <span>로그인 유지</span></label>
          <button class="btn btn-solid">로그인</button>
        </form>
        <div class="tg-join"><span>아직 회원이 아니라면</span><button class="btn btn-ghost btn-sm" data-talk="join">코치 가입 신청</button></div>
        <p class="fb-help">아이디·비밀번호를 잊었다면 카카오톡 채널로 문의해 주세요.</p>`}
      </div>`;
  }

  function joinForm() {
    const body = openModal(`
      <h3>코치 가입 신청</h3><div class="meta">관리자가 확인 후 승인하면 대화방을 이용할 수 있어요</div>
      <form class="form" id="talkJoin">
        <div class="form-row">
          <label>아이디 (영문 소문자·숫자·_ 4~20자)<input name="id" required maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="예) keeper_yoo" /></label>
          <label>이름<input name="name" required maxlength="20" placeholder="예) 유수영" /></label>
        </div>
        <div class="form-row">
          <label>비밀번호 (6자 이상)<input name="pw" type="password" required minlength="6" maxlength="40" autocomplete="new-password" /></label>
          <label>비밀번호 확인<input name="pw2" type="password" required minlength="6" maxlength="40" autocomplete="new-password" /></label>
        </div>
        <label>소속<input name="org" required maxlength="30" placeholder="예) OO FC U15, 프리랜서" /></label>
        <label class="check"><input type="checkbox" name="agree" required /> <span>가입 확인을 위한 정보(이름 · 소속) 수집 및 이용에 동의합니다. 이름과 소속은 글쓴이로 표시돼요.</span></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">가입 신청</button></div>
      </form>`, true);
    const f = $("#talkJoin", body);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = (n) => f[n].value.trim();
      const id = val("id").toLowerCase();
      if (!ID_RE.test(id)) return toast("아이디는 영문 소문자 · 숫자 · _ 4~20자예요");
      if (f.pw.value !== f.pw2.value) return toast("비밀번호가 서로 달라요");
      const btn = $(".btn-solid", f); btn.disabled = true;
      try {
        await boot();
        await fb.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        const cred = await fb.auth.createUserWithEmailAndPassword(coachEmail(id), f.pw.value);
        await fb.db.doc(`coaches/${cred.user.uid}`).set({
          id, name: val("name"), org: val("org"), status: "pending", createdAt: fb.FV.serverTimestamp(),
        });
        closeModal(); toast("가입 신청을 보냈어요. 승인되면 바로 이용할 수 있어요"); load();
      } catch (err) {
        console.error(err); btn.disabled = false;
        const c = err.code || "";
        toast(/email-already-in-use/.test(c) ? "이미 쓰고 있는 아이디예요" : /weak-password/.test(c) ? "비밀번호를 6자 이상으로 해주세요" : "가입 신청을 보내지 못했어요. 잠시 후 다시 해주세요");
      }
    });
  }

  /* ---------- 관리자: 가입 관리 ---------- */
  function membersModal() {
    const groups = [["pending", "승인 대기"], ["approved", "승인된 코치"], ["rejected", "거절 · 이용 중지"]];
    const fmt = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleDateString("ko-KR") : "");
    openModal(`
      <h3>코치 가입 관리</h3><div class="meta">승인된 코치만 대화방을 보고 쓸 수 있어요</div>
      <div class="members">
      ${groups.map(([st, label]) => {
        const list = coaches.filter((c) => (c.status || "pending") === st);
        return `<section><h4>${label} <span>${list.length}</span></h4>${list.length ? `<ul>${list.map((c) => `
          <li>
            <div class="mb-who"><b>${esc(c.name)}</b> <span>${esc(c.org || "")} · 아이디 ${esc(c.id || "")} · ${fmt(c.createdAt)} 신청</span></div>
            <div class="mb-acts">
              ${st !== "approved" ? `<button class="btn btn-solid btn-sm" data-mb="approved" data-uid="${c.uid}">승인</button>` : ""}
              ${st !== "rejected" ? `<button class="btn btn-ghost btn-sm" data-mb="rejected" data-uid="${c.uid}">${st === "approved" ? "이용 중지" : "거절"}</button>` : ""}
              <button class="btn btn-ghost btn-sm fb-danger" data-mb="delete" data-uid="${c.uid}">가입 정보 삭제</button>
            </div>
          </li>`).join("")}</ul>` : `<p class="fb-help">없어요.</p>`}</section>`;
      }).join("")}
      </div>`, true);
  }
  modalBody.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-mb]"); if (!b || !KLFB.isAdmin()) return;
    const uid = b.dataset.uid, act = b.dataset.mb;
    if (act === "delete" && b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "한 번 더 누르면 삭제"; return; }
    b.disabled = true;
    try {
      if (act === "delete") await fb.db.doc(`coaches/${uid}`).delete();
      else await fb.db.doc(`coaches/${uid}`).update({ status: act });
      toast({ approved: "승인했어요", rejected: "처리했어요", delete: "삭제했어요" }[act]);
      await load(); membersModal();
    } catch (err) { console.error(err); b.disabled = false; toast("처리하지 못했어요"); }
  });

  /* ---------- 게시판 ---------- */
  function render() {
    const q = search.toLowerCase();
    const found = posts.filter((p) => (cat === "all" || p.cat === cat)
      && (!q || `${p.title} ${p.body} ${p.author} ${p.org || ""} ${p.region || ""}`.toLowerCase().includes(q)));
    const pages = Math.max(1, Math.ceil(found.length / PER_PAGE));
    if (page > pages) page = pages;
    const shown = found.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const admin = KLFB.isAdmin();
    const waiting = coaches.filter((c) => (c.status || "pending") === "pending").length;
    root.innerHTML = `
      <div class="fb-bar">${admin
        ? `<span class="fb-admin-on">관리자 모드</span><button class="btn btn-solid btn-sm" data-talk="members">가입 관리${waiting ? ` · 대기 ${waiting}` : ""}</button><button class="btn btn-ghost btn-sm" data-talk="out">관리자 나가기</button>`
        : `<span class="talk-me">${esc(me.coach.name)}${me.coach.org ? ` (${esc(me.coach.org)})` : ""} 코치님</span><button class="btn btn-ghost btn-sm" data-talk="logout">로그아웃</button>`}</div>
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
      <p class="fb-help">글은 승인된 코치끼리만 보여요. 광고 · 비방 글은 관리자가 지울 수 있어요.</p>`;
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
    const t = b.dataset.talk;
    if (t === "clear") { search = ""; page = 1; return render(); }
    if (t === "admin") return KLFB.adminLogin({ openModal: (h) => openModal(h), closeModal, toast });
    if (t === "join") return joinForm();
    if (t === "members" && KLFB.isAdmin()) return membersModal();
    if (t === "out" || t === "logout") { await KLFB.signOut(); toast(t === "out" ? "관리자 모드를 나왔어요" : "로그아웃했어요"); }
  });
  root.addEventListener("submit", async (e) => {
    const lf = e.target.closest("#talkLogin");
    if (lf) {
      e.preventDefault();
      const id = lf.id.value.trim().toLowerCase();
      if (!ID_RE.test(id)) return toast("아이디를 확인해 주세요");
      const btn = $(".btn-solid", lf); btn.disabled = true;
      try { await KLFB.signIn(coachEmail(id), lf.pw.value, { remember: lf.keep.checked }); }
      catch (err) {
        btn.disabled = false;
        toast(/too-many/.test(err.code || "") ? "여러 번 틀려서 잠시 막혔어요. 몇 분 뒤에 다시 해주세요" : "아이디 또는 비밀번호가 맞지 않아요");
      }
      return;
    }
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
    const admin = KLFB.isAdmin();
    const body = openModal(`
      <h3>${post ? "글 수정" : "글쓰기"}</h3><div class="meta">GK 코치 대화방 · ${admin ? "운영자로 올라가요" : `${esc(me.coach.name)}${me.coach.org ? ` (${esc(me.coach.org)})` : ""} 이름으로 올라가요`}</div>
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
        <label>연락 방법 (선택 · 승인된 코치들에게 보여요)<input name="contact" maxlength="80" value="${v("contact")}" placeholder="예) 카카오 오픈채팅 링크, 이메일" /></label>
        ${admin && !post ? `<div class="form-row">
          <label>이름<input name="author" required maxlength="20" value="KEEPER LAB" /></label>
          <label>소속 (선택)<input name="org" maxlength="30" /></label>
        </div>` : ""}
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
        if (!post) {
          const ref = fb.db.collection("talk").doc();
          if (admin) await ref.set({ ...data, author: val("author"), org: val("org"), byAdmin: true, createdAt: fb.FV.serverTimestamp() });
          else await ref.set({ ...data, author: me.coach.name, org: me.coach.org || "", uid: me.uid, createdAt: fb.FV.serverTimestamp() });
          toast("글을 올렸어요");
          await load(); openPost(ref.id); // 창을 닫지 않고 바로 올린 글로 바꿔요
        } else {
          await fb.db.doc(`talk/${post.id}`).update({ ...data, updatedAt: fb.FV.serverTimestamp() });
          toast("수정했어요");
          await load(); openPost(post.id);
        }
      } catch (err) { console.error(err); btn.disabled = false; toast("올리지 못했어요. 잠시 후 다시 해주세요"); }
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
    const a = KLFB.ready() ? access() : "none";
    if (a !== "admin" && a !== "coach") return toast("승인된 코치만 글을 쓸 수 있어요");
    writeForm();
  });

  /* ---------- 글 보기 · 댓글 ---------- */
  let openId = null;
  const mine = (o) => KLFB.isAdmin() || (o.uid && o.uid === me.uid);
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
        ${mine(p) ? `<div class="talk-own"><button class="btn btn-ghost btn-sm" data-post-edit>수정</button><button class="btn btn-ghost btn-sm fb-danger" data-post-del>삭제</button></div>` : ""}
        <section class="talk-comments">
          <h4>댓글 ${comments.length}</h4>
          ${comments.length ? `<ul>${comments.map((c) => `
            <li data-cid="${c.id}">
              <div class="tc-head">${c.byAdmin ? `<i class="talk-official">운영자</i>` : ""}<b>${esc(byline(c))}</b><span>${when(c.createdAt)}</span>
                ${mine(c) ? `<button class="tc-del" data-cdel="${c.id}">삭제</button>` : ""}</div>
              <div class="tc-body">${esc(c.body).replace(/\n/g, "<br>")}</div>
            </li>`).join("")}</ul>` : `<p class="fb-help">첫 댓글을 남겨보세요.</p>`}
          <form class="form talk-cform" id="talkCForm">
            <textarea name="body" required maxlength="1000" rows="3" placeholder="${admin ? "운영자로 댓글을 달아요" : "댓글을 적어주세요"}"></textarea>
            <div class="talk-cfields"><button class="btn btn-solid btn-sm">댓글 달기</button></div>
          </form>
        </section>
      </div>`, true);

    $("#talkCForm", modalBody).addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = e.target.body.value.trim();
      if (!text) return;
      const btn = $(".btn-solid", e.target); btn.disabled = true;
      try {
        const col = fb.db.collection(`talk/${id}/comments`);
        if (KLFB.isAdmin()) await col.add({ author: "KEEPER LAB", org: "", body: text, byAdmin: true, createdAt: fb.FV.serverTimestamp() });
        else await col.add({ author: me.coach.name, org: me.coach.org || "", body: text, uid: me.uid, createdAt: fb.FV.serverTimestamp() });
        openPost(id);
      } catch (err) { console.error(err); btn.disabled = false; toast("댓글을 올리지 못했어요"); }
    });
  }

  modalBody.addEventListener("click", async (e) => {
    if (!openId || !$(".talk-view", modalBody)) return;
    const id = openId, p = posts.find((x) => x.id === id);
    if (e.target.closest("[data-post-edit]") && mine(p)) return writeForm(p);
    const del = e.target.closest("[data-post-del]");
    if (del && mine(p)) {
      if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "한 번 더 누르면 삭제"; return; }
      try { await fb.db.doc(`talk/${id}`).delete(); closeModal(); toast("삭제했어요"); load(); }
      catch (err) { console.error(err); toast("삭제하지 못했어요"); }
      return;
    }
    const cd = e.target.closest("[data-cdel]");
    if (cd) {
      if (cd.dataset.sure !== "1") { cd.dataset.sure = "1"; cd.textContent = "한 번 더 누르면 삭제"; return; }
      try { await fb.db.doc(`talk/${id}/comments/${cd.dataset.cdel}`).delete(); toast("댓글을 지웠어요"); openPost(id); }
      catch (err) { console.error(err); toast("지우지 못했어요"); }
    }
  });
  new MutationObserver(() => { if (!modal.open) openId = null; }).observe(modal, { attributes: true, attributeFilter: ["open"] });

  /* 대화방 페이지를 열 때 불러와요 · 로그인 상태가 바뀌면 다시 그려요 */
  KLFB.onAuth(() => { if (opened) load(); });
  const maybeLoad = () => { if (location.hash.startsWith("#/talk")) load(); };
  window.addEventListener("hashchange", maybeLoad);
  maybeLoad();
})();
