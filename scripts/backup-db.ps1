# ============================================================
#  backup-db.ps1 — Backup Supabase PostgreSQL tự động
#  Lưu file .sql có timestamp vào thư mục backups\
#  Tự động xóa backup cũ hơn 7 ngày
# ============================================================

# -- Cau hinh ----------------------------------------------------
$DB_HOST     = "aws-1-ap-northeast-1.pooler.supabase.com"
$DB_PORT     = "5432"
$DB_NAME     = "postgres"
$DB_USER     = "postgres.segbujtdyqkloxjuunac"
$DB_PASSWORD = 'N&wSE7kfN!$Cv?$'

$BACKUP_DIR  = "$PSScriptRoot\..\backups"
$KEEP_DAYS   = 7

# -- Tao thu muc backup neu chua co ------------------------------
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    Write-Host "Da tao thu muc: $BACKUP_DIR"
}

# -- Ten file backup theo ngay gio --------------------------------
$TIMESTAMP   = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BACKUP_FILE = "$BACKUP_DIR\gas-store_$TIMESTAMP.sql"

# -- Chay pg_dump -------------------------------------------------
Write-Host "Dang backup database..."

$env:PGPASSWORD = $DB_PASSWORD

& pg_dump `
    --host=$DB_HOST `
    --port=$DB_PORT `
    --username=$DB_USER `
    --dbname=$DB_NAME `
    --no-password `
    --format=plain `
    --no-owner `
    --no-acl `
    --file=$BACKUP_FILE

if ($LASTEXITCODE -eq 0) {
    $SIZE = [math]::Round((Get-Item $BACKUP_FILE).Length / 1KB, 1)
    Write-Host "Backup thanh cong: $BACKUP_FILE ($SIZE KB)"
} else {
    Write-Host "Backup that bai! Kiem tra lai ket noi hoac cai pg_dump."
    exit 1
}

# -- Xoa backup cu hon $KEEP_DAYS ngay ---------------------------
$OLD_FILES = Get-ChildItem "$BACKUP_DIR\gas-store_*.sql" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KEEP_DAYS) }

foreach ($f in $OLD_FILES) {
    Remove-Item $f.FullName
    Write-Host "Da xoa backup cu: $($f.Name)"
}

Write-Host ""
Write-Host "Thu muc backup: $BACKUP_DIR"
Write-Host "Tong so file backup: $((Get-ChildItem "$BACKUP_DIR\gas-store_*.sql").Count)"
