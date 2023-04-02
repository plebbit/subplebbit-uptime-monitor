# go to current folder
cd "$(dirname "$0")"
cd ..

docker rm -f subplebbit-uptime-monitor 2>/dev/null

docker run \
  --detach \
  --name subplebbit-uptime-monitor \
  --restart always \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  --volume=$(pwd):/usr/src/subplebbit-uptime-monitor \
  --workdir="/usr/src/subplebbit-uptime-monitor" \
  node:16 \
  npm run monitor

docker logs --follow subplebbit-uptime-monitor
