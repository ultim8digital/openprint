# Licensing and provenance

The OpenPrint source, original UI, SVG illustrations, documentation, and parametric generator are MIT-licensed. See [LICENSE](LICENSE).

Client dependencies retain their notices in [public/third-party-licenses.txt](public/third-party-licenses.txt), also served by the application. Regenerate this file with `node scripts/licenses.mjs` after a dependency update. It includes React, React DOM, Scheduler, React Router, Cookie, Set-Cookie Parser, Three.js, Leaflet, Lucide, Zod, and Express. Server dependencies also include their original license files in `node_modules`.

The built-in SQLite implementation is provided by Node.js. Its upstream license and third-party notices are part of the Node.js distribution; SQLite itself is public-domain software. Development tools retain their respective upstream licenses and are not part of the application license grant.

## Demo content

All sample people, names, businesses, profiles, and briefs in `server/demo.ts` are fictional. No scraped directory or real customer records are included. Any resemblance to a real business is incidental. Coordinates are approximate city centers and do not identify workshop premises.

To the extent copyright applies, the **sample profile/brief text and three generated geometric demo designs** are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Their generator and application source code remain MIT-licensed. No engineering fitness, printability, or quality certification is implied.

Models uploaded by participants are separate works. The application records their own CC0, CC BY 4.0, or CC BY-SA 4.0 grant and attribution. A contributor cannot place someone else's model under a new license without permission. Removing a model does not revoke rights already granted to recipients.

## Maps

Leaflet uses the 2-clause BSD license. Optional map tiles and map data come from OpenStreetMap; visible attribution is retained in the map control. Tile loading requires an explicit UI action. Respect the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and [OSM attribution](https://www.openstreetmap.org/copyright). There is no offline tile cache, scraping, prefetch, or SLA. At larger scale, replace or disable the optional map rather than relying on unlimited free OSM tile capacity.

## Original service

OpenPrint is an independent implementation inspired by the owner’s 3d-online.app project. No private repository history, scraped company records, paid AI output, third-party model catalog, production credentials, or customer files from that service are included.
