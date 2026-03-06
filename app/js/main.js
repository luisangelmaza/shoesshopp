/**
 * ============================================================
 * SHOESSHOP - Lógica principal
 * Secciones: estado, filtros, listado, panel de detalle, UI dinámica
 * ============================================================
 */

(function () {
  'use strict';

  // --- Estado global (dinámico) ---
  let currentCategory = 'todos';
  let filters = {
    collection: new Set(),
    color: new Set(),
    size: new Set(),
    priceMin: null,
    priceMax: null,
  };
  let sortBy = 'release';
  let searchQuery = '';
  /** Carrito: array de { id, qty } */
  let cart = [];
  /** Favoritos: Set de product id */
  let favorites = new Set();

  // --- Referencias DOM ---
  const productsGrid = document.getElementById('products-grid');
  const productsCountEl = document.getElementById('products-count');
  const sortSelect = document.getElementById('sort-select');
  const detailPanel = document.getElementById('detail-panel');
  const detailPanelContent = document.getElementById('detail-panel-content');
  const detailPanelClose = document.getElementById('detail-panel-close');
  const contentWrap = document.getElementById('content-wrap');
  const mainContainer = document.querySelector('.main-container');
  const heroTitle = document.getElementById('hero-title');
  const cartCountEl = document.getElementById('cart-count');
  const searchWrap = document.getElementById('search-wrap');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const wishlistBtn = document.getElementById('wishlist-btn');

  function getProducts() {
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  /**
   * Obtiene opciones únicas para filtros desde PRODUCTS (data.js)
   */
  function getFilterOptions() {
    const collections = new Set();
    const colors = new Set();
    const sizes = new Set();
    getProducts().forEach((p) => {
      if (p.collection) collections.add(p.collection);
      if (p.color) colors.add(p.color);
      if (p.sizes) p.sizes.forEach((s) => sizes.add(s));
    });
    return {
      collections: [...collections].sort(),
      colors: [...colors].sort(),
      sizes: [...sizes].sort((a, b) => a - b),
    };
  }

  /**
   * Renderiza la barra lateral de filtros (colección, color, talla)
   */
  function renderFilters() {
    const opts = getFilterOptions();

    const collectionContainer = document.getElementById('filter-collection');
    collectionContainer.innerHTML = opts.collections
      .map(
        (c) =>
          `<label><input type="checkbox" data-filter="collection" value="${c}"> ${c}</label>`
      )
      .join('');

    const colorContainer = document.getElementById('filter-color');
    colorContainer.innerHTML = opts.colors
      .map(
        (c) =>
          `<label><input type="checkbox" data-filter="color" value="${c}"> ${c}</label>`
      )
      .join('');

    const sizeContainer = document.getElementById('filter-size');
    sizeContainer.innerHTML = opts.sizes
      .map(
        (s) =>
          `<label><input type="checkbox" data-filter="size" value="${s}"> ${s}</label>`
      )
      .join('');
  }

  /**
   * Enlaza una sola vez los eventos de filtros (delegación en .sidebar)
   */
  function bindFilterEvents() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar._filterBound) return;
    sidebar._filterBound = true;

    sidebar.addEventListener('change', (e) => {
      const el = e.target;
      if (el.type === 'checkbox' && el.dataset.filter) {
        const key = el.dataset.filter;
        const set = filters[key];
        if (set) {
          if (el.checked) set.add(el.value);
          else set.delete(el.value);
        }
        renderProducts();
      }
    });

    document.getElementById('price-min').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      filters.priceMin = isNaN(v) ? null : v;
      renderProducts();
    });
    document.getElementById('price-max').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      filters.priceMax = isNaN(v) ? null : v;
      renderProducts();
    });
  }

  /**
   * Filtra y ordena productos según estado actual (categoría, filtros, búsqueda)
   */
  function getFilteredProducts() {
    const q = (searchQuery || '').trim().toLowerCase();
    let list = getProducts().filter((p) => {
      if (currentCategory === 'rebajas') {
        if (!p.onSale) return false;
      } else if (currentCategory === 'limpieza') {
        if (p.type !== 'limpieza') return false;
      } else if (currentCategory !== 'todos') {
        if (p.category !== currentCategory) return false;
      }
      if (filters.collection.size && !filters.collection.has(p.collection)) return false;
      if (filters.color.size && (!p.color || !filters.color.has(p.color))) return false;
      if (filters.size.size && (!p.sizes || !p.sizes.some((s) => filters.size.has(String(s))))) return false;
      if (filters.priceMin != null && p.price < filters.priceMin) return false;
      if (filters.priceMax != null && p.price > filters.priceMax) return false;
      if (q) {
        const text = [p.name, p.description, p.collection, p.category, p.color].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }

  function getCartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function updateCartCountUI() {
    if (cartCountEl) cartCountEl.textContent = getCartCount();
  }

  function addToCart(productId) {
    const item = cart.find((i) => i.id === productId);
    if (item) item.qty += 1;
    else cart.push({ id: productId, qty: 1 });
    updateCartCountUI();
    renderCartDropdown();
  }

  function isFavorite(productId) {
    return favorites.has(productId);
  }

  function toggleFavorite(productId) {
    if (favorites.has(productId)) favorites.delete(productId);
    else favorites.add(productId);
    updateWishlistUI();
    renderProducts();
  }

  function updateWishlistUI() {
    if (wishlistBtn) wishlistBtn.classList.toggle('has-favorites', favorites.size > 0);
    renderFavoritesDropdown();
  }

  function renderCartDropdown() {
    const listEl = document.getElementById('cart-dropdown-list');
    const emptyEl = document.getElementById('cart-dropdown-empty');
    if (!listEl || !emptyEl) return;
    if (cart.length === 0) {
      listEl.innerHTML = '';
      listEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = cart
      .map((item) => {
        const p = getProducts().find((x) => x.id === item.id);
        if (!p) return '';
        return `
          <div class="nav-dropdown__item nav-dropdown__item--cart" data-product-id="${p.id}">
            <div class="nav-dropdown__item-info">
              <span class="nav-dropdown__item-name">${p.name}</span>
              <span class="nav-dropdown__item-meta">${item.qty} × ${formatPrice(p.price)}</span>
            </div>
            <button type="button" class="nav-dropdown__item-remove" data-product-id="${p.id}" aria-label="Quitar del carrito">×</button>
          </div>
        `;
      })
      .join('');
    listEl.querySelectorAll('.nav-dropdown__item-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromCart(Number(btn.dataset.productId));
      });
    });
    listEl.querySelectorAll('.nav-dropdown__item--cart').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.nav-dropdown__item-remove')) return;
        openDetail(Number(row.dataset.productId));
      });
    });
  }

  function removeFromCart(productId) {
    cart = cart.filter((i) => i.id !== productId);
    updateCartCountUI();
    renderCartDropdown();
  }

  function renderFavoritesDropdown() {
    const listEl = document.getElementById('favorites-dropdown-list');
    const emptyEl = document.getElementById('favorites-dropdown-empty');
    if (!listEl || !emptyEl) return;
    const list = [...favorites].map((id) => getProducts().find((p) => p.id === id)).filter(Boolean);
    if (list.length === 0) {
      listEl.innerHTML = '';
      listEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = list
      .map(
        (p) => `
        <div class="nav-dropdown__item nav-dropdown__item--favorite" data-product-id="${p.id}">
          <span class="nav-dropdown__item-name">${p.name}</span>
          <span class="nav-dropdown__item-price">${formatPrice(p.price)}</span>
          <button type="button" class="nav-dropdown__item-remove" data-product-id="${p.id}" aria-label="Quitar de favoritos">×</button>
        </div>
      `
      )
      .join('');
    listEl.querySelectorAll('.nav-dropdown__item-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(Number(btn.dataset.productId));
      });
    });
    listEl.querySelectorAll('.nav-dropdown__item--favorite').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.nav-dropdown__item-remove')) return;
        closeNavDropdowns();
        openDetail(Number(row.dataset.productId));
      });
    });
  }

  /** Iconos SVG minimalistas para placeholders de producto */
  const ICON_SHOE =
    '<svg class="placeholder-icon" viewBox="0 0 64 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 28V14l4-6h8l2 4 6 2 4 4v10H8z"/><path d="M12 8 10 4h12l-2 4"/></svg>';
  const ICON_CLEANING =
    '<svg class="placeholder-icon" viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4h8v6h-8z"/><path d="M10 10h12v34a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V10z"/><path d="M16 20v16"/><path d="M12 28h8"/></svg>';

  /**
   * Formatea precio para mostrar
   */
  function formatPrice(price) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(price);
  }

  /**
   * Renderiza la cuadrícula de productos (área dinámica)
   */
  function renderProducts() {
    const list = getFilteredProducts();
    productsCountEl.textContent = list.length + ' PRODUCTOS';

    productsGrid.innerHTML = list
      .map(
        (p) => `
        <article class="product-card ${p.onSale ? 'product-card--sale' : ''}" data-product-id="${p.id}" role="button" tabindex="0">
          ${p.onSale ? '<span class="product-card__sale-badge">REBAJA</span>' : ''}
          ${p.image
            ? `<img class="product-card__image" src="${p.image}" alt="${p.name}">`
            : `<div class="product-card__image product-card__image--placeholder">${p.type === 'limpieza' ? ICON_CLEANING : ICON_SHOE}</div>`
          }
          <button type="button" class="product-card__wishlist ${isFavorite(p.id) ? 'is-favorite' : ''}" data-product-id="${p.id}" aria-label="${isFavorite(p.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${getHeartSVG(isFavorite(p.id))}</button>
          <div class="product-card__info">
            <h3 class="product-card__name">${p.name}</h3>
            <p class="product-card__price ${p.onSale ? 'product-card__price--sale' : ''}">${formatPrice(p.price)}</p>
          </div>
        </article>
      `
      )
      .join('');

    productsGrid.querySelectorAll('.product-card').forEach((card) => {
      const id = Number(card.dataset.productId);
      card.addEventListener('click', (e) => {
        if (e.target.closest('.product-card__wishlist')) return;
        openDetail(id);
      });
      card.addEventListener('keydown', (e) => {
        if (e.target.closest('.product-card__wishlist')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail(id);
        }
      });
      const wishBtn = card.querySelector('.product-card__wishlist');
      if (wishBtn) wishBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(id); });
    });
  }

  function getHeartSVG(filled) {
    if (filled) return '<svg class="product-card__heart-icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
    return '<svg class="product-card__heart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  }

  /**
   * Abre el panel de detalle a la derecha (50% de la pantalla)
   */
  function openDetail(productId) {
    const product = getProducts().find((p) => p.id === productId);
    if (!product) return;

    const inFav = isFavorite(product.id);
    detailPanelContent.innerHTML = `
      <div class="detail-panel__image-wrap">
        ${product.image
        ? `<img class="detail-panel__image" src="${product.image}" alt="${product.name}" style="width:100%;height:auto;display:block;">`
        : `<div class="detail-panel__image detail-panel__image--placeholder product-card__image--placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${product.type === 'limpieza' ? ICON_CLEANING : ICON_SHOE}</div>`
      }
      </div>
      <h2 class="detail-panel__title">${product.name}</h2>
      <p class="detail-panel__category">${product.collection || product.category}</p>
      <p class="detail-panel__price">${formatPrice(product.price)}</p>
      <p class="detail-panel__description">${product.description}</p>
      <div class="detail-panel__actions">
        <button type="button" class="detail-panel__btn-cart" data-product-id="${product.id}">Añadir al carrito</button>
        <button type="button" class="detail-panel__btn-wishlist ${inFav ? 'is-favorite' : ''}" data-product-id="${product.id}">${inFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}</button>
      </div>
    `;

    detailPanel.setAttribute('aria-hidden', 'false');
    detailPanel.classList.add('is-open');
    mainContainer.classList.add('panel-open');

    const btnCart = detailPanelContent.querySelector('.detail-panel__btn-cart');
    const btnWish = detailPanelContent.querySelector('.detail-panel__btn-wishlist');
    if (btnCart) btnCart.addEventListener('click', () => { addToCart(product.id); });
    if (btnWish) btnWish.addEventListener('click', () => {
      toggleFavorite(product.id);
      openDetail(product.id);
    });

    detailPanelClose.focus();
  }

  /**
   * Cierra el panel de detalle
   */
  function closeDetail() {
    detailPanel.setAttribute('aria-hidden', 'true');
    detailPanel.classList.remove('is-open');
    mainContainer.classList.remove('panel-open');
  }

  detailPanelClose.addEventListener('click', closeDetail);

  /**
   * Actualiza contenido dinámico: hero y breadcrumbs según categoría
   */
  function updateDynamicUI() {
    const titles = {
      todos: 'TODOS LOS PRODUCTOS',
      hombre: 'ZAPATOS DE HOMBRE: COMODIDAD Y ESTILO',
      mujer: 'ZAPATOS DE MUJER: ESTILO Y CONFORT',
      unisex: 'ZAPATOS UNISEX: PARA TODOS',
      limpieza: 'CUIDADO Y LIMPIEZA PARA TU CALZADO',
      rebajas: 'REBAJAS',
    };
    if (heroTitle) heroTitle.textContent = titles[currentCategory] || titles.hombre;
  }

  function setCategory(cat) {
    currentCategory = cat || 'hombre';
    filters.collection.clear();
    filters.color.clear();
    filters.size.clear();
    filters.priceMin = null;
    filters.priceMax = null;
    const priceMinEl = document.getElementById('price-min');
    const priceMaxEl = document.getElementById('price-max');
    if (priceMinEl) priceMinEl.value = '';
    if (priceMaxEl) priceMaxEl.value = '';
    updateDynamicUI();
    renderFilters();
    renderProducts();
    closeCategoriesPanel();
  }

  /**
   * Navegación por categoría (enlaces del nav y panel móvil)
   */
  function bindCategoryLinks() {
    const handler = (e, link) => {
      e.preventDefault();
      setCategory(link.dataset.category);
    };
    document.querySelectorAll('.main-nav__links [data-category]').forEach((link) => {
      link.addEventListener('click', (e) => handler(e, link));
    });
    const panel = document.getElementById('categories-panel');
    if (panel) {
      panel.querySelectorAll('a[data-category]').forEach((link) => {
        link.addEventListener('click', (e) => handler(e, link));
      });
    }
  }

  const categoriesPanel = document.getElementById('categories-panel');
  const categoriesTrigger = document.getElementById('categories-trigger');

  function openCategoriesPanel() {
    if (categoriesPanel) {
      categoriesPanel.classList.add('is-open');
      categoriesPanel.setAttribute('aria-hidden', 'false');
    }
    if (categoriesTrigger) categoriesTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeCategoriesPanel() {
    if (categoriesPanel) {
      categoriesPanel.classList.remove('is-open');
      categoriesPanel.setAttribute('aria-hidden', 'true');
    }
    if (categoriesTrigger) categoriesTrigger.setAttribute('aria-expanded', 'false');
  }

  function toggleCategoriesPanel() {
    const isOpen = categoriesPanel && categoriesPanel.classList.contains('is-open');
    if (isOpen) closeCategoriesPanel();
    else openCategoriesPanel();
  }

  if (categoriesTrigger) {
    categoriesTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      toggleCategoriesPanel();
    });
  }

  function closeNavDropdowns() {
    const cartDrop = document.getElementById('cart-dropdown');
    const favDrop = document.getElementById('favorites-dropdown');
    if (cartDrop) { cartDrop.classList.remove('is-open'); cartDrop.setAttribute('aria-hidden', 'true'); }
    if (favDrop) { favDrop.classList.remove('is-open'); favDrop.setAttribute('aria-hidden', 'true'); }
    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) cartBtn.setAttribute('aria-expanded', 'false');
    if (wishlistBtn) wishlistBtn.setAttribute('aria-expanded', 'false');
  }

  function openCartDropdown() {
    closeNavDropdowns();
    closeCategoriesPanel();
    const el = document.getElementById('cart-dropdown');
    if (el) {
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
    }
    const btn = document.getElementById('cart-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function openFavoritesDropdown() {
    closeNavDropdowns();
    closeCategoriesPanel();
    const el = document.getElementById('favorites-dropdown');
    if (el) {
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
    }
    if (wishlistBtn) wishlistBtn.setAttribute('aria-expanded', 'true');
  }

  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const drop = document.getElementById('favorites-dropdown');
      const isOpen = drop && drop.classList.contains('is-open');
      if (isOpen) closeNavDropdowns();
      else openFavoritesDropdown();
    });
  }

  const cartBtn = document.getElementById('cart-btn');
  if (cartBtn) {
    cartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const drop = document.getElementById('cart-dropdown');
      const isOpen = drop && drop.classList.contains('is-open');
      if (isOpen) closeNavDropdowns();
      else openCartDropdown();
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-dropdown') || e.target.closest('.main-nav__cart') || e.target.closest('.main-nav__wishlist') || e.target.closest('#cart-btn') || e.target.closest('#wishlist-btn')) return;
    closeNavDropdowns();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.categories-panel') || e.target.closest('#categories-trigger')) return;
    closeCategoriesPanel();
  });

  // --- Ordenación ---
  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    renderProducts();
  });

  // --- Búsqueda (lupa funcional) ---
  const mainNav = document.querySelector('.main-nav');

  function closeSearch() {
    if (!searchWrap) return;
    searchWrap.classList.remove('is-open');
    if (searchInput) searchInput.blur();
    if (mainNav) mainNav.classList.remove('main-nav--search-open');
  }

  function openSearch() {
    if (!searchWrap) return;
    searchWrap.classList.add('is-open');
    if (mainNav) mainNav.classList.add('main-nav--search-open');
    if (searchInput) searchInput.focus();
  }

  if (searchBtn && searchWrap && searchInput) {
    searchBtn.addEventListener('click', () => {
      const isOpen = searchWrap.classList.contains('is-open');
      if (isOpen) closeSearch();
      else openSearch();
    });
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      renderProducts();
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSearch();
      }
    });
    // Cerrar búsqueda al hacer scroll (solo si está abierta)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      if (!searchWrap || !searchWrap.classList.contains('is-open')) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(closeSearch, 80);
    }, { passive: true });
  }

  /**
   * En móvil: secciones del sidebar clicables (acordeón)
   */
  function bindSidebarAccordion() {
    document.querySelectorAll('.sidebar__heading').forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.sidebar__section');
        if (section) section.classList.toggle('is-open');
      });
    });
  }

  /**
   * Maneja el Custom Select de "Ordenar por" (estilo iOS)
   */
  function bindCustomSelect() {
    const customSort = document.getElementById('custom-sort');
    const customTrigger = document.getElementById('custom-sort-trigger');
    const customOptions = document.querySelectorAll('.custom-select__option');
    const nativeSelect = document.getElementById('sort-select');

    if (!customSort || !customTrigger) return;

    // Toggle dropdown
    customTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      customSort.classList.toggle('is-open');
    });

    // Handle option click
    customOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = option.dataset.value;
        const text = option.textContent;

        // Update trigger text
        customTrigger.querySelector('span').textContent = text;

        // Update selected class
        customOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        // Update global sort state and re-render
        if (nativeSelect) nativeSelect.value = value;
        sortBy = value;
        renderProducts();

        // Close dropdown
        customSort.classList.remove('is-open');
      });
    });

    // Close on outside click
    window.addEventListener('click', () => {
      customSort.classList.remove('is-open');
    });
  }

  /**
   * Enlaza los enlaces de categorías del footer
   */
  function bindFooterCategoryLinks() {
    document.querySelectorAll('.footer__links [data-category]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        setCategory(link.dataset.category);
        // Scroll suave hacia arriba
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /**
   * Maneja el formulario de newsletter
   */
  function bindNewsletterForm() {
    const form = document.getElementById('newsletter-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('.footer__input');
        const email = input.value.trim();
        if (email) {
          // Aquí puedes agregar la lógica para enviar el email
          alert(`¡Gracias por suscribirte! Te enviaremos ofertas exclusivas a ${email}`);
          input.value = '';
        }
      });
    }
  }

  // --- Inicialización ---
  renderFilters();
  bindFilterEvents();
  bindSidebarAccordion();
  renderProducts();
  updateDynamicUI();
  bindCategoryLinks();
  bindFooterCategoryLinks();
  bindNewsletterForm();
  updateCartCountUI();
  updateWishlistUI();
  renderCartDropdown();
  bindCustomSelect();

  // --- Carrusel de videos en el Hero (transición con oscurecimiento) ---
  function initVideoCarousel() {
    const videos = document.querySelectorAll('.hero__video');
    const overlay = document.querySelector('.hero__overlay');
    if (videos.length === 0 || !overlay) return;

    let currentVideoIndex = 0;
    let isTransitioning = false;

    // Configurar el primer video
    videos[0].classList.add('hero__video--active');

    // Función para cambiar al siguiente video con efecto de desvanecimiento
    function nextVideo() {
      if (isTransitioning) return;

      const nextIndex = (currentVideoIndex + 1) % videos.length;
      const nextVid = videos[nextIndex];

      // Asegurarse de que el siguiente video esté cargado o empezando a cargar
      if (nextVid.readyState < 3) {
        nextVid.load();
      }

      isTransitioning = true;

      // Fase 1: Oscurecer el overlay
      overlay.classList.add('hero__overlay--dark');

      // Fase 2: Después de que el overlay se oscurece, cambiar el video
      setTimeout(() => {
        // Pausar el video actual
        videos[currentVideoIndex].pause();
        videos[currentVideoIndex].classList.remove('hero__video--active');

        // Avanzar al siguiente video
        currentVideoIndex = nextIndex;

        // Reproducir el nuevo video
        nextVid.classList.add('hero__video--active');
        const playPromise = nextVid.play();

        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('Video play interrupted or failed:', err);
            // Reintentar si falló por interacción
            if (err.name === 'NotAllowedError') {
              console.log('Reintentando reproducción de video...');
            }
          });
        }

        // Pequeña pausa para que el video entrante empiece a aparecer
        setTimeout(() => {
          // Fase 3: Quitar la oscuridad del overlay
          overlay.classList.remove('hero__overlay--dark');
          isTransitioning = false;
        }, 300);
      }, 800); // Reducido un poco para que sea más fluido
    }

    // Cambiar video cada 8 segundos (más tiempo para apreciar 4K si carga)
    setInterval(nextVideo, 8000);
  }

  // Iniciar carrusel cuando el DOM esté listo
  initVideoCarousel();

  document.addEventListener('products-updated', () => {
    renderFilters();
    renderProducts();
    updateDynamicUI();
    updateCartCountUI();
    updateWishlistUI();
    renderCartDropdown();
  });

  window.renderProducts = renderProducts;
})();
