# Licensing and provenance

The OpenPrint source, original UI, SVG illustrations, documentation, and parametric generator are MIT-licensed. See [LICENSE](LICENSE).

Client dependencies retain their notices in [public/third-party-licenses.txt](public/third-party-licenses.txt), also served by the application. Regenerate this file with `node scripts/licenses.mjs` after a dependency update. It includes React, React DOM, Scheduler, React Router, Cookie, Set-Cookie Parser, Three.js, Leaflet, Lucide, Zod, and Express. Server dependencies also include their original license files in `node_modules`.

The built-in SQLite implementation is provided by Node.js. Its upstream license and third-party notices are part of the Node.js distribution; SQLite itself is public-domain software. Development tools retain their respective upstream licenses and are not part of the application license grant.

## Offline map

OpenPrint distributes the unmodified 1:110m land polygons in `public/maps/land-110m.geojson`. Natural Earth provides these coastlines in the public domain. The source file has SHA-256 `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`. [Upstream file](https://github.com/nvkelso/natural-earth-vector/blob/693f11422f4e08d2da4566b854dda53eb7c39fb3/geojson/ne_110m_land.geojson) · [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)

## Demo content

All sample people, names, businesses, profiles, and briefs in `server/demo.ts` are fictional. No scraped directory or real customer records are included. Any resemblance to a real business is incidental. Coordinates are approximate city centers and do not identify workshop premises.

To the extent copyright applies, the **sample profile/brief text and three generated geometric demo designs** are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Their generator and application source code remain MIT-licensed. No engineering fitness, printability, or quality certification is implied.

Models uploaded by participants are separate works. The application records their own CC0, CC BY 4.0, or CC BY-SA 4.0 grant and attribution. A contributor cannot place someone else's model under a new license without permission. Removing a model does not revoke rights already granted to recipients.

## Maps

Leaflet uses the 2-clause BSD license. The base map uses OpenStreetMap tiles with visible attribution in the map control. Tiles load when a map view mounts, including the default catalogue landing page; a separate click is not required there. Respect the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and [OSM attribution](https://www.openstreetmap.org/copyright). There is no application-managed offline tile cache, scraping, prefetch, or SLA. At larger scale, replace or disable the map rather than relying on unlimited free OSM tile capacity.

Studio locations and descriptions come from operator imports or self-publication, not from the OpenStreetMap tile license. They retain their own rights and restrictions. See [directory data provenance](docs/DATA_PROVENANCE.md) before importing or publishing an external catalogue; the MIT software license does not relicense it.

## Original service

OpenPrint is an independent implementation inspired by the owner’s 3d-online.app project. No private repository history, scraped company records, paid AI output, third-party model catalog, production credentials, or customer files from that service are included.
