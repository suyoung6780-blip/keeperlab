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

  let fb = null, posts = [], cat = "all", search = "", page = 1, loaded = false;
  const boot = () => KLFB.boot().then((x) => (fb = x));

  async function load() {
    if (!KLFB.ready()) { root.innerHTML = `<div class="fb-empty">대화방 준비 중이에요.</div>`; return; }
    if (!loaded) root.innerHTML = `<div class="fb-empty">불러오는 중…</div>`;
    try {
      await boot();
      const snap = await fb.db.collection("talk").orderBy("createdAt", "desc").limit(300).get();
      posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      <form class="fb-search talk-search" role="search">
        <input name="q" type="search" value="${esc(search)}" placeholder="제목 · 내용 · 이름 · 지역 검색" aria-label="대화방 검색" autocomplete="off" />
        <button class="btn btn-ghost btn-sm">검색</button>
        ${search ? `<button type="button" class="btn btn-ghost btn-sm" data-talk="clear">전체 보기</button>` : ""}
      </form>
      ${shown.length ? `<ul class="talk-list">${shown.map((p) => `
        <li><button class="talk-row" data-post="${p.id}">
          <span class="talk-cat">${esc(p.cat)}</span>
          <span class="talk-title">${esc(p.title)}${p.region ? `<em>${esc(p.region)}</em>` : ""}</span>
          <span class="talk-meta">${esc(byline(p))} · ${when(p.createdAt)}</span>
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
    "GK선수 모집 및 팀 모집": {
      title: "예) [선수 모집] OO FC U15 골키퍼 모집 / [팀 찾기] 서울 지역 GK 선수 프로필",
      tip: "팀이 GK 선수를 모집하거나, GK 선수가 뛸 팀을 찾을 때 써요.",
      body: "■ 구분 : 선수 모집 / 팀 찾기\n■ 지역 : \n■ 팀 이름 (팀이 쓸 때) : \n\n[선수 프로필]\n■ 나이 · 학년 : \n■ 키 · 주발 : \n■ 경력 · 소속 : \n■ 가능한 훈련 요일 · 시간 : \n\n■ 하고 싶은 말 : ",
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
    const body = openModal(`
      <h3>${post ? "글 수정" : "글쓰기"}</h3><div class="meta">GK 코치 대화방</div>
      <form class="form" id="talkForm">
        <div class="form-row">
          <label>말머리<select name="cat" required>${CATS.map((c) => `<option ${post && post.cat === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
          <label>지역<select name="region">${regionOptions(post ? post.region : "")}</select></label>
        </div>
        <p class="form-hint talk-tip"></p>
        <label>제목<input name="title" required maxlength="80" value="${v("title")}" /></label>
        <label>내용<textarea name="body" required maxlength="5000" rows="12">${v("body")}</textarea></label>
        <label>연락 방법 (선택 · 모두에게 공개돼요)<input name="contact" maxlength="80" value="${v("contact")}" placeholder="예) 카카오 오픈채팅 링크, 이메일" /></label>
        ${post ? "" : `<div class="form-row">
          <label>이름<input name="author" required maxlength="20" value="${esc(localStorage.getItem("kl_name") || "")}" placeholder="예) 유수영" /></label>
          <label>소속 (선택)<input name="org" maxlength="30" value="${esc(localStorage.getItem("kl_org") || "")}" placeholder="예) KEEPER LAB" /></label>
        </div>`}
        <label>${post ? "글 비밀번호 (쓸 때 정한 비밀번호)" : "글 비밀번호 (수정 · 삭제할 때 필요해요, 4자 이상)"}<input name="pw" type="password" required minlength="4" maxlength="30" autocomplete="new-password" /></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">${post ? "수정하기" : "올리기"}</button></div>
      </form>`, true);
    const f = $("#talkForm", body);
    // 말머리를 바꾸면 제목 예시 · 안내 · 내용 양식이 바뀌어요 (이미 쓴 내용은 그대로 둬요)
    const applyGuide = () => {
      const g = GUIDE[f.cat.value] || GUIDE["GK코치들의 이야기"];
      f.title.placeholder = g.title;
      $(".talk-tip", f).textContent = g.tip;
      f.body.placeholder = g.body ? "" : "자유롭게 적어주세요";
      if (isTemplate(f.body.value)) f.body.value = g.body;
    };
    f.cat.addEventListener("change", applyGuide);
    applyGuide();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = (n) => (f[n] ? f[n].value.trim() : "");
      if (!val("title") || isTemplate(val("body"))) return toast("제목과 내용을 적어주세요");
      // 양식에서 비워둔 줄(■ 항목 : )은 빼고 올려요
      const cleanBody = val("body").split("\n").filter((l) => !/^■[^:]*:\s*$/.test(l.trim())).join("\n").replace(/\n{3,}/g, "\n\n").trim();
      const data = { cat: val("cat"), title: val("title"), body: cleanBody, contact: val("contact"), region: val("region") };
      if (!data.body) return toast("내용을 적어주세요");
      const btn = $(".btn-solid", f); btn.disabled = true;
      try {
        await boot();
        const batch = fb.db.batch();
        if (!post) {
          const ref = fb.db.collection("talk").doc();
          const author = val("author"), org = val("org");
          try { localStorage.setItem("kl_name", author); localStorage.setItem("kl_org", org); } catch {}
          batch.set(ref, { ...data, author, org, createdAt: fb.FV.serverTimestamp() });
          batch.set(fb.db.doc(`talkLock/${ref.id}`), { h: await hashPw(ref.id, val("pw")) });
          await batch.commit();
          toast("글을 올렸어요");
          await load(); openPost(ref.id); // 창을 닫지 않고 바로 올린 글로 바꿔요
        } else {
          batch.set(fb.db.doc(`talkUnlock/${post.id}`), { h: await hashPw(post.id, val("pw")) });
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
        <div class="meta">${esc(byline(p))} · ${when(p.createdAt)}${p.updatedAt ? " · 수정됨" : ""}</div>
        ${p.region || p.contact ? `<dl class="talk-info">${p.region ? `<dt>지역</dt><dd>${esc(p.region)}</dd>` : ""}${p.contact ? `<dt>연락</dt><dd>${esc(p.contact)}</dd>` : ""}</dl>` : ""}
        <div class="article talk-body">${paras(p.body)}</div>
        <div class="talk-own" data-own>
          <button class="btn btn-ghost btn-sm" data-own-act="edit">수정</button>
          <button class="btn btn-ghost btn-sm" data-own-act="del">삭제</button>
          ${admin ? `<button class="btn btn-ghost btn-sm fb-danger" data-admin-del>관리자 삭제</button>` : ""}
        </div>
        <section class="talk-comments">
          <h4>댓글 ${comments.length}</h4>
          ${comments.length ? `<ul>${comments.map((c) => `
            <li data-cid="${c.id}">
              <div class="tc-head"><b>${esc(byline(c))}</b><span>${when(c.createdAt)}</span>
                <button class="tc-del" data-cdel="${c.id}">삭제</button></div>
              <div class="tc-body">${esc(c.body).replace(/\n/g, "<br>")}</div>
            </li>`).join("")}</ul>` : `<p class="fb-help">첫 댓글을 남겨보세요.</p>`}
          <form class="form talk-cform" id="talkCForm">
            <textarea name="body" required maxlength="1000" rows="3" placeholder="댓글을 적어주세요"></textarea>
            <div class="talk-cfields">
              <input name="author" required maxlength="20" value="${esc(localStorage.getItem("kl_name") || "")}" placeholder="이름" aria-label="이름" />
              <input name="org" maxlength="30" value="${esc(localStorage.getItem("kl_org") || "")}" placeholder="소속 (선택)" aria-label="소속" />
              <input name="pw" type="password" required minlength="4" maxlength="30" placeholder="비밀번호 (삭제용)" aria-label="댓글 비밀번호" autocomplete="new-password" />
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
        batch.set(ref, { author: val("author"), org: val("org"), body: val("body"), createdAt: fb.FV.serverTimestamp() });
        batch.set(fb.db.doc(`talkLock/${id}__${ref.id}`), { h: await hashPw(`${id}__${ref.id}`, val("pw")) });
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
        batch.set(fb.db.doc(`talkUnlock/${id}`), { h: await hashPw(id, pw) });
        batch.update(fb.db.doc(`talk/${id}`), { title: p.title });
        await batch.commit();
        writeForm(p);
        const f = $("#talkForm", modalBody); if (f) f.pw.value = pw;
      });
    }
    if (own && own.dataset.ownAct === "del") {
      return askPw($("[data-own]", modalBody), "글 비밀번호 (삭제)", async (pw) => {
        const batch = fb.db.batch();
        batch.set(fb.db.doc(`talkUnlock/${id}`), { h: await hashPw(id, pw) });
        batch.delete(fb.db.doc(`talk/${id}`));
        batch.delete(fb.db.doc(`talkLock/${id}`));
        await batch.commit();
        closeModal(); toast("삭제했어요"); load();
      });
    }
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
        batch.set(fb.db.doc(`talkUnlock/${key}`), { h: await hashPw(key, pw) });
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
