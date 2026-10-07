/* =========================================================
   Store — 데이터 저장 어댑터
   지금은 브라우저 localStorage에 저장합니다 (같은 브라우저에서만 보임).
   코치들끼리 실제로 서로의 보드를 보려면 이 파일의 메서드만
   Supabase / Firebase 같은 백엔드 호출로 바꾸면 됩니다.
   (모든 메서드가 Promise를 반환하므로 나머지 코드는 그대로 동작)
   ========================================================= */
(function () {
  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function collection(key, seed) {
    const all = () => {
      const saved = read(key, null);
      if (saved) {
        // 새로 추가된 기본 예시는 기존 목록 앞에 붙여줌
        const missing = seed.filter((x) => !saved.some((y) => y.id === x.id));
        // 기본 예시 내용이 바뀌었으면 최신 내용으로 갱신 (좋아요 수는 유지)
        let changed = false;
        const fresh = saved.map((y) => {
          const x = seed.find((s) => s.id === y.id);
          if (!x) return y;
          const next = { ...x, likes: y.likes ?? x.likes };
          if (JSON.stringify(next) !== JSON.stringify(y)) changed = true;
          return next;
        });
        if (missing.length || changed) { const merged = [...missing, ...fresh]; write(key, merged); return merged; }
        return saved;
      }
      write(key, seed);
      return seed.slice();
    };
    return {
      async list() { return all(); },
      async get(id) { return all().find((x) => x.id === id) || null; },
      async add(item) {
        const doc = { ...item, id: uid(), createdAt: Date.now(), mine: true };
        write(key, [doc, ...all()]);
        return doc;
      },
      async update(id, patch) {
        const items = all().map((x) => (x.id === id ? { ...x, ...patch } : x));
        write(key, items);
        return items.find((x) => x.id === id);
      },
      async remove(id) { write(key, all().filter((x) => x.id !== id)); },
    };
  }

  window.Store = {
    collection,
    cart: {
      get: () => read("kl_cart", {}),
      set: (cart) => write("kl_cart", cart),
    },
    likes: {
      has: (id) => read("kl_likes", []).includes(id),
      toggle(id) {
        const l = read("kl_likes", []);
        const on = !l.includes(id);
        write("kl_likes", on ? [...l, id] : l.filter((x) => x !== id));
        return on;
      },
    },
  };
})();
