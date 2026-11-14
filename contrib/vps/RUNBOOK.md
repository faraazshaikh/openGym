# Fitrix on the Hostinger VPS

A step-by-step for putting the Fitrix server on a VPS that already runs other things. It is written
so that nothing here touches your existing sites, n8n or the Jarvis agents: Fitrix listens on
`127.0.0.1:8085` only, in its own folder (`/opt/fitrix`), with its own containers.

Replace `YOUR_DOMAIN` everywhere with the new domain. Run the steps as root over SSH.

## 0. Before anything else

In Hostinger hPanel, open the VPS, then Snapshots, and take a snapshot. The server holds live
systems; a snapshot is the undo button for everything below.

## 1. Domain and DNS

1. Buy the domain.
2. Add one DNS record at the domain's DNS: type `A`, name `@`, value `187.77.174.87`.
3. Wait until this prints the VPS address (it can take a few minutes up to an hour):

```sh
dig +short YOUR_DOMAIN
```

## 2. Look before you build (read-only)

```sh
docker compose version        # needs 2.24.4 or newer
ss -ltn | grep 8085           # must print nothing (the port is free)
ss -ltnp | grep -E ':(80|443)\s'   # shows which program holds web traffic: nginx, caddy, traefik, docker-proxy
df -h /                       # at least 10 GB free
free -h                       # the build wants about 2 GB free
```

If a line is not as described, stop and fix that first. The answer to the fourth command decides
which proxy file you use in step 5.

## 3. Get the code and settings

```sh
git clone --branch feat/fitinit-home https://github.com/faraazshaikh/openGym.git /opt/fitrix
cd /opt/fitrix
cp contrib/vps/env.vps.example .env
sed -i 's/YOUR_DOMAIN/the.real.domain/g' .env
```

Once the work is merged to `main`, clone `main` instead.

## 4. Build and start

The first build takes several minutes and uses a lot of CPU. Do it when n8n is quiet.

```sh
cd /opt/fitrix
docker compose -f docker-compose.yml -f contrib/vps/docker-compose.vps.yml up -d --build
curl -s http://127.0.0.1:8085/api/health
```

The last command should answer with a short JSON line saying the server is fine.

## 5. HTTPS in front of it

Use the file that matches what step 2 showed.

**nginx**

```sh
cp /opt/fitrix/contrib/vps/nginx-fitrix.conf /etc/nginx/sites-available/fitrix
sed -i 's/YOUR_DOMAIN/the.real.domain/g' /etc/nginx/sites-available/fitrix
ln -s /etc/nginx/sites-available/fitrix /etc/nginx/sites-enabled/fitrix
nginx -t && systemctl reload nginx
certbot --nginx -d the.real.domain
```

`nginx -t` must say "syntax is ok" before the reload. If it does not, remove the link and stop.

**Caddy**: add `contrib/vps/Caddyfile.snippet` to the existing Caddyfile with the real domain, then
`caddy reload`.

**Traefik or Cloudflare Tunnel**: route the domain to `http://127.0.0.1:8085`. Leave
`CF_CONNECTING_IP` unset unless Cloudflare really is in front.

Check from your own computer: `https://the.real.domain/api/health` answers over HTTPS.

## 6. Register yourself as the admin

1. Open `https://the.real.domain` in a browser and create your profile with a passkey. The first
   profile on a fresh server becomes the admin (`FIRST_USER_ADMIN=1`).
2. Open Settings. An "Admin dashboard" link should be there. If it is not, stop and tell me.

## 7. Close the door behind you

Edit `/opt/fitrix/.env`: remove the `#` before `INVITE_ONLY=1` and `ALLOW_GUEST=0`, then:

```sh
cd /opt/fitrix
docker compose -f docker-compose.yml -f contrib/vps/docker-compose.vps.yml up -d
```

Now only people with an invite code can sign up. You make the codes in the Admin dashboard.

You are the only admin and passkeys live on your phone or browser. Read the "Password sign-in" part
of `docs/SELF_HOSTING.md` and decide whether to also switch on `PASSWORD_LOGIN=1`, so losing a
device does not lock you out.

## 8. Backups

```sh
chmod +x /opt/fitrix/contrib/vps/backup.sh
crontab -e     # add: 15 3 * * * /opt/fitrix/contrib/vps/backup.sh
```

Also copy `/var/backups/fitrix` somewhere off the server now and then. Hostinger snapshots cover
the whole disk, but they are not a substitute for a copy of `data/`.

## 9. Connect the phone app

In a signed-in browser: Settings, Account, "Pair the mobile app". In the app: Settings, "Server &
sync", enter `https://the.real.domain` and the code. The details and the common errors are in
`docs/MOBILE.md`.

## Updating later

```sh
cd /opt/fitrix && git pull
docker compose -f docker-compose.yml -f contrib/vps/docker-compose.vps.yml up -d --build
```

The `data/` folder is never touched by an update.

## Undoing it

```sh
cd /opt/fitrix
docker compose -f docker-compose.yml -f contrib/vps/docker-compose.vps.yml down
rm /etc/nginx/sites-enabled/fitrix && nginx -t && systemctl reload nginx
```

That stops Fitrix and removes it from the proxy. `data/` stays until you delete `/opt/fitrix`.
