# Crea un acceso directo "Finance.ia" en el Desktop que lanza el dashboard con un click.

$scriptPath = "C:\Users\benja\Documents\Proyectos_IA\maia-skill\launch.ps1"
$shortcutPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"), "Finance.ia.lnk")

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$shortcut.WorkingDirectory = "C:\Users\benja\Documents\Proyectos_IA\maia-skill"
$shortcut.Description = "Abre Finance.ia en localhost:3420"
$shortcut.IconLocation = "C:\Windows\System32\shell32.dll,14"  # icono de globo/web
$shortcut.Save()

Write-Host "Acceso directo creado en el Desktop: Finance.ia" -ForegroundColor Green
