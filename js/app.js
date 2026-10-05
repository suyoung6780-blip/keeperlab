/* =========================================================
   KEEPER LAB — app
   ========================================================= */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = (n) => "₩" + n.toLocaleString("ko-KR");
  const fmtDate = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------- modal ---------- */
  const modal = $("#modal");
  function openModal(html, { wide = false } = {}) {
    $("#modalBody").innerHTML = `<button class="icon-btn modal-close" data-close aria-label="닫기">✕</button>${html}`;
    modal.classList.toggle("wide", wide);
    if (!modal.open) modal.showModal();
    return $("#modalBody");
  }
  function closeModal() { if (modal.open) modal.close(); }
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) closeModal();
  });
  modal.addEventListener("close", () => {
    $("#modalBody").innerHTML = ""; // stops any playing video
    if (location.hash.startsWith("#b=")) history.replaceState(null, "", location.pathname + location.search + "#/tactics");
  });

  /* ---------- nav: hamburger side menu ---------- */
  const menuBtn = $("#menuBtn"), sideMenu = $("#sideMenu");
  function setSide(open) {
    sideMenu.classList.toggle("is-open", open);
    sideMenu.setAttribute("aria-hidden", !open);
    menuBtn.setAttribute("aria-expanded", open);
    $("#scrim").hidden = !open;
    if (open) $("#sideClose").focus();
  }
  menuBtn.addEventListener("click", () => setSide(true));
  $("#sideClose").addEventListener("click", () => setSide(false));
  sideMenu.addEventListener("click", (e) => { if (e.target.closest("a")) setSide(false); });
  $("#scrim").addEventListener("click", () => setSide(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sideMenu.classList.contains("is-open")) setSide(false); });

  /* ---------- floating social links — 주소를 넣으면 바로 연결돼요 ---------- */
  const SOCIAL = {
    kakao: "https://pf.kakao.com/_yPxaxiX/chat",
    instagram: "https://www.instagram.com/keeper1ab/",
    youtube: "",    // 예) https://youtube.com/@keeperlab
  };
  $$("[data-social]").forEach((a) => {
    const url = SOCIAL[a.dataset.social];
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
    else a.addEventListener("click", (e) => { e.preventDefault(); toast("채널 링크를 준비 중이에요"); });
  });

  const toTop = $("#toTop");
  const onScroll = () => { toTop.hidden = window.scrollY < 400; };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // 레슨 신청 · 상품 주문 문자를 받을 번호 — 여기만 바꾸면 됩니다
  function LESSON_PHONE_SHARED() { return "010-2043-8701"; }

  /* ---------- 개인정보처리방침 (레슨 신청서용) ---------- */
  $("#privacyBtn").addEventListener("click", () => openModal(`
    <h3>개인정보처리방침</h3>
    <div class="meta">KEEPER LAB · 시행일 2026년 10월 2일</div>
    <div class="policy">
      <p>KEEPER LAB은 레슨 상담과 상품 주문을 위해 꼭 필요한 개인정보만 받고, 다른 목적으로 사용하지 않습니다.</p>
      <h4>1. 수집하는 항목</h4>
      <ul><li>레슨 신청 — 필수: 이름, 연락처 / 선택: 선수 구분, 희망 지역, 희망 코치, 희망 요일·시간, 요청 사항</li><li>상품 주문 — 필수: 이름, 연락처, 받는 주소 / 선택: 입금자명, 요청 사항</li></ul>
      <h4>2. 이용 목적</h4>
      <p>레슨 상담 및 일정·장소 조율, 주문 확인·입금 확인·상품 배송 및 관련 안내</p>
      <h4>3. 수집 방법</h4>
      <p>레슨 신청서와 주문서를 작성한 뒤, 본인 휴대폰 문자로 직접 보내는 방식으로 받습니다.</p>
      <h4>4. 보유 및 파기</h4>
      <p>상담·레슨이 끝나거나 상품 배송이 완료되면 지체 없이 삭제합니다. 삭제를 요청하시면 즉시 삭제합니다.</p>
      <h4>5. 제3자 제공</h4>
      <p>받은 개인정보는 다른 곳에 제공하지 않습니다.</p>
      <h4>6. 개인정보 보호책임자 및 문의</h4>
      <p>책임자: 유수영 · 문의: 인스타그램 DM @keeper1ab</p>
    </div>`));

  /* ---------- 메인 화면 효과: 마우스 시차 ---------- */
  (function heroFx() {
    const hero = $("#hero"), media = $("#heroMedia");
    if (!hero || !media) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(pointer: fine)").matches) return;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      media.style.transform = `translate(${-dx * 10}px, ${-dy * 6}px)`;
    });
    hero.addEventListener("pointerleave", () => { media.style.transform = ""; });
  })();

  /* ---------- pages (hash router: #/shop, #/training …) ---------- */
  const PAGES = ["home", "about", "shop", "training", "archive", "tactics"];
  const TITLES = { home: "", about: "소개", shop: "샵", training: "트레이닝", archive: "아카이브", tactics: "택티컬 패드" };
  function showPage(id) {
    $$("main [data-page]").forEach((el) => { el.hidden = el.dataset.page !== id; });
    document.body.dataset.page = id;
    $$("[data-nav]").forEach((a) => {
      const on = a.dataset.nav === id;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.title = id === "home" ? "KEEPER LAB — 골키퍼를 위한 연구소" : `${TITLES[id]} — KEEPER LAB`;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (id === "tactics" && typeof pad !== "undefined" && pad) requestAnimationFrame(() => pad.refresh());
  }
  function route() {
    const h = location.hash;
    if (h.startsWith("#b=")) { showPage("tactics"); openFromHash(); return; }
    if (h && h !== "#" && !h.startsWith("#/")) return; // in-page anchors like #main
    const [id = "home", sub] = h.slice(2).split(/[/?]/).filter(Boolean);
    showPage(PAGES.includes(id) ? id : "home");
    if (id === "shop") showShop(sub);
  }
  window.addEventListener("hashchange", route);

  /* reveal on scroll */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); revealObs.unobserve(en.target); } });
  }, { threshold: 0.12 });
  $$(".sec-head, .pad, .lesson-grid, .lesson-steps, .about .reveal").forEach((el) => { el.classList.add("reveal"); revealObs.observe(el); });

  function setChips(container, btn) {
    $$(".chip", container).forEach((c) => {
      c.classList.toggle("is-active", c === btn);
      c.setAttribute("aria-selected", c === btn);
    });
  }

  /* =========================================================
     02 SHOP — 골키퍼 일지 1종 · 주문서(문자) + 계좌이체
     ========================================================= */
  // ▼ 상품·결제 정보 — 여기만 바꾸면 사이트 전체에 반영돼요
  //   새 상품은 PRODUCTS 배열에 하나씩 추가하면 목록과 상세 페이지가 자동으로 생겨요
  const SHIPPING = 3000; // 주문 1건당 배송비 (0이면 무료배송)
  // 샵 오픈 시 입금 계좌를 여기에 입력 (공개 저장소라 지금은 비워둠)
  const BANK = { bank: "", account: "", holder: "" };
  const PRODUCTS = [
    {
      id: "number-one-diary",
      name: "넘버원 다이어리",
      en: "NUMBER ONE DIARY",
      tag: "KEEPER LAB ORIGINAL",
      // 사진: assets/shop/ 폴더에 넣고 파일 이름을 적어주세요 (첫 번째가 대표 사진)
      photos: ["assets/shop/number-one-diary.jpg"],
      summary: "골키퍼의 <b>훈련과 경기, 컨디션과 성장 과정</b>을 기록하는 골키퍼 전용 다이어리입니다.",
      options: [
        { id: "training", name: "훈련용", en: "TRAINING DIARY", price: 15000 },
        { id: "match", name: "경기용", en: "MATCH DIARY", price: 15000 },
      ],
      detail: `
        <article class="pd-detail" aria-label="넘버원 다이어리 상세 소개">
          <header class="pdd-head">
            <p class="sec-kicker">Product Detail</p>
            <h3>KEEPER LAB 넘버원 다이어리</h3>
            <p>골키퍼의 <strong>훈련과 경기, 컨디션과 성장 과정</strong>을 기록하는 골키퍼 전용 다이어리입니다.</p>
          </header>
          <div class="pdd-cols">
            <section class="pdd-col">
              <span class="pdd-en">TRAINING DIARY</span>
              <h4>훈련용</h4>
              <p>훈련의 목적과 과정을 기록하고, 스스로의 플레이를 돌아보며 다음 훈련의 방향을 설정합니다.</p>
              <ul>
                <li>IDP 개인 기량 체크</li><li>훈련 주제</li><li>코칭 포인트</li><li>Goalkeeper Grid</li><li>잘한 점 / 보완할 점</li>
                <li>Self Score</li><li>Coach's Feedback</li><li>수면 시간 / 수면의 질</li><li>컨디션</li><li>훈련 강도(RPE)</li>
              </ul>
            </section>
            <section class="pdd-col">
              <span class="pdd-en">MATCH DIARY</span>
              <h4>경기용</h4>
              <p>경기 전 나의 상태를 확인하고, 경기 후 실제 플레이를 돌아보며 기록합니다.</p>
              <ul>
                <li>IDP 개인 기량 체크</li><li>경기 주제</li><li>경기 개인 지표</li><li>Self Score</li>
                <li>Coach's Feedback</li><li>수면 시간 / 수면의 질</li><li>경기 전 컨디션</li><li>경기 후 RPE(체감 경기강도)</li>
              </ul>
            </section>
          </div>
          <footer class="pdd-foot">
            <p class="pdd-slogan">기록하고, 돌아보고, 성장하다.</p>
            <p>KEEPER LAB 넘버원 다이어리는<br />꾸준한 기록을 통해 <strong>골키퍼 스스로 자신의 변화를 확인하고 성장 과정을 만들어갈 수 있도록</strong> 설계했습니다.</p>
          </footer>
        </article>`,
    },
  ];
  const ORDER_PHONE = LESSON_PHONE_SHARED();
  const orders = Store.collection("kl_orders_v1", []);
  let cur = null;         // 지금 보고 있는 상품
  let cartQty = {};       // 옵션별 수량

  const minPrice = (p) => Math.min(...p.options.map((o) => o.price));
  const sumItems = () => cur.options.reduce((s, o) => s + o.price * cartQty[o.id], 0);
  const countItems = () => cur.options.reduce((s, o) => s + cartQty[o.id], 0);
  const orderTotal = () => (countItems() ? sumItems() + SHIPPING : 0);
  const itemLines = () => cur.options.filter((o) => cartQty[o.id]).map((o) => `${cur.name} ${o.name} × ${cartQty[o.id]}`);

  function renderShopList() {
    $("#shopGrid").innerHTML = PRODUCTS.map((p) => {
      const same = p.options.every((o) => o.price === p.options[0].price);
      return `
        <a class="shop-card" href="#/shop/${p.id}">
          <div class="shop-thumb">${p.photos[0] ? `<img src="${p.photos[0]}" alt="" loading="lazy" onerror="this.remove()" />` : ""}</div>
          <div class="shop-body">
            <span class="shop-tag">${p.tag}</span>
            <h3>${p.name}</h3>
            <p class="shop-opts">${p.options.map((o) => o.name).join(" · ")}</p>
            <p class="shop-price">${won(minPrice(p))}${same ? "" : " ~"}</p>
          </div>
        </a>`;
    }).join("");
  }

  // 결제 준비가 끝나면 true로 바꾸면 상품 목록·상세가 다시 열려요
  const SHOP_OPEN = false;
  // #/shop → 목록, #/shop/상품id → 상세
  function showShop(productId) {
    $("#shopSoon").hidden = SHOP_OPEN;
    $("#shopSteps").hidden = !SHOP_OPEN;
    if (!SHOP_OPEN) { $("#shopList").hidden = true; $("#shopDetail").hidden = true; return; }
    const p = PRODUCTS.find((x) => x.id === productId);
    $("#shopList").hidden = !!p;
    $("#shopDetail").hidden = !p;
    if (!p) return;
    if (cur !== p) { cur = p; cartQty = Object.fromEntries(p.options.map((o, i) => [o.id, i === 0 ? 1 : 0])); }
    document.title = `${p.name} — KEEPER LAB`;
    $("#crumbName").textContent = p.name;
    renderProduct();
    $("#productDetail").innerHTML = p.detail || "";
  }

  function renderProduct() {
    $("#product").innerHTML = `
      <div class="pd-gallery">
        <div class="pd-main" id="pdMain"></div>
        <div class="pd-thumbs" id="pdThumbs"></div>
      </div>
      <div class="pd-info">
        <span class="pd-tag">${cur.tag} · ${cur.en}</span>
        <h3 class="pd-name">${cur.name}</h3>
        <p class="pd-price">${won(minPrice(cur))}${cur.options.length > 1 ? ` <small>/ 권</small>` : ""}</p>
        <p class="pd-summary">${cur.summary}</p>
        <div class="pd-options" role="group" aria-label="종류와 수량 선택">
          ${cur.options.map((o) => `
            <div class="pd-opt">
              <div><b>${o.name}</b><span>${o.en || ""}</span></div>
              <span class="pd-opt-price">${won(o.price)}</span>
              <div class="qty qty-lg"><button data-q="-1" data-opt="${o.id}" aria-label="${o.name} 수량 줄이기">−</button><span data-qty-of="${o.id}">${cartQty[o.id]}</span><button data-q="1" data-opt="${o.id}" aria-label="${o.name} 수량 늘리기">+</button></div>
            </div>`).join("")}
        </div>
        <dl class="pd-rows">
          <div><dt>배송비</dt><dd>${SHIPPING ? won(SHIPPING) : "무료"}</dd></div>
          <div><dt>결제</dt><dd>계좌이체 (입금 확인 후 발송)</dd></div>
        </dl>
        <div class="pd-buy">
          <span class="pd-count" id="pdCount"></span>
          <div class="pd-total"><span>총 금액</span><strong id="pdTotal"></strong></div>
        </div>
        <button class="btn btn-solid btn-block" id="orderBtn">주문하기</button>
      </div>`;
    syncTotals();
    loadPhotos();
  }

  function syncTotals() {
    cur.options.forEach((o) => { const el = $(`[data-qty-of="${o.id}"]`); if (el) el.textContent = cartQty[o.id]; });
    const n = countItems();
    $("#pdCount").textContent = n ? `총 ${n}개` : "수량을 선택해 주세요";
    $("#pdTotal").textContent = won(orderTotal());
    $("#orderBtn").disabled = !n;
  }

  // 사진 파일이 있을 때만 보여주고, 없으면 빈 자리
  function loadPhotos() {
    const ok = [];
    let pending = cur.photos.length;
    if (!pending) { $("#pdMain").innerHTML = `<span class="pd-nophoto">PHOTO</span>`; return; }
    cur.photos.forEach((src, i) => {
      const img = new Image();
      img.onload = () => { ok[i] = src; done(); };
      img.onerror = done;
      img.src = src;
    });
    function done() {
      if (--pending) return;
      const list = ok.filter(Boolean);
      if (!list.length) { $("#pdMain").innerHTML = `<span class="pd-nophoto">PHOTO</span>`; return; }
      const show = (src) => {
        $("#pdMain").innerHTML = `<img src="${src}" alt="${cur.name}" />`;
        $$("#pdThumbs button").forEach((b) => b.classList.toggle("is-active", b.dataset.src === src));
      };
      $("#pdThumbs").innerHTML = list.length > 1 ? list.map((src) => `<button data-src="${src}" aria-label="사진 보기"><img src="${src}" alt="" /></button>`).join("") : "";
      show(list[0]);
      $("#pdThumbs").onclick = (e) => { const b = e.target.closest("[data-src]"); if (b) show(b.dataset.src); };
    }
  }

  $("#product").addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]");
    if (q) {
      const id = q.dataset.opt;
      cartQty[id] = Math.min(20, Math.max(0, cartQty[id] + Number(q.dataset.q)));
      syncTotals();
    }
    if (e.target.closest("#orderBtn") && countItems()) openOrder();
  });

  function openOrder() {
    const total = orderTotal();
    const items = itemLines();
    const body = openModal(`
      <h3>주문서 작성</h3>
      <div class="meta">${esc(items.join(" · "))} · 총 ${won(total)} · 계좌이체</div>
      <form class="form" id="orderForm">
        <div class="form-row">
          <label>주문자 이름<input name="name" required maxlength="30" autocomplete="name" /></label>
          <label>연락처<input name="phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" /></label>
        </div>
        <label>받는 주소<input name="addr" required maxlength="120" autocomplete="street-address" placeholder="도로명 주소" /></label>
        <div class="form-row">
          <label>상세 주소<input name="addr2" maxlength="60" placeholder="동 · 호수" /></label>
          <label>입금자명<input name="payer" maxlength="30" placeholder="주문자와 다를 때만" /></label>
        </div>
        <label>요청 사항 (선택)<textarea name="note" maxlength="500" placeholder="배송 요청 사항 등"></textarea></label>
        <label class="check"><input type="checkbox" name="agree" required /> <span>주문 처리와 배송을 위한 개인정보(이름·연락처·주소) 수집 및 이용에 동의합니다.</span></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">주문서 보내기</button></div>
      </form>`);
    $("#orderForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const digits = f.phone.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 12 || /[^\d\s-]/.test(f.phone)) {
        e.target.phone.focus();
        return toast("연락처를 숫자로 정확히 입력해 주세요");
      }
      const o = {
        name: f.name.trim(), phone: f.phone.trim(), addr: `${f.addr.trim()} ${f.addr2.trim()}`.trim(),
        payer: f.payer.trim() || f.name.trim(), note: f.note.trim(), items, qty: { ...cartQty }, total, status: "new",
      };
      await orders.add(o);
      showOrderSend(o);
    });
  }

  function showOrderSend(o) {
    const text = [
      "[KEEPER LAB 주문]",
      ...o.items.map((l) => `상품: ${l}`),
      `금액: ${won(o.total)}${SHIPPING ? ` (배송비 ${won(SHIPPING)} 포함)` : ""}`,
      `주문자: ${o.name}`,
      `연락처: ${o.phone}`,
      `주소: ${o.addr}`,
      `입금자명: ${o.payer}`,
      o.note && `요청 사항: ${o.note}`,
    ].filter(Boolean).join("\n");
    const body = openModal(`
      <div class="done">
        <div class="done-mark" aria-hidden="true">✉</div>
        <h3>문자로 주문서 보내기</h3>
        <p>버튼을 누르면 문자 앱이 열리고 주문 내용이 채워져요.<br /><b>전송</b>까지 눌러야 주문이 접수돼요.</p>
        <a class="btn btn-solid btn-block" href="${smsLink(ORDER_PHONE, text)}" data-sms>문자로 주문서 보내기</a>
        <div class="pay-box">
          <span>입금 계좌</span>
          <strong>${esc(BANK.bank)} ${esc(BANK.account)}</strong>
          <small>예금주 ${esc(BANK.holder)} · 입금액 <b>${won(o.total)}</b> · 입금자명 ${esc(o.payer)}</small>
          <button class="btn btn-ghost btn-sm" data-copy-acc>계좌번호 복사</button>
        </div>
        <div class="sms-preview">
          <div class="sms-to"><span>받는 번호</span><strong>${esc(ORDER_PHONE)}</strong></div>
          <pre>${esc(text)}</pre>
          <button class="btn btn-ghost btn-sm btn-block" data-copy-sms>PC라면: 내용 복사하기</button>
        </div>
      </div>`);
    $("[data-copy-acc]", body).addEventListener("click", () => copyText(BANK.account.replace(/\D/g, ""), "계좌번호를 복사했어요"));
    $("[data-copy-sms]", body).addEventListener("click", () => copyText(text, `복사했어요. ${ORDER_PHONE}로 문자 보내주세요`));
  }

  const smsLink = (phone, text) => `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(text)}`; // ?&body= : iOS · 안드로이드 공통
  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch { window.prompt("아래 내용을 복사해 주세요", text); }
  }

  /* =========================================================
     03 TRAINING — 횟수권 + 레슨 신청서 (결제 없음, 담당자가 연락)
     ========================================================= */
  const LESSON_PHONE = LESSON_PHONE_SHARED();
  const LESSONS = [
    { id: "l1", count: 1, name: "1회 체험", cta: "체험 신청하기", note: "처음이라면 체험부터", desc: "처음 만나는 체험 레슨, 또는 특정 기술 하나를 집중 교정하는 원포인트 레슨.", points: ["수준별 맞춤 지도", "현재 수준 진단과 피드백"] },
    { id: "l4", count: 4, name: "4회권", cta: "문의하기", note: "가격은 문의해 주세요", desc: "기본기를 체계적으로 다지는 한 달 과정 (주 1회 기준).", points: ["수준별 맞춤 지도", "수준 진단 후 4회 커리큘럼 구성", "회차별 피드백"] },
    { id: "l8", count: 8, name: "8회권", cta: "문의하기", note: "가격은 문의해 주세요", desc: "시즌 준비나 입시처럼 확실한 변화가 필요한 선수를 위한 과정.", points: ["수준별 맞춤 지도", "수준 진단 후 8회 커리큘럼 구성", "회차별 피드백"] },
  ];
  const lessonReqs = Store.collection("kl_lesson_requests_v1", []);

  // ▼ 레슨 가능 지역 · 코치 — 여기만 바꾸면 안내란과 신청서에 함께 반영돼요
  const REGIONS = [
    { group: "서울", areas: ["서울 중부", "서울 동부", "서울 동남"] },
    { group: "경기", areas: ["경기 서부", "경기 남부", "경기 동북부"] },
  ];
  // 사진은 assets/coaches/ 폴더에 넣고 photo에 파일 이름을 적어주세요 (없으면 이니셜이 보여요)
  const COACHES = [
    { id: "yoo", name: "유수영", role: "KEEPER LAB 대표 · GK 코치", photo: "assets/coaches/yoo.jpg" },
    { id: "seo", name: "서동현", role: "GK 코치", photo: "assets/coaches/seo.jpg" },
    { id: "bang", name: "방하승", role: "GK 코치", photo: "assets/coaches/bang.jpg" },
  ];
  const ALL_AREAS = REGIONS.flatMap((r) => r.areas);

  function renderLessonInfo() {
    $("#lessonInfo").innerHTML = `
      <div class="li-block">
        <div class="li-head"><span class="li-num">AREA</span><h3>레슨 가능 지역</h3></div>
        <div class="li-regions">
          ${REGIONS.map((r) => `
            <div class="li-region">
              <b>${r.group}</b>
              <ul>${r.areas.map((a) => `<li>${a.replace(r.group + " ", "")}</li>`).join("")}</ul>
            </div>`).join("")}
        </div>
        <p class="li-note">정확한 레슨 장소는 신청 후 담당자와 상의해서 정해요.</p>
      </div>
      <div class="li-block">
        <div class="li-head"><span class="li-num">COACH</span><h3>KEEPER LAB 코치</h3></div>
        <div class="coach-grid">
          ${COACHES.map((c) => `
            <article class="coach">
              <div class="coach-photo" data-initial="${c.name.slice(1)}">${c.photo ? `<img src="${c.photo}" alt="${c.name} 코치" onerror="this.remove()" />` : ""}</div>
              <div class="coach-body">
                <h4>${c.name}<small>코치</small></h4>
                <p>${c.role}</p>
              </div>
            </article>`).join("")}
        </div>
      </div>`;
  }

  function renderLessons() {
    $("#lessonGrid").innerHTML = LESSONS.map((l) => `
      <article class="lesson">
        <div class="lesson-count"><b>${l.count}</b><span>회</span></div>
        <h3>${l.name}</h3>
        <p>${l.desc}</p>
        <ul>${l.points.map((p) => `<li>${p}</li>`).join("")}</ul>
        <div class="lesson-price">
          <div><strong class="lesson-ask">${l.count === 1 ? "체험" : "문의"}</strong><small>${l.note}</small></div>
          <button class="btn btn-solid btn-sm" data-apply="${l.id}">${l.cta}</button>
        </div>
      </article>`).join("");
  }

  $("#training").addEventListener("click", (e) => {
    const b = e.target.closest("[data-apply]");
    if (b) openApply(b.dataset.apply);
  });

  function openApply(selected) {
    const body = openModal(`
      <h3>레슨 신청</h3>
      <div class="meta">신청서를 남기면 담당자가 연락드려 일정과 장소를 조율해요 · 지금은 결제하지 않아요</div>
      <form class="form" id="applyForm">
        <div class="form-row">
          <label>이름<input name="name" required maxlength="30" autocomplete="name" /></label>
          <label>연락처<input name="phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="010-0000-0000" /></label>
        </div>
        <div class="form-row">
          <label>횟수권<select name="plan">
            ${LESSONS.map((l) => `<option value="${l.id}" ${l.id === selected ? "selected" : ""}>${l.name}${l.count > 1 ? " (문의)" : ""}</option>`).join("")}
            <option value="consult" ${selected === "consult" ? "selected" : ""}>아직 모르겠어요 (상담 먼저)</option>
          </select></label>
          <label>선수 구분<select name="level">
            <option>입문 · 취미</option><option>유소년 선수</option><option>중·고등 선수</option><option>성인 아마추어</option><option>기타</option>
          </select></label>
        </div>
        <div class="form-row">
          <label>희망 지역<select name="area" required>
            <option value="">지역을 선택해 주세요</option>
            ${REGIONS.map((r) => `<optgroup label="${r.group}">${r.areas.map((a) => `<option>${a}</option>`).join("")}</optgroup>`).join("")}
          </select></label>
          <label>희망 코치<select name="coach">
            <option value="">상관없음</option>
            ${COACHES.map((c) => `<option>${c.name}</option>`).join("")}
          </select></label>
        </div>
        <div class="form-row">
          <label>상세 위치 (선택)<input name="spot" maxlength="40" placeholder="예) 송파구, 잠실역 근처" /></label>
          <label>희망 요일 · 시간대<input name="when" maxlength="60" placeholder="예) 평일 저녁, 토요일 오전" /></label>
        </div>
        <label>요청 사항 (선택)<textarea name="note" maxlength="1000" placeholder="포지션 경력, 고치고 싶은 부분 등을 적어주세요"></textarea></label>
        <label class="check"><input type="checkbox" name="agree" required /> <span>레슨 상담을 위한 개인정보(이름·연락처) 수집 및 이용에 동의합니다.</span></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">신청서 보내기</button></div>
      </form>`);
    $("#applyForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const digits = f.phone.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 12 || /[^\d\s-]/.test(f.phone)) {
        e.target.phone.focus();
        return toast("연락처를 숫자로 정확히 입력해 주세요");
      }
      const plan = LESSONS.find((l) => l.id === f.plan);
      const req = {
        name: f.name.trim(), phone: f.phone.trim(), plan: plan ? plan.name : "상담 먼저", price: 0,
        level: f.level, area: [f.area, f.spot.trim()].filter(Boolean).join(" · "), coach: f.coach || "상관없음",
        when: f.when.trim(), note: f.note.trim(), status: "new",
      };
      await lessonReqs.add(req);
      showSendStep(req);
    });
  }

  /* 신청 내용을 문자로 만들어 신청자 휴대폰 문자 앱에서 운영자 번호로 보내게 함 */
  function showSendStep(r) {
    const text = [
      "[KEEPER LAB 레슨 신청]",
      `이름: ${r.name}`,
      `연락처: ${r.phone}`,
      `신청: ${r.plan}`,
      `선수 구분: ${r.level}`,
      r.area && `희망 지역: ${r.area}`,
      `희망 코치: ${r.coach || "상관없음"}`,
      r.when && `희망 요일·시간: ${r.when}`,
      r.note && `요청 사항: ${r.note}`,
    ].filter(Boolean).join("\n");
    // ?&body= 형태가 iOS · 안드로이드 모두에서 동작
    const smsHref = `sms:${LESSON_PHONE.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(text)}`;
    const body = openModal(`
      <div class="done">
        <div class="done-mark" aria-hidden="true">✉</div>
        <h3>마지막 단계: 문자 보내기</h3>
        <p>아래 버튼을 누르면 문자 앱이 열리고 신청 내용이 자동으로 채워져요.<br /><b>전송</b>까지 눌러야 신청이 완료돼요.</p>
        <a class="btn btn-solid btn-block" href="${smsHref}" data-sms>문자로 신청서 보내기</a>
        <div class="sms-preview">
          <div class="sms-to"><span>받는 번호</span><strong>${esc(LESSON_PHONE)}</strong></div>
          <pre>${esc(text)}</pre>
          <button class="btn btn-ghost btn-sm btn-block" data-copy-sms>PC라면: 내용 복사하기</button>
        </div>
      </div>`);
    $("[data-copy-sms]", body).addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); toast(`복사했어요. ${LESSON_PHONE}로 문자 보내주세요`); }
      catch { window.prompt("아래 내용을 복사해 주세요", text); }
    });
    $("[data-sms]", body).addEventListener("click", () => {
      setTimeout(() => {
        openModal(`
          <div class="done">
            <div class="done-mark" aria-hidden="true">✓</div>
            <h3>문자를 보내셨나요?</h3>
            <p>${esc(r.name)}님, 문자가 전송되면<br />남겨주신 연락처(${esc(r.phone)})로 담당자가 연락드려 일정과 장소를 조율할게요.</p>
            <div class="form-actions" style="justify-content:center">
              <button class="btn btn-ghost btn-sm" data-resend>문자 다시 열기</button>
              <button class="btn btn-solid btn-sm" data-close>확인</button>
            </div>
          </div>`);
        $("[data-resend]", $("#modalBody")).addEventListener("click", () => showSendStep(r));
      }, 600);
    });
  }

  /* =========================================================
     04 ARCHIVE
     ========================================================= */
  const RES_SEED = [
    {
      id: "r1", type: "article", title: "다이빙의 시작은 발이다: 파워 스텝", author: "KEEPER LAB", createdAt: Date.parse("2026-09-12"),
      desc: "멀리 뜨는 다이빙은 팔이 아니라 첫 스텝에서 결정됩니다. 공 방향 발로 딛는 파워 스텝의 원리.",
      body: `<h4>왜 스텝인가</h4><p>다이빙 거리의 대부분은 지면 반발력에서 나옵니다. 세트 포지션에서 공 방향 발을 짧고 강하게 사선 앞으로 딛는 것이 '파워 스텝'입니다.</p>
        <h4>체크포인트</h4><ol><li>세트 시 체중은 발 앞꿈치, 무릎은 살짝 굽힘</li><li>공 방향 발을 사선 앞으로 — 옆이 아니라 앞으로 딛어야 각도를 줄입니다</li><li>딛는 발과 같은 쪽 팔이 먼저 공 라인으로</li><li>반대쪽 무릎을 끌어올려 몸을 '띄운다'</li></ol>
        <h4>흔한 실수</h4><p>뒤로 빠지는 스텝(드롭 스텝)은 골대와의 거리를 줄여 각도를 넓혀줍니다. 영상으로 자신의 첫 스텝 방향을 꼭 확인하세요.</p>`,
    },
    {
      id: "r2", type: "article", title: "1:1 상황, 언제 서고 언제 덮칠까", author: "KEEPER LAB", createdAt: Date.parse("2026-09-03"),
      desc: "공격수의 터치 거리로 판단하는 1:1 대응. 블록 자세(K-블록, 스프레드)의 선택 기준.",
      body: `<h4>판단 기준: 공과 발 사이의 거리</h4><p>공격수의 터치가 길어질 때가 전진의 신호입니다. 공이 발에 붙어 있으면 거리를 좁히며 세트하고, 터치가 길면 공을 향해 과감하게 덮칩니다.</p>
        <h4>블록의 종류</h4><ul><li><b>K-블록</b> — 근거리, 낮은 슈팅. 한쪽 무릎을 꿇고 다른 다리로 각을 막음</li><li><b>스프레드</b> — 초근거리. 몸 전체를 펼쳐 면적을 최대화</li><li><b>스탠딩</b> — 거리가 남아 있고 칩슛 위험이 있을 때</li></ul>
        <h4>원칙</h4><p>먼저 넘어지지 않는다. 공격수가 결정하게 만들고, 그 순간에 반응합니다.</p>`,
    },
    {
      id: "r3", type: "article", title: "크로스 처리: 나갈까, 남을까", author: "Coach J.", createdAt: Date.parse("2026-08-21"),
      desc: "크로스 상황에서 골키퍼가 내려야 하는 세 가지 판단 — 궤적, 트래픽, 콜.",
      body: `<h4>1. 시작 위치</h4><p>크로스 쪽 포스트에서 1~2m 앞, 골대 중앙 쪽으로 열린 자세. 몸을 공과 박스 안쪽 모두 볼 수 있게 엽니다.</p>
        <h4>2. 궤적 읽기</h4><p>공이 떠나는 순간 높이·속도·회전을 읽고 결정합니다. 망설임이 가장 큰 실점 원인입니다.</p>
        <h4>3. 콜</h4><p>"키퍼!" 또는 "어웨이!" — 결정했다면 크고 빠르게. 수비수가 다음 행동을 할 수 있게 하는 것이 목소리의 역할입니다.</p>`,
    },
    {
      id: "r4", type: "drill", title: "리액션 월 15분 루틴", author: "KEEPER LAB", createdAt: Date.parse("2026-08-10"),
      desc: "벽과 리플렉스 볼만 있으면 되는 개인 반응 훈련. 3세트 × 4종목.",
      body: `<h4>준비물</h4><p>벽, 리플렉스 볼 또는 테니스공, 콘 2개</p>
        <h4>루틴 (각 45초 / 휴식 15초 × 3세트)</h4><ol><li>벽 2m 앞 양손 캐치 — 세트 자세 유지</li><li>한 손 던지고 반대 손 캐치 — 손-눈 협응</li><li>리플렉스 볼 바운드 캐치 — 낮은 자세</li><li>콘 사이 사이드 스텝 후 캐치 — 스텝과 손 동기화</li></ol>
        <h4>코칭 포인트</h4><p>속도보다 '세트 자세로 돌아오는 것'을 우선하세요. 매 캐치 후 무게중심을 앞꿈치로.</p>`,
    },
    {
      id: "r5", type: "drill", title: "빌드업 패스 3-게이트 드릴", author: "Coach J.", createdAt: Date.parse("2026-07-28"),
      desc: "백패스 첫 터치부터 전환 패스까지. 콘 게이트 3개로 만드는 발 기술 훈련.",
      body: `<h4>세팅</h4><p>골대 앞 10m에 코치, 좌·우·중앙 20m 지점에 콘 게이트(폭 2m) 3개.</p>
        <h4>진행</h4><ol><li>코치의 백패스를 오픈 바디로 첫 터치</li><li>코치가 외치는 게이트로 2터치 이내 패스</li><li>성공 10회 후 약발로 반복</li></ol>
        <h4>발전</h4><p>압박 역할 선수를 추가해 첫 터치 방향을 압박 반대쪽으로 가져가도록 합니다.</p>`,
    },
  ];
  const resStore = Store.collection("kl_resources_v1", RES_SEED);
  const TYPE_NAME = { video: "영상", article: "아티클", drill: "훈련 드릴" };
  const ytId = (url = "") => (url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/) || [])[1];
  let resFilter = "all";

  async function renderResources() {
    const items = (await resStore.list()).filter((r) => resFilter === "all" || r.type === resFilter);
    $("#resGrid").innerHTML = items.length ? items.map((r) => {
      const yt = ytId(r.url);
      const thumb = yt ? `style="background-image:url('https://i.ytimg.com/vi/${yt}/hqdefault.jpg')"` : "";
      const glyph = { video: "PLAY", article: "READ", drill: "DRILL" }[r.type];
      return `<button class="res-card" data-res="${r.id}">
        <div class="res-thumb" ${thumb}>${yt ? "" : `<span class="res-glyph">${glyph}</span>`}${r.type === "video" ? `<span class="res-play"></span>` : ""}</div>
        <div class="res-body">
          <div class="res-meta"><span class="type">${TYPE_NAME[r.type]}</span><span>${esc(r.author)}</span><span>${fmtDate(r.createdAt)}</span></div>
          <h3 class="res-title">${esc(r.title)}</h3>
          <p class="res-desc">${esc(r.desc)}</p>
        </div>
      </button>`;
    }).join("") : `<div class="empty">${resFilter === "video" ? "아직 공유된 영상이 없어요. 첫 영상을 공유해보세요!" : "자료가 없어요."}</div>`;
  }

  $("#resFilters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    setChips($("#resFilters"), b); resFilter = b.dataset.type; renderResources();
  });

  $("#resGrid").addEventListener("click", async (e) => {
    const card = e.target.closest("[data-res]"); if (!card) return;
    const r = await resStore.get(card.dataset.res); if (!r) return;
    const yt = ytId(r.url);
    const media = yt
      ? `<div class="video-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1" title="${esc(r.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
      : "";
    const body = r.body || (r.desc ? `<p style="white-space:pre-wrap">${esc(r.desc)}</p>` : "");
    const link = r.url && !yt ? `<p><a class="btn btn-ghost btn-sm" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">원본 링크 열기 ↗</a></p>` : "";
    const del = r.mine ? `<div class="form-actions"><button class="btn btn-ghost btn-sm" data-del-res="${r.id}">삭제</button></div>` : "";
    openModal(`${media}<h3>${esc(r.title)}</h3><div class="meta">${TYPE_NAME[r.type]} · ${esc(r.author)} · ${fmtDate(r.createdAt)}</div><div class="article">${body}</div>${link}${del}`, { wide: !!yt });
  });

  $("#modalBody").addEventListener("click", async (e) => {
    const d = e.target.closest("[data-del-res]");
    if (d) { await resStore.remove(d.dataset.delRes); closeModal(); renderResources(); toast("삭제했어요"); }
  });

  $("#resShareBtn").addEventListener("click", () => {
    const body = openModal(`
      <h3>자료 공유하기</h3><div class="meta">영상 · 아티클 · 훈련 드릴</div>
      <form class="form" id="resForm">
        <div class="form-row">
          <label>종류<select name="type"><option value="video">영상</option><option value="article">아티클</option><option value="drill">훈련 드릴</option></select></label>
          <label>작성자<input name="author" required maxlength="30" value="${esc(localStorage.getItem("kl_name") || "")}" placeholder="이름 또는 닉네임" /></label>
        </div>
        <label>제목<input name="title" required maxlength="80" placeholder="예) 하이볼 캐칭 포인트 정리" /></label>
        <label>링크 (유튜브 링크는 바로 재생돼요)<input name="url" type="url" placeholder="https://youtu.be/..." /></label>
        <label>설명 / 내용<textarea name="desc" maxlength="3000" placeholder="어떤 자료인지, 핵심 포인트를 적어주세요"></textarea></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">공유하기</button></div>
      </form>`);
    $("#resForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (f.type === "video" && !f.url) return toast("영상은 링크가 필요해요");
      try { localStorage.setItem("kl_name", f.author); } catch {}
      await resStore.add({ type: f.type, title: f.title.trim(), author: f.author.trim(), url: f.url.trim(), desc: f.desc.trim() });
      closeModal();
      resFilter = "all"; setChips($("#resFilters"), $("#resFilters .chip"));
      renderResources();
      toast("아카이브에 공유했어요");
    });
  });

  /* =========================================================
     05 TACTICAL PAD (3D)
     ========================================================= */
  const T3 = window.Tactics3D;
  const pad = T3 ? T3.createPad({
    stage: $("#padStage"), palette: $("#padPalette"), hint: $("#padHint"),
    onPlayChange: (on) => { $("#playBtn").textContent = on ? "■ 정지" : "▶ 재생"; $("#playBtn").classList.toggle("is-active", on); },
    onChange: () => syncUndo(),
  }) : null;
  if (!pad) { $("#padFallback").hidden = false; $("#padHint").hidden = true; }
  const needPad = () => { if (!pad) toast("3D 엔진을 불러오지 못했어요"); return !!pad; };
  function syncUndo() { if (!pad) return; $("#undoBtn").disabled = !pad.canUndo; $("#redoBtn").disabled = !pad.canRedo; }

  // 위쪽: 경기장 각도 썸네일 · 색
  function renderSegs() {
    if (!pad) return;
    const st = pad.state;
    $("#pitchPicker").innerHTML = Object.entries(T3.ANGLES).map(([id, a]) => `
      <button type="button" role="radio" aria-checked="${st.angle === id}" data-angle="${id}" title="${a.name}">
        <img src="${T3.boardImage({ angle: id, turf: st.turf }, 240, 150)}" alt="" /><span>${a.name}</span>
      </button>`).join("");
    $("#turfSeg").innerHTML = Object.entries(T3.TURFS).map(([id, n]) =>
      `<button type="button" role="radio" data-turf="${id}" aria-checked="${st.turf === id}">${n}</button>`).join("");
    syncUndo();
  }
  $("#pitchPicker").addEventListener("click", (e) => { const b = e.target.closest("[data-angle]"); if (b && needPad()) { pad.setAngle(b.dataset.angle); renderSegs(); } });
  $("#turfSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-turf]"); if (b && needPad()) { pad.setTurf(b.dataset.turf); renderSegs(); } });

  $("#undoBtn").addEventListener("click", () => { if (needPad()) { pad.undo(); renderSegs(); } });

  // 전체화면: 버튼으로 들어가고 ESC로 나옴
  const padBox = $("#tactics .pad");
  function setFull(on) {
    padBox.classList.toggle("is-full", on);
    document.body.classList.toggle("pad-full", on);
    $("#fullBtn").textContent = on ? "✕ 나가기" : "⛶ 전체화면";
    // 브라우저 전체화면 기능 대신 창 전체를 덮는 방식 (끌기·그리기가 그대로 동작)
    if (pad) { requestAnimationFrame(() => pad.refresh()); setTimeout(() => pad.refresh(), 250); }
  }
  $("#fullBtn").addEventListener("click", () => setFull(!padBox.classList.contains("is-full")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && padBox.classList.contains("is-full") && !modal.open) setFull(false);
  });
  $("#redoBtn").addEventListener("click", () => { if (needPad()) { pad.redo(); renderSegs(); } });
  $("#clearBtn").addEventListener("click", () => { if (needPad()) pad.clear(); });
  $("#playBtn").addEventListener("click", () => {
    if (!needPad()) return;
    if (!pad.play()) toast("선수나 공을 누르고 ＋ 다음 위치를 눌러, 움직일 순서를 먼저 만들어 주세요");
  });

  document.addEventListener("keydown", (e) => {
    if (!pad || modal.open || (e.target.closest && e.target.closest("input, textarea, select"))) return;
    if (document.body.dataset.page !== "tactics") return;
    const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    if (mod && k === "z") { e.preventDefault(); (e.shiftKey ? pad.redo() : pad.undo()); renderSegs(); return; }
    if (mod && k === "d") { e.preventDefault(); pad.duplicateSelected(); return; }
    if (mod && k === "c" && !window.getSelection().toString()) { if (pad.copyToClip()) { e.preventDefault(); toast("복사했어요 · ⌘V로 붙여넣기"); } return; }
    if (mod && k === "v") { e.preventDefault(); pad.pasteClip(); return; }
    if (k === " ") { e.preventDefault(); $("#playBtn").click(); return; }
    if (k === "escape") { pad.escape(); return; }
    if ((k === "delete" || k === "backspace") && pad.hasSelection()) { e.preventDefault(); pad.deleteSelected(); }
  });

  /* ---------- community boards ---------- */
  // x: 골키퍼 기준 왼쪽 +, z: 우리 골라인에서의 거리(m)
  const P = (kind, x, z, rot, pose, label = "", extra = {}) => ({ kind, x, z, rot, pose, label, mirror: false, ...extra });
  const BALL = (x, z, h = 0) => ({ kind: "ball", x, z, h, rot: 0, label: "" });
  const CONE = (x, z) => ({ kind: "cone", x, z, rot: 0, label: "" });
  const EQ = (kind, x, z, rot = 0) => ({ kind, x, z, rot, label: "" });
  const SEQ = (o) => ({ mirror: false, ...o });
  const BOARD_SEED = [
    {
      id: "s0", title: "▶ 재생 예시 — 1:1 각도 좁히고 K-블록", author: "KEEPER LAB", category: "1:1 대응", likes: 40, createdAt: Date.parse("2026-10-02"),
      desc: "'3D 패드에서 열기' → ▶ 재생을 눌러보세요.\n같은 선수를 복사해 순서(1·2·3)를 매기면, 위치와 자세가 순서대로 이어져 움직여요.",
      state: { v: 2, range: "box", view: "tac", items: [
        SEQ({ id: "s0g1", pid: "s0g", kind: "gk", x: 0, z: 1.4, rot: 0.25, pose: "set", label: "GK", step: 1, op: 0.4 }),
        SEQ({ id: "s0g2", pid: "s0g", kind: "gk", x: 1.1, z: 4.3, rot: 0.3, pose: "set", label: "GK", step: 2, op: 0.4 }),
        SEQ({ id: "s0g3", pid: "s0g", kind: "gk", x: 1.7, z: 6.1, rot: 0.3, pose: "kblock", label: "GK", step: 3 }),
        SEQ({ id: "s0a1", pid: "s0a", kind: "opp", x: 4.2, z: 15.5, rot: -2.9, pose: "run", label: "9", step: 1, op: 0.4 }),
        SEQ({ id: "s0a2", pid: "s0a", kind: "opp", x: 3.3, z: 11, rot: -2.9, pose: "run", label: "9", step: 2, op: 0.4 }),
        SEQ({ id: "s0a3", pid: "s0a", kind: "opp", x: 3, z: 9, rot: -2.95, pose: "shoot", label: "9", step: 3 }),
        { id: "s0b1", pid: "s0b", kind: "ball", x: 3.8, z: 14.6, h: 0, rot: 0, label: "", step: 1, op: 0.4 },
        { id: "s0b2", pid: "s0b", kind: "ball", x: 3, z: 10.2, h: 0, rot: 0, label: "", step: 2, op: 0.4 },
        { id: "s0b3", pid: "s0b", kind: "ball", x: 2.5, z: 7.2, h: 0, rot: 0, label: "", step: 3 },
      ], lines: [
        { type: "run", pts: [[0, 1.4], [1.7, 6.1]], c: [1.1, 3.6] },
        { type: "run", pts: [[4.2, 15.5], [3, 9]] },
        { type: "pass", pts: [[3.8, 14.6], [2.5, 7.2]] },
      ] },
    },
    {
      id: "s1", title: "높이별 다이빙 비교 — 낮게 · 중간 · 높게", author: "KEEPER LAB", category: "훈련 드릴", likes: 31, createdAt: Date.parse("2026-09-28"),
      desc: "같은 방향 다이빙이라도 공 높이에 따라 몸의 각도와 손의 위치가 달라집니다.\n'슈터 정면' · '골라인 측면' 시점으로 돌려 보세요.",
      state: { v: 2, range: "goal", view: "front", items: [
        P("gk", -4.6, 1.2, 0, "dive_low", "낮"), P("gk", -0.6, 1.2, 0, "dive_mid", "중"), P("gk", 3.4, 1.2, 0, "dive_high", "높"),
        BALL(-2.6, 1.2, 0), BALL(1.4, 1.2, 0.9), BALL(4.9, 1.2, 2.2)], lines: [] },
    },
    {
      id: "s2", title: "1:1 — 전진하며 각도 좁히기", author: "KEEPER LAB", category: "1:1 대응", likes: 24, createdAt: Date.parse("2026-09-20"),
      desc: "침투하는 공격수의 터치가 길어지는 순간 전진. 볼–양 포스트를 잇는 삼각형 안에서 몸을 최대한 앞에 둡니다.\n점선 = 슈팅 가능 각도",
      state: { v: 2, range: "box", view: "tac", items: [
        P("opp", 3.2, 13.5, -2.91, "run", "9"), BALL(2.7, 12.6), P("own", 7.5, 17.5, -2.37, "run", "4"), P("gk", 1.0, 4.4, 0.2, "set", "GK")],
        lines: [{ type: "run", pts: [[0, 0.8], [0.9, 3.8]] }, { type: "pass", pts: [[2.7, 12.6], [-3.6, 0]] }, { type: "pass", pts: [[2.7, 12.6], [3.6, 0]] }, { type: "run", pts: [[7.5, 17.5], [4.5, 14.6]] }] },
    },
    {
      id: "s3", title: "측면 크로스 — 시작 위치와 공격 지점", author: "Coach J.", category: "크로스", likes: 17, createdAt: Date.parse("2026-09-14"),
      desc: "크로스 쪽 포스트 1~2m 앞에서 몸을 열고 시작. 궤적을 읽은 뒤 앞 포스트 공간으로 공격합니다.",
      state: { v: 2, range: "third", view: "behind", items: [
        P("opp", -27, 9, 1.68, "cross", "7"), BALL(-26.3, 9.4), P("own", -24.5, 11, -2.3, "jockey", "2"),
        P("opp", -2, 8, -2.03, "run", "9"), P("own", -1.2, 9.2, -1.55, "jockey", "5"),
        P("opp", 5, 10, -2.6, "run", "10"), P("own", 4.5, 11.4, -1.6, "jockey", "4"), P("opp", 9, 7, -1.9, "stand", "11"),
        P("gk", -1.8, 1.4, -1.26, "set", "GK")],
        lines: [{ type: "lob", pts: [[-26.3, 9.4], [-3, 5.5]] }, { type: "run", pts: [[-1.8, 1.4], [-2.9, 4.4]] }, { type: "run", pts: [[-2, 8], [-3.8, 6.4]] }] },
    },
    {
      id: "s4", title: "백패스 빌드업 — 압박 반대로 전환", author: "KEEPER LAB", category: "빌드업", likes: 12, createdAt: Date.parse("2026-09-02"),
      desc: "센터백 백패스 → 오픈 바디 첫 터치 → 압박이 오는 반대쪽 센터백/풀백으로 전환.",
      state: { v: 2, range: "half", view: "tac", items: [
        P("gk", 0.6, 4, -1.28, "kick", "GK"), BALL(-0.1, 4.3),
        P("own", -16, 9, 1.86, "stand", "3"), P("own", 16, 9, -1.88, "stand", "4"), P("own", -28, 26, 0, "run", "2"), P("own", 28, 26, 0, "run", "5"), P("own", 0, 20, Math.PI, "stand", "6"),
        P("opp", 5, 10, -2.49, "run", "9"), P("opp", -9, 16, -2.36, "run", "10"), P("opp", -2, 30, Math.PI, "stand", "8")],
        lines: [{ type: "pass", pts: [[-0.1, 4.3], [-15.5, 8.8]] }, { type: "pass", pts: [[-16, 9], [-27.5, 25]] }, { type: "run", pts: [[-28, 26], [-28, 36]] }, { type: "run", pts: [[5, 10], [1.8, 5.6]] }] },
    },
    {
      id: "s5", title: "리액션 다이빙 — 3콘 드릴", author: "Coach J.", category: "훈련 드릴", likes: 9, createdAt: Date.parse("2026-08-25"),
      desc: "중앙 콘에서 세트 → 코치 신호에 좌/우 콘 터치 → 즉시 반대 포스트 쪽 슈팅 다이빙.",
      state: { v: 2, range: "goal", view: "tac", items: [
        CONE(-2.5, 2.2), CONE(0, 3.2), CONE(2.5, 2.2), P("gk", 1.6, 1.3, 0, "dive_mid", "GK"),
        P("coach", 0, 11, Math.PI, "shoot", ""), BALL(0.4, 10.2), EQ("marker", 0, 2.7), EQ("pole", -3.2, 0.5), EQ("pole", 3.2, 0.5)],
        lines: [{ type: "pass", pts: [[0.4, 10.2], [3.2, 0.4]] }, { type: "run", pts: [[0, 2.7], [1.0, 1.7]] }] },
    },
  ];
  const boardStore = Store.collection("kl_boards_v2", BOARD_SEED);
  const boardImg = (s, w, h) => (T3 ? T3.boardImage(s, w, h) : "");

  /* share links — the board is encoded into the URL itself */
  const b64 = {
    enc: (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: (str) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))),
  };
  const shareUrl = (b) => location.href.split("#")[0] + "#b=" + b64.enc({ t: b.title, a: b.author, c: b.category, d: b.desc, s: b.state });

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("링크를 복사했어요 — 다른 코치에게 보내보세요"); }
    catch { window.prompt("아래 링크를 복사하세요", text); }
  }

  async function renderBoards() {
    const q = $("#boardSearch").value.trim().toLowerCase();
    const cat = $("#boardCat").value;
    const boards = (await boardStore.list()).filter((b) =>
      (cat === "all" || b.category === cat) &&
      (!q || (b.title + " " + b.author).toLowerCase().includes(q)));
    $("#boardGrid").innerHTML = boards.length ? boards.map((b) => `
      <button class="board-card" data-board="${b.id}">
        <img alt="" src="${boardImg(b.state, 560, 385)}" />
        <div class="bc-body">
          <span class="bc-cat">${esc(b.category)}</span>
          <h4 class="bc-title">${esc(b.title)}</h4>
          <div class="bc-foot"><span>${esc(b.author)}</span><span>♥ ${b.likes || 0}</span></div>
        </div>
      </button>`).join("") : `<div class="empty">조건에 맞는 보드가 없어요.</div>`;
  }
  $("#boardSearch").addEventListener("input", debounce(renderBoards, 150));
  $("#boardCat").addEventListener("change", renderBoards);

  function boardView(b, { shared = false } = {}) {
    const liked = b.id && Store.likes.has(b.id);
    const body = openModal(`
      <div class="board-view">
        <h3>${esc(b.title)}</h3>
        <div class="meta">${esc(b.category)} · ${esc(b.author)}${b.createdAt ? " · " + fmtDate(b.createdAt) : ""}${shared ? " · 공유받은 보드" : ""}</div>
        <img alt="${esc(b.title)} 전술 보드" src="${boardImg(b.state, 1040, 715)}" />
        ${b.desc ? `<p class="desc">${esc(b.desc)}</p>` : ""}
        <div class="form-actions" style="justify-content:flex-start">
          <button class="btn btn-solid btn-sm" data-act="open">3D 패드에서 열기</button>
          <button class="btn btn-ghost btn-sm" data-act="link">링크 복사</button>
          ${shared ? `<button class="btn btn-ghost btn-sm" data-act="keep">커뮤니티에 저장</button>` : `<button class="btn btn-ghost btn-sm" data-act="like" aria-pressed="${liked}">${liked ? "♥" : "♡"} ${b.likes || 0}</button>`}
          ${b.mine ? `<button class="btn btn-ghost btn-sm" data-act="delete" style="margin-left:auto">삭제</button>` : ""}
        </div>
      </div>`, { wide: true });

    $(".form-actions", body).addEventListener("click", async (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "open") {
        if (!needPad()) return;
        pad.load(b.state); renderSegs();
        closeModal();
        $("#tactics .pad").scrollIntoView({ behavior: "smooth", block: "center" });
        toast("패드로 불러왔어요. 수정 후 새로 저장할 수 있어요");
      } else if (act === "link") {
        copy(shareUrl(b));
      } else if (act === "like") {
        const on = Store.likes.toggle(b.id);
        const upd = await boardStore.update(b.id, { likes: Math.max(0, (b.likes || 0) + (on ? 1 : -1)) });
        Object.assign(b, upd);
        e.target.closest("[data-act]").textContent = `${on ? "♥" : "♡"} ${b.likes}`;
        renderBoards();
      } else if (act === "keep") {
        await boardStore.add({ title: b.title, author: b.author, category: b.category, desc: b.desc, state: b.state, likes: 0 });
        closeModal(); renderBoards(); toast("커뮤니티 보드에 저장했어요");
      } else if (act === "delete") {
        await boardStore.remove(b.id); closeModal(); renderBoards(); toast("보드를 삭제했어요");
      }
    });
  }

  $("#boardGrid").addEventListener("click", async (e) => {
    const c = e.target.closest("[data-board]"); if (!c) return;
    const b = await boardStore.get(c.dataset.board);
    if (b) boardView(b);
  });

  $("#saveBoardBtn").addEventListener("click", () => {
    if (!needPad()) return;
    if (pad.isEmpty()) return toast("먼저 보드에 선수나 선을 놓아주세요");
    const snap = pad.getState();
    const cats = ["1:1 대응", "포지셔닝", "크로스", "빌드업", "세트피스", "훈련 드릴"];
    const body = openModal(`
      <h3>보드 저장 &amp; 공유</h3><div class="meta">지금 보이는 시점 그대로 저장돼요 · 커뮤니티 보드에 올라가고 공유 링크가 만들어져요</div>
      <img class="board-preview" alt="저장할 보드 미리보기" src="${boardImg(snap, 1040, 715)}" />
      <form class="form" id="boardForm">
        <label>제목<input name="title" required maxlength="60" placeholder="예) 코너킥 — 니어 포스트 수비 배치" /></label>
        <div class="form-row">
          <label>코치 이름<input name="author" required maxlength="30" value="${esc(localStorage.getItem("kl_name") || "")}" placeholder="이름 또는 닉네임" /></label>
          <label>카테고리<select name="category">${cats.map((c) => `<option>${c}</option>`).join("")}</select></label>
        </div>
        <label>설명 (선택)<textarea name="desc" maxlength="1000" placeholder="상황, 코칭 포인트, 선수에게 강조할 점"></textarea></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">저장하고 링크 복사</button></div>
      </form>`, { wide: true });
    $("#boardForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try { localStorage.setItem("kl_name", f.author.trim()); } catch {}
      const saved = await boardStore.add({
        title: f.title.trim(), author: f.author.trim(), category: f.category, desc: f.desc.trim(), state: snap, likes: 0,
      });
      closeModal();
      $("#boardSearch").value = ""; $("#boardCat").value = "all";
      await renderBoards();
      copy(shareUrl(saved));
    });
  });

  /* open a shared board from the URL */
  function openFromHash() {
    const m = location.hash.match(/^#b=([\w-]+)/);
    if (!m) return;
    try {
      const d = b64.dec(m[1]);
      if (!d.s || !Array.isArray(d.s.items)) throw new Error("bad board");
      if (!d.s.v) return toast("이전 버전으로 만든 보드라 열 수 없어요");
      boardView({ title: d.t || "공유된 보드", author: d.a || "익명", category: d.c || "", desc: d.d || "", state: d.s }, { shared: true });
    } catch {
      toast("공유 링크를 읽을 수 없어요");
    }
  }

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ---------- init ---------- */
  renderShopList();
  renderResources();
  renderSegs();
  renderBoards();
  if (T3 && T3.ready) T3.ready.then(() => { renderSegs(); renderBoards(); }); // 선수 이미지를 불러온 뒤 썸네일 다시 그림
  renderLessonInfo();
  renderLessons();
  route();
})();
