# Directory data provenance

The MIT license covers OpenPrint's own source code and documentation. It does **not** grant rights to imported business records, descriptions, photographs, logos, reviews, coordinates or other third-party content. A publicly visible record is not automatically an openly licensed record. Source attribution records where information came from; it does not replace permission.

## Repository review on 15 November 2026

A read-only technical review examined commit `436df70` and the history reachable through the local Git references at that time:

- No source `studios.json`, catalogue SQLite database or catalogue CSV was found in those tracked paths. The private operator dataset is excluded from Git and Docker build inputs through `.local` exclusions and explicit container copy paths.
- The review inspected 276 historical Git blobs, totalling 4,474,602 bytes. No quoted string matched the 9,818 source record identifiers of at least eight characters from an operator-provided 9,846-record catalogue. This check can detect those identifiers; it cannot rule out renamed records, copied descriptions, transformed data or other datasets.
- No Google Maps, 2GIS or Yandex Maps integration, scraper or related branded asset was identified in the checked source. The tracked overview image shows OpenPrint's fictional demo interface. The map implementation uses Leaflet and OpenStreetMap tiles with attribution.
- Dependency notices and the adapted MIT CAD compiler's original license and provenance notice are retained. This is not an independent authorship or license audit of every dependency.

This review did not establish rights to the private catalogue, the current production catalogue at 3d-online.app or every one of its records. It did not inspect every external deployment, GitHub attachment, release asset or unreachable Git object. It is not legal clearance. Later imports and contributions require their own review.

## Before importing or publishing a dataset

1. Record the actual source and collection method for each batch, and for individual fields where sources differ. Keep source URLs, collection dates, permission or license evidence, and any restrictions outside the public repository if they contain private information.
2. Verify that the permission covers the intended actions: copying, persistent storage, public display, redistribution, modification and commercial use where relevant. API access or payment alone does not necessarily grant all of these rights.
3. Use information supplied by an authorised business representative, independently collected information whose use is permitted, or a dataset with an appropriate license. Do not assume that moving records to another map provider, removing reviews or rewriting descriptions resolves source restrictions.
4. Retain required attribution and license notices. Keep third-party data separate from the MIT software license. Check privacy obligations separately, especially for personal phone numbers, sole traders and residential addresses.
5. Provide a contact for corrections and removal requests, and document how updates affect the live catalogue and backups. Self-publication includes a rights confirmation, but the software does not verify ownership or grant rights the submitter does not hold.

The [importer](CATALOG_IMPORT.md) validates fields and prevents conflicting updates. It does not validate legal provenance. Its source label and import date are informational. The default distribution contains fictional demo records, not an openly licensed copy of an operator's catalogue.

## Relevant source terms

These official pages were checked on 15 November 2026. The applicable contract, collection date, territory, permissions and statutory exceptions can change the assessment; obtain qualified legal advice before relying on a disputed dataset.

- [Google Maps end-user terms](https://www.google.com/help/terms_maps/), section 2, restrict copying, redistribution and bulk downloading, subject to stated exceptions. [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms), section 3.2.3(a), separately restrict extracting and storing Maps content, including business names and addresses, for use outside the services.
- [2GIS license](https://law.2gis.ru/licensing-agreement/), sections 5.1.8 and 5.2, restrict automated collection and copying, transformation and publication of extracted directory materials. [The WebAPI offer](https://law.2gis.ru/offer-license-agreement-webapi), section 3.1, restricts saving and reusing data beyond the contract.
- [Yandex service terms](https://yandex.ru/legal/rules/ru/), sections 5.2.10 and 6.2, restrict copying and redistribution; [Yandex Maps API terms](https://yandex.ru/legal/maps_api/ru/), section 5.1.6, restrict persistent storage and processing, with a limited temporary-cache exception within the service.
- [OpenStreetMap copyright and licensing](https://www.openstreetmap.org/copyright) and the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) govern the map data and public tile service. They do not grant rights to studio records taken from a different source.

For the software, demo content and dependency notices, see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
