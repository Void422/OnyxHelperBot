"""Deploy the prebuilt Onyx bot bundle to an isolated SSH account directory.

Credentials and the bot environment are accepted only through process
environment variables. The script never writes them locally or prints them.
"""

from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path

import paramiko


def decoded(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required deployment input: {name}")
    return base64.b64decode(value).decode("utf-8")


host = decoded("ONYX_DEPLOY_HOST_B64")
username = decoded("ONYX_DEPLOY_USER_B64")
password = decoded("ONYX_DEPLOY_PASSWORD_B64")
bot_environment = decoded("ONYX_BOT_ENV_B64")
archive = Path(decoded("ONYX_DEPLOY_ARCHIVE_B64")).resolve()
release_name = os.environ.get("ONYX_RELEASE_NAME", "")

if not archive.is_file():
    raise RuntimeError("The production archive does not exist")
if not re.fullmatch(r"[a-zA-Z0-9._-]{4,64}", release_name):
    raise RuntimeError("ONYX_RELEASE_NAME is invalid")

client = paramiko.SSHClient()
# The credential file identifies this dedicated host. This is a trust-on-first-
# use connection and does not alter the user's global SSH configuration.
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    host,
    username=username,
    password=password,
    timeout=20,
    allow_agent=False,
    look_for_keys=False,
)

sftp = client.open_sftp()
home = sftp.normalize(".")
root = f"{home}/apps/onyx"


def ensure_directory(path: str, mode: int = 0o700) -> None:
    try:
        sftp.stat(path)
    except OSError:
        sftp.mkdir(path, mode)


ensure_directory(f"{home}/apps")
ensure_directory(root)
for directory in ("runtime", "logs", "releases", "shared"):
    ensure_directory(f"{root}/{directory}")

remote_archive = f"{root}/releases/{release_name}.tar.gz"
sftp.put(str(archive), remote_archive)
with sftp.open(f"{root}/shared/.env", "w") as environment_file:
    environment_file.write(bot_environment)
sftp.chmod(f"{root}/shared/.env", 0o600)
sftp.close()

setup = f"""set -eu
ROOT="$HOME/apps/onyx"
RELEASE_NAME="{release_name}"
RELEASE="$ROOT/releases/$RELEASE_NAME"
ARCHIVE="$ROOT/releases/$RELEASE_NAME.tar.gz"
NODE_ROOT="$ROOT/runtime/node"
mkdir -p "$ROOT/runtime" "$ROOT/logs" "$ROOT/releases" "$ROOT/shared"
if [ ! -x "$NODE_ROOT/bin/node" ]; then
  DOWNLOAD="$ROOT/runtime/download"
  mkdir -p "$DOWNLOAD"
  curl -fsSL 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt' -o "$DOWNLOAD/SHASUMS256.txt"
  ARTIFACT=$(awk '/node-v.*-linux-x64.tar.xz$/ {{print $2; exit}}' "$DOWNLOAD/SHASUMS256.txt")
  test -n "$ARTIFACT"
  curl -fsSL "https://nodejs.org/dist/latest-v22.x/$ARTIFACT" -o "$DOWNLOAD/$ARTIFACT"
  (cd "$DOWNLOAD" && grep "  $ARTIFACT$" SHASUMS256.txt | sha256sum -c - >/dev/null)
  mkdir -p "$NODE_ROOT"
  tar -xJf "$DOWNLOAD/$ARTIFACT" -C "$NODE_ROOT" --strip-components=1
fi
NODE="$NODE_ROOT/bin/node"
NPM="$NODE_ROOT/lib/node_modules/npm/bin/npm-cli.js"
test ! -e "$RELEASE"
mkdir "$RELEASE"
tar -xzf "$ARCHIVE" -C "$RELEASE"
ln -s ../../shared/.env "$RELEASE/.env"
cd "$RELEASE"
"$NODE" "$NPM" ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null
"$NODE" apps/bot/dist/deploy-commands.js > "$ROOT/logs/commands.log" 2>&1
ln -sfn "releases/$RELEASE_NAME" "$ROOT/current"
READY_BEFORE=$(grep -c '\"event\":\"discord.ready\"' "$HOME/.pm2/logs/onyx-bot-out.log" 2>/dev/null || true)
if pm2 describe onyx-bot >/dev/null 2>&1; then
  pm2 restart onyx-bot --update-env >/dev/null
else
  pm2 start "$ROOT/current/apps/bot/dist/index.js" --name onyx-bot --interpreter "$NODE" --cwd "$ROOT/current" --time >/dev/null
fi
pm2 save >/dev/null
READY=no
i=0
while [ "$i" -lt 15 ]; do
  READY_AFTER=$(grep -c '\"event\":\"discord.ready\"' "$HOME/.pm2/logs/onyx-bot-out.log" 2>/dev/null || true)
  if [ "$READY_AFTER" -gt "$READY_BEFORE" ]; then READY=yes; break; fi
  i=$((i+1))
  sleep 1
done
STATUS=$(pm2 jlist | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{{try{{let p=JSON.parse(s).find(x=>x.name==="onyx-bot");process.stdout.write(p?.pm2_env?.status||"missing")}}catch{{process.stdout.write("unknown")}}}})')
PID=$(pm2 pid onyx-bot | tail -1)
RESTARTS=$(pm2 jlist | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{{try{{let p=JSON.parse(s).find(x=>x.name==="onyx-bot");process.stdout.write(String(p?.pm2_env?.restart_time??-1))}}catch{{process.stdout.write("-1")}}}})')
printf 'node=%s\\n' "$("$NODE" --version)"
printf 'status=%s\\n' "$STATUS"
printf 'pid=%s\\n' "$PID"
printf 'restarts=%s\\n' "$RESTARTS"
printf 'ready=%s\\n' "$READY"
printf 'commands=%s\\n' "$(grep -q 'commands.deployed' "$ROOT/logs/commands.log" && echo deployed || echo failed)"
"""

_, stdout, stderr = client.exec_command(setup, timeout=300)
output = stdout.read().decode("utf-8", errors="replace")
error_output = stderr.read().decode("utf-8", errors="replace")
exit_code = stdout.channel.recv_exit_status()
client.close()

print(
    json.dumps(
        {
            "exit_code": exit_code,
            "output": output,
            "error": error_output,
        }
    )
)
