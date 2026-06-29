param([string]$msg = "update")
Write-Host "Opravujem kodovanie..." -ForegroundColor Cyan
$enc = [System.Text.UTF8Encoding]::new($false)
Get-ChildItem -Path . -Recurse -Include @("*.ts","*.tsx","*.css","*.json") | Where-Object {
    $p = $_.FullName
    $p -notlike "*\node_modules\*" -and $p -notlike "*\.next\*" -and $p -notlike "*\.git\*"
} | ForEach-Object {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        if (($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) -or ($bytes.Length -gt 10 -and $bytes[1] -eq 0 -and $bytes[3] -eq 0)) {
            $content = [System.IO.File]::ReadAllText($_.FullName)
            [System.IO.File]::WriteAllText($_.FullName, $content, $enc)
            Write-Host "  Opraveny: $($_.Name)" -ForegroundColor Yellow
        }
    } catch {}
}
git add .
git commit -m $msg
git push
Write-Host "Hotovo!" -ForegroundColor Green