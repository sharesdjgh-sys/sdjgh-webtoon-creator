#!/usr/bin/env bash
set -euo pipefail

# 운영 저장소의 읽기 전용 스냅샷을 만든다. 서버 밖 복사는 별도 단계에서 검증한다.
source_dir=${1:?usage: create-webtoon-backup.sh SOURCE_DIR BACKUP_DIR}
backup_dir=${2:?usage: create-webtoon-backup.sh SOURCE_DIR BACKUP_DIR}
source_dir=$(realpath -- "$source_dir")
backup_dir=$(realpath -m -- "$backup_dir")

if [[ ! -d "$source_dir" || "$source_dir" == / || "$backup_dir" == "$source_dir" || "$backup_dir" == "$source_dir"/* ]]; then
  echo 'invalid_backup_paths' >&2
  exit 2
fi

install -d -m 700 -- "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary=$(mktemp -- "$backup_dir/.webtoon-$stamp-XXXXXXXX.tar")
trap 'rm -f -- "$temporary"' EXIT
tar --sort=name --one-file-system -C "$source_dir" -cf "$temporary" .
tar -tf "$temporary" >/dev/null
final="$backup_dir/webtoon-$stamp.tar"
if [[ -e "$final" ]]; then
  echo 'backup_name_collision' >&2
  exit 3
fi
mv -- "$temporary" "$final"
trap - EXIT
chmod 600 -- "$final"
sha256sum -- "$final" > "$final.sha256"
chmod 600 -- "$final.sha256"
printf '%s\n' "$final"
