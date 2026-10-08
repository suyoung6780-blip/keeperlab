/* =========================================================
   KEEPER LAB — Firebase 공용 연결 (트레이닝 피드백 · 아카이브 승인)
   필요한 페이지를 열 때만 Firebase를 불러와요.
   관리자 번호와 선수 비밀번호는 코드에 없어요 (Firebase 로그인 비밀번호로만 존재).
   ========================================================= */
(function () {
  const SDK = "https://www.gstatic.com/firebasejs/10.12.5/";
  const ADMIN_EMAIL = "admin@keeperlab.co.kr";
  let fb = null, loading = null;
  const listeners = new Set();

  const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const ready = () => !!(window.KL_FIREBASE && window.KL_FIREBASE.apiKey);

  function boot() {
    if (fb) return Promise.resolve(fb);
    if (loading) return loading;
    loading = (async () => {
      if (!window.firebase) {
        await loadScript(SDK + "firebase-app-compat.js");
        await Promise.all([loadScript(SDK + "firebase-auth-compat.js"), loadScript(SDK + "firebase-firestore-compat.js")]);
      }
      const app = firebase.initializeApp(window.KL_FIREBASE);
      const auth = app.auth();
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); // 브라우저 탭을 닫으면 로그아웃
      fb = { app, auth, db: app.firestore(), FV: firebase.firestore.FieldValue };
      await new Promise((r) => { const off = auth.onAuthStateChanged(() => { off(); r(); }); });
      auth.onAuthStateChanged(() => listeners.forEach((cb) => cb()));
      return fb;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }

  // 선수 계정을 만들거나 비밀번호를 바꿀 때 관리자 로그인이 풀리지 않도록 보조 연결을 따로 써요
  function helperAuth() {
    const name = "kl-helper";
    const app = firebase.apps.find((a) => a.name === name) || firebase.initializeApp(window.KL_FIREBASE, name);
    const a = app.auth();
    return a.setPersistence(firebase.auth.Auth.Persistence.NONE).then(() => a);
  }

  const isAdmin = () => !!(fb && fb.auth.currentUser && fb.auth.currentUser.email === ADMIN_EMAIL);

  function authError(e) {
    const c = (e && e.code) || "";
    if (/wrong-password|invalid-credential|invalid-login|user-not-found/.test(c)) return "번호가 맞지 않아요.";
    if (/too-many-requests/.test(c)) return "여러 번 틀려서 잠시 막혔어요. 몇 분 뒤에 다시 해주세요.";
    if (/network/.test(c)) return "인터넷 연결을 확인해 주세요.";
    return "문제가 생겼어요. 잠시 후 다시 해주세요.";
  }

  /* 관리자 로그인 창 (트레이닝 · 아카이브 어디서든 같은 창) */
  function adminLogin({ openModal, closeModal, toast }) {
    const body = openModal(`
      <h3>관리자</h3><div class="meta">관리자 번호를 입력해 주세요</div>
      <form class="form" id="klAdminForm">
        <label>관리자 번호<input name="code" type="password" inputmode="numeric" autocomplete="off" required /></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>취소</button><button class="btn btn-solid btn-sm">들어가기</button></div>
      </form>`);
    const f = body.querySelector("#klAdminForm");
    f.code.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = f.querySelector(".btn-solid"); btn.disabled = true;
      try {
        await boot();
        await fb.auth.signInWithEmailAndPassword(ADMIN_EMAIL, f.code.value.trim());
        closeModal(); toast("관리자 모드예요");
      } catch (err) { toast(authError(err)); btn.disabled = false; }
    });
  }

  window.KLFB = {
    ready, boot, helperAuth, isAdmin, authError, adminLogin,
    get fb() { return fb; },
    signOut: () => (fb ? fb.auth.signOut() : Promise.resolve()),
    onAuth: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
})();
