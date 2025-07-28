/* =========================================================
 * TRS Front (index.html) & Members (member.html)
 * Single JS bundle
 * ======================================================= */

/* ---------- Constants ---------- */
const MEMBER_PASS = 'TRS2025SUPRA';
const ADMIN_PASS  = '2JZ-GTE';
const COOKIE_MEMBER = 'trs_member';
const COOKIE_ADMIN  = 'trs_admin';
const COOKIE_OWNER  = 'trs_owner';
const LOGIN_HOURS   = 6; // 6 hours

const LS_POSTS = 'trs_posts';
const LS_BBS   = 'trs_bbs';
const LS_BBS_NO = 'trs_bbs_no';

/* ---------- Shortcuts ---------- */
const qs  = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => [...el.querySelectorAll(sel)];

/* ---------- Cookie helpers ---------- */
function setCookie(name, value, hours) {
  const d = new Date();
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
function getCookie(name) {
  const c = document.cookie.split(';').map(c => c.trim());
  for (const row of c) {
    if (row.startsWith(name + '=')) {
      return decodeURIComponent(row.split('=')[1]);
    }
  }
  return null;
}
function deleteCookie(name) {
  document.cookie = `${name}=;max-age=0;path=/;SameSite=Lax`;
}
function isMember() { return getCookie(COOKIE_MEMBER) === 'ok'; }
function isAdmin()  { return getCookie(COOKIE_ADMIN)  === 'ok'; }

/* ---------- LocalStorage helpers ---------- */
function loadPosts() {
  try { return JSON.parse(localStorage.getItem(LS_POSTS)) || []; }
  catch(_){ return []; }
}
function savePosts(arr) {
  localStorage.setItem(LS_POSTS, JSON.stringify(arr));
}
function loadBBS() {
  try { return JSON.parse(localStorage.getItem(LS_BBS)) || []; }
  catch(_){ return []; }
}
function saveBBS(arr) {
  localStorage.setItem(LS_BBS, JSON.stringify(arr));
}
function loadBBSNo() {
  return parseInt(localStorage.getItem(LS_BBS_NO) || '1', 10);
}
function saveBBSNo(no) {
  localStorage.setItem(LS_BBS_NO, String(no));
}

/* =========================================================
 * Entry
 * ======================================================= */
document.addEventListener('DOMContentLoaded', () => {
  bindHamburger();

  const isIndex   = !!qs('#latestList');
  const isMembers = !!qs('#loginPanel') || !!qs('#dashboard');

  // index
  if (isIndex) {
    renderIndex(); // sections
    bindBBSOnIndex();
  }
  // member
  if (isMembers) {
    bindMemberPage();
  }
});

/* =========================================================
 * Hamburger
 * ======================================================= */
function bindHamburger() {
  const btn = qs('#hamburger');
  const drawer = qs('#drawer');
  const close = qs('#drawerClose');
  if (!btn || !drawer) return;

  const closeDrawer = () => {
    btn.classList.remove('active');
    drawer.classList.remove('open');
  };

  btn.addEventListener('click', () => {
    const opened = drawer.classList.toggle('open');
    btn.classList.toggle('active', opened);
  });

  if (close) close.addEventListener('click', closeDrawer);

  // クリックで閉じる（内部以外）
  document.addEventListener('click', (e) => {
    if (!drawer.classList.contains('open')) return;
    const within = drawer.contains(e.target) || btn.contains(e.target);
    if (!within) closeDrawer();
  });

  // Esc で閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // ドロワー内リンク押下で閉じる
  qsa('.drawer-links a').forEach(a => {
    a.addEventListener('click', closeDrawer);
  });
}

/* =========================================================
 * INDEX PAGE
 * ======================================================= */
function renderIndex() {
  const posts = loadPosts();

  const fill = (type, containerSel, renderItem) => {
    const box = qs(containerSel);
    if (!box) return;
    const list = posts.filter(p => p.type === type).sort((a,b)=>b.createdAt - a.createdAt);
    if (!list.length) {
      box.classList.add('empty-msg');
      box.textContent = box.textContent || '未登録です。';
      return;
    }
    box.classList.remove('empty-msg');
    box.innerHTML = list.map(renderItem).join('');
  };

  const renderText = (p) => `
    <div class="post-item">
      <div class="post-meta">${p.date || ''}</div>
      <div class="post-title">${escapeHTML(p.title || '')}</div>
      ${p.body ? `<p>${escapeHTML(p.body).replace(/\n/g,'<br>')}</p>` : ''}
      ${p.img ? `<img src="${p.img}" alt="${escapeHTML(p.title || '')}" />` : ''}
    </div>
  `;

  fill('latest',   '#latestList',   renderText);
  fill('news',     '#newsList',     renderText);
  fill('schedule', '#scheduleList', renderText);
  fill('machine',  '#machineList',  renderText);
  fill('gallery',  '#galleryList',  (p) => `
    <figure>
      <img src="${p.img || ''}" alt="${escapeHTML(p.title || '')}">
      <figcaption>${escapeHTML(p.title || '')}</figcaption>
    </figure>
  `);
}

/* ---------- BBS on Index (削除ログ対応) ---------- */
function bindBBSOnIndex() {
  const lock   = qs('#bbsLock');
  const area   = qs('#bbsArea');
  const listEl = qs('#bbsList');
  const form   = qs('#bbsForm');
  const nameEl = qs('#bbsName');
  const bodyEl = qs('#bbsBody');

  if (!lock || !area) return;

  // 表示切替
  if (isMember()) {
    lock.classList.add('hidden');
    area.classList.remove('hidden');
    // ニックネーム復元
    const savedName = getCookie('trs_nick');
    if (savedName) nameEl.value = savedName;
  } else {
    lock.classList.remove('hidden');
    area.classList.add('hidden');
    return;
  }

  // 初回 owner cookie
  if (!getCookie(COOKIE_OWNER)) {
    setCookie(COOKIE_OWNER, cryptoRandom(24), LOGIN_HOURS);
  }

  // render
  const renderBbs = () => {
    const data = loadBBS();
    if (!data.length) {
      listEl.innerHTML = '';
      listEl.classList.add('empty-msg');
      listEl.textContent = 'まだ投稿がありません。';
      return;
    }
    listEl.classList.remove('empty-msg');
    listEl.innerHTML = data.map(item => {
      const who = escapeHTML(item.name || '名無し');
      const deleted = !!item.isDeleted;
      const title = deleted ? `No.${item.no} 削除ログ` : `No.${item.no}`;
      const txt = deleted ? '(削除ログ)' : linkReply(escapeHTML(item.body)).replace(/\n/g,'<br>');
      const canDelete = isAdmin() || getCookie(COOKIE_OWNER) === item.owner;
      return `
        <li data-id="${item.id}">
          <div class="bbs-meta">
            <span class="bbs-no">${title}</span>
            <span class="bbs-name">${who}</span>
            <time>${item.date || ''}</time>
          </div>
          <div class="bbs-body">${txt}</div>
          ${canDelete ? `<button class="bbs-del" data-id="${item.id}">削除</button>` : ''}
        </li>
      `;
    }).join('');
    // delete bind（削除ログ化）
    qsa('.bbs-del', listEl).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        let bbs = loadBBS();
        const idx = bbs.findIndex(x => x.id === id);
        if (idx === -1) return;
        bbs[idx].isDeleted = true;
        bbs[idx].body = '';
        bbs[idx].name = '削除者';
        saveBBS(bbs);
        renderBbs();
      });
    });

    // reply >>No. tap
    qsa('#bbsList li').forEach(li => {
      const noEl = qs('.bbs-no', li);
      if (noEl) {
        noEl.addEventListener('click', () => {
          const num = (noEl.textContent || '').replace(/[^0-9]/g,'');
          bodyEl.value = `${bodyEl.value}${bodyEl.value ? '\n' : ''}>>${num}\n`;
          bodyEl.focus();
        });
      }
    });
  };
  renderBbs();

  // submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = bodyEl.value.trim();
    if (!body) {
      alert('本文を入力してください');
      return;
    }
    const name = nameEl.value.trim() || '名無し';
    setCookie('trs_nick', name, 24 * 30); // 30日保持

    const owner = getCookie(COOKIE_OWNER);
    const id = cryptoRandom(16);
    let no = loadBBSNo();
    const now = new Date();
    const post = {
      id,
      no,
      name,
      body,
      owner,
      isDeleted: false,  // ← 追加（初期状態は未削除）
      date: `${now.getMonth()+1}/${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    };
    const list = loadBBS();
    list.push(post);
    saveBBS(list);
    saveBBSNo(no + 1);
    bodyEl.value = '';
    renderBbs();
  });
}

/* =========================================================
 * MEMBER PAGE
 * ======================================================= */
function bindMemberPage() {
  const loginPanel = qs('#loginPanel');
  const dashboard  = qs('#dashboard');

  if (!loginPanel || !dashboard) return;

  const memberBtn    = qs('#memberLoginBtn');
  const memberPassEl = qs('#memberPass');
  const logoutBtn    = qs('#logoutBtn');
  const adminBtn     = qs('#adminLoginBtn');
  const adminPassEl  = qs('#adminPass');
  const resetBbsBlock= qs('#resetBbsBlock');
  const resetBbsBtn  = qs('#resetBbsBtn');

  // 既にメンバーなら
  if (isMember()) {
    loginPanel.classList.add('hidden');
    dashboard.classList.remove('hidden');
  }

  // メンバーログイン
  memberBtn?.addEventListener('click', () => {
    if (memberPassEl.value === MEMBER_PASS) {
      setCookie(COOKIE_MEMBER, 'ok', LOGIN_HOURS);
      loginPanel.classList.add('hidden');
      dashboard.classList.remove('hidden');
    } else {
      shake(memberPassEl);
      alert('パスワードが違います');
    }
  });

  // ログアウト
  logoutBtn?.addEventListener('click', () => {
    deleteCookie(COOKIE_MEMBER);
    deleteCookie(COOKIE_ADMIN);
    location.reload();
  });

  // 管理者ログイン
  if (adminBtn) {
    if (isAdmin()) resetBbsBlock.classList.remove('hidden');

    adminBtn.addEventListener('click', () => {
      if (!isMember()) return alert('まずメンバーでログインしてください');
      if (adminPassEl.value === ADMIN_PASS) {
        setCookie(COOKIE_ADMIN, 'ok', LOGIN_HOURS);
        resetBbsBlock.classList.remove('hidden');
        alert('管理者ログイン成功！トップページ掲示板の全削除が可能になります。');
      } else {
        shake(adminPassEl);
        alert('管理者パスワードが違います');
      }
    });
  }

  // 掲示板全リセット
  resetBbsBtn?.addEventListener('click', () => {
    if (!isAdmin()) return;
    if (!confirm('掲示板を全リセットします。よろしいですか？')) return;
    localStorage.removeItem(LS_BBS);
    localStorage.removeItem(LS_BBS_NO);
    alert('掲示板を全リセットしました。');
  });

  // 投稿フォーム + 一覧
  bindPostForm();
  renderAdminPosts();

  // タブ切り替え
  bindTabs();
}

function bindTabs() {
  const btns = qsa('.tab-btn');
  const contents = qsa('.tab-content');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      btns.forEach(b => b.classList.toggle('active', b === btn));
      contents.forEach(c => c.classList.toggle('hidden', c.id !== target));
    });
  });
}

/* ---------- Post CRUD ---------- */
function bindPostForm() {
  const form      = qs('#postForm');
  if (!form) return;

  const typeEl    = qs('#postType');
  const titleEl   = qs('#postTitle');
  const bodyEl    = qs('#postBody');
  const dateEl    = qs('#postDate');
  const imgEl     = qs('#postImage');
  const editIdEl  = qs('#editId');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type  = typeEl.value;
    const title = titleEl.value.trim();
    const body  = bodyEl.value.trim();
    const date  = dateEl.value.trim();

    // 現在日時
    let displayDate = date;
    if (!displayDate) {
      const now = new Date();
      displayDate = `${now.getMonth()+1}/${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    let imgData = null;
    if (imgEl.files && imgEl.files[0]) {
      imgData = await toBase64(imgEl.files[0]);
    }

    let posts = loadPosts();

    if (editIdEl.value) {
      // update
      const id = editIdEl.value;
      const idx = posts.findIndex(p => p.id === id);
      if (idx !== -1) {
        posts[idx] = {
          ...posts[idx],
          type, title, body, date: displayDate,
          img: imgData ?? posts[idx].img,
          updatedAt: Date.now()
        };
      }
      editIdEl.value = '';
      alert('更新しました');
    } else {
      // create
      const id = cryptoRandom(16);
      posts.push({
        id, type, title, body,
        date: displayDate,
        img: imgData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      alert('投稿しました');
    }
    savePosts(posts);

    // reset form
    form.reset();
    renderAdminPosts();
  });

  // フィルタ変更で再描画
  const filter = qs('#filterType');
  if (filter) filter.addEventListener('change', renderAdminPosts);
}

function renderAdminPosts() {
  const listBox = qs('#adminPostList');
  if (!listBox) return;
  const filter  = qs('#filterType');
  const posts = loadPosts().sort((a,b)=>b.createdAt - a.createdAt);
  const type = filter?.value ?? 'all';
  const filtered = type === 'all' ? posts : posts.filter(p => p.type === type);

  if (!filtered.length) {
    listBox.classList.add('empty-msg');
    listBox.textContent = '投稿はありません。';
    return;
  }

  listBox.classList.remove('empty-msg');
  listBox.innerHTML = filtered.map(p => `
    <div class="post-item" data-id="${p.id}">
      <div class="post-meta">${escapeHTML(p.type)} | ${p.date || ''}</div>
      <div class="post-title">${escapeHTML(p.title || '')}</div>
      ${p.body ? `<p>${escapeHTML(p.body).replace(/\n/g,'<br>')}</p>` : ''}
      ${p.img ? `<img src="${p.img}" alt="">` : ''}
      <div class="post-actions">
        <button class="btn ghost btn-edit">編集</button>
        <button class="btn danger btn-del">削除</button>
      </div>
    </div>
  `).join('');

  // bind edit / delete
  const editButtons = qsa('.btn-edit', listBox);
  const delButtons  = qsa('.btn-del', listBox);
  const editIdEl  = qs('#editId');
  const typeEl    = qs('#postType');
  const titleEl   = qs('#postTitle');
  const bodyEl    = qs('#postBody');
  const dateEl    = qs('#postDate');

  editButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.post-item').dataset.id;
      const posts = loadPosts();
      const p = posts.find(x => x.id === id);
      if (!p) return;
      // set form values
      editIdEl.value = p.id;
      typeEl.value   = p.type;
      titleEl.value  = p.title || '';
      bodyEl.value   = p.body  || '';
      dateEl.value   = p.date  || '';
      // タブをフォームに切り替え
      const tabBtn = qs('.tab-btn[data-tab="formTab"]');
      tabBtn?.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  delButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.post-item').dataset.id;
      let posts = loadPosts();
      posts = posts.filter(x => x.id !== id);
      savePosts(posts);
      renderAdminPosts();
    });
  });
}

/* =========================================================
 * Utils
 * ======================================================= */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
function cryptoRandom(len=16) {
  const arr = new Uint8Array(len);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  return Array.from(arr, b => ('0' + b.toString(16)).slice(-2)).join('');
}
function shake(el) {
  if (!el) return;
  el.style.animation = 'shake .35s';
  el.addEventListener('animationend', () => el.style.animation = '', { once: true });
}
function escapeHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function linkReply(str) {
  // >>数字 を強調
  return str.replace(/&gt;&gt;(\d+)/g, '<span style="color:#4dabff;">&gt;&gt;$1</span>');
}

/* simple css animation for shake */
const styleShake = document.createElement('style');
styleShake.textContent = `
@keyframes shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-3px); }
  100% { transform: translateX(0); }
}`;
document.head.appendChild(styleShake);