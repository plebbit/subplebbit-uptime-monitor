#!/usr/bin/env bash

# deploy to a server

# go to current folder
cd "$(dirname "$0")"
cd ..

# add env vars
if [ -f .deploy-env ]; then
  export $(echo $(cat .deploy-env | sed 's/#.*//g'| xargs) | envsubst)
fi

# check creds
if [ -z "${DEPLOY_HOST+xxx}" ]; then echo "DEPLOY_HOST not set" && exit; fi
if [ -z "${DEPLOY_USER+xxx}" ]; then echo "DEPLOY_USER not set" && exit; fi
if [ -z "${DEPLOY_PASSWORD+xxx}" ]; then echo "DEPLOY_PASSWORD not set" && exit; fi

SUBPLEBBITS=$(node -e "fetch('https://raw.githubusercontent.com/plebbit/temporary-default-subplebbits/master/multisub.json ').then(res => res.json()).then(multisub => console.log(multisub.subplebbits.map(subplebbit => subplebbit.address).join('\n')))")

SCRIPT="
cd /home
git clone https://github.com/plebbit/subplebbit-uptime-monitor.git
cd subplebbit-uptime-monitor
git reset HEAD --hard
git pull
npm install

# download subs from github
echo '$SUBPLEBBITS' > subplebbits.txt
"

# execute script over ssh
echo "$SCRIPT" | sshpass -p "$DEPLOY_PASSWORD" ssh "$DEPLOY_USER"@"$DEPLOY_HOST"

# copy files
FILE_NAMES=(
  # ".env"
  # "subplebbits.txt"
  "config.js"
)

# copy files
for FILE_NAME in ${FILE_NAMES[@]}; do
  sshpass -p "$DEPLOY_PASSWORD" scp $FILE_NAME "$DEPLOY_USER"@"$DEPLOY_HOST":/home/subplebbit-uptime-monitor
done

SCRIPT="
cd /home/subplebbit-uptime-monitor
scripts/start-docker.sh
"

echo "$SCRIPT" | sshpass -p "$DEPLOY_PASSWORD" ssh "$DEPLOY_USER"@"$DEPLOY_HOST"
