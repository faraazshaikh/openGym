#!/bin/sh
# Nightly backup of Fitrix's data folder (accounts, passkeys, every user's workouts, uploads).
# Install: crontab -e  ->  15 3 * * * /opt/fitrix/contrib/vps/backup.sh
# Keeps the last 14 archives. Copy them off the server now and then: a backup on the same disk
# does not survive the disk.
set -eu
APP=/opt/fitrix
OUT=/var/backups/fitrix
mkdir -p "$OUT"
tar czf "$OUT/fitrix-data-$(date +%Y%m%d).tgz" -C "$APP" data
ls -1t "$OUT"/fitrix-data-*.tgz | tail -n +15 | xargs -r rm --
