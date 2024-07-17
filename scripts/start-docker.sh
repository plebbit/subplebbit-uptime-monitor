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
  --publish 80:3000 \
  node:18 \
  sh -c "npm install; npm run monitor"

docker logs --follow plebbit-uptime-monitor
