# Workshop network

[Руководство на русском](WORKSHOP_NETWORK.ru.md)

A customer needs a browser. A maker needs an account on a participating community node. A makerspace can run one node for its members, or a printer owner can run a node on their own computer. Each operator keeps their own SQLite database and uploads. Each node chooses its peers. The network has no central directory, global login, ledger, token, or payment service.

## Run a workshop node

Install Node.js 24 and run these commands in a clone of OpenPrint.

```sh
npm ci
npm run build
cp .env.example .env
```

Set `APP_MODE=community` in `.env`, then run `npm start`. Open the address in `APP_URL`, create a local account and open **My workspace → Maker profile**. Add the name, city and printing technologies. Enter optional coordinates and tick **List my workshop on other OpenPrint nodes**. Save the profile. The workshop now appears at `/network` on its own node. A workshop without coordinates still appears in the list.

To receive internet orders, keep this node reachable at a stable HTTPS origin and set `APP_URL` to that address. A home machine can sit behind an HTTPS reverse proxy. A computer without a reachable address can participate using a local community's node. Keep the main database and files on local storage and back them up together. [Self-hosting instructions](SELF_HOSTING.md)

## Connect two nodes

Operators exchange their public origins. On node A, set the following in `.env` and restart OpenPrint. Use the actual address of node B in place of the example.

```dotenv
OPENPRINT_PEERS=https://makers.example.org
```

Open **Directory & map → Workshop network** on A. Workshop profiles from B now appear alongside workshops advertised by A. A catalog-only node can discover workshops and prepare models. A community node can also receive and fulfill orders. To discover A's workshops on B, add A's address to B's configuration.

For a local trial, start the following commands in two terminals after building. Use fresh data directories. The separate hostnames also keep the browser sessions distinct.

```sh
APP_MODE=community HOST=127.0.0.1 PORT=3102 APP_URL=http://127.0.0.1:3102 DATA_DIR=.local/workshop-b MAP_TILES=off npm start
```

```sh
APP_MODE=catalog HOST=127.0.0.1 PORT=3101 APP_URL=http://localhost:3101 DATA_DIR=.local/directory-a OPENPRINT_PEERS=http://127.0.0.1:3102 MAP_TILES=off npm start
```

Create and list the workshop at `http://127.0.0.1:3102`. As a customer, open `http://localhost:3101/network` in another browser profile. Allow up to 30 seconds for changes to appear on a peer, then reload. With `MAP_TILES=off`, the map displays workshop pins over bundled Natural Earth coastlines. Street detail requires an online basemap. The default `osm` setting loads OpenStreetMap tiles when a map opens.

## Make and order a part

1. Open **3D tools**. Choose a drilled plate, spacer tube or block, or open a local STL/OBJ. Drag to rotate, set the dimensions of a template or scale a mesh, and check the result in millimetres. Community nodes also offer a **Model library** with licensed designs. Follow the attribution and licensing shown on the model card.
2. Select **Choose a maker** and pick a workshop from the map or list. Its node address appears on the card. You can also start from the network map and prepare the part in that workshop's editor.
3. A parametric design travels as dimensions in the URL fragment. A mesh opens the workshop in a second tab. Keep the first tab open and click **Open an STL or OBJ** next to the source address in the new tab. The two tabs exchange the selected file locally. If browser policy blocks the transfer, download the model and open that file on the workshop node.
4. Click **Direct request**. Sign in or register on the workshop node, enter the brief, quantity and material, then review the recipient and attachment. The browser uploads the file to that node when you publish. Reloading a file-backed order draft requires choosing the file again. The request stays off the public project board. Retrying the same model order after a lost response returns its original order ID.
5. The maker opens the request from their workspace, discusses the brief and quotes a price and lead time. The customer accepts the exact offer revision. The maker can then download the model and mark the item delivered. The customer confirms receipt. Payment and physical delivery are arranged between the parties.

The browser screenshots show a fictional workshop on a second local node with external tiles disabled. [Desktop](images/workshop-network-desktop.png) · [Mobile](images/workshop-network-mobile.png)

## Protocol v1

- `GET /api/directory/node` returns `version: 1`, `truncated` and `workshops`. Each record contains `id`, `name`, `city`, `technologies`, `lat` and `lng`. Coordinates may both be null. IDs are scoped to the serving origin.
- A node exports only its own opted-in, published, non-demo maker profiles with active accounts. Catalog-mode nodes and demo instances serve an empty feed. Imported directory cards, anonymous contact listings, account IDs, attachments and orders stay out of the feed.
- `GET /api/directory/network` combines the local feed with feeds from up to 12 configured peers. Peer addresses must be plain HTTPS origins. HTTP is also supported on loopback. The server requests a fixed path, follows no redirects and forwards no customer cookies, search terms or headers. A peer supplies display data only. The receiving node constructs workshop links from its configured origin and the maker's profile ID.
- Each feed returns up to 250 profiles in ID order. A truncated feed links to the source directory. A fetch has a four-second deadline and a 512 KiB response limit. Concurrent visitors share peer reads for 30 seconds. An unavailable peer is labelled and its records are omitted. Revocation takes effect on the next peer refresh. OpenPrint does not write remote listings to disk or recursively redistribute them.
- The order lives on one maker node. An operator with access to that machine can read stored orders and files. Losing the discovery node does not interrupt an order already placed on another node. Availability of the order itself depends on its host and backups.
