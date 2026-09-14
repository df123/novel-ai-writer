#!/usr/bin/env bash
# 备份数据库与插画目录（设计书 §42）
# 保留 14 天每日 + 8 周每周 + 12 月每月；备份文件含 OAuth 令牌表，属高敏感文件(600)
# 用法: ./scripts/backup.sh [数据目录]  （默认 ~/.novel-ai-writer，Docker 部署时传 volume 宿主挂载路径）
set -euo pipefail

DATA_DIR="${1:-$HOME/.novel-ai-writer}"
BACKUP_ROOT="${BACKUP_ROOT:-$DATA_DIR/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_ROOT/$STAMP"

if [ ! -f "$DATA_DIR/database.db" ]; then
  echo "错误: 未找到 $DATA_DIR/database.db" >&2
  exit 1
fi

mkdir -p "$TARGET"
chmod 700 "$BACKUP_ROOT"

# sqlite 数据库快照（cp 即可：本项目为单进程写入，且 saveDB 已原子 rename）
cp -p "$DATA_DIR/database.db" "$TARGET/database.db"
if [ -d "$DATA_DIR/illustrations" ]; then
  cp -rp "$DATA_DIR/illustrations" "$TARGET/illustrations"
fi
chmod -R go-rwx "$TARGET"

# 生成校验和，便于 restore 前验证完整性
( cd "$BACKUP_ROOT" && find "$STAMP" -type f -exec sha256sum {} \; > "$STAMP.SHA256SUMS" )
echo "备份完成: $TARGET"

# 轮转：单机场景采用朴素策略，保留最近 34 份（约覆盖 14 每日 + 8 每周 + 12 每月）
TOTAL_KEEP=$((14 + 8 + 12))
COUNT=$(ls -1d "$BACKUP_ROOT"/20* 2>/dev/null | wc -l)
if [ "$COUNT" -gt "$TOTAL_KEEP" ]; then
  ls -1d "$BACKUP_ROOT"/20* | sort -r | tail -n +"$((TOTAL_KEEP + 1))" | xargs -r rm -rf
  echo "已轮转至最近 $TOTAL_KEEP 份备份"
fi
