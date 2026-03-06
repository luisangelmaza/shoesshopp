/**
 * ============================================================
 * SISTEMA DE ADMINISTRACIÓN - SoleCare
 * Gestión de productos, categorías e inventario
 * ============================================================
 */

(function () {
  'use strict';

  // Contraseña de administrador (en producción debería estar en el servidor)
  const ADMIN_PASSWORD = 'admin123';
  const ENV = (import.meta && import.meta.env) ? import.meta.env : {};

  // Estado del admin
  let isAdminLoggedIn = false;
  let editingProductId = null;

  // Referencias DOM
  const adminBtn = document.getElementById('admin-btn');
  const adminModal = document.getElementById('admin-modal');
  const adminModalClose = document.getElementById('admin-modal-close');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminPasswordInput = document.getElementById('admin-password');
  const adminError = document.getElementById('admin-error');
  const adminPanel = document.getElementById('admin-panel');
  const adminPanelClose = document.getElementById('admin-panel-close');
  const adminTabs = document.querySelectorAll('.admin-panel__tab');
  const tabContents = document.querySelectorAll('.admin-panel__tab-content');

  // Formularios
  const productForm = document.getElementById('product-form');
  const categoryForm = document.getElementById('category-form');
  const inventorySearch = document.getElementById('inventory-search');
  const inventoryFilterSale = document.getElementById('inventory-filter-sale');



  /**
   * Abre el modal de login
   */
  function openLoginModal() {
    adminModal.setAttribute('aria-hidden', 'false');
    adminPasswordInput.focus();
  }

  /**
   * Cierra el modal de login
   */
  function closeLoginModal() {
    adminModal.setAttribute('aria-hidden', 'true');
    adminPasswordInput.value = '';
    adminError.classList.remove('show');
    adminError.textContent = '';
  }

  /**
   * Abre el panel de administración
   */
  function openAdminPanel() {
    adminPanel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    loadCategories();
    loadInventory();
  }

  /**
   * Cierra el panel de administración
   */
  function closeAdminPanel() {
    adminPanel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    editingProductId = null;
    resetProductForm();
  }

  /**
   * Maneja el login
   */
  function handleLogin(e) {
    e.preventDefault();
    const password = adminPasswordInput.value.trim();

    if (password === ADMIN_PASSWORD) {
      isAdminLoggedIn = true;
      closeLoginModal();
      openAdminPanel();
    } else {
      adminError.textContent = 'Contraseña incorrecta';
      adminError.classList.add('show');
      adminPasswordInput.value = '';
      adminPasswordInput.focus();
    }
  }

  /**
   * Cambia de tab
   */
  function switchTab(tabName) {
    adminTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    tabContents.forEach(content => {
      if (content.id === `tab-${tabName}`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  /**
   * Carga las categorías en el select y en la lista
   */
  async function loadCategories() {
    const categorySelect = document.getElementById('product-category');
    const categoriesList = document.getElementById('categories-list');
    let names = [];
    if (window.supabase) {
      const { data, error } = await window.supabase.from('categories').select('name').order('name');
      if (error) {
        alert('Error cargando categorías: ' + error.message);
      } else if (Array.isArray(data)) {
        names = data.map(x => x.name).filter(Boolean);
      }
    }

    categorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
    names.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      categorySelect.appendChild(option);
    });
    categoriesList.innerHTML = '';
    names.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'admin-category-card';
      card.innerHTML = `
        <p class="admin-category-card__name">${cat.charAt(0).toUpperCase() + cat.slice(1)}</p>
        <button type="button" class="admin-category-card__delete" data-category="${cat}" aria-label="Eliminar categoría">×</button>
      `;
      categoriesList.appendChild(card);
    });
    document.querySelectorAll('.admin-category-card__delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const category = btn.dataset.category;
        if (!confirm(`¿Estás seguro de eliminar la categoría "${category}"? Esto no eliminará los productos, solo la categoría de la lista.`)) return;
        if (window.supabase) {
          const { error } = await window.supabase.from('categories').delete().eq('name', category);
          if (error) alert('Error eliminando la categoría');
        }
        loadCategories();
      });
    });
  }

  /**
   * Agrega una nueva categoría
   */
  async function handleAddCategory(e) {
    e.preventDefault();
    const categoryInput = document.getElementById('category-name');
    const categoryName = categoryInput.value.trim().toLowerCase();

    if (categoryName) {
      if (window.supabase) {
        const { error } = await window.supabase.from('categories').insert([{ name: categoryName }]).select('id');
        if (error) {
          alert('Error agregando la categoría: ' + error.message);
        } else {
          alert(`Categoría "${categoryName}" agregada`);
        }
      }
      categoryInput.value = '';
      loadCategories();
    }
  }

  /**
   * Agrega o edita un producto
   */
  async function handleProductSubmit(e) {
    e.preventDefault();

    const product = {
      name: document.getElementById('product-name').value.trim(),
      category: document.getElementById('product-category').value.trim(),
      collection: document.getElementById('product-collection').value.trim() || null,
      price: parseInt(document.getElementById('product-price').value, 10),
      color: document.getElementById('product-color').value.trim() || null,
      sizes: document.getElementById('product-sizes').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s)
        .map(s => isNaN(s) ? s : parseInt(s)) || null,
      description: document.getElementById('product-description').value.trim(),
      image: document.getElementById('product-image').value.trim() || null,
      type: document.getElementById('product-type').value,
      onSale: document.getElementById('product-on-sale').checked,
    };

    if (!product.name || !product.category || !product.price || !product.description) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const fileEl = document.getElementById('product-image-file');
      const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
      const bucket = ENV.VITE_SUPABASE_BUCKET || 'product-images';
      let uploadedUrl = null;

      if (file) {
        if (window.supabase) {
          const path = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
          const { error: upErr } = await window.supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
          if (upErr) {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
              reader.readAsDataURL(file);
            });
            uploadedUrl = dataUrl;
          } else {
            const { data: pub } = window.supabase.storage.from(bucket).getPublicUrl(path);
            uploadedUrl = pub.publicUrl;
          }
        }
      }

      if (uploadedUrl) {
        product.image = uploadedUrl;
      }

      if (window.supabase) {
        const client = window.supabase;
        if (editingProductId) {
          const { error } = await client.from('products').update(product).eq('id', editingProductId);
          if (error) throw new Error(error.message || 'Error actualizando producto');
        } else {
          const { error } = await client.from('products').insert([product]).select();
          if (error) throw new Error(error.message || 'Error agregando producto');
        }
      }

      alert(editingProductId ? 'Producto actualizado correctamente' : 'Producto agregado correctamente');
      resetProductForm();
      if (typeof window.refreshProducts === 'function') window.refreshProducts();
      loadInventory();
    } catch (err) {
      alert('Error guardando producto: ' + (err && err.message ? err.message : err));
    }
  }

  /**
   * Resetea el formulario de producto
   */
  function resetProductForm() {
    productForm.reset();
    editingProductId = null;
    const submitBtn = productForm.querySelector('.admin-form__submit');
    if (submitBtn) {
      submitBtn.textContent = 'Agregar Producto';
    }
  }

  /**
   * Carga el inventario
   */
  function loadInventory() {
    const inventoryList = document.getElementById('inventory-list');
    const searchTerm = inventorySearch.value.toLowerCase();
    const onlySale = inventoryFilterSale.checked;

    let filteredProducts = window.PRODUCTS || [];

    if (searchTerm) {
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        (p.description && p.description.toLowerCase().includes(searchTerm))
      );
    }

    if (onlySale) {
      filteredProducts = filteredProducts.filter(p => p.onSale);
    }

    inventoryList.innerHTML = '';

    if (filteredProducts.length === 0) {
      inventoryList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">No se encontraron productos</p>';
      return;
    }

    filteredProducts.forEach(product => {
      const card = document.createElement('div');
      card.className = 'admin-product-card';
      card.innerHTML = `
        <div class="admin-product-card__header">
          <h4 class="admin-product-card__name">${product.name}</h4>
          ${product.onSale ? '<span class="admin-product-card__badge">EN REBAJA</span>' : ''}
        </div>
        <div class="admin-product-card__info">
          <p><strong>Categoría:</strong> ${product.category || 'N/A'}</p>
          <p><strong>Colección:</strong> ${product.collection || 'N/A'}</p>
          <p><strong>Color:</strong> ${product.color || 'N/A'}</p>
          <p><strong>Tallas:</strong> ${product.sizes ? product.sizes.join(', ') : 'N/A'}</p>
          <p class="admin-product-card__price">${formatPrice(product.price)}</p>
          <p><strong>Descripción:</strong> ${product.description || 'Sin descripción'}</p>
        </div>
        <div class="admin-product-card__actions">
          <button type="button" class="admin-product-card__btn admin-product-card__btn--edit" data-product-id="${product.id}">
            Editar
          </button>
          <button type="button" class="admin-product-card__btn admin-product-card__btn--sale ${product.onSale ? 'active' : ''}" data-product-id="${product.id}">
            ${product.onSale ? 'Quitar Rebaja' : 'Marcar Rebaja'}
          </button>
          <button type="button" class="admin-product-card__btn admin-product-card__btn--delete" data-product-id="${product.id}">
            Eliminar
          </button>
        </div>
      `;
      inventoryList.appendChild(card);
    });

    // Agregar eventos
    document.querySelectorAll('.admin-product-card__btn--edit').forEach(btn => {
      btn.addEventListener('click', () => editProduct(parseInt(btn.dataset.productId)));
    });

    document.querySelectorAll('.admin-product-card__btn--delete').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(parseInt(btn.dataset.productId)));
    });

    document.querySelectorAll('.admin-product-card__btn--sale').forEach(btn => {
      btn.addEventListener('click', () => toggleSale(parseInt(btn.dataset.productId)));
    });
  }

  /**
   * Edita un producto
   */
  function editProduct(productId) {
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const product = products.find(p => p.id === productId);
    if (!product) return;

    editingProductId = productId;
    document.getElementById('product-name').value = product.name || '';
    document.getElementById('product-category').value = product.category || '';
    document.getElementById('product-collection').value = product.collection || '';
    document.getElementById('product-price').value = product.price || '';
    document.getElementById('product-color').value = product.color || '';
    document.getElementById('product-sizes').value = product.sizes ? product.sizes.join(', ') : '';
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-image').value = product.image || '';
    document.getElementById('product-type').value = product.type || 'zapato';
    document.getElementById('product-on-sale').checked = product.onSale || false;

    const submitBtn = productForm.querySelector('.admin-form__submit');
    if (submitBtn) {
      submitBtn.textContent = 'Actualizar Producto';
    }

    // Cambiar a la pestaña de productos
    switchTab('products');
    productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Elimina un producto
   */
  function deleteProduct(productId) {
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (confirm(`¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`)) {
      if (window.supabase) {
        window.supabase.from('products').delete().eq('id', productId)
          .then(({ error }) => {
            if (error) throw error;
            if (typeof window.refreshProducts === 'function') window.refreshProducts();
            if (typeof window.renderProducts === 'function') window.renderProducts();
            loadInventory();
            alert('Producto eliminado correctamente');
          })
          .catch(() => alert('Ocurrió un error eliminando el producto'));
      }
    }
  }

  /**
   * Alterna el estado de rebaja de un producto
   */
  function toggleSale(productId) {
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const next = { ...product, onSale: !product.onSale };
    if (window.supabase) {
      window.supabase.from('products').update({ onSale: next.onSale }).eq('id', productId)
        .then(({ error }) => {
          if (error) throw error;
          if (typeof window.refreshProducts === 'function') window.refreshProducts();
          if (typeof window.renderProducts === 'function') window.renderProducts();
          loadInventory();
          alert(`Producto ${next.onSale ? 'marcado' : 'desmarcado'} como rebaja`);
        })
        .catch(() => alert('Ocurrió un error actualizando la rebaja'));
    }
  }

  /**
   * Formatea el precio
   */
  function formatPrice(price) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(price);
  }

  // Event Listeners
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      if (isAdminLoggedIn) {
        openAdminPanel();
      } else {
        openLoginModal();
      }
    });
  }

  if (adminModalClose) {
    adminModalClose.addEventListener('click', closeLoginModal);
  }

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', handleLogin);
  }

  if (adminPanelClose) {
    adminPanelClose.addEventListener('click', closeAdminPanel);
  }

  if (adminTabs.length > 0) {
    adminTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
      });
    });
  }

  if (productForm) {
    productForm.addEventListener('submit', handleProductSubmit);
  }

  if (categoryForm) {
    categoryForm.addEventListener('submit', handleAddCategory);
  }

  const fileInputEl = document.getElementById('product-image-file');
  const previewEl = document.getElementById('product-image-preview');
  if (fileInputEl && previewEl) {
    fileInputEl.addEventListener('change', () => {
      const file = fileInputEl.files && fileInputEl.files[0] ? fileInputEl.files[0] : null;
      if (!file) {
        previewEl.innerHTML = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        previewEl.innerHTML = `<img src="${reader.result}" alt="Vista previa" style="max-width:100%;height:auto;border:2px solid var(--color-border);border-radius:var(--radius-soft);">`;
      };
      reader.readAsDataURL(file);
    });
  }

  if (inventorySearch) {
    inventorySearch.addEventListener('input', loadInventory);
  }

  if (inventoryFilterSale) {
    inventoryFilterSale.addEventListener('change', loadInventory);
  }

  // Cerrar modal al hacer clic fuera
  if (adminModal) {
    adminModal.addEventListener('click', (e) => {
      if (e.target === adminModal) {
        closeLoginModal();
      }
    });
  }

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (adminModal.getAttribute('aria-hidden') === 'false') {
        closeLoginModal();
      }
      if (adminPanel.getAttribute('aria-hidden') === 'false') {
        closeAdminPanel();
      }
    }
  });
})();
