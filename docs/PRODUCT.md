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

## Neofab Studio in v0.3

Neofab Studio adds private versioned briefs, components and operations, optional AI drafting, local declarative CAD and a confirmed handoff. CAD supports bounded parts and assemblies, STEP/STL and BOM exports, a geometry report, component preview, version history and named-provider quotation access. Functional parts, repairs, furniture and small batches can share this workflow; each manufacturing process still needs its own engineering preparation. See [setup](NEOFAB_SETUP.md), [CAD scope](CAD_ENGINE.md) and the broader [CAD/CAM architecture](NEOFAB_BLUEPRINT.md).

The complete manual path has no required AI key. Installing the optional CAD runtime enables geometry without an AI service; leaving it disabled preserves briefs, collaboration and simple browser templates.

## Deliberate limits of v0.3

- One user manages one provider profile. Shared workshop staff and granular permissions are future work.
- No payments, commission accounting, escrow, tax calculation, shipping integration or automatic dispute arbitration. Participants handle these directly.
- No automatic identity/email verification, public ratings or invented reputation scores.
- Optional AI drafts briefs and bounded declarative CAD proposals. Models are selected by task on the server; reviewed CAD proposals are applied and built separately. Autonomous agent delegation and monetary budgets are future work; a third-party model API is not required for the manual path.
- No full validation of arbitrary CAD safety, printability or malware. Preview supports STL/OBJ; other supported formats are attachments.
- Ordinary uploaded attachments are shared after provider selection. Confirmed CAD packages additionally support direct-recipient and explicit per-provider quotation access. Access to an already downloaded copy cannot be recalled.
- CAD accepts up to 24 physical components and 300 bounded operations. Arbitrary STEP import into editable history, freeform modelling, FEA, CAM, G-code and machine-profile validation are not included. Geometry passing does not release manufacturing.
- No offline tile cache or installable offline PWA. The app is a locally runnable self-hosted web service.
- Published briefs and CAD handoffs are immutable. Cancel and create a revised brief before assignment when scope changes. Post-agreement changes need their own future versioning workflow.
- Dashboard/moderator queries show bounded windows (up to 200 records; notifications 100; direct requests 100). Historical dashboard pagination is future work. Public directory/library and message histories already have explicit pagination.
- No production Supabase migration, SSR/SEO parity, native mobile app, federation or horizontal scaling.

## Useful next contributions

Start with evidence from a small real maker community: onboarding, completed collaborations, 200% zoom, screen readers, mobile devices, recovery/restore drills and clearer briefs. A scraped-listing count or demo account count is not evidence of demand or active supply.

Bounded extensions: team membership, complete dashboard history, optional email outbox, configurable map providers, versioned request amendments, moderation appeals, reusable CAD templates, model-quality evaluations and licensed user-supplied data import. Multi-provider routes and manufacturing adapters need their own versioned inputs, permissions and validation.

Keep payments, AI and public-data adapters optional. Do not infer downstream model rights from a search result or a generic “commercial use” label.
