# install-youtube-cron.ps1
# Registra una tarea programada en Windows que corre youtube-signals-daily.ps1
# todos los días a las 08:00 AM hora local.
#
# Ejecutar UNA SOLA VEZ:
#   powershell -ExecutionPolicy Bypass -File install-youtube-cron.ps1
#
# Para ver el estado:    Get-ScheduledTask -TaskName "FinanceIa-YoutubeSignals"
# Para correr manual:    Start-ScheduledTask -TaskName "FinanceIa-YoutubeSignals"
# Para borrar:           Unregister-ScheduledTask -TaskName "FinanceIa-YoutubeSignals" -Confirm:$false

$taskName    = "FinanceIa-YoutubeSignals"
$projectRoot = "C:\Users\benja\Documents\Proyectos_IA\maia-skill"
$scriptPath  = Join-Path $projectRoot "youtube-signals-daily.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Error "No existe $scriptPath"
    exit 1
}

# Si ya existe, la borramos para re-crearla limpia
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Write-Host "Tarea '$taskName' ya existe, recreando..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action  = New-ScheduledTaskAction `
    -Execute  "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`"" `
    -WorkingDirectory $projectRoot

# Diaria 08:00 AM hora local. Si el PC está apagado, corre al volver al inicio.
$trigger = New-ScheduledTaskTrigger -Daily -At "08:00"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask `
    -TaskName    $taskName `
    -Description "Polling diario de canales YouTube de inversión (Finance.ia)" `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -RunLevel    Limited

Write-Host "[OK] Tarea '$taskName' registrada - corre todos los dias a las 08:00 AM" -ForegroundColor Green
Write-Host "  Logs:  $projectRoot\youtube_signals_log.txt"
Write-Host "  Probar ya:  Start-ScheduledTask -TaskName $taskName"
