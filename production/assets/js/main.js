/**
 * LASU Campus Broadcast - Public Portal Vanilla JavaScript
 */
(function () {
  const basePath = document.body.getAttribute('data-base-path') || '';

  function urlFor(path) {
    return basePath + path;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(str) {
    if (!str) return 'Unscheduled';
    const d = new Date(str.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return str;
    return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Mobile Menu Toggle
  const menuBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', function () {
      const isHidden = drawer.hasAttribute('hidden');
      if (isHidden) {
        drawer.removeAttribute('hidden');
        menuBtn.setAttribute('aria-expanded', 'true');
      } else {
        drawer.setAttribute('hidden', '');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Masthead Browse Desks Dropdown
  const browseBtn = document.getElementById('browseDesksBtn');
  const browseMenu = document.getElementById('browseDesksMenu');
  if (browseBtn && browseMenu) {
    browseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      browseMenu.hidden = !browseMenu.hidden;
    });
    document.addEventListener('click', function () {
      if (!browseMenu.hidden) browseMenu.hidden = true;
    });
  }

  // Breaking News Ticker Rotation
  const tickerItems = document.querySelectorAll('[data-ticker-item]');
  const tickerCounter = document.getElementById('tickerCounter');
  const tickerPrev = document.getElementById('tickerPrevBtn');
  const tickerNext = document.getElementById('tickerNextBtn');
  let tickerIdx = 0;

  function showTicker(idx) {
    if (tickerItems.length === 0) return;
    tickerIdx = (idx + tickerItems.length) % tickerItems.length;
    tickerItems.forEach(function (el, i) {
      el.hidden = i !== tickerIdx;
    });
    if (tickerCounter) {
      tickerCounter.textContent = (tickerIdx + 1) + '/' + tickerItems.length;
    }
  }

  if (tickerItems.length > 1) {
    if (tickerPrev) tickerPrev.addEventListener('click', function () { showTicker(tickerIdx - 1); });
    if (tickerNext) tickerNext.addEventListener('click', function () { showTicker(tickerIdx + 1); });
    setInterval(function () { showTicker(tickerIdx + 1); }, 6000);
  }

  // Homepage Live Category Tab Filtering
  const tabButtons = document.querySelectorAll('[data-category-tab]');
  const latestContainer = document.getElementById('latestBroadcastsContainer');
  if (tabButtons.length > 0 && latestContainer) {
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const slug = btn.getAttribute('data-category-tab') || 'all';
        const color = btn.getAttribute('data-category-color') || '#0B2545';

        tabButtons.forEach(function (b) {
          b.classList.remove('is-active');
          b.style.backgroundColor = '';
          b.style.borderColor = '';
          b.style.color = '';
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.style.backgroundColor = color;
        btn.style.borderColor = color;
        btn.style.color = '#FFFFFF';
        btn.setAttribute('aria-selected', 'true');

        latestContainer.innerHTML = '<div class="empty-box"><p>Loading campus broadcasts...</p></div>';
        try {
          const res = await fetch(urlFor('/api/public_news.php?category=' + encodeURIComponent(slug) + '&limit=8'));
          const data = await res.json();
          const articles = data.articles || [];
          if (articles.length === 0) {
            latestContainer.innerHTML =
              '<div class="empty-box">' +
              '<h3>No published articles in this category yet</h3>' +
              '<p>Select another category tab or visit the News Archive once editors publish under this desk.</p>' +
              '</div>';
            return;
          }

          const rows = articles.map(function (art) {
            const articleHref = urlFor('/article.php?slug=' + encodeURIComponent(art.slug));
            const imgSrc = art.featured_image
              ? (/^(https?:)?\/\//i.test(art.featured_image) || (basePath && art.featured_image.indexOf(basePath + '/') === 0)
                  ? art.featured_image
                  : urlFor(art.featured_image))
              : '';
            const mediaHtml = imgSrc
              ? '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(art.title) + '">'
              : '<div class="media-fallback">' + escapeHtml(art.category_name) + '</div>';
            const catColor = art.category_color || '#0B2545';

            return (
              '<article class="story-row">' +
              '  <a href="' + articleHref + '" class="media-4x3" style="border:1px solid var(--lasu-border-soft);">' +
              mediaHtml +
              '  </a>' +
              '  <div>' +
              '    <div class="meta-line">' +
              '      <span class="meta-cat" style="color:' + escapeHtml(catColor) + ';">' + escapeHtml(art.category_name) + '</span>' +
              '      <span>&middot;</span>' +
              '      <span>' + escapeHtml(formatDate(art.published_at || art.created_at)) + '</span>' +
              '    </div>' +
              '    <h3 class="card-title" style="margin:0.4rem 0;"><a href="' + articleHref + '">' + escapeHtml(art.title) + '</a></h3>' +
              '    <p class="card-excerpt">' + escapeHtml(art.excerpt) + '</p>' +
              '    <div class="card-footer" style="border-top:none;padding-top:0.5rem;">' +
              '      <span>By ' + escapeHtml(art.author_name) + '</span>' +
              '      <a href="' + articleHref + '" class="text-link">Read Story &rarr;</a>' +
              '    </div>' +
              '  </div>' +
              '</article>'
            );
          }).join('');

          latestContainer.innerHTML = '<div class="story-list">' + rows + '</div>';
        } catch (_err) {
          latestContainer.innerHTML = '<div class="empty-box"><p>Unable to load category stories right now.</p></div>';
        }
      });
    });
  }

  // Contact Press Desk Form
  const contactForm = document.getElementById('contactForm');
  const contactAlert = document.getElementById('contactFeedback');
  if (contactForm && contactAlert) {
    contactForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      contactAlert.hidden = true;
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        sender_name: contactForm.sender_name.value.trim(),
        sender_email: contactForm.sender_email.value.trim(),
        subject: contactForm.subject.value.trim(),
        message: contactForm.message.value.trim(),
      };

      try {
        const res = await fetch(urlFor('/api/contact.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submission failed.');
        contactAlert.className = 'alert alert-success';
        contactAlert.textContent = data.message || 'Message submitted.';
        contactAlert.hidden = false;
        contactForm.reset();
      } catch (err) {
        contactAlert.className = 'alert alert-error';
        contactAlert.textContent = err.message || 'Unable to submit inquiry.';
        contactAlert.hidden = false;
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Article Comment Submission Form
  const commentForm = document.getElementById('commentForm');
  const commentAlert = document.getElementById('commentFeedback');
  if (commentForm && commentAlert) {
    commentForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      commentAlert.hidden = true;
      const submitBtn = commentForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        slug: commentForm.getAttribute('data-article-slug'),
        author_name: commentForm.author_name ? commentForm.author_name.value.trim() : '',
        author_email: commentForm.author_email ? commentForm.author_email.value.trim() : '',
        content: commentForm.content.value.trim(),
      };

      try {
        const res = await fetch(urlFor('/api/comments.php'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to post comment.');
        commentAlert.className = 'alert alert-success';
        commentAlert.textContent = data.message || 'Comment submitted.';
        commentAlert.hidden = false;
        commentForm.content.value = '';
        if (data.status === 'approved') {
          window.location.reload();
        }
      } catch (err) {
        commentAlert.className = 'alert alert-error';
        commentAlert.textContent = err.message || 'Unable to post comment.';
        commentAlert.hidden = false;
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Copy Link Share Button on Article Page
  const copyBtn = document.getElementById('copyArticleLinkBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(window.location.href);
        copyBtn.textContent = 'Link Copied';
        setTimeout(function () {
          copyBtn.textContent = 'Copy Link';
        }, 2400);
      } catch (_err) {
        // Fallback ignored if clipboard blocked
      }
    });
  }
})();
