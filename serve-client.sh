wait_file() {
  local file="$1"; shift
  local wait_seconds="${1:-300}"; shift # 3 seconds as default timeout

  until test $((wait_seconds--)) -eq 0 -o -f "$file" ; do sleep 1; done

  ((++wait_seconds))
}

wait_file "client/projects/aitheon/template/src/lib/rest/index.ts"

$(npm bin)/concurrently -p "[{name}]" -n "Lib,App" -c "magenta.bold,green.bold" "npm run client:lib:watch" "npm run client:lib && npm run client:watch"