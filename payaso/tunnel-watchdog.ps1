while ($true) {
    Write-Host "Iniciando tunel localtunnel en puerto 4000 (subdomain: carhide-vip-filter)..."
    npx --yes localtunnel --port 4000 --subdomain carhide-vip-filter
    Write-Host "Tunel desconectado. Reintentando en 3 segundos..."
    Start-Sleep -Seconds 3
}
