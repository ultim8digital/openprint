# Product scope — v0.6

## Purpose

OpenPrint is an open directory of fabrication workshops. A visitor finds a workshop by city, technology or map location and contacts it directly. A workshop can publish its details immediately, without registering an account or waiting for a moderator, then maintain the listing through a private management link.

The original 3d-online.app concept combines discovery, model preparation, orders and engineering help. This portable implementation now starts in `APP_MODE=catalog`. The earlier collaboration and Neofab Studio workflows remain available when an operator explicitly chooses `APP_MODE=community`; switching modes preserves the stored data.

## The default catalog path

1. Search existing cards and map points by name, city and manufacturing technology.
2. Open a workshop card and contact its public website or phone number.
3. Add a workshop with a name, city and usable website or phone; coordinates are optional.
4. Confirm the right to publish the supplied information. A valid, nonduplicate submission becomes public immediately.
5. Save the private management link. It allows its holder to update or delete this one listing without an account.

Self-published cards and operator-imported cards have distinct provenance labels. Neither label certifies the business, the submitter's identity, current availability or manufacturing capability. The catalog does not invent ratings or verification badges. Counts describe listings, not active suppliers or completed business.

The management link is a secret: anyone holding it can change or delete that listing. The application offers copying/downloading the link and retains access in the current browser tab's session storage. It has no email recovery or identity-based ownership claim. Editing checks the displayed version so a stale window cannot silently overwrite newer changes. Deleting a card removes its public details; retrying its original publication cannot restore it.

A workshop without coordinates remains discoverable in the list. The map uses all matching coordinates independently of list pagination, with explicit counts and a 50,000-point limit. Optional OpenStreetMap tiles require an external tile request. See [catalog import](CATALOG_IMPORT.md) for bringing an operator's existing directory into the separate imported-record store.

No account, subscription, model API key, moderator action or third-party CAPTCHA gates this path. Publication requires the operator's running Node/SQLite service. GitHub distributes the source and releases; GitHub Pages alone cannot execute these write APIs or persist the shared directory. A repository release is not a claim that a public service has been deployed.

## Operating limits

- Each instance permits five successful new listings per IP over 24 hours and 200 across the instance. The counters survive restarts and deletion. Networks sharing one public IP share that allowance.
- Management reads allow 60 requests per IP per minute; edits/deletions share 20. General API and creation-attempt throttles also apply.
- Up to 50,000 self-published identities are retained, including deleted-card tombstones. Deletion does not free this lifetime capacity because an old key must remain unable to resurrect a deleted card.
- Exact duplicates use Unicode-normalized name, city and address across imported and active self-published records. Separate branch addresses are allowed. Spelling variations and fraudulent ownership claims are not resolved automatically.
- Imported records can be contacted directly but cannot be claimed or edited using a self-publication key. Import replacement changes only its named source and rejects a batch overlapping an active self-published card.
- Self-publication stores public business details, not account email addresses, ratings, reviews or a moderation queue. Publishing requires an explicit rights acknowledgement; this is not an independent legal or identity check.
- The operator controls the server and local catalog. A separate [workshop network](WORKSHOP_NETWORK.md) combines consenting maker profiles from connected community nodes and opens direct orders on the selected node. The catalog also includes browser-based 3D tools.

## Optional community and Neofab Studio

`APP_MODE=community` restores registered maker/engineer profiles, private collaboration, offers, exact acceptance, delivery, licensed model sharing and the earlier moderation tools. These features are optional workflows, not requirements for catalog publication. Imported and self-published cards remain separate from account-owned profiles and do not become order recipients automatically. Demo accounts and projects are fictional.

Neofab Studio retains private versioned briefs, components and operations, optional AI drafting, local declarative CAD and confirmed handoffs. Supported bounded parts and assemblies can produce STEP/STL, a BOM and a geometry report with component preview, version history and named-provider quotation access. Functional parts, repairs, furniture and small batches can use this path; each manufacturing process still needs its own engineering preparation. See [setup](NEOFAB_SETUP.md), [CAD scope](CAD_ENGINE.md) and the broader [CAD/CAM architecture](NEOFAB_BLUEPRINT.md).

The community manual path has no required AI key. Installing the optional CAD runtime enables geometry without an AI service. Catalog mode does not start the CAD service or resume queued private builds, even when the same database contains earlier Studio work.

The existing community limits remain: one provider profile per account; no payments, escrow, tax or shipping integration; no automatic identity/email verification; bounded dashboard history; no shared workshop staff; immutable published briefs and accepted terms. Ordinary attachments and confirmed CAD packages have their documented participant-access rules. An already downloaded copy cannot be recalled.

CAD supports up to 24 physical components and 300 bounded operations. AI offers reviewable proposals selected by server-side task configuration; it does not automatically apply, build, confirm or publish them. Editable arbitrary STEP import, freeform modelling, FEA, CAM/G-code, machine-profile validation, autonomous agent delegation and monetary AI budgets remain future work. A passing geometry report does not release a design for manufacturing.

## Useful next contributions

Prioritize real workshop onboarding, contact accuracy, lost-link guidance, accessible mobile forms, keyboard/screen-reader testing and restore drills. Validate that people can find and maintain useful listings before treating catalog size as demand.

Bounded extensions include configurable map providers, better duplicate suggestions, explicit listing transfer, reusable CAD templates and measured model-quality evaluations. Team membership, versioned request amendments and multi-provider manufacturing routes belong to the optional community workflow and need their own permissions and validation. Keep paid services and external data adapters optional, and establish redistribution rights for each imported dataset.
