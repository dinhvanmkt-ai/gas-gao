# ============================================================
#  setup-auto-backup.ps1
#  Dat Windows Task Scheduler chay backup-db.ps1 moi ngay 2h sang
#  Chay script nay 1 lan duy nhat voi quyen Administrator
# ============================================================

$TASK_NAME   = "GasStoreBackup"
$SCRIPT_PATH = "$PSScriptRoot\backup-db.ps1"
$RUN_HOUR    = 2   # 2h sang moi ngay

# Xoa task cu neu co
if (Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
    Write-Host "Da xoa task cu."
}

# Tao task moi
$Action  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NonInteractive -File `"$SCRIPT_PATH`""

$Trigger = New-ScheduledTaskTrigger -Daily -At "$($RUN_HOUR):00"

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action   $Action `
    -Trigger  $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host "Da dat lich: Task '$TASK_NAME' chay moi ngay luc $($RUN_HOUR)h sang."
Write-Host "De chay thu ngay: Start-ScheduledTask -TaskName '$TASK_NAME'"
