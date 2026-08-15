$base = "http://localhost:3000"
$sess = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$body = @{ username = "candidate"; password = "candidate123" } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body $body -WebSession $sess
Write-Host "Logged in as:" $r.user.displayName "role:" $r.user.role

$me = Invoke-RestMethod -Uri "$base/api/auth/me" -WebSession $sess
Write-Host "Me:" $me.user.username

Invoke-RestMethod -Method Post -Uri "$base/api/auth/logout" -WebSession $sess | Out-Null
Write-Host "Logged out"

try {
  Invoke-RestMethod -Uri "$base/api/auth/me" -WebSession $sess | Out-Null
  Write-Host "FAIL - still authenticated"
} catch {
  Write-Host "PASS - rejected after logout"
}