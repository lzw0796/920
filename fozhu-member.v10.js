(function () {
  'use strict';

  const $ = (selector, parent) => (parent || document).querySelector(selector);
  const $$ = (selector, parent) => Array.from((parent || document).querySelectorAll(selector));

  let memberBootstrapped = false;

  function normalizeBool(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function getMemberConfig() {
    const cfg = window.fozhuMember || {};
    return {
      ajaxurl: cfg.ajaxurl || '/wp-admin/admin-ajax.php',
      nonce: cfg.nonce || '',
      isLoggedIn: normalizeBool(cfg.isLoggedIn),
      memberUrl: cfg.memberUrl || '/member',
      favoritesUrl: cfg.favoritesUrl || '/my-favorites',
      ordersUrl: cfg.ordersUrl || '/my-orders',
      loginUrl: cfg.loginUrl || '/member',
      logoutUrl: cfg.logoutUrl || '/member',
      currentUserId: parseInt(cfg.currentUserId || 0, 10) || 0
    };
  }

  function setMemberConfig(patch) {
    window.fozhuMember = Object.assign({}, window.fozhuMember || {}, patch || {});
  }

  function updateRuntimeLoginState(loggedIn, userId) {
    setMemberConfig({
      isLoggedIn: loggedIn ? 1 : 0,
      currentUserId: loggedIn ? (parseInt(userId || 0, 10) || 0) : 0
    });
    syncMemberUI();
  }

  function setLoading(el, loading) {
    if (!el) return;
    el.classList.toggle('is-loading', !!loading);
    if ('disabled' in el) el.disabled = !!loading;
    el.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m];
    });
  }

  function openModal(tabName) {
    const modal = $('#fozhu-member-modal');
    if (!modal) return;
    modal.hidden = false;
    document.documentElement.classList.add('fozhu-modal-open');
    if (tabName) switchTab(tabName);
  }

  function closeModal() {
    const modal = $('#fozhu-member-modal');
    if (!modal) return;
    modal.hidden = true;
    document.documentElement.classList.remove('fozhu-modal-open');
  }

  function switchTab(tabName) {
    $$('.fozhu-member-tabs button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabName);
    });

    $$('.fozhu-member-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panel === tabName);
    });
  }

  function showRegisterMessage(message, ok) {
    const box = $('#fozhu-register-msg');
    if (!box) return;
    const color = ok ? '#16a34a' : '#d63638';
    box.innerHTML = message ? '<span style="color:' + color + ';">' + escapeHtml(message) + '</span>' : '';
  }

  function getAjaxErrorMessage(res, fallback) {
    let msg = fallback || '操作失败';

    if (res && typeof res === 'object' && 'data' in res) {
      if (typeof res.data === 'string' && res.data) {
        msg = res.data;
      } else if (res.data && typeof res.data.message === 'string' && res.data.message) {
        msg = res.data.message;
      } else if (res.data && typeof res.data === 'object') {
        try {
          msg = JSON.stringify(res.data);
        } catch (e) {}
      }
    }

    return msg;
  }

  async function parseAjaxResponse(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(text || '返回内容不是合法 JSON');
    }
  }

  async function postAjax(formData) {
    const cfg = getMemberConfig();

    const res = await fetch(cfg.ajaxurl, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
      cache: 'no-store'
    });

    return parseAjaxResponse(res);
  }

  function syncMemberUI() {
    const cfg = getMemberConfig();

    $$('.js-member-entry').forEach((el) => {
      el.classList.toggle('is-logged-in', cfg.isLoggedIn);
      el.classList.toggle('is-guest', !cfg.isLoggedIn);
    });

    $$('.fozhu-fav-btn').forEach((btn) => {
      btn.setAttribute('data-login-state', cfg.isLoggedIn ? '1' : '0');
    });
  }

  async function fetchRealMemberStatus() {
    const cfg = getMemberConfig();

    try {
      const formData = new FormData();
      formData.append('action', 'fozhu_member_status');
      formData.append('nonce', cfg.nonce);

      const res = await postAjax(formData);

      if (res.success && res.data) {
        updateRuntimeLoginState(!!res.data.logged_in, res.data.user_id || 0);
        return {
          loggedIn: !!res.data.logged_in,
          userId: parseInt(res.data.user_id || 0, 10) || 0
        };
      }
    } catch (e) {}

    return {
      loggedIn: cfg.isLoggedIn,
      userId: cfg.currentUserId || 0
    };
  }

  async function initFavoriteButtons(force) {
    const cfg = getMemberConfig();
    if (!cfg.isLoggedIn) return;

    const buttons = $$('.fozhu-fav-btn[data-post-id]');
    if (!buttons.length) return;

    try {
      const ids = buttons
        .map((btn) => parseInt(btn.dataset.postId || '0', 10))
        .filter((id) => id > 0);

      if (!ids.length) return;

      const formData = new FormData();
      formData.append('action', 'fozhu_member_favorites_state');
      formData.append('nonce', cfg.nonce);
      formData.append('post_ids', ids.join(','));

      const res = await postAjax(formData);
      if (!res.success || !res.data || !res.data.states) return;

      buttons.forEach((btn) => {
        const postId = String(parseInt(btn.dataset.postId || '0', 10));
        const favorited = !!res.data.states[postId];
        btn.classList.toggle('is-favorited', favorited);

        const textNode = $('.fozhu-fav-text', btn) || $('.fav-text', btn);
        if (textNode) {
          textNode.textContent = favorited ? '已收藏' : '收藏';
        }
      });

      if (force) {
        memberBootstrapped = true;
      }
    } catch (e) {}
  }

  function resetFavoriteButtonsForGuest() {
    $$('.fozhu-fav-btn').forEach((btn) => {
      btn.classList.remove('is-favorited');
      const textNode = $('.fozhu-fav-text', btn) || $('.fav-text', btn);
      if (textNode) {
        textNode.textContent = '收藏';
      }
    });
  }

  async function bootstrapRealMemberState() {
    const status = await fetchRealMemberStatus();

    if (status.loggedIn) {
      await initFavoriteButtons(true);
    } else {
      resetFavoriteButtonsForGuest();
      memberBootstrapped = true;
    }
  }

  function appendTimestamp(url) {
    const sep = url.indexOf('?') > -1 ? '&' : '?';
    return url + sep + 't=' + Date.now();
  }

  function bindLoginForm() {
    const modal = $('#fozhu-member-modal');
    if (!modal) return;

    const loginPanel = $('.fozhu-member-panel[data-panel="login"]', modal);
    if (!loginPanel) return;

    const loginForm = $('form', loginPanel);
    if (!loginForm) return;

    function setRedirect() {
      let redirectField = loginForm.querySelector('input[name="redirect_to"]');
      if (!redirectField) {
        redirectField = document.createElement('input');
        redirectField.type = 'hidden';
        redirectField.name = 'redirect_to';
        loginForm.appendChild(redirectField);
      }

      redirectField.value = appendTimestamp('/member/');
    }

    setRedirect();
    loginForm.addEventListener('submit', setRedirect);
  }

  function bindRegisterForm() {
    const submitBtn = $('#fozhu-register-submit');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();

      const cfg = getMemberConfig();

      if (cfg.isLoggedIn) {
        showRegisterMessage('您已经登录，无需重复注册', false);
        switchTab('login');
        return;
      }

      if (submitBtn.classList.contains('is-loading')) return;

      const username = (($('#fozhu-reg-username') || {}).value || '').trim();
      const email = (($('#fozhu-reg-email') || {}).value || '').trim();
      const password = (($('#fozhu-reg-password') || {}).value || '');

      showRegisterMessage('', false);

      if (!username || !email || !password) {
        showRegisterMessage('请填写完整信息', false);
        return;
      }

      if (username.length < 3) {
        showRegisterMessage('用户名至少 3 位', false);
        return;
      }

      if (password.length < 6) {
        showRegisterMessage('密码至少 6 位', false);
        return;
      }

      setLoading(submitBtn, true);

      try {
        const formData = new FormData();
        formData.append('action', 'fozhu_register');
        formData.append('nonce', cfg.nonce);
        formData.append('username', username);
        formData.append('email', email);
        formData.append('password', password);

        const res = await postAjax(formData);

        if (res.success) {
          showRegisterMessage((res.data && res.data.message) || '注册成功，正在跳转...', true);
          updateRuntimeLoginState(true, res.data && res.data.user_id ? res.data.user_id : 0);

          const url = (res.data && res.data.redirect) ? res.data.redirect : cfg.memberUrl;
          window.location.href = appendTimestamp(url);
          return;
        }

        showRegisterMessage(getAjaxErrorMessage(res, '注册失败'), false);
      } catch (err) {
        showRegisterMessage('注册失败：' + (err.message || '接口异常'), false);
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  async function handleLike(button) {
    const cfg = getMemberConfig();
    if (!button || button.classList.contains('is-loading')) return;

    const postId = button.dataset.postId;
    if (!postId) return;
    if (button.classList.contains('is-liked')) return;

    setLoading(button, true);

    try {
      const formData = new FormData();
      formData.append('action', 'fozhu_like_post');
      formData.append('nonce', cfg.nonce);
      formData.append('post_id', postId);

      const res = await postAjax(formData);

      if (res.success && res.data) {
        button.classList.add('is-liked');
        const countNode = $('.fozhu-like-count', button) || $('.like-count', button);
        if (countNode) {
          countNode.textContent = String(res.data.count || 0);
        }
        return;
      }

      alert(getAjaxErrorMessage(res, '操作失败'));
    } catch (err) {
      alert('网络异常，请稍后再试');
    } finally {
      setLoading(button, false);
    }
  }

  async function handleFavorite(button) {
    const cfg = getMemberConfig();
    if (!button || button.classList.contains('is-loading')) return;

    if (!cfg.isLoggedIn) {
      openModal('login');
      return;
    }

    const postId = button.dataset.postId;
    if (!postId) return;

    setLoading(button, true);

    try {
      const formData = new FormData();
      formData.append('action', 'fozhu_toggle_favorite');
      formData.append('nonce', cfg.nonce);
      formData.append('post_id', postId);

      const res = await postAjax(formData);

      if (res.success && res.data) {
        const favorited = !!res.data.favorited;
        button.classList.toggle('is-favorited', favorited);

        const textNode = $('.fozhu-fav-text', button) || $('.fav-text', button);
        if (textNode) {
          textNode.textContent = favorited ? '已收藏' : '收藏';
        }

        const countNode = $('.fozhu-fav-count', button) || $('.fav-count', button);
        if (countNode && typeof res.data.count !== 'undefined') {
          countNode.textContent = String(res.data.count || 0);
        }
        return;
      }

      if (res.data && res.data.need_login) {
        updateRuntimeLoginState(false, 0);
        resetFavoriteButtonsForGuest();
        openModal('login');
        return;
      }

      alert(getAjaxErrorMessage(res, '操作失败'));
    } catch (err) {
      alert('网络异常，请稍后再试');
    } finally {
      setLoading(button, false);
    }
  }

  function bindGlobalEvents() {
    document.addEventListener('click', function (e) {
      const memberEntry = e.target.closest('.js-member-entry, a[href="/member"], a[href$="/member/"]');
      if (memberEntry) {
        const cfg = getMemberConfig();
        if (!cfg.isLoggedIn) {
          e.preventDefault();
          e.stopPropagation();
          openModal('login');
        }
        return;
      }

      const loginOpenBtn = e.target.closest('.js-open-login');
      if (loginOpenBtn) {
        e.preventDefault();
        e.stopPropagation();
        openModal('login');
        return;
      }

      const registerOpenBtn = e.target.closest('.js-open-register');
      if (registerOpenBtn) {
        e.preventDefault();
        e.stopPropagation();
        openModal('register');
        return;
      }

      const tabBtn = e.target.closest('.fozhu-member-tabs button');
      if (tabBtn) {
        e.preventDefault();
        e.stopPropagation();
        switchTab(tabBtn.dataset.tab);
        return;
      }

      const closeBtn = e.target.closest('[data-close="1"]');
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
        return;
      }

      const likeBtn = e.target.closest('.fozhu-like-btn');
      if (likeBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleLike(likeBtn);
        return;
      }

      const favBtn = e.target.closest('.fozhu-fav-btn');
      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleFavorite(favBtn);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindLoginForm();
    bindRegisterForm();
    bindGlobalEvents();
    syncMemberUI();
    bootstrapRealMemberState();
  });
})();