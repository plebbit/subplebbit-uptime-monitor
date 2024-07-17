# go to current folder
cd "$(dirname "$0")"
cd ..

docker rm -f plebbit-uptime-monitor 2>/dev/null

docker run \
  --detach \
  --name plebbit-uptime-monitor \
  --restart always \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  --volume=$(pwd):/usr/src/plebbit-uptime-monitor \
  --workdir="/usr/src/plebbit-uptime-monitor" \
  node:18 \
  npm install

docker run \
  --detach \
  --name plebbit-uptime-monitor \
  --restart always \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  --volume=$(pwd):/usr/src/plebbit-uptime-monitor \
  --workdir="/usr/src/plebbit-uptime-monitor" \
  node:18 \
  npm run monitor

docker logs --follow plebbit-uptime-monitor
