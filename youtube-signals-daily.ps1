# youtube-signals-daily.ps1
# Wrapper para el polling diario de YouTube — invocado por la tarea programada.
# Loguea stdout y stderr a youtube_signals_log.txt para debugging.

$ErrorActionPreference = "Continue"
$projectRoot = "C:\Users\benja\Documents\Proyectos_IA\maia-skill"
$logFile     = Join-Path $projectRoot "youtube_signals_log.txt"

Set-Location $projectRoot

# Forzar Python a emitir UTF-8 en stdout y stderr
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8       = "1"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"`n=== $timestamp ===" | Out-File -FilePath $logFile -Append -Encoding utf8

# Delegar la redirección a cmd para evitar que PowerShell envuelva stderr
# de comandos nativos como NativeCommandError (ver issue PS 5.1).
# --max 5 → revisa los últimos 5 videos por canal; los ya procesados se saltan
& cmd /c "python youtube_signals.py --max 5 >> ""$logFile"" 2>&1"
$exitCode = $LASTEXITCODE

"--- exit code: $exitCode ---" | Out-File -FilePath $logFile -Append -Encoding utf8
exit $exitCode
