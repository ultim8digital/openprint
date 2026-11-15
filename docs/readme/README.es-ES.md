# OpenPrint

**Un directorio abierto de estudios y talleres de impresión. No requiere registro ni moderadores.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Encuentre un taller en el mapa, compruebe sus capacidades y póngase en contacto directamente con él. Si su taller no aparece, añada sus datos de contacto y servicios: el anuncio aparecerá de inmediato. Guarde el enlace de gestión privado para editar o eliminar su anuncio más adelante. El catálogo predeterminado no tiene cuentas, confirmación por correo electrónico ni cola de aprobación.

Ejecute OpenPrint con Node.js 24 y SQLite local. Vercel, Supabase, un proveedor de correo electrónico, la IA de pago y el inicio de sesión de terceros no son necesarios. GitHub aloja el código fuente y las versiones; un sitio web compartido que acepta envíos necesita un servidor API en funcionamiento. [GitHub Páginas](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) por sí solas no pueden ejecutar el Node.js API ni mantener los cambios de los visitantes.

## Características del catálogo

- Busque por nombre, ciudad y tecnología. El mapa incluye las ubicaciones que coinciden con la búsqueda, independientemente de la paginación de la lista.
- Publica sin necesidad de una cuenta. Elige un punto en el mapa o introduce las coordenadas; los anuncios sin coordenadas seguirán siendo buscables.
- Edite o elimine una entrada junto con su enlace privado. Las comprobaciones de versión protegen contra ediciones conflictivas en diferentes pestañas.
- Busque estudios existentes antes de publicar. Los nombres, ciudades y direcciones duplicados se rechazan automáticamente.
- Importe un catálogo con la debida atribución de la fuente. Los operadores no pueden modificar las entradas publicadas por ellos mismos.
- Visualice OpenStreetMap mosaicos sin necesidad de una API clave. Los mosaicos se cargan cuando se muestra un mapa, incluida la página de inicio predeterminada.
- Elija el idioma de la interfaz desde el menú de idiomas. Consulte el archivo README completo en su idioma a través del índice de idiomas que se encuentra arriba.

La publicación no verifica la propiedad del negocio ni la calidad del servicio. Confirme el equipo, las capacidades y las condiciones con el estudio. Cualquier persona que tenga el enlace de gestión privado puede controlar esa entrada. Manténgalo en privado; no hay opción de recuperación por correo electrónico. Consulte la [guía de autopublicación](../../docs/OPEN_CATALOG.md).

## Ejecuta tu propia instancia

Instale Node.js 24, clone este repositorio y ejecute:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. La configuración predeterminada `APP_MODE=catalog` no requiere la configuración de un administrador ni de un usuario. Configure `APP_URL`, HTTPS y las copias de seguridad utilizando la [guía de autoalojamiento](../../docs/SELF_HOSTING.md). Docker Compose también está disponible: `docker compose up --build -d`.

La implementación compatible consiste en un único proceso de aplicación con SQLite en un disco local. La publicación automática y las cuotas de solicitudes limitan el uso indebido sin necesidad de una cola de moderación. Una dirección IP de oficina compartida puede compartir una cuota de publicación. Consulte [límites y comportamiento del enlace de gestión](../../docs/OPEN_CATALOG.md) antes de abrir una instancia pública.

Utilice la [herramienta de línea de comandos para importar el catálogo](../../docs/CATALOG_IMPORT.md) para un conjunto de datos existente después de verificar sus derechos de uso. Los conjuntos de datos de instancias, las cargas y las copias de seguridad no se incluyen en el repositorio ni en las imágenes de contenedor.

## Modo comunitario opcional y modo Neofab

Establezca `APP_MODE=community` explícitamente para habilitar proyectos privados, cotizaciones de proveedores, la biblioteca de modelos y Neofab Studio. Estos flujos de trabajo utilizan sus propias cuentas y permisos. Cambiar de modo conserva los datos almacenados. El modo de catálogo no expone el historial privado de la comunidad a través de su API ni reanuda las CAD tareas en cola.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) es compatible con versiones de documentos técnicos de fabricación, listas de materiales y geometría declarativa limitada CAD con exportación a STEP/STL. CAD e IA son opcionales. Las propuestas de IA requieren revisión y un paso de aplicación independiente; no publican pedidos ni generan geometría automáticamente. CAM, el código G y la validación física de la fabricación no están implementados.

## Derechos de los datos y privacidad

La licencia del software MIT no otorga derechos sobre los registros empresariales importados. La simple atribución no autoriza la copia de datos de Google Maps, 2GIS, Yandex Maps u otras fuentes. Verifique los permisos para el almacenamiento, la publicación y la redistribución antes de utilizar un conjunto de datos. Consulte [origen y límites de la revisión de los datos](../../docs/DATA_PROVENANCE.md).

Los datos de contacto que se publican por cuenta propia son públicos; las claves de administración son privadas. Mantenga las bases de datos y las copias de seguridad fuera de los directorios a los que se accede públicamente y proporcione un contacto para las solicitudes de corrección y eliminación. Lea las secciones de [privacidad](../../PRIVACY.md) y [seguridad](../../SECURITY.md) antes de la implementación.

## Desarrollo y traducción

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Las acciones comprueban los tipos, API y los flujos de trabajo del navegador, así como los CAD contenedores predeterminados y nativos. Las pruebas utilizan registros ficticios. Las pruebas exactas, la cobertura y los límites restantes se registran en [validación](../../docs/VALIDATION.md) y [alcance del producto](../../docs/PRODUCT.md).

El archivo README en inglés es la referencia para las versiones traducidas completas. El [índice de idiomas](../../docs/i18n/README.md) documenta los límites de mantenimiento y revisión de la traducción. La localización de la interfaz no traduce las listas creadas por los usuarios, el contenido del proyecto ni todos los datos técnicos externos.

## Licencias y contribuciones

El código fuente original, la interfaz de usuario, las SVG ilustraciones, la documentación y el generador paramétrico están [licenciados bajo MIT](../../LICENSE). Las dependencias conservan sus propias licencias y avisos. Los modelos de usuario tienen una licencia independiente elegida por sus autores. El perfil de demostración ficticio y el texto breve, así como los tres diseños de demostración generados, se ofrecen bajo CC0; el generador sigue siendo MIT. Consulte los [avisos de terceros](../../THIRD_PARTY_NOTICES.md).

Esta implementación independiente desarrolla la idea de [3d-online.app](https://3d-online.app). No se incluyen las cuentas originales de producción, las claves de acceso, el historial del repositorio Git privado ni los archivos de usuario. El compilador MIT Neofab CAD adaptado conserva su [licencia original y la declaración de origen](../../cad-worker/NOTICE.md).

Las contribuciones pueden incluir código, correcciones de traducción, mejoras en la usabilidad, piezas paramétricas de código abierto, comprobaciones de instalación y comentarios de talleres reales. Comience con [CONTRIBUTING.md](../../CONTRIBUTING.md).
