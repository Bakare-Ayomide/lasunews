/**
 * LASU Campus Broadcast - Admin Dashboard Vanilla JavaScript
 */
(function () {
  const root = document.getElementById('adminApp');
  if (!root) return;

  const basePath = root.getAttribute('data-base-path') || '';
  const csrfToken = root.getAttribute('data-csrf') || '';
  const currentAdminId = Number(root.getAttribute('data-admin-id') || '0');
  const currentAdminRole = root.getAttribute('data-admin-role') || 'editor';

  function urlFor(path) {
    return basePath + path;
  }

  function mediaUrl(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//i.test(path) || path.indexOf('data:') === 0) return path;
    if (basePath && path.indexOf(basePath + '/') === 0) return path;
    return urlFor(path);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const method = (options.method || 'GET').toUpperCase();
    if (!(options.body instanceof FormData) && method !== 'GET' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const res = await fetch(urlFor(path), Object.assign({}, options, { headers, credentials: 'same-origin' }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Request failed (' + res.status + ')');
    }
    return data;
  }

  const feedbackEl = document.getElementById('adminFeedback');
  function notify(type, text) {
    if (!feedbackEl) return;
    feedbackEl.className = 'alert ' + (type === 'success' ? 'alert-success' : 'alert-error');
    feedbackEl.textContent = text;
    feedbackEl.hidden = false;
    setTimeout(function () {
      if (feedbackEl.textContent === text) feedbackEl.hidden = true;
    }, 5000);
  }

  // Mobile sidebar toggle
  const sidebar = document.getElementById('adminSidebar');
  const openSidebarBtn = document.getElementById('openSidebarBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  if (openSidebarBtn && sidebar) {
    openSidebarBtn.addEventListener('click', () => sidebar.classList.add('is-open'));
  }
  if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('is-open'));
  }

  // State
  let categoriesCache = [];
  let articlesCache = [];
  let adsCache = [];
  let analyticsCache = null;
  let sourcesDataCache = null;
  let usersCache = [];

  // Tab switching
  const tabBtns = document.querySelectorAll('[data-tab-target]');
  const tabPanels = document.querySelectorAll('[data-tab-panel]');
  const breadcrumbTitle = document.getElementById('breadcrumbTabTitle');

  function switchTab(target) {
    tabBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-tab-target') === target));
    tabPanels.forEach((p) => {
      if (p.getAttribute('data-tab-panel') === target) {
        p.removeAttribute('hidden');
      } else {
        p.setAttribute('hidden', '');
      }
    });
    const activeBtn = document.querySelector('[data-tab-target="' + target + '"]');
    if (breadcrumbTitle && activeBtn) {
      breadcrumbTitle.textContent = activeBtn.childNodes[0].textContent.trim();
    }
    if (sidebar) sidebar.classList.remove('is-open');

    if (target === 'overview') loadOverview();
    if (target === 'articles') loadArticles();
    if (target === 'analytics') loadAnalytics();
    if (target === 'sources' && !sourcesDataCache) loadSources();
    if (target === 'categories') loadCategories();
    if (target === 'comments') loadComments();
    if (target === 'ads') loadAds();
    if (target === 'users') loadUsers();
    if (target === 'admins') loadAdmins();
    if (target === 'activity') loadOverview();
    if (target === 'messages') loadMessages();
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab-target')));
  });

  // Load Overview
  async function loadOverview() {
    try {
      const data = await api('/api/admin_overview.php');
      const s = data.stats;
      document.getElementById('statPublished').textContent = s.published_articles;
      document.getElementById('statDrafts').textContent = s.draft_articles;
      document.getElementById('statBreaking').textContent = s.breaking_articles;
      document.getElementById('statPendingComments').textContent = s.pending_comments;
      document.getElementById('statActiveAds').textContent = s.active_ads;
      document.getElementById('statUsers').textContent = s.total_users;
      document.getElementById('statViews').textContent = Number(s.total_views).toLocaleString();

      const unreadBadge = document.getElementById('unreadMessagesCount');
      if (unreadBadge) unreadBadge.textContent = s.unread_messages > 0 ? String(s.unread_messages) : '';

      const pendingBadge = document.getElementById('pendingCommentsCount');
      if (pendingBadge) pendingBadge.textContent = s.pending_comments > 0 ? String(s.pending_comments) : '';

      const recentArtBody = document.getElementById('overviewArticlesBody');
      if (recentArtBody) {
        if (!data.recentArticles.length) {
          recentArtBody.innerHTML = '<tr><td colspan="4" style="padding:1.5rem;text-align:center;color:var(--lasu-muted);">No articles in database yet.</td></tr>';
        } else {
          recentArtBody.innerHTML = data.recentArticles.map((art) => (
            '<tr>' +
            '<td><strong>' + escapeHtml(art.title) + '</strong></td>' +
            '<td>' + escapeHtml(art.category_name) + '</td>' +
            '<td><span class="' + (art.status === 'published' ? 'status-published' : 'status-draft') + '">' + escapeHtml(art.status) + '</span></td>' +
            '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(art.views) + '</td>' +
            '</tr>'
          )).join('');
        }
      }

      const recentActList = document.getElementById('overviewActivityList');
      const fullActivityBody = document.getElementById('fullActivityBody');
      if (recentActList) {
        recentActList.innerHTML = data.recentActivity.length
          ? data.recentActivity.slice(0, 7).map((l) => (
              '<div style="padding:0.7rem 0;border-bottom:1px solid #F1EFEA;font-size:0.8rem;">' +
              '<div><strong>' + escapeHtml(l.details) + '</strong></div>' +
              '<div class="font-mono" style="font-size:0.72rem;color:var(--lasu-muted);">' + escapeHtml(l.admin_name) + ' &middot; ' + escapeHtml(l.created_at) + '</div>' +
              '</div>'
            )).join('')
          : '<p style="font-size:0.8rem;color:var(--lasu-muted);">No activity recorded yet.</p>';
      }
      if (fullActivityBody) {
        fullActivityBody.innerHTML = data.recentActivity.length
          ? data.recentActivity.map((l) => (
              '<tr>' +
              '<td class="font-mono tabular-nums">' + escapeHtml(l.created_at) + '</td>' +
              '<td>' + escapeHtml(l.admin_name) + '</td>' +
              '<td class="font-mono">' + escapeHtml(l.action) + '</td>' +
              '<td>' + escapeHtml(l.details) + '</td>' +
              '</tr>'
            )).join('')
          : '<tr><td colspan="4" style="padding:1.5rem;text-align:center;">No activity logs recorded yet.</td></tr>';
      }
    } catch (err) {
      notify('error', err.message);
    }
  }

  // Categories
  const catColorInput = document.getElementById('catColor');
  const catColorLabel = document.getElementById('catColorLabel');
  if (catColorInput && catColorLabel) {
    catColorInput.addEventListener('input', () => {
      catColorLabel.textContent = catColorInput.value.toUpperCase();
    });
  }

  async function loadCategories() {
    const reloadBtn = document.getElementById('reloadArtCatsBtn');
    try {
      const data = await api('/api/admin_categories.php');
      categoriesCache = data.categories || [];
    } catch (err) {
      try {
        const pub = await api('/api/public_news.php?limit=1&include_categories=1');
        categoriesCache = pub.categories || [];
      } catch {
        notify('error', err.message);
      }
    }

    if (reloadBtn) reloadBtn.hidden = categoriesCache.length > 0;

    const filterCat = document.getElementById('filterArticleCategory');
    const analyticsCat = document.getElementById('analyticsCategoryFilter');
    const formCat = document.getElementById('artCategoryId');
    if (filterCat) {
      const prev = filterCat.value;
      filterCat.innerHTML = '<option value="all">All Categories</option>' +
        categoriesCache.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('');
      filterCat.value = prev || 'all';
    }
    if (analyticsCat) {
      const prevA = analyticsCat.value;
      analyticsCat.innerHTML = '<option value="all">All Desks</option>' +
        categoriesCache.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('');
      analyticsCat.value = prevA || 'all';
    }
    if (formCat) {
      const prevForm = formCat.value;
      formCat.innerHTML = categoriesCache.length
        ? categoriesCache.map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('')
        : '<option value="">No categories available</option>';
      if (prevForm && categoriesCache.some((c) => String(c.id) === String(prevForm))) {
        formCat.value = prevForm;
      } else if (categoriesCache.length) {
        formCat.value = String(categoriesCache[0].id);
      }
    }

    const tbody = document.getElementById('categoriesTableBody');
    if (tbody) {
      tbody.innerHTML = categoriesCache.map((c) => (
        '<tr>' +
        '<td>' +
        '  <div style="display:flex;align-items:center;gap:0.5rem;">' +
        '    <span style="width:12px;height:12px;display:inline-block;background:' + escapeHtml(c.color_hex || '#0B2545') + ';flex-shrink:0;"></span>' +
        '    <strong>' + escapeHtml(c.name) + '</strong>' +
        '  </div>' +
        '  <div style="font-size:0.75rem;color:var(--lasu-muted);">' + escapeHtml(c.description) + '</div>' +
        '</td>' +
        '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(c.article_count || 0) + '</td>' +
        '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(c.published_count || 0) + '</td>' +
        '<td style="text-align:right;white-space:nowrap;">' +
        '  <button type="button" class="btn btn-outline" data-edit-cat="' + c.id + '">Edit</button> ' +
        '  <button type="button" class="btn btn-danger" data-del-cat="' + c.id + '">Delete</button>' +
        '</td>' +
        '</tr>'
      )).join('');

      tbody.querySelectorAll('[data-edit-cat]').forEach((b) => {
        b.addEventListener('click', () => {
          const cat = categoriesCache.find((x) => String(x.id) === b.getAttribute('data-edit-cat'));
          if (!cat) return;
          document.getElementById('catEditId').value = cat.id;
          document.getElementById('catName').value = cat.name;
          document.getElementById('catDescription').value = cat.description || '';
          const hex = cat.color_hex || '#0B2545';
          if (catColorInput) catColorInput.value = hex;
          if (catColorLabel) catColorLabel.textContent = hex;
          document.getElementById('catSubmitBtn').textContent = 'Update Category';
          document.getElementById('catCancelBtn').hidden = false;
        });
      });
      tbody.querySelectorAll('[data-del-cat]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_categories.php?id=' + b.getAttribute('data-del-cat'), { method: 'DELETE' });
            notify('success', 'Category deleted.');
            loadCategories();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });
    }
  }

  const categoryForm = document.getElementById('categoryForm');
  if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('catEditId').value;
      const payload = {
        id: id ? Number(id) : undefined,
        name: document.getElementById('catName').value.trim(),
        description: document.getElementById('catDescription').value.trim(),
        color_hex: catColorInput ? catColorInput.value : '#0B2545',
      };
      try {
        await api('/api/admin_categories.php', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        notify('success', id ? 'Category updated.' : 'Category created.');
        categoryForm.reset();
        document.getElementById('catEditId').value = '';
        if (catColorInput) catColorInput.value = '#0B2545';
        if (catColorLabel) catColorLabel.textContent = '#0B2545';
        document.getElementById('catSubmitBtn').textContent = 'Create Category';
        document.getElementById('catCancelBtn').hidden = true;
        loadCategories();
        loadOverview();
      } catch (err) {
        notify('error', err.message);
      }
    });
  }

  const catCancelBtn = document.getElementById('catCancelBtn');
  if (catCancelBtn) {
    catCancelBtn.addEventListener('click', () => {
      categoryForm.reset();
      document.getElementById('catEditId').value = '';
      if (catColorInput) catColorInput.value = '#0B2545';
      if (catColorLabel) catColorLabel.textContent = '#0B2545';
      document.getElementById('catSubmitBtn').textContent = 'Create Category';
      catCancelBtn.hidden = true;
    });
  }

  // Articles & Modal Editor
  async function loadArticles() {
    const q = document.getElementById('filterArticleSearch')?.value.trim() || '';
    const status = document.getElementById('filterArticleStatus')?.value || 'all';
    const catId = document.getElementById('filterArticleCategory')?.value || 'all';
    const type = document.getElementById('filterArticleType')?.value || 'all';

    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status !== 'all') params.set('status', status);
    if (catId !== 'all') params.set('category_id', catId);
    if (type !== 'all') params.set('type', type);

    try {
      const data = await api('/api/admin_articles.php?' + params.toString());
      articlesCache = data.articles || [];
      const tbody = document.getElementById('articlesTableBody');
      if (!tbody) return;

      if (!articlesCache.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--lasu-muted);">No matching articles found. Click "+ New Article" to publish your first broadcast.</td></tr>';
        return;
      }

      tbody.innerHTML = articlesCache.map((art) => {
        const flags = [];
        if (Number(art.is_breaking)) flags.push('Breaking');
        if (Number(art.is_featured)) flags.push('Featured');
        if (Number(art.is_announcement)) flags.push(art.announcement_priority === 'urgent' ? 'Urgent Notice' : 'Announcement');
        const placement = flags.length ? flags.join(' · ') : 'Standard';

        return (
          '<tr>' +
          '<td><strong>' + escapeHtml(art.title) + '</strong><div style="font-size:0.75rem;color:var(--lasu-muted);">By ' + escapeHtml(art.author_name) + '</div></td>' +
          '<td>' + escapeHtml(art.category_name) + '</td>' +
          '<td>' + escapeHtml(placement) + '</td>' +
          '<td><span class="' + (art.status === 'published' ? 'status-published' : 'status-draft') + '">' + escapeHtml(art.status) + '</span></td>' +
          '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(art.views) + '</td>' +
          '<td class="font-mono tabular-nums">' + escapeHtml(art.published_at || art.created_at) + '</td>' +
          '<td style="text-align:right;white-space:nowrap;">' +
          '  <button type="button" class="btn btn-outline" data-edit-art="' + art.id + '">Edit</button> ' +
          '  <button type="button" class="btn btn-danger" data-del-art="' + art.id + '">Delete</button>' +
          '</td>' +
          '</tr>'
        );
      }).join('');

      tbody.querySelectorAll('[data-edit-art]').forEach((b) => {
        b.addEventListener('click', () => {
          const art = articlesCache.find((x) => String(x.id) === b.getAttribute('data-edit-art'));
          if (art) openEditor(art);
        });
      });

      tbody.querySelectorAll('[data-del-art]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_articles.php?id=' + b.getAttribute('data-del-art'), { method: 'DELETE' });
            notify('success', 'Article deleted.');
            loadArticles();
            loadOverview();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });
    } catch (err) {
      notify('error', err.message);
    }
  }

  ['filterArticleSearch', 'filterArticleStatus', 'filterArticleCategory', 'filterArticleType'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(id === 'filterArticleSearch' ? 'input' : 'change', loadArticles);
  });

  const modal = document.getElementById('articleModal');
  const articleForm = document.getElementById('articleForm');

  // Rich Text Editor Helpers
  const rteEditor = document.getElementById('artRteEditor');
  const rteSource = document.getElementById('artContent');
  const rteBlockFormat = document.getElementById('rteBlockFormat');
  const rteStatsLabel = document.getElementById('rteStatsLabel');
  const rteModeBtn = document.getElementById('rteModeBtn');
  const rteLinkBar = document.getElementById('rteLinkBar');
  const rteLinkInput = document.getElementById('rteLinkInput');
  const rteImageBar = document.getElementById('rteImageBar');
  const rteInlineImgUrl = document.getElementById('rteInlineImgUrl');
  const rteInlineImgFile = document.getElementById('rteInlineImgFile');
  let rteSourceMode = false;
  let savedSelectionRange = null;

  function isHtmlString(str) {
    return /<(p|br|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|a|img|figure|hr|div)\b/i.test(str || '');
  }

  function plainTextToRichHtml(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return '';
    if (isHtmlString(trimmed)) return trimmed;
    return trimmed
      .split(/\n\s*\n/)
      .map((para) => '<p>' + escapeHtml(para.trim()).replace(/\n/g, '<br>') + '</p>')
      .join('');
  }

  function updateRteStats() {
    if (!rteEditor || !rteSource || !rteStatsLabel) return;
    const html = rteSourceMode ? rteSource.value : rteEditor.innerHTML;
    if (!rteSourceMode) rteSource.value = html;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const plain = (tmp.textContent || tmp.innerText || '').trim();
    const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    const mins = Math.max(1, Math.ceil(words / 200));
    rteStatsLabel.textContent = words + ' words · ' + mins + ' min read';
  }

  function setRteContent(rawContent) {
    const html = plainTextToRichHtml(rawContent);
    if (rteEditor) rteEditor.innerHTML = html;
    if (rteSource) rteSource.value = html;
    if (rteSourceMode && rteModeBtn) {
      rteSourceMode = false;
      rteEditor.hidden = false;
      rteSource.hidden = true;
      rteModeBtn.classList.remove('is-active');
    }
    if (rteLinkBar) rteLinkBar.hidden = true;
    if (rteImageBar) rteImageBar.hidden = true;
    updateRteStats();
  }

  function getRteContent() {
    if (rteSourceMode && rteSource) {
      return rteSource.value.trim();
    }
    return rteEditor ? rteEditor.innerHTML.trim() : (rteSource ? rteSource.value.trim() : '');
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && rteEditor && rteEditor.contains(sel.anchorNode)) {
      savedSelectionRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    if (!rteEditor) return;
    rteEditor.focus();
    if (savedSelectionRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRange);
      }
    }
  }

  if (rteEditor) {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Ignore unsupported browsers
    }

    rteEditor.addEventListener('input', updateRteStats);
    rteEditor.addEventListener('keyup', saveSelection);
    rteEditor.addEventListener('mouseup', saveSelection);

    document.querySelectorAll('[data-rte-cmd]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        if (rteSourceMode) return;
        rteEditor.focus();
        document.execCommand(btn.getAttribute('data-rte-cmd'), false, null);
        updateRteStats();
      });
    });

    if (rteBlockFormat) {
      rteBlockFormat.addEventListener('change', () => {
        if (rteSourceMode) return;
        rteEditor.focus();
        document.execCommand('formatBlock', false, '<' + rteBlockFormat.value + '>');
        updateRteStats();
      });
    }

    if (rteModeBtn && rteSource) {
      rteModeBtn.addEventListener('click', () => {
        rteSourceMode = !rteSourceMode;
        if (rteSourceMode) {
          rteSource.value = rteEditor.innerHTML;
          rteEditor.hidden = true;
          rteSource.hidden = false;
          rteModeBtn.classList.add('is-active');
        } else {
          rteEditor.innerHTML = rteSource.value;
          rteSource.hidden = true;
          rteEditor.hidden = false;
          rteModeBtn.classList.remove('is-active');
        }
        updateRteStats();
      });
      rteSource.addEventListener('input', updateRteStats);
    }

    document.getElementById('rteLinkToggleBtn')?.addEventListener('click', () => {
      if (rteSourceMode || !rteLinkBar) return;
      saveSelection();
      if (rteImageBar) rteImageBar.hidden = true;
      rteLinkBar.hidden = !rteLinkBar.hidden;
      if (!rteLinkBar.hidden && rteLinkInput) {
        rteLinkInput.value = 'https://';
        rteLinkInput.focus();
      }
    });

    document.getElementById('rteLinkApplyBtn')?.addEventListener('click', () => {
      const href = (rteLinkInput?.value || '').trim();
      if (!href || !/^(https?:\/\/|mailto:|\/)/i.test(href)) {
        notify('error', 'Enter a valid link starting with https://, http://, or /.');
        return;
      }
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        document.execCommand('insertHTML', false, '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(href) + '</a>');
      } else {
        document.execCommand('createLink', false, href);
      }
      if (rteLinkBar) rteLinkBar.hidden = true;
      updateRteStats();
    });

    document.getElementById('rteLinkRemoveBtn')?.addEventListener('click', () => {
      restoreSelection();
      document.execCommand('unlink', false, null);
      if (rteLinkBar) rteLinkBar.hidden = true;
      updateRteStats();
    });

    document.getElementById('rteLinkCancelBtn')?.addEventListener('click', () => {
      if (rteLinkBar) rteLinkBar.hidden = true;
    });

    document.getElementById('rteImageToggleBtn')?.addEventListener('click', () => {
      if (rteSourceMode || !rteImageBar) return;
      saveSelection();
      if (rteLinkBar) rteLinkBar.hidden = true;
      rteImageBar.hidden = !rteImageBar.hidden;
    });

    document.getElementById('rteInlineImgCancelBtn')?.addEventListener('click', () => {
      if (rteImageBar) rteImageBar.hidden = true;
    });

    document.getElementById('rteInlineImgInsertBtn')?.addEventListener('click', () => {
      const url = (rteInlineImgUrl?.value || '').trim();
      if (!url || !/^(https?:\/\/|\/)/i.test(url)) {
        notify('error', 'Enter a valid image URL starting with https://, http://, or /.');
        return;
      }
      restoreSelection();
      document.execCommand('insertHTML', false, '<figure><img src="' + escapeHtml(url) + '" alt="LASU Broadcast Media"></figure><p><br></p>');
      if (rteInlineImgUrl) rteInlineImgUrl.value = '';
      if (rteImageBar) rteImageBar.hidden = true;
      updateRteStats();
    });

    if (rteInlineImgFile) {
      rteInlineImgFile.addEventListener('change', async () => {
        const file = rteInlineImgFile.files && rteInlineImgFile.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('image', file);
        try {
          const res = await api('/api/admin_upload.php', { method: 'POST', body: fd });
          restoreSelection();
          document.execCommand('insertHTML', false, '<figure><img src="' + escapeHtml(res.url) + '" alt="LASU Broadcast Media"></figure><p><br></p>');
          if (rteImageBar) rteImageBar.hidden = true;
          updateRteStats();
          notify('success', 'Inline image inserted into article.');
        } catch (err) {
          notify('error', err.message);
        } finally {
          rteInlineImgFile.value = '';
        }
      });
    }
  }

  async function openEditor(article = null, asAnnouncement = false, prefill = null) {
    if (!modal || !articleForm) return;
    if (!categoriesCache.length) {
      await loadCategories();
    }
    articleForm.reset();
    document.getElementById('artId').value = article ? article.id : '';
    document.getElementById('artModalTitle').textContent = article ? 'Edit Campus Broadcast' : 'Compose Campus Broadcast';
    document.getElementById('artTitle').value = article ? article.title : (prefill?.title || '');
    document.getElementById('artExcerpt').value = article ? article.excerpt : (prefill?.excerpt || '');
    setRteContent(article ? article.content : (prefill?.content || ''));
    document.getElementById('artStatus').value = article ? article.status : 'published';
    document.getElementById('artFeatured').checked = article ? Boolean(Number(article.is_featured)) : false;
    document.getElementById('artBreaking').checked = article ? Boolean(Number(article.is_breaking)) : false;
    document.getElementById('artAnnouncement').checked = article ? Boolean(Number(article.is_announcement)) : asAnnouncement;
    document.getElementById('artPriority').value = article ? (article.announcement_priority || 'normal') : 'normal';
    const imgVal = article ? (article.featured_image || '') : (prefill?.featured_image || '');
    document.getElementById('artImageUrl').value = imgVal;
    updateImagePreview(imgVal);

    const catSelect = document.getElementById('artCategoryId');
    if (article && article.category_id) {
      catSelect.value = String(article.category_id);
    } else if (prefill && prefill.category_id) {
      catSelect.value = String(prefill.category_id);
    } else if (asAnnouncement) {
      const annCat = categoriesCache.find((c) => c.slug === 'announcements') || categoriesCache[0];
      if (annCat) catSelect.value = String(annCat.id);
    } else if (categoriesCache.length) {
      catSelect.value = String(categoriesCache[0].id);
    }

    modal.removeAttribute('hidden');
  }

  function updateImagePreview(url) {
    const previewWrap = document.getElementById('artImagePreviewWrap');
    const previewImg = document.getElementById('artImagePreview');
    if (url) {
      previewImg.src = mediaUrl(url);
      previewWrap.hidden = false;
    } else {
      previewWrap.hidden = true;
    }
  }

  document.getElementById('reloadArtCatsBtn')?.addEventListener('click', loadCategories);
  document.getElementById('newArticleBtn')?.addEventListener('click', () => openEditor(null, false));
  document.getElementById('newAnnouncementBtn')?.addEventListener('click', () => openEditor(null, true));
  document.getElementById('closeArticleModalBtn')?.addEventListener('click', () => modal.setAttribute('hidden', ''));
  document.getElementById('cancelArticleModalBtn')?.addEventListener('click', () => modal.setAttribute('hidden', ''));
  document.getElementById('removeArtImageBtn')?.addEventListener('click', () => {
    document.getElementById('artImageUrl').value = '';
    updateImagePreview('');
  });

  const fileInput = document.getElementById('artImageFile');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await api('/api/admin_upload.php', { method: 'POST', body: fd });
        document.getElementById('artImageUrl').value = res.url;
        updateImagePreview(res.url);
        notify('success', 'Image uploaded.');
      } catch (err) {
        notify('error', err.message);
      } finally {
        fileInput.value = '';
      }
    });
  }

  if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('artId').value;
      const richContent = getRteContent();
      const tmp = document.createElement('div');
      tmp.innerHTML = richContent;
      const plainLen = (tmp.textContent || tmp.innerText || '').trim().length;
      if (plainLen < 20) {
        notify('error', 'Article body content must be at least 20 characters of readable text.');
        if (!rteSourceMode && rteEditor) rteEditor.focus();
        return;
      }

      const payload = {
        id: id ? Number(id) : undefined,
        title: document.getElementById('artTitle').value.trim(),
        category_id: Number(document.getElementById('artCategoryId').value),
        status: document.getElementById('artStatus').value,
        featured_image: document.getElementById('artImageUrl').value.trim(),
        excerpt: document.getElementById('artExcerpt').value.trim(),
        content: richContent,
        is_featured: document.getElementById('artFeatured').checked,
        is_breaking: document.getElementById('artBreaking').checked,
        is_announcement: document.getElementById('artAnnouncement').checked,
        announcement_priority: document.getElementById('artPriority').value,
      };
      try {
        await api('/api/admin_articles.php', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        modal.setAttribute('hidden', '');
        notify('success', id ? 'Broadcast updated.' : 'Broadcast saved.');
        loadArticles();
        loadOverview();
        loadCategories();
        if (analyticsCache) loadAnalytics();
      } catch (err) {
        notify('error', err.message);
      }
    });
  }

  // Comments & Moderation
  async function loadComments() {
    const status = document.getElementById('filterCommentStatus')?.value || 'all';
    const container = document.getElementById('commentsModerationList');
    if (!container) return;

    try {
      const data = await api('/api/admin_comments.php?status=' + encodeURIComponent(status));
      const comments = data.comments || [];
      if (!comments.length) {
        container.innerHTML = '<div style="padding:2rem;text-align:center;font-size:0.85rem;color:var(--lasu-muted);">No comments in this moderation queue.</div>';
        return;
      }

      container.innerHTML = comments.map((c) => (
        '<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--lasu-border);display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;align-items:flex-start;">' +
        '  <div style="flex:1;min-width:240px;">' +
        '    <div style="font-size:0.8rem;"><strong>' + escapeHtml(c.author_name) + '</strong> (' + escapeHtml(c.author_email) + ') &middot; <span style="font-weight:700;text-transform:uppercase;">' + escapeHtml(c.status) + '</span></div>' +
        '    <div style="font-size:0.75rem;color:var(--lasu-muted);margin:0.2rem 0;">On: ' + escapeHtml(c.article_title) + ' &middot; ' + escapeHtml(c.created_at) + '</div>' +
        '    <p style="font-size:0.85rem;margin-top:0.35rem;">' + escapeHtml(c.content) + '</p>' +
        '  </div>' +
        '  <div style="display:flex;gap:0.4rem;flex-shrink:0;">' +
        (c.status !== 'approved' ? '<button type="button" class="btn btn-primary" data-mod-comment="' + c.id + '" data-mod-status="approved">Approve</button>' : '') +
        (c.status !== 'rejected' ? '<button type="button" class="btn btn-outline" data-mod-comment="' + c.id + '" data-mod-status="rejected">Reject</button>' : '') +
        '    <button type="button" class="btn btn-danger" data-del-comment="' + c.id + '">Delete</button>' +
        '  </div>' +
        '</div>'
      )).join('');

      container.querySelectorAll('[data-mod-comment]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_comments.php', {
              method: 'PATCH',
              body: JSON.stringify({
                id: Number(b.getAttribute('data-mod-comment')),
                status: b.getAttribute('data-mod-status'),
              }),
            });
            notify('success', 'Comment updated.');
            loadComments();
            loadOverview();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });

      container.querySelectorAll('[data-del-comment]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_comments.php?id=' + b.getAttribute('data-del-comment'), { method: 'DELETE' });
            notify('success', 'Comment deleted.');
            loadComments();
            loadOverview();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });
    } catch (err) {
      notify('error', err.message);
    }
  }
  document.getElementById('filterCommentStatus')?.addEventListener('change', loadComments);

  // Advertisements Management
  function updateAdImagePreview(url) {
    const wrap = document.getElementById('adImagePreviewWrap');
    const img = document.getElementById('adImagePreview');
    if (url) {
      img.src = mediaUrl(url);
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
    }
  }

  document.getElementById('removeAdImageBtn')?.addEventListener('click', () => {
    document.getElementById('adImageUrl').value = '';
    updateAdImagePreview('');
  });

  const adImageFile = document.getElementById('adImageFile');
  if (adImageFile) {
    adImageFile.addEventListener('change', async () => {
      const file = adImageFile.files && adImageFile.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await api('/api/admin_upload.php', { method: 'POST', body: fd });
        document.getElementById('adImageUrl').value = res.url;
        updateAdImagePreview(res.url);
        notify('success', 'Banner image uploaded.');
      } catch (err) {
        notify('error', err.message);
      } finally {
        adImageFile.value = '';
      }
    });
  }

  function formatRemainingDuration(msRemaining) {
    const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
    if (totalSec <= 0) return '0s left';
    if (totalSec < 60) return totalSec + 's left';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) return mins + 'm ' + secs + 's left';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs < 24) return hrs + 'h ' + remMins + 'm left';
    const days = Math.floor(hrs / 24);
    const remHrs = hrs % 24;
    return days + 'd ' + remHrs + 'h left';
  }

  let adsTickTimer = null;

  function renderAdsTable() {
    const tbody = document.getElementById('adsTableBody');
    const summaryEl = document.getElementById('adsPlacementSummary');
    const nowMs = Date.now();

    if (summaryEl) {
      let topCount = 0;
      let sideCount = 0;
      let inlineCount = 0;
      adsCache.forEach((ad) => {
        const expMs = ad.expires_at_ms ? Number(ad.expires_at_ms) : null;
        const expired = expMs !== null && expMs <= nowMs;
        if (ad.status === 'active' && !expired) {
          if (ad.placement === 'top_banner') topCount++;
          if (ad.placement === 'sidebar_box') sideCount++;
          if (ad.placement === 'inline_banner') inlineCount++;
        }
      });
      summaryEl.innerHTML =
        '<span>Multiple active ad spaces per placement render simultaneously.</span>' +
        '<span class="font-mono tabular-nums">Active Spaces &mdash; Top Banner: <strong>' + topCount +
        '</strong> &middot; Sidebar: <strong>' + sideCount +
        '</strong> &middot; Inline: <strong>' + inlineCount + '</strong></span>';
    }

    if (!tbody) return;

    if (!adsCache.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--lasu-muted);">No advertisements configured yet.</td></tr>';
      return;
    }

    tbody.innerHTML = adsCache.map((ad) => {
      const expMs = ad.expires_at_ms ? Number(ad.expires_at_ms) : null;
      const expired = expMs !== null && expMs <= nowMs;
      const statusCls = expired ? 'status-expired' : (ad.status === 'active' ? 'status-published' : 'status-draft');
      const statusText = expired ? 'Expired' : ad.status;
      const hasLimit = ad.duration_unit && ad.duration_unit !== 'none' && Number(ad.duration_value || 0) > 0;
      const durMeta = hasLimit
        ? (ad.duration_value + ' ' + ad.duration_unit + (expired ? ' · Ended' : (expMs ? ' · ' + formatRemainingDuration(expMs - nowMs) : '')))
        : 'Unlimited';

      return (
        '<tr>' +
        '<td><strong>' + escapeHtml(ad.title) + '</strong><div style="font-size:0.75rem;color:var(--lasu-muted);">' + escapeHtml(ad.advertiser_name) + '</div></td>' +
        '<td class="font-mono">' + escapeHtml(ad.placement) + '<div style="font-size:0.72rem;color:var(--lasu-muted);">Slot #' + Number(ad.display_order || 0) + '</div></td>' +
        '<td><span class="' + statusCls + '">' + escapeHtml(statusText) + '</span><div class="font-mono" style="font-size:0.72rem;color:var(--lasu-muted);">' + escapeHtml(durMeta) + '</div></td>' +
        '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(ad.impressions || 0) + '</td>' +
        '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(ad.clicks || 0) + '</td>' +
        '<td style="text-align:right;white-space:nowrap;">' +
        '  <button type="button" class="btn btn-outline" data-edit-ad="' + ad.id + '">Edit</button> ' +
        '  <button type="button" class="btn btn-danger" data-del-ad="' + ad.id + '">Delete</button>' +
        '</td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('[data-edit-ad]').forEach((b) => {
      b.addEventListener('click', () => {
        const ad = adsCache.find((x) => String(x.id) === b.getAttribute('data-edit-ad'));
        if (!ad) return;
        document.getElementById('adEditId').value = ad.id;
        document.getElementById('adTitle').value = ad.title;
        document.getElementById('adAdvertiser').value = ad.advertiser_name;
        document.getElementById('adPlacement').value = ad.placement;
        document.getElementById('adStatus').value = ad.status;
        document.getElementById('adDurationValue').value = ad.duration_value ? String(ad.duration_value) : '';
        document.getElementById('adDurationUnit').value = ad.duration_unit || 'none';
        document.getElementById('adDisplayOrder').value = String(ad.display_order || 0);
        document.getElementById('adTargetUrl').value = ad.target_url || '';
        document.getElementById('adImageUrl').value = ad.image_url || '';
        const restartWrap = document.getElementById('adRestartWrap');
        const restartChk = document.getElementById('adRestartDuration');
        const expHint = document.getElementById('adExpiryHint');
        if (restartChk) restartChk.checked = false;
        if (restartWrap) restartWrap.hidden = false;
        if (expHint) {
          if (ad.expires_at_ms && Number(ad.expires_at_ms) <= Date.now()) {
            expHint.textContent = 'Expired at: ' + (ad.expires_at || '') + ' (check above to relaunch timer)';
          } else if (ad.expires_at) {
            expHint.textContent = 'Current expiry: ' + ad.expires_at;
          } else {
            expHint.textContent = 'Current duration: Unlimited';
          }
        }
        updateAdImagePreview(ad.image_url || '');
        document.getElementById('adSubmitBtn').textContent = 'Update Campaign';
        document.getElementById('adCancelBtn').hidden = false;
      });
    });

    tbody.querySelectorAll('[data-del-ad]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          await api('/api/admin_ads.php?id=' + b.getAttribute('data-del-ad'), { method: 'DELETE' });
          notify('success', 'Advertisement deleted.');
          loadAds();
          loadOverview();
        } catch (err) {
          notify('error', err.message);
        }
      });
    });
  }

  function resetAdFormState() {
    if (!adForm) return;
    adForm.reset();
    document.getElementById('adEditId').value = '';
    document.getElementById('adImageUrl').value = '';
    document.getElementById('adDurationValue').value = '';
    document.getElementById('adDurationUnit').value = 'none';
    document.getElementById('adDisplayOrder').value = '0';
    const restartWrap = document.getElementById('adRestartWrap');
    const restartChk = document.getElementById('adRestartDuration');
    if (restartWrap) restartWrap.hidden = true;
    if (restartChk) restartChk.checked = false;
    updateAdImagePreview('');
    document.getElementById('adSubmitBtn').textContent = 'Create Campaign';
    document.getElementById('adCancelBtn').hidden = true;
  }

  async function loadAds() {
    try {
      const data = await api('/api/admin_ads.php');
      adsCache = data.ads || [];
      renderAdsTable();
      if (adsTickTimer) {
        clearInterval(adsTickTimer);
        adsTickTimer = null;
      }
      if (adsCache.some((ad) => ad.expires_at_ms)) {
        adsTickTimer = setInterval(() => {
          const panel = document.querySelector('[data-tab-panel="ads"]');
          if (panel && !panel.hidden) {
            renderAdsTable();
          }
        }, 1000);
      }
    } catch (err) {
      notify('error', err.message);
    }
  }

  const adForm = document.getElementById('adForm');
  if (adForm) {
    adForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('adEditId').value;
      const durUnit = document.getElementById('adDurationUnit').value;
      const durValRaw = document.getElementById('adDurationValue').value.trim();
      const durVal = durValRaw !== '' ? Math.max(0, Number(durValRaw)) : 0;
      if (durUnit !== 'none' && durVal <= 0) {
        notify('error', 'Enter a duration number greater than 0 or choose "No Expiry (Unlimited)".');
        return;
      }
      const payload = {
        id: id ? Number(id) : undefined,
        title: document.getElementById('adTitle').value.trim(),
        advertiser_name: document.getElementById('adAdvertiser').value.trim(),
        placement: document.getElementById('adPlacement').value,
        status: document.getElementById('adStatus').value,
        duration_value: durVal,
        duration_unit: durUnit,
        display_order: Math.max(0, Number(document.getElementById('adDisplayOrder').value || 0)),
        restart_duration: Boolean(document.getElementById('adRestartDuration')?.checked),
        target_url: document.getElementById('adTargetUrl').value.trim(),
        image_url: document.getElementById('adImageUrl').value.trim(),
      };
      try {
        await api('/api/admin_ads.php', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        notify('success', id ? 'Advertisement updated.' : 'Advertisement created.');
        resetAdFormState();
        loadAds();
        loadOverview();
      } catch (err) {
        notify('error', err.message);
      }
    });
  }

  document.getElementById('adCancelBtn')?.addEventListener('click', resetAdFormState);

  async function exportAdsPdfReport(triggerBtn) {
    const placement = document.getElementById('adsExportPlacement')?.value || 'all';
    const statusFilter = document.getElementById('adsExportStatus')?.value || 'all';
    const params = new URLSearchParams({ placement, status: statusFilter });
    const origText = triggerBtn ? triggerBtn.textContent : '';
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'Generating PDF...';
    }
    try {
      const res = await fetch(urlFor('/api/admin_ads_export.php?' + params.toString()), {
        method: 'GET',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to export advertisement PDF report.');
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.href = blobUrl;
      link.download = 'LASU-Ad-Statistics-Report-' + today + '.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      notify('success', 'Branded advertisement statistics PDF downloaded.');
    } catch (err) {
      notify('error', err.message || 'Unable to generate PDF report.');
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = origText;
      }
    }
  }

  document.getElementById('exportAdsPdfBtn')?.addEventListener('click', function () {
    exportAdsPdfReport(this);
  });
  document.getElementById('exportAnalyticsAdsPdfBtn')?.addEventListener('click', function () {
    exportAdsPdfReport(this);
  });

  // Performance & Readership Analytics
  async function loadAnalytics() {
    try {
      analyticsCache = await api('/api/admin_analytics.php');
      renderAnalytics();
    } catch (err) {
      notify('error', err.message);
    }
  }

  function renderAnalytics() {
    if (!analyticsCache) return;
    const s = analyticsCache.summary || {};
    const grid = document.getElementById('analyticsSummaryGrid');
    const ctr = s.total_impressions > 0 ? ((s.total_clicks / s.total_impressions) * 100).toFixed(2) + '%' : '0.00%';
    if (grid) {
      const cards = [
        { label: 'Published / Total', val: (s.published_articles || 0) + ' / ' + (s.total_articles || 0), sub: (s.draft_articles || 0) + ' drafts' },
        { label: 'Total Readership', val: Number(s.total_views || 0).toLocaleString(), sub: (s.featured_articles || 0) + ' featured · ' + (s.breaking_articles || 0) + ' breaking' },
        { label: 'Avg Views / Story', val: Math.round(Number(s.avg_views_published || 0)).toLocaleString(), sub: (s.announcement_articles || 0) + ' announcements' },
        { label: 'Top Story Views', val: Number(s.top_article_views || 0).toLocaleString(), sub: 'Highest read dispatch' },
        { label: 'Reader Comments', val: (s.approved_comments || 0) + ' / ' + (s.total_comments || 0), sub: (s.pending_comments || 0) + ' pending review' },
        { label: 'Sponsor CTR', val: ctr, sub: Number(s.total_clicks || 0).toLocaleString() + ' clicks / ' + Number(s.total_impressions || 0).toLocaleString() + ' impr.' },
      ];
      grid.innerHTML = cards.map((c) => (
        '<div class="stat-box">' +
        '<div class="stat-label">' + escapeHtml(c.label) + '</div>' +
        '<div class="stat-num tabular-nums">' + escapeHtml(c.val) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--lasu-muted);margin-top:0.25rem;">' + escapeHtml(c.sub) + '</div>' +
        '</div>'
      )).join('');
    }

    const catBody = document.getElementById('analyticsCategoriesBody');
    if (catBody) {
      const totalViews = Number(s.total_views || 0);
      catBody.innerHTML = (analyticsCache.categoryBreakdown || []).map((c) => {
        const views = Number(c.total_views || 0);
        const share = totalViews > 0 ? Math.round((views / totalViews) * 100) : 0;
        return (
          '<tr>' +
          '<td><span style="display:inline-block;width:10px;height:10px;background:' + escapeHtml(c.color_hex || '#0B2545') + ';margin-right:0.45rem;"></span><strong>' + escapeHtml(c.name) + '</strong></td>' +
          '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(c.published_articles || 0) + '</td>' +
          '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(c.total_articles || 0) + '</td>' +
          '<td class="font-mono tabular-nums" style="text-align:right;"><strong>' + views.toLocaleString() + '</strong></td>' +
          '<td class="font-mono tabular-nums" style="text-align:right;">' + escapeHtml(c.avg_views || 0) + '</td>' +
          '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(c.comment_count || 0) + '</td>' +
          '<td><div style="display:flex;align-items:center;gap:0.5rem;"><div style="flex:1;min-width:70px;height:6px;background:#EFECE6;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + Math.max(share, views > 0 ? 4 : 0) + '%;background:' + escapeHtml(c.color_hex || '#0B2545') + ';"></div></div><span class="font-mono tabular-nums" style="font-size:0.72rem;">' + share + '%</span></div></td>' +
          '</tr>'
        );
      }).join('');
    }

    const artBody = document.getElementById('analyticsArticlesBody');
    if (artBody) {
      const q = (document.getElementById('analyticsSearch')?.value || '').trim().toLowerCase();
      const catFilter = document.getElementById('analyticsCategoryFilter')?.value || 'all';
      const sortMode = document.getElementById('analyticsSort')?.value || 'views_desc';
      const maxViews = Math.max(1, Number(s.top_article_views || 1));

      let rows = (analyticsCache.articlePerformance || []).filter((item) => {
        if (catFilter !== 'all' && String(item.category_id) !== catFilter) return false;
        if (q) {
          const hay = (item.title + ' ' + item.author_name + ' ' + item.category_name).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      rows = rows.slice().sort((a, b) => {
        if (sortMode === 'views_asc') return Number(a.views) - Number(b.views);
        if (sortMode === 'comments_desc') return Number(b.total_comments) - Number(a.total_comments) || Number(b.views) - Number(a.views);
        if (sortMode === 'newest') return String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at));
        return Number(b.views) - Number(a.views);
      });

      artBody.innerHTML = rows.map((art, idx) => {
        const flags = [];
        if (Number(art.is_breaking)) flags.push('Breaking');
        if (Number(art.is_featured)) flags.push('Featured');
        if (Number(art.is_announcement)) flags.push(art.announcement_priority === 'urgent' ? 'Urgent' : 'Notice');
        const views = Number(art.views || 0);
        const pct = Math.round((views / maxViews) * 100);
        return (
          '<tr>' +
          '<td class="font-mono tabular-nums">' + (idx + 1) + '</td>' +
          '<td><strong>' + escapeHtml(art.title) + '</strong><div style="font-size:0.72rem;color:var(--lasu-muted);">' + escapeHtml(art.author_name) + '</div></td>' +
          '<td>' + escapeHtml(art.category_name) + '</td>' +
          '<td><span class="' + (art.status === 'published' ? 'status-published' : 'status-draft') + '">' + escapeHtml(art.status) + '</span></td>' +
          '<td>' + escapeHtml(flags.length ? flags.join(' · ') : 'Standard') + '</td>' +
          '<td style="text-align:right;white-space:nowrap;"><div style="display:inline-flex;align-items:center;gap:0.4rem;"><div style="width:48px;height:5px;background:#EFECE6;border-radius:3px;overflow:hidden;"><div style="height:100%;background:var(--lasu-navy);width:' + Math.max(pct, views > 0 ? 5 : 0) + '%;"></div></div><strong class="font-mono tabular-nums">' + views.toLocaleString() + '</strong></div></td>' +
          '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(art.approved_comments || 0) + '/' + Number(art.total_comments || 0) + '</td>' +
          '<td class="font-mono tabular-nums" style="white-space:nowrap;">' + escapeHtml(art.published_at || art.created_at) + '</td>' +
          '<td style="text-align:right;white-space:nowrap;"><button type="button" class="btn btn-outline" data-analytics-edit="' + art.id + '">Edit</button></td>' +
          '</tr>'
        );
      }).join('');

      artBody.querySelectorAll('[data-analytics-edit]').forEach((b) => {
        b.addEventListener('click', async () => {
          const targetId = b.getAttribute('data-analytics-edit');
          if (!articlesCache.length) {
            const d = await api('/api/admin_articles.php');
            articlesCache = d.articles || [];
          }
          const found = articlesCache.find((x) => String(x.id) === targetId);
          if (found) openEditor(found);
        });
      });
    }
  }

  document.getElementById('refreshAnalyticsBtn')?.addEventListener('click', loadAnalytics);
  ['analyticsSearch', 'analyticsCategoryFilter', 'analyticsSort'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(id === 'analyticsSearch' ? 'input' : 'change', renderAnalytics);
  });

  // Multi-Source News Wire
  async function loadSources() {
    const grid = document.getElementById('sourcesGrid');
    const statusBar = document.getElementById('sourceStatusBar');
    const sourceKey = document.getElementById('sourceSelect')?.value || 'all';
    const q = document.getElementById('sourceSearch')?.value.trim() || '';
    const customUrl = document.getElementById('sourceCustomUrl')?.value.trim() || '';

    if (grid) grid.innerHTML = '<div class="panel"><div class="panel-body" style="text-align:center;color:var(--lasu-muted);">Connecting to live news feeds...</div></div>';

    const params = new URLSearchParams();
    if (sourceKey !== 'all') params.set('source', sourceKey);
    if (q) params.set('q', q);
    if (customUrl) params.set('custom_url', customUrl);

    try {
      sourcesDataCache = await api('/api/admin_sources.php?' + params.toString());
      const items = sourcesDataCache.items || [];
      const statuses = sourcesDataCache.sourceStatuses || [];

      if (statusBar) {
        statusBar.innerHTML = statuses.map((st) => (
          '<span style="font-size:0.72rem;padding:0.2rem 0.55rem;border-radius:0.25rem;border:1px solid ' + (st.ok ? '#A7F3D0;background:#ECFDF5;color:#065F46' : '#FDE68A;background:#FFFBEB;color:#92400E') + ';">' +
          escapeHtml(st.name) + ': <strong class="font-mono">' + Number(st.count || 0) + '</strong></span>'
        )).join('');
      }

      if (!grid) return;
      if (!items.length) {
        grid.innerHTML = '<div class="panel"><div class="panel-body" style="text-align:center;color:var(--lasu-muted);">No headlines matched your filter. Try selecting All Live Sources or clearing your keyword.</div></div>';
        return;
      }

      grid.innerHTML = items.map((item, idx) => (
        '<div class="panel" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">' +
        '  <div class="panel-body">' +
        '    <div style="display:flex;gap:0.75rem;">' +
        (item.image_url ? '<img src="' + escapeHtml(item.image_url) + '" alt="" style="width:88px;height:70px;object-fit:cover;border-radius:0.25rem;border:1px solid var(--lasu-border);flex-shrink:0;">' : '') +
        '      <div style="min-width:0;">' +
        '        <div style="font-size:0.72rem;margin-bottom:0.35rem;display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">' +
        '          <span style="background:var(--lasu-navy);color:#fff;padding:0.12rem 0.45rem;font-weight:600;border-radius:2px;">' + escapeHtml(item.source_name) + '</span>' +
        '          <span class="font-mono" style="color:var(--lasu-muted);">' + escapeHtml(item.published_at) + '</span>' +
        '        </div>' +
        '        <h3 style="font-size:0.95rem;line-height:1.3;margin-bottom:0.35rem;">' + escapeHtml(item.title) + '</h3>' +
        (item.summary ? '<p style="margin:0;font-size:0.78rem;color:var(--lasu-muted);line-height:1.45;">' + escapeHtml(item.summary) + '</p>' : '') +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '  <div style="padding:0.75rem 1.25rem;border-top:1px solid var(--lasu-border);display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
        '    <a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" style="font-size:0.75rem;color:var(--lasu-navy);font-weight:600;">Original Source &rarr;</a>' +
        '    <div style="display:flex;gap:0.4rem;">' +
        '      <button type="button" class="btn btn-outline" data-src-import="' + idx + '">Import to Editor</button>' +
        '      <button type="button" class="btn btn-primary" data-src-publish="' + idx + '">Quick Publish</button>' +
        '    </div>' +
        '  </div>' +
        '</div>'
      )).join('');

      grid.querySelectorAll('[data-src-import]').forEach((b) => {
        b.addEventListener('click', async () => {
          const item = items[Number(b.getAttribute('data-src-import'))];
          if (!item) return;
          if (!categoriesCache.length) await loadCategories();
          const cat = categoriesCache.find((c) => c.slug === item.suggested_category_slug) || categoriesCache[0];
          const summary = (item.summary && item.summary.length >= 10 ? item.summary : item.title + ' — Reported via ' + item.source_name).slice(0, 480);
          const content = (item.content && item.content.length >= 20 ? item.content : summary) + '\n\nSource Dispatch: ' + item.source_name + (item.url ? ' (' + item.url + ')' : '');
          openEditor(null, false, {
            title: item.title.slice(0, 215),
            excerpt: summary,
            content: content,
            featured_image: item.image_url || '',
            category_id: cat ? cat.id : '',
          });
        });
      });

      grid.querySelectorAll('[data-src-publish]').forEach((b) => {
        b.addEventListener('click', async () => {
          const item = items[Number(b.getAttribute('data-src-publish'))];
          if (!item) return;
          b.disabled = true;
          try {
            if (!categoriesCache.length) await loadCategories();
            const cat = categoriesCache.find((c) => c.slug === item.suggested_category_slug) || categoriesCache[0];
            if (!cat) throw new Error('No categories available.');
            const title = item.title.trim().slice(0, 215);
            const excerpt = (item.summary && item.summary.length >= 10 ? item.summary : title + ' — Dispatched via ' + item.source_name).slice(0, 480);
            const content = (item.content && item.content.length >= 20 ? item.content : excerpt) + '\n\nSource Attribution: ' + item.source_name + (item.url ? ' (' + item.url + ')' : '');
            await api('/api/admin_articles.php', {
              method: 'POST',
              body: JSON.stringify({
                title: title.length >= 5 ? title : title + ' Update',
                excerpt: excerpt.length >= 10 ? excerpt : excerpt + ' Campus broadcast update.',
                content: content.length >= 20 ? content : content + ' Published to LASU Campus Broadcast.',
                featured_image: item.image_url || '',
                category_id: cat.id,
                status: 'published',
                is_featured: false,
                is_breaking: false,
                is_announcement: false,
                announcement_priority: 'normal',
              }),
            });
            notify('success', 'Published "' + title + '" into ' + cat.name + '.');
            loadOverview();
            loadCategories();
          } catch (err) {
            notify('error', err.message);
          } finally {
            b.disabled = false;
          }
        });
      });
    } catch (err) {
      if (grid) grid.innerHTML = '';
      notify('error', err.message);
    }
  }

  document.getElementById('refreshSourcesBtn')?.addEventListener('click', loadSources);
  document.getElementById('sourceSelect')?.addEventListener('change', loadSources);
  document.getElementById('sourcesFilterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    loadSources();
  });

  // Reader Accounts Full CRUD
  const readerForm = document.getElementById('readerForm');
  function resetReaderForm() {
    if (!readerForm) return;
    readerForm.reset();
    document.getElementById('readerEditId').value = '';
    document.getElementById('readerActive').checked = true;
    document.getElementById('readerPassword').required = true;
    document.getElementById('readerPassLabel').textContent = 'Password (min 6 chars)';
    document.getElementById('readerFormTitle').textContent = 'Create Reader Account';
    document.getElementById('readerSubmitBtn').textContent = 'Create Reader';
    document.getElementById('readerCancelBtn').hidden = true;
  }

  document.getElementById('readerCancelBtn')?.addEventListener('click', resetReaderForm);

  if (readerForm) {
    readerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('readerEditId').value;
      const password = document.getElementById('readerPassword').value;
      const payload = {
        id: id ? Number(id) : undefined,
        full_name: document.getElementById('readerName').value.trim(),
        email: document.getElementById('readerEmail').value.trim(),
        department: document.getElementById('readerDept').value.trim(),
        password: password || undefined,
        is_active: document.getElementById('readerActive').checked,
      };
      try {
        await api('/api/admin_users.php', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        notify('success', id ? 'Reader account updated.' : 'Reader account created.');
        resetReaderForm();
        loadUsers();
        loadOverview();
      } catch (err) {
        notify('error', err.message);
      }
    });
  }

  async function loadUsers() {
    try {
      const q = document.getElementById('filterUserSearch')?.value.trim() || '';
      const status = document.getElementById('filterUserStatus')?.value || 'all';
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status !== 'all') params.set('status', status);
      const qs = params.toString();

      const data = await api('/api/admin_users.php' + (qs ? '?' + qs : ''));
      usersCache = data.users || [];
      const countLbl = document.getElementById('usersCountLabel');
      if (countLbl) countLbl.textContent = usersCache.length + ' account(s)';

      const tbody = document.getElementById('usersTableBody');
      if (!tbody) return;

      if (!usersCache.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--lasu-muted);">No matching reader accounts found.</td></tr>';
        return;
      }

      tbody.innerHTML = usersCache.map((u) => (
        '<tr>' +
        '<td><strong>' + escapeHtml(u.full_name) + '</strong><div style="font-size:0.75rem;color:var(--lasu-muted);">' + escapeHtml(u.email) + '</div></td>' +
        '<td>' + escapeHtml(u.department || '—') + '</td>' +
        '<td><span class="' + (Number(u.is_active) ? 'status-published' : 'status-draft') + '">' + (Number(u.is_active) ? 'Active' : 'Suspended') + '</span></td>' +
        '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(u.comment_count || 0) + '</td>' +
        '<td class="font-mono tabular-nums">' + escapeHtml(u.created_at) + '</td>' +
        '<td style="text-align:right;white-space:nowrap;">' +
        '  <button type="button" class="btn btn-outline" data-edit-user="' + u.id + '">Edit</button> ' +
        '  <button type="button" class="btn btn-outline" data-toggle-user="' + u.id + '" data-next-active="' + (Number(u.is_active) ? '0' : '1') + '">' + (Number(u.is_active) ? 'Suspend' : 'Activate') + '</button> ' +
        '  <button type="button" class="btn btn-danger" data-del-user="' + u.id + '">Delete</button>' +
        '</td>' +
        '</tr>'
      )).join('');

      tbody.querySelectorAll('[data-edit-user]').forEach((b) => {
        b.addEventListener('click', () => {
          const u = usersCache.find((x) => String(x.id) === b.getAttribute('data-edit-user'));
          if (!u) return;
          document.getElementById('readerEditId').value = u.id;
          document.getElementById('readerName').value = u.full_name;
          document.getElementById('readerEmail').value = u.email;
          document.getElementById('readerDept').value = u.department || '';
          document.getElementById('readerPassword').value = '';
          document.getElementById('readerPassword').required = false;
          document.getElementById('readerPassLabel').textContent = 'New Password (leave blank to keep)';
          document.getElementById('readerActive').checked = Boolean(Number(u.is_active));
          document.getElementById('readerFormTitle').textContent = 'Edit ' + u.email;
          document.getElementById('readerSubmitBtn').textContent = 'Update Reader';
          document.getElementById('readerCancelBtn').hidden = false;
        });
      });

      tbody.querySelectorAll('[data-toggle-user]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_users.php', {
              method: 'PATCH',
              body: JSON.stringify({
                id: Number(b.getAttribute('data-toggle-user')),
                is_active: Number(b.getAttribute('data-next-active')),
              }),
            });
            notify('success', 'Reader account updated.');
            loadUsers();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });

      tbody.querySelectorAll('[data-del-user]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_users.php?id=' + b.getAttribute('data-del-user'), { method: 'DELETE' });
            notify('success', 'Reader account deleted.');
            loadUsers();
            loadOverview();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });
    } catch (err) {
      notify('error', err.message);
    }
  }

  document.getElementById('filterUserSearch')?.addEventListener('input', loadUsers);
  document.getElementById('filterUserStatus')?.addEventListener('change', loadUsers);

  // Administrators Management
  let adminsCache = [];
  const adminCreateForm = document.getElementById('createAdminForm');

  function resetAdminForm() {
    if (!adminCreateForm) return;
    adminCreateForm.reset();
    document.getElementById('adminEditId').value = '';
    document.getElementById('newAdminEmail').disabled = false;
    document.getElementById('newAdminPassword').required = true;
    document.getElementById('newAdminPassLabel').textContent = 'Password (min 8 chars)';
    document.getElementById('adminFormTitle').textContent = 'Add Administrator';
    document.getElementById('newAdminSubmitBtn').textContent = 'Create Administrator';
    document.getElementById('newAdminActive').checked = true;
    document.getElementById('newAdminActiveWrap').hidden = true;
    document.getElementById('newAdminCancelBtn').hidden = true;
  }

  document.getElementById('newAdminCancelBtn')?.addEventListener('click', resetAdminForm);

  async function loadAdmins() {
    try {
      const data = await api('/api/admin_admins.php');
      adminsCache = data.admins || [];
      const tbody = document.getElementById('adminsTableBody');
      if (!tbody) return;

      tbody.innerHTML = adminsCache.map((a) => (
        '<tr>' +
        '<td><strong>' + escapeHtml(a.full_name) + '</strong><div style="font-size:0.75rem;color:var(--lasu-muted);">' + escapeHtml(a.email) + '</div></td>' +
        '<td>' + (a.role === 'super_admin' ? 'Super Admin' : 'Editor') + '</td>' +
        '<td><span class="' + (Number(a.is_active) ? 'status-published' : 'status-draft') + '">' + (Number(a.is_active) ? 'Active' : 'Disabled') + '</span></td>' +
        '<td class="font-mono tabular-nums" style="text-align:right;">' + Number(a.article_count || 0) + '</td>' +
        (currentAdminRole === 'super_admin'
          ? '<td style="text-align:right;white-space:nowrap;">' +
            '  <button type="button" class="btn btn-outline" data-edit-admin="' + a.id + '">Edit</button> ' +
            (Number(a.id) !== currentAdminId ? '<button type="button" class="btn btn-danger" data-del-admin="' + a.id + '">Delete</button>' : '<span class="font-mono" style="font-size:0.72rem;color:var(--lasu-muted);margin-left:0.25rem;">Self</span>') +
            '</td>'
          : '') +
        '</tr>'
      )).join('');

      tbody.querySelectorAll('[data-edit-admin]').forEach((b) => {
        b.addEventListener('click', () => {
          const adm = adminsCache.find((x) => String(x.id) === b.getAttribute('data-edit-admin'));
          if (!adm || !adminCreateForm) return;
          document.getElementById('adminEditId').value = adm.id;
          document.getElementById('newAdminName').value = adm.full_name;
          document.getElementById('newAdminEmail').value = adm.email;
          document.getElementById('newAdminEmail').disabled = true;
          document.getElementById('newAdminPassword').value = '';
          document.getElementById('newAdminPassword').required = false;
          document.getElementById('newAdminPassLabel').textContent = 'New Password (leave blank to keep)';
          document.getElementById('newAdminRole').value = adm.role || 'editor';
          document.getElementById('newAdminActive').checked = Boolean(Number(adm.is_active));
          document.getElementById('newAdminActiveWrap').hidden = false;
          document.getElementById('adminFormTitle').textContent = 'Edit ' + adm.email;
          document.getElementById('newAdminSubmitBtn').textContent = 'Update Administrator';
          document.getElementById('newAdminCancelBtn').hidden = false;
        });
      });

      tbody.querySelectorAll('[data-del-admin]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_admins.php?id=' + b.getAttribute('data-del-admin'), { method: 'DELETE' });
            notify('success', 'Administrator removed.');
            loadAdmins();
            loadOverview();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });
    } catch (err) {
      notify('error', err.message);
    }
  }

  if (adminCreateForm) {
    adminCreateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('adminEditId').value;
      const password = document.getElementById('newAdminPassword').value;
      const payload = {
        id: id ? Number(id) : undefined,
        full_name: document.getElementById('newAdminName').value.trim(),
        email: document.getElementById('newAdminEmail').value.trim(),
        role: document.getElementById('newAdminRole').value,
        is_active: id ? document.getElementById('newAdminActive').checked : true,
      };
      if (password) {
        payload.password = password;
      }
      try {
        await api('/api/admin_admins.php', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        notify('success', id ? 'Administrator updated.' : 'Administrator created.');
        resetAdminForm();
        loadAdmins();
        loadOverview();
      } catch (err) {
        notify('error', err.message);
      }
    });
  }

  // Press Inquiries
  async function loadMessages() {
    try {
      const data = await api('/api/admin_messages.php');
      const msgs = data.messages || [];
      const container = document.getElementById('messagesContainer');
      if (!container) return;

      if (!msgs.length) {
        container.innerHTML = '<div style="padding:2rem;text-align:center;font-size:0.85rem;color:var(--lasu-muted);">No contact form submissions yet.</div>';
        return;
      }

      container.innerHTML = msgs.map((m) => (
        '<div style="padding:1.25rem;border-bottom:1px solid var(--lasu-border);display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">' +
        '  <div>' +
        '    <div style="font-size:0.85rem;"><strong>' + escapeHtml(m.subject) + '</strong> &middot; <span style="color:var(--lasu-navy);">' + (Number(m.is_read) ? 'Read' : 'Unread') + '</span></div>' +
        '    <div style="font-size:0.75rem;color:var(--lasu-muted);margin:0.25rem 0;">From ' + escapeHtml(m.sender_name) + ' (' + escapeHtml(m.sender_email) + ') &middot; ' + escapeHtml(m.created_at) + '</div>' +
        '    <p style="font-size:0.85rem;margin-top:0.5rem;">' + escapeHtml(m.message) + '</p>' +
        '  </div>' +
        '  <button type="button" class="btn btn-outline" data-toggle-msg="' + m.id + '" data-next-read="' + (Number(m.is_read) ? '0' : '1') + '">' +
        (Number(m.is_read) ? 'Mark Unread' : 'Mark Read') +
        '  </button>' +
        '</div>'
      )).join('');

      container.querySelectorAll('[data-toggle-msg]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api('/api/admin_messages.php', {
              method: 'PATCH',
              body: JSON.stringify({
                id: Number(b.getAttribute('data-toggle-msg')),
                is_read: Number(b.getAttribute('data-next-read')),
              }),
            });
            loadMessages();
            loadOverview();
          } catch (err) {
            notify('error', err.message);
          }
        });
      });
    } catch (err) {
      notify('error', err.message);
    }
  }

  // Initial load
  loadOverview();
  loadCategories();
})();
