# PartSync

PartSync is a small stock monitor for a cupboard, workshop, or kitchen. It runs on a Raspberry Pi. People on the same network open it in a browser, update how many of a thing is in stock, and the ledger records what was taken out. When a count falls to its reorder line, PartSync emails someone that stock is low and needs ordering.

It sends that email once. Taking more while the item is still low does not send another. Bringing the count back above the line, then letting it fall again, sends a new one.

## Run it here

Node.js 20.9 or newer (22 is a good choice on a Pi).

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4747](http://127.0.0.1:4747). The dev server listens on every interface, so another device on the network can use this machine’s address, for example `http://192.168.1.20:4747`.

The cupboard starts empty. **Add an item** puts the first thing on the shelf. Low items are marked **Order**. **Email the order list** files a reorder note. Until a mail server is set up, the note waits under **Setup**.

## Counts, the ledger, and the reorder line

- **Add an item** with a name, the unit you count (reams, boxes, kg), the opening count, and an optional reorder line.
- Leave the reorder line blank and PartSync will never email about that item.
- **Take out** asks for a name, so the ledger shows who took it. You can’t take more than is in stock.
- **Book in** is a delivery or a return. **Correct count** is a stocktake. Both are logged.
- The order list is the things at or below their line. Print it, or email it.

## Email

Open **Setup**. Add the address (or addresses) that should hear about low stock, and the SMTP server that will send the mail.

A typical hosted mailbox:

| Field | Example |
| --- | --- |
| Host | `smtp.example.com` |
| Port | `587` |
| Encryption | STARTTLS |
| From | the mailbox address |

Port 465 uses SSL. A relay on the Pi’s own network can use no encryption. **Send a test email** checks the path. If the server isn’t filled in yet, reorder notes stay in the outbox and **Send waiting mail** tries them later.

The same settings can live in `.env.local` (see `.env.example`). Anything set there overrides the form, which is the better place for the SMTP password. Copy the example, fill in the values, and restart.

Put the Pi’s address in **Address on the network** (`http://192.168.1.20:4747`) if you want the email to include a link to the order list.

“Taken today” uses the time zone in Setup. It defaults to `Europe/London`, including when the Pi’s own clock is UTC.

## Raspberry Pi

A Pi 4 or Pi 5, with 2 GB of RAM or more, is a comfortable host. Raspberry Pi OS often ships a Node that is too old for this app. Run the installer as your normal user. It clones the repository to `~/PartSync` and builds there. `package.json` is in that folder.

```bash
git clone https://github.com/mrdomrocks/PartSync.git "$HOME/PartSync"
bash "$HOME/PartSync/deploy/install.sh"
```

The service listens on `0.0.0.0:4747`. From another computer, open `http://<the-pi-ip>:4747`. `hostname -I` prints the Pi’s address.

The database is `data/partsync.db`. Back it up with `npm run backup`, or stop the service and copy `data/partsync.db` together with the `-wal` and `-shm` files beside it.

## On the network

There is no login. Anyone who can open the address can change counts and the mail settings. Keep it on the workshop network. Don’t forward port 4747 to the internet.

## Checks

```bash
npm test
npm run lint
npm run build
```
