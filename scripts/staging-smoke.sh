#!/usr/bin/env bash
set -euo pipefail
compose=(docker compose --env-file .env.staging.local -f docker-compose.staging.yml)
"${compose[@]}" config --quiet
for service in postgres web worker renderer; do
  id=$("${compose[@]}" ps -q "$service")
  test -n "$id"
  for attempt in {1..60}; do
    status=$(docker inspect --format '{{.State.Health.Status}}' "$id")
    if [[ "$status" == healthy ]]; then break; fi
    sleep 5
  done
  test "$status" = healthy
done
migration=$("${compose[@]}" ps -aq migrate)
test "$(docker inspect --format '{{.State.Status}}:{{.State.ExitCode}}' "$migration")" = exited:0
for service in postgres worker renderer; do
  id=$("${compose[@]}" ps -q "$service")
  test "$(docker inspect --format '{{len .HostConfig.PortBindings}}' "$id")" = 0
done
test "$(docker inspect --format '{{range $p, $bindings := .HostConfig.PortBindings}}{{range $bindings}}{{.HostIp}}{{end}}{{end}}' "$("${compose[@]}" ps -q web)")" = 127.0.0.1
marker="/data/.staging-smoke-$$-$RANDOM"
trap '"${compose[@]}" exec -T renderer rm -f "$marker"' EXIT
"${compose[@]}" exec -T renderer sh -c 'printf staging-smoke > "$1"' sh "$marker"
for service in web worker; do
  test "$("${compose[@]}" exec -T "$service" cat "$marker")" = staging-smoke
done
echo "Staging topology and persistence smoke checks passed."
