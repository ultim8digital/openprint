# Product scope

## Purpose

Help a real local fabrication community coordinate useful work. A customer gets understandable choices; a workshop controls its own profile and terms; an engineer is discoverable without pretending to be a print shop; an author shares designs with a clear license; a moderator maintains trust; an operator runs the community without mandatory cloud accounts.

The original 3d-online.app concept combines discovery, model preparation, orders and engineering help. OpenPrint keeps that chain in a separate portable implementation, starting with participant-managed data rather than republishing a collected directory.

## A complete useful free path

Visitors can discover providers, inspect STL/OBJ, construct/download simple parts and download approved open models. Accounts add private collaboration. No central subscription or paid AI key gates these paths. Hosting still costs resources; an operator decides how to fund their community outside this application.

1. Describe a need, dimensions and intended use, even without a model.
2. Share it publicly or send it to one provider.
3. Ask questions before proposing a price.
4. Compare total prices, lead times, scope and revisions in the project currency.
5. Accept exact displayed terms and share the attachment with the chosen provider.
6. Receive the result and confirm completion.
7. Share original designs with attribution and explicit licensing.

An empty community is not presented as an established network of suppliers. All demo data is prominently fictional; real installations start empty.

## Deliberate limits of v0.1

The Neofab Studio preview extends this baseline with private versioned briefs, a flat component list, optional AI drafting and a confirmed handoff. It preserves the key-free path. See [setup](NEOFAB_SETUP.md) and the broader [CAD/CAM architecture](NEOFAB_BLUEPRINT.md); the limits below describe the original 0.1 community release.

- One user manages one provider profile. Shared workshop staff and granular permissions are future work.
- No payments, commission accounting, escrow, tax calculation, shipping integration or automatic dispute arbitration. Participants handle these directly.
- No automatic identity/email verification, public ratings or invented reputation scores.
- No AI generation or third-party model API dependency. Optional adapters could come later with rights/cost controls and a complete key-free path.
- No full validation of arbitrary CAD safety, printability or malware. Preview supports STL/OBJ; other supported formats are attachments.
- Attachments are shared only after provider selection. An explicit per-provider pre-quote file-access grant would be a useful future extension for professional estimating.
- No offline tile cache or installable offline PWA. The app is a locally runnable self-hosted web service.
- Published briefs are immutable in v0.1. Cancel and create a revised brief before assignment when scope changes. Post-agreement changes need their own future versioning workflow.
- Dashboard/moderator queries show bounded windows (up to 200 records; notifications 100; direct requests 100). Historical dashboard pagination is future work. Public directory/library and message histories already have explicit pagination.
- No production Supabase migration, SSR/SEO parity, native mobile app, federation or horizontal scaling.

## Useful next contributions

Start with evidence from a small real maker community: onboarding, completed collaborations, 200% zoom, screen readers, mobile devices, recovery/restore drills and clearer briefs. A scraped-listing count or demo account count is not evidence of demand or active supply.

Bounded extensions: team membership, complete dashboard history, consent-based pre-quote file access, optional email outbox, configurable map providers, versioned request amendments, moderation appeals, source-model versions and licensed user-supplied data import.

Keep payments, AI and public-data adapters optional. Do not infer downstream model rights from a search result or a generic “commercial use” label.
