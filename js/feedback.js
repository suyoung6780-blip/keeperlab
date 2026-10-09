/* =========================================================
   03 TRAINING — 트레이닝 피드백 (KEEPER LAB 선수 전용)
   - 데이터는 Firebase(Firestore)에 저장 → 어느 기기에서나 같은 내용이 보여요
   - 관리자: 관리자 번호로 로그인 → 선수 등록 · 피드백 작성
   - 선수: 내 이름 옆에 비밀번호(휴대폰 뒷자리 4자리) → 내 피드백 보기 · 확인 체크
   - 외부 방문자: 이름 가운데만 가린 목록(유*영)만 보여요. 소속·내용은 안 보여요.
   관리자 번호와 선수 비밀번호는 코드에 적혀 있지 않아요 (Firebase 로그인 비밀번호로만 존재).
   ========================================================= */
(function () {
  const root = document.getElementById("fbPanel");
  if (!root) return;

  const playerEmail = (pid) => `p-${pid.toLowerCase()}@players.keeperlab.co.kr`;
  const playerPass = (pin) => `KL-${pin}-gk`; // Firebase 비밀번호는 6자 이상이라 앞뒤를 붙여요

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl = (s = "") => esc(s).replace(/\n/g, "<br>");
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fmtDay = (s) => { const [y, m, d] = String(s).split("-"); return y && m && d ? `${y}. ${m}. ${d}.` : esc(s); };
  const fmtTime = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  const mask = (name) => {
    const n = [...name.trim()];
    if (n.length <= 1) return n.join("");
    if (n.length === 2) return n[0] + "*";
    return n[0] + "*".repeat(n.length - 2) + n[n.length - 1];
  };
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");

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
  /* ---------- Firebase 연결은 js/kl-firebase.js (아카이브와 같이 써요) ---------- */
  let fb = null;
  const boot = () => KLFB.boot().then((x) => (fb = x));
  const { helperAuth, isAdmin, authError } = KLFB;

  let players = [];
  let regionFilter = "all";
  let search = "", page = 1;
  const PER_PAGE = 5;
  // 이름 검색: 밖에서는 가려진 이름(유*영)끼리 비교해요. 관리자는 실제 이름·소속으로도 찾아요
  const matches = (p, admin) => {
    const q = search.replace(/\s/g, "");
    if (!q) return true;
    if (admin && ((p.name || "").includes(q) || (p.org || "").includes(q))) return true;
    if (q.length === 1) return p.masked.startsWith(q);
    return p.masked === mask(q);
  };
  const regions = () => window.KL_REGIONS || [];
  const regionSelect = (cur = "") => `<select name="region" required>
      <option value="">지역 선택</option>
      ${regions().map((r) => `<optgroup label="${esc(r.group)}">${r.areas.map((a) => `<option ${a === cur ? "selected" : ""}>${esc(a)}</option>`).join("")}</optgroup>`).join("")}
    </select>`;
  let viewingPid = null; // 선수 본인이 피드백을 보고 있을 때

  /* ---------- 목록 ---------- */
  async function render(cached) {
    if (!KLFB.ready()) {
      root.innerHTML = `<div class="fb-empty">피드백 기능 준비 중이에요.</div>`;
      return;
    }
    if (!cached) root.innerHTML = `<div class="fb-empty">불러오는 중…</div>`;
    if (!cached) try {
      await boot();
      const snap = await fb.db.collection("players").orderBy("createdAt", "desc").get();
      players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (isAdmin()) {
        const priv = await Promise.all(players.map((p) => fb.db.doc(`players/${p.id}/private/info`).get()));
        priv.forEach((d, i) => Object.assign(players[i], d.exists ? d.data() : {}));
      }
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="fb-empty">목록을 불러오지 못했어요. 새로고침해 주세요.</div>`;
      return;
    }
    const admin = isAdmin();
    const used = regions().flatMap((r) => r.areas).filter((a) => players.some((p) => p.region === a));
    if (regionFilter !== "all" && !used.includes(regionFilter)) regionFilter = "all";
    const found = players.filter((p) => (regionFilter === "all" || p.region === regionFilter) && matches(p, admin));
    const pages = Math.max(1, Math.ceil(found.length / PER_PAGE));
    if (page > pages) page = pages;
    const shown = found.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    root.innerHTML = `
      <div class="fb-bar">
        ${admin
          ? `<span class="fb-admin-on">관리자 모드</span><button class="btn btn-solid btn-sm" data-fb="add">+ 선수 등록</button><button class="btn btn-ghost btn-sm" data-fb="logout">관리자 나가기</button>`
          : `<button class="fb-admin-link" data-fb="admin">관리자</button>`}
      </div>
      ${used.length ? `<div class="chips fb-chips" role="tablist" aria-label="지역">
        ${["all", ...used].map((a) => `<button class="chip ${a === regionFilter ? "is-active" : ""}" data-region="${esc(a)}" role="tab" aria-selected="${a === regionFilter}">${a === "all" ? "전체 지역" : esc(a)}</button>`).join("")}
      </div>` : ""}
      <form class="fb-search" role="search">
        <input name="q" type="search" value="${esc(search)}" placeholder="${admin ? "이름 · 소속 검색" : "내 이름 검색 (예: 유수영)"}" aria-label="이름 검색" autocomplete="off" />
        <button class="btn btn-ghost btn-sm">검색</button>
        ${search ? `<button type="button" class="btn btn-ghost btn-sm" data-fb="clear">전체 보기</button>` : ""}
      </form>
      ${shown.length ? `<ul class="fb-list">${shown.map((p) => `
        <li class="fb-row">
          <div class="fb-who">
            ${p.region ? `<em class="fb-region">${esc(p.region)}</em>` : ""}
            <b>${esc(admin ? p.name || p.masked : p.masked)}</b>
            ${admin && p.org ? `<span>${esc(p.org)}</span>` : ""}
          </div>
          ${admin
            ? `<div class="fb-acts">
                 <button class="btn btn-solid btn-sm" data-fb="write" data-pid="${p.id}">피드백 작성</button>
                 <button class="btn btn-ghost btn-sm" data-fb="manage" data-pid="${p.id}">피드백 보기</button>
                 <button class="btn btn-ghost btn-sm" data-fb="edit" data-pid="${p.id}">선수 정보</button>
               </div>`
            : `<form class="fb-pin" data-pid="${p.id}">
                 <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" placeholder="비밀번호 4자리" aria-label="${esc(p.masked)} 비밀번호" required />
                 <button class="btn btn-ghost btn-sm">내 피드백 보기</button>
               </form>`}
        </li>`).join("")}</ul>`
        : `<div class="fb-empty">${search ? "찾는 이름이 없어요. 이름을 정확히 입력했는지 확인해 주세요." : admin ? "아직 등록된 선수가 없어요. ‘+ 선수 등록’을 눌러 추가해 주세요." : "아직 등록된 선수가 없어요."}</div>`}
      ${pages > 1 ? `<nav class="fb-pages" aria-label="페이지">
        <button class="fb-pg" data-pg="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="이전 페이지">‹</button>
        ${Array.from({ length: pages }, (_, i) => i + 1).map((n) => `<button class="fb-pg${n === page ? " is-on" : ""}" data-pg="${n}" ${n === page ? 'aria-current="page"' : ""}>${n}</button>`).join("")}
        <button class="fb-pg" data-pg="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="다음 페이지">›</button>
      </nav>` : ""}
      <p class="fb-help">내 이름이 안 보이거나 비밀번호를 잊었다면 담당 코치에게 알려주세요.</p>`;
  }

  /* ---------- 선수: 비밀번호 → 내 피드백 ---------- */
  root.addEventListener("submit", async (e) => {
    const s = e.target.closest(".fb-search");
    if (s) { e.preventDefault(); search = s.q.value.trim(); page = 1; render(true); const i = $(".fb-search input", root); if (i) i.focus(); return; }
    const f = e.target.closest(".fb-pin"); if (!f) return;
    e.preventDefault();
    const pin = f.pin.value.trim();
    if (!/^\d{4}$/.test(pin)) { toast("비밀번호 숫자 4자리를 입력해 주세요"); return; }
    const btn = f.querySelector("button"); btn.disabled = true;
    try {
      await boot();
      await fb.auth.signInWithEmailAndPassword(playerEmail(f.dataset.pid), playerPass(pin));
      f.pin.value = "";
      viewingPid = f.dataset.pid;
      await showMine(viewingPid);
    } catch (err) {
      toast(authError(err));
    } finally { btn.disabled = false; }
  });

  const FIELDS = [
    ["topic", "훈련 주제"],
    ["good", "잘한 점"],
    ["improve", "개선할 점"],
    ["apply", "적용점"],
    ["homework", "한 주 동안 과제"],
  ];
  function card(fbk, { forPlayer, forAdmin }) {
    const checked = !!fbk.checked;
    return `<article class="fb-card${checked ? " is-checked" : ""}">
      <header><span class="fb-date">${fmtDay(fbk.date)}</span>
        <span class="fb-state">${checked ? `✓ 선수 확인${fbk.checkedAt ? " · " + fmtTime(fbk.checkedAt) : ""}` : "확인 전"}</span></header>
      <h4>${esc(fbk.topic || "")}</h4>
      <dl>${FIELDS.slice(1).map(([k, label]) => fbk[k] ? `<dt>${label}</dt><dd>${nl(fbk[k])}</dd>` : "").join("")}</dl>
      ${forPlayer ? `<button class="btn ${checked ? "btn-ghost" : "btn-solid"} btn-sm fb-check" data-check="${fbk.id}" ${checked ? "disabled" : ""}>${checked ? "✓ 확인했어요" : "확인했어요"}</button>` : ""}
      ${forAdmin ? `<div class="fb-acts"><button class="btn btn-ghost btn-sm" data-fbedit="${fbk.id}">수정</button><button class="btn btn-ghost btn-sm" data-fbdel="${fbk.id}">삭제</button></div>` : ""}
    </article>`;
  }
  async function loadFeedback(pid) {
    const snap = await fb.db.collection(`players/${pid}/feedback`).orderBy("date", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  async function showMine(pid) {
    const [info, list] = await Promise.all([fb.db.doc(`players/${pid}/private/info`).get(), loadFeedback(pid)]);
    const me = info.exists ? info.data() : {};
    const left = list.filter((x) => !x.checked).length;
    openModal(`
      <h3>${esc(me.name || "")} 선수 피드백</h3>
      <div class="meta">${esc(me.org || "")}${left ? ` · 확인 안 한 피드백 ${left}개` : ""}</div>
      <div class="fb-cards">${list.length ? list.map((x) => card(x, { forPlayer: true })).join("") : `<div class="fb-empty">아직 받은 피드백이 없어요.</div>`}</div>
      <p class="fb-note">창을 닫으면 자동으로 로그아웃돼요.</p>`, true);
  }
  modalBody.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-check]"); if (!b || !viewingPid) return;
    b.disabled = true;
    try {
      await fb.db.doc(`players/${viewingPid}/feedback/${b.dataset.check}`).update({ checked: true, checkedAt: fb.FV.serverTimestamp() });
      await showMine(viewingPid);
      toast("확인 완료!");
    } catch (err) { console.error(err); b.disabled = false; toast("저장하지 못했어요. 다시 눌러주세요."); }
  });
  // 선수 창을 닫으면 바로 로그아웃 (같은 기기를 다른 사람이 써도 안전하게)
  const leavePlayer = () => {
    if (viewingPid && fb && !isAdmin()) fb.auth.signOut();
    viewingPid = null;
  };
  modal.addEventListener("close", leavePlayer);
  // 창이 닫히는 순간을 직접 지켜봐요 (close 이벤트가 늦거나 안 와도 로그아웃되게)
  new MutationObserver(() => { if (!modal.open) { leavePlayer(); modalBody.onclick = null; } }).observe(modal, { attributes: true, attributeFilter: ["open"] });

  /* ---------- 관리자 ---------- */
  const adminLogin = () => KLFB.adminLogin({ openModal: (h) => openModal(h), closeModal, toast });

  function playerForm(p) {
    const editing = !!p;
    const body = openModal(`
      <h3>${editing ? "선수 정보" : "선수 등록"}</h3>
      <div class="meta">${editing ? "이름 · 소속 · 비밀번호를 바꿀 수 있어요" : "밖에서는 이름 가운데가 가려져 보이고(유*영), 소속은 안 보여요"}</div>
      <form class="form" id="fbPlayerForm">
        <div class="form-row">
          <label>이름<input name="name" required maxlength="20" value="${esc(p ? p.name : "")}" placeholder="예) 유수영" /></label>
          <label>소속<input name="org" required maxlength="30" value="${esc(p ? p.org : "")}" placeholder="예) ○○FC U15" /></label>
        </div>
        <div class="form-row">
          <label>지역 (목록에 보여요)${regionSelect(p ? p.region : "")}</label>
          <label>비밀번호 (휴대폰 뒷자리 4자리)<input name="pin" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${esc(p ? p.pin || "" : "")}" placeholder="예) 1234" /></label>
        </div>
        <div class="form-actions">
          ${editing ? `<button type="button" class="btn btn-ghost btn-sm fb-danger" data-fbremove="${p.id}">선수 삭제</button>` : ""}
          <button type="button" class="btn btn-ghost btn-sm" data-close>취소</button>
          <button class="btn btn-solid btn-sm">${editing ? "저장" : "등록"}</button>
        </div>
      </form>`);
    const f = $("#fbPlayerForm", body);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = f.name.value.trim(), org = f.org.value.trim(), pin = f.pin.value.trim(), region = f.region.value;
      if (!/^\d{4}$/.test(pin)) { toast("비밀번호는 숫자 4자리예요"); return; }
      const btn = f.querySelector(".btn-solid"); btn.disabled = true;
      try {
        const helper = await helperAuth();
        if (!editing) {
          const pid = newId();
          const cred = await helper.createUserWithEmailAndPassword(playerEmail(pid), playerPass(pin));
          await helper.signOut();
          const batch = fb.db.batch();
          batch.set(fb.db.doc(`players/${pid}`), { masked: mask(name), region, uid: cred.user.uid, createdAt: fb.FV.serverTimestamp() });
          batch.set(fb.db.doc(`players/${pid}/private/info`), { name, org, pin });
          await batch.commit();
          toast(`${name} 선수를 등록했어요`);
        } else {
          if (pin !== p.pin) {
            const cred = await helper.signInWithEmailAndPassword(playerEmail(p.id), playerPass(p.pin));
            await cred.user.updatePassword(playerPass(pin));
            await helper.signOut();
          }
          const batch = fb.db.batch();
          batch.update(fb.db.doc(`players/${p.id}`), { masked: mask(name), region });
          batch.set(fb.db.doc(`players/${p.id}/private/info`), { name, org, pin });
          await batch.commit();
          toast("저장했어요");
        }
        closeModal(); render();
      } catch (err) { console.error(err); toast("저장하지 못했어요. 다시 해주세요."); btn.disabled = false; }
    });
  }

  async function removePlayer(p, btn) {
    if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = "정말 삭제할까요? 한 번 더 누르기"; return; }
    btn.disabled = true;
    try {
      const list = await loadFeedback(p.id);
      const batch = fb.db.batch();
      list.forEach((x) => batch.delete(fb.db.doc(`players/${p.id}/feedback/${x.id}`)));
      batch.delete(fb.db.doc(`players/${p.id}/private/info`));
      batch.delete(fb.db.doc(`players/${p.id}`));
      await batch.commit();
      try { // 로그인 계정도 정리
        const helper = await helperAuth();
        const cred = await helper.signInWithEmailAndPassword(playerEmail(p.id), playerPass(p.pin));
        await cred.user.delete();
      } catch (_) { /* 계정이 남아 있어도 볼 수 있는 데이터는 없어요 */ }
      closeModal(); toast("삭제했어요"); render();
    } catch (err) { console.error(err); toast("삭제하지 못했어요"); btn.disabled = false; }
  }

  function feedbackForm(p, fbk) {
    const v = (k) => esc(fbk ? fbk[k] || "" : "");
    const body = openModal(`
      <h3>${fbk ? "피드백 수정" : "피드백 작성"}</h3><div class="meta">${esc(p.name)} · ${esc(p.org || "")}</div>
      <form class="form" id="fbForm">
        <div class="form-row">
          <label>날짜<input name="date" type="date" required value="${fbk ? v("date") : today()}" /></label>
          <label>훈련 주제<input name="topic" required maxlength="80" value="${v("topic")}" placeholder="예) 1:1 대응 — 각도 좁히기" /></label>
        </div>
        <label>잘한 점<textarea name="good" maxlength="2000">${v("good")}</textarea></label>
        <label>개선할 점<textarea name="improve" maxlength="2000">${v("improve")}</textarea></label>
        <label>적용점<textarea name="apply" maxlength="2000" placeholder="경기·팀 훈련에서 이렇게 써보기">${v("apply")}</textarea></label>
        <label>한 주 동안 과제<textarea name="homework" maxlength="2000">${v("homework")}</textarea></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">${fbk ? "저장" : "피드백 보내기"}</button></div>
      </form>`, true);
    const f = $("#fbForm", body);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {};
      ["date", ...FIELDS.map(([k]) => k)].forEach((k) => { data[k] = f[k].value.trim(); });
      const btn = f.querySelector(".btn-solid"); btn.disabled = true;
      try {
        if (fbk) await fb.db.doc(`players/${p.id}/feedback/${fbk.id}`).update({ ...data, updatedAt: fb.FV.serverTimestamp() });
        else await fb.db.collection(`players/${p.id}/feedback`).add({ ...data, checked: false, checkedAt: null, createdAt: fb.FV.serverTimestamp() });
        toast(fbk ? "수정했어요" : "피드백을 보냈어요");
        manage(p);
      } catch (err) { console.error(err); toast("저장하지 못했어요. 다시 해주세요."); btn.disabled = false; }
    });
  }

  async function manage(p) {
    const list = await loadFeedback(p.id);
    const done = list.filter((x) => x.checked).length;
    const body = openModal(`
      <h3>${esc(p.name)} 선수 피드백</h3>
      <div class="meta">${esc(p.org || "")} · 피드백 ${list.length}개 · 선수 확인 ${done}개</div>
      <div class="form-actions" style="justify-content:flex-start;margin:0 0 16px"><button class="btn btn-solid btn-sm" data-fbnew>+ 새 피드백 작성</button></div>
      <div class="fb-cards">${list.length ? list.map((x) => card(x, { forAdmin: true })).join("") : `<div class="fb-empty">아직 작성한 피드백이 없어요.</div>`}</div>`, true);
    body.onclick = async (e) => {
      if (e.target.closest("[data-fbnew]")) return feedbackForm(p);
      const ed = e.target.closest("[data-fbedit]");
      if (ed) return feedbackForm(p, list.find((x) => x.id === ed.dataset.fbedit));
      const del = e.target.closest("[data-fbdel]");
      if (del) {
        if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "한 번 더 누르면 삭제"; return; }
        await fb.db.doc(`players/${p.id}/feedback/${del.dataset.fbdel}`).delete();
        toast("삭제했어요"); manage(p);
      }
    };
  }
  // 다른 화면을 열면 이전 화면의 클릭 처리기를 지워요
  modal.addEventListener("close", () => { modalBody.onclick = null; });

  root.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-region]");
    if (c) { regionFilter = c.dataset.region; page = 1; return render(true); }
    const pg = e.target.closest("[data-pg]");
    if (pg && !pg.disabled) { page = +pg.dataset.pg; render(true); root.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (e.target.closest('[data-fb="clear"]')) { search = ""; page = 1; return render(true); }
    const b = e.target.closest("[data-fb]"); if (!b) return;
    const act = b.dataset.fb;
    const p = players.find((x) => x.id === b.dataset.pid);
    if (act === "admin") return adminLogin();
    if (!isAdmin()) return;
    if (act === "logout") { await KLFB.signOut(); toast("관리자 모드를 나왔어요"); return; }
    if (act === "add") return playerForm();
    if (act === "edit" && p) return playerForm(p);
    if (act === "write" && p) return feedbackForm(p);
    if (act === "manage" && p) return manage(p);
  });
  modalBody.addEventListener("click", (e) => {
    const r = e.target.closest("[data-fbremove]"); if (!r || !isAdmin()) return;
    const p = players.find((x) => x.id === r.dataset.fbremove);
    if (p) removePlayer(p, r);
  });

  /* 트레이닝 페이지를 처음 열 때 불러와요 */
  let started = false;
  KLFB.onAuth(() => { if (started) render(); }); // 관리자 로그인/로그아웃하면 목록을 다시 그려요
  const maybeStart = () => {
    if (started || !location.hash.startsWith("#/training")) return;
    started = true; render();
  };
  window.addEventListener("hashchange", maybeStart);
  maybeStart();
})();
