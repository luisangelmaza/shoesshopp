import { createClient } from '@supabase/supabase-js';
let PRODUCTS = [];
const ENV = (import.meta && import.meta.env) ? import.meta.env : {};
const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY;
let supabase = null;
if (typeof SUPABASE_URL === 'string' && SUPABASE_URL && typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabase = supabase;
  console.log('Supabase configurado correctamente');
} else {
  console.error('Supabase no configurado: revisa el archivo .env en la carpeta /app/');
  console.log('Variables detectadas:', { URL: !!SUPABASE_URL, KEY: !!SUPABASE_ANON_KEY });
}

async function refreshProducts() {
  try {
    if (!supabase) return;
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
    if (error) throw error;
    PRODUCTS = Array.isArray(data) ? data : [];
    window.PRODUCTS = PRODUCTS;
    document.dispatchEvent(new CustomEvent('products-updated'));
  } catch (e) {
    console.error('Error cargando productos', e);
  }
}

refreshProducts();
window.PRODUCTS = PRODUCTS;
window.refreshProducts = refreshProducts;
