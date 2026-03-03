# ShoesShop

Página de venta de zapatos y productos de limpieza para calzado. Diseño inspirado en tiendas de calzado premium.

## Ubicación del proyecto

Todo el código de la página está guardado en la carpeta **`app`** del repositorio:

**Ruta completa:** `C:\Users\danil\shoesShop\app\`

## Estructura del proyecto

```
shoesShop/
├── app/                    ← Carpeta con todo el contenido de la web
│   ├── index.html          # Página principal (secciones comentadas)
│   ├── css/
│   │   └── styles.css      # Estilos por sección (comentados)
│   └── js/
│       ├── data.js         # Datos de productos (zapatos + limpieza)
│       └── main.js         # Lógica: filtros, listado, panel de detalle
└── README.md
```

## Cómo ver la página

Abre `app/index.html` en el navegador (doble clic o arrastrar al archivo al navegador). No requiere servidor.

## Estructura de la página (estático vs dinámico)

| Sección | Tipo | Descripción |
|--------|------|-------------|
| Barra superior | Estática | Enlaces Cliente, Empresa, App, Blog, Tiendas, país |
| Navegación principal | Estática | Logo, categorías, búsqueda, cuenta, favoritos, carrito |
| Hero | Dinámico | Título según categoría (Hombre, Mujer, Limpieza…) |
| Breadcrumbs | Dinámico | Ruta según categoría actual |
| Sidebar filtros | Estática (estructura) | Opciones (colección, color, talla, precio) dinámicas |
| Listado productos | Dinámico | Cuadrícula, contador, ordenación |
| Panel detalle | Dinámico | Se abre a la **derecha (50% pantalla)** al hacer clic en un producto |
| Chat flotante | Estático | Botones de ayuda |

## Panel de detalle

Al hacer **clic en un producto**, se abre un panel fijo que ocupa la **mitad derecha** de la pantalla. La mitad izquierda sigue mostrando el listado. El botón × cierra el panel.

## Próximos cambios

El código está organizado y comentado por secciones para que sea fácil indicar cambios (por ejemplo: “en el hero”, “en el panel”, “en los filtros”) y aplicar modificaciones de forma localizada.
