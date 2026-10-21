/* Vora's blog and app share the same public catalog endpoint. No visitor data is sent. */
(() => {
  'use strict';
  const articleSlug = location.pathname.match(/^\/post\/([^/]+)\/?$/)?.[1];
  const root = document.querySelector('.rich-text');
  if (!articleSlug || !root) return;
  let running = false, lastAttempt = 0, renderedVersion = '';
  const disclosureText = 'Some links are affiliate links. VORA may earn a commission if you buy through them.';

  const element = (tag, content) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const safeUrl = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  };
  function card(product) {
    const href = safeUrl(product.shopUrl), imageUrl = safeUrl(product.image);
    if (!href || !imageUrl) return null;
    const figure = element('figure');
    figure.className = 'vora-article-product';
    figure.dataset.productId = product.id || '';
    figure.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:24px;padding:24px;margin:32px 0;border:1px solid #2c2c2c33;border-radius:12px;background:#fff;max-width:100%;';
    const link = () => {
      const a = element('a'); a.href = href; a.target = '_blank';
      a.rel = product.isAffiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer';
      a.style.textDecoration = 'none'; return a;
    };
    const imageLink = link();
    imageLink.style.cssText = 'display:block;flex:1 1 220px;min-width:0;';
    const image = element('img');
    image.src = imageUrl; image.alt = `${product.brand} ${product.name}`; image.loading = 'lazy';
    image.width = 600; image.height = 900;
    const ratio = ['2 / 3', '3 / 4', '4 / 5'].includes(product.imageAspectRatio) ? product.imageAspectRatio : '2 / 3';
    image.style.cssText = `display:block;width:100%;height:auto;max-height:none;aspect-ratio:${ratio};object-fit:cover;object-position:50% 50%;`;
    imageLink.append(image);
    const caption = element('figcaption');
    caption.style.cssText = 'flex:1 1 220px;min-width:0;width:auto;text-align:left;font-family:inherit;font-size:14px;font-weight:300;line-height:1.5;color:#1e1e1e;';
    const heading = element('p'); heading.className = 'heading_small';
    const title = link(); title.style.color = 'inherit'; title.append(element('strong', `${product.brand} ${product.name}`)); heading.append(title);
    const note = element('p', product.stylingNote);
    const cta = element('p'); cta.style.cssText = 'display:flex;justify-content:flex-start;margin-top:24px;';
    const shop = link(); shop.className = 'button-vora';
    const label = element('span', 'Shop this piece'); label.className = 'note-6'; shop.append(label); cta.append(shop);
    caption.append(heading, note, cta); figure.append(imageLink, caption);
    return figure;
  }
  function notice(message) {
    let node = root.querySelector('[data-vora-catalog-status]');
    if (!node) { node = element('p'); node.dataset.voraCatalogStatus = ''; node.setAttribute('role', 'status'); root.append(node); }
    node.textContent = message;
    return node;
  }
  function unavailable() {
    // Do not leave stale affiliate destinations clickable after a failed refresh.
    root.querySelectorAll('figure.vora-article-product a').forEach(a => { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); });
    const message = notice('Shopping picks are temporarily unavailable. ');
    const retry = element('button', 'Try again'); retry.type = 'button'; retry.className = 'button-vora';
    retry.addEventListener('click', () => { lastAttempt = 0; void refresh(); }); message.append(retry);
  }
  async function refresh() {
    if (running || document.visibilityState === 'hidden' || Date.now() - lastAttempt < 30_000) return;
    running = true; lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch('/app/api/catalog', { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Catalog unavailable');
      const catalog = await response.json();
      // Preserve the current published article until the private CMS token is configured.
      if (catalog.source === 'bundled') return;
      if (catalog.version !== 1 || catalog.source !== 'webflow' || !catalog.byArticleSlug || !Object.prototype.hasOwnProperty.call(catalog.byArticleSlug, articleSlug)) return;
      const picks = catalog.byArticleSlug[articleSlug];
      if (!Array.isArray(picks) || picks.length > 1000) throw new Error('Invalid catalog');
      const signature = JSON.stringify(picks);
      const hadError = Boolean(root.querySelector('[data-vora-catalog-status]'));
      if (signature === renderedVersion && !hadError) return;
      const cards = picks.map(card).filter(Boolean);
      const old = Array.from(root.querySelectorAll('figure.vora-article-product'));
      let anchor = root.querySelector('[data-vora-catalog-anchor]');
      if (!anchor) {
        anchor = element('div'); anchor.dataset.voraCatalogAnchor = '';
        if (old.length) old[0].before(anchor);
        else {
          const heading = Array.from(root.querySelectorAll('h2')).find(h => /essentials for your closet/i.test(h.textContent));
          if (heading) heading.after(anchor); else root.append(anchor);
        }
      }
      old.forEach(node => node.remove());
      root.querySelectorAll('[data-vora-catalog-status], [data-vora-affiliate-disclosure]').forEach(node => node.remove());
      if (picks.some(product => product.isAffiliate)) {
        const disclosure = element('p', disclosureText); disclosure.dataset.voraAffiliateDisclosure = '';
        disclosure.style.cssText = 'font-family:inherit;font-size:12px;line-height:1.6;color:inherit;opacity:.7;';
        anchor.before(disclosure);
      }
      anchor.replaceChildren(...cards);
      if (!cards.length) anchor.append(element('p', 'Fresh picks are on their way. Check back for our next edit.'));
      renderedVersion = signature;
    } catch { unavailable(); }
    finally { clearTimeout(timeout); running = false; }
  }
  void refresh();
  document.addEventListener('visibilitychange', () => void refresh());
  window.addEventListener('focus', () => void refresh());
  window.setInterval(() => void refresh(), 120_000);
})();
