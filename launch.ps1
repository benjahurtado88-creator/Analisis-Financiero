# Finance.ia — Launcher
# Inicia el servidor si no está corriendo, luego abre el browser.

$port = 3420
$dashboardPath = "C:\Users\benja\Documents\Proyectos_IA\maia-skill\dashboard"
$url = "http://localhost:$port"

function Test-Port {
    param($p)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", $p)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

$serverRunning = Test-Port $port

if (-not $serverRunning) {
    Write-Host "Iniciando Finance.ia en puerto $port..." -ForegroundColor Cyan

    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c cd /d `"$dashboardPath`" && npm run dev -- -p $port" `
        -WindowStyle Minimized

    # Esperar hasta que el servidor responda (max 60s)
    $attempts = 0
    while (-not (Test-Port $port) -and $attempts -lt 30) {
        Start-Sleep -Seconds 2
        $attempts++
        Write-Host "  Esperando... ($($attempts * 2)s)" -ForegroundColor DarkGray
    }

    if (Test-Port $port) {
        Write-Host "Servidor listo." -ForegroundColor Green
    } else {
        Write-Host "El servidor tardó más de lo esperado. Abriendo de todas formas..." -ForegroundColor Yellow
    }
} else {
    Write-Host "Servidor ya corriendo en puerto $port." -ForegroundColor Green
}

Start-Process $url
