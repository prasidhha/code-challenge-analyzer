$base = "http://localhost:3000"
$sess = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$login = @{ username = "candidate"; password = "candidate123" } | ConvertTo-Json
$u = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body $login -WebSession $sess
Write-Host "Logged in as:" $u.user.displayName

$s = Invoke-RestMethod -Method Post -Uri "$base/api/sessions" -ContentType "application/json" -Body (@{ problemId = 1 } | ConvertTo-Json) -WebSession $sess
Write-Host "Session:" $s.sessionId

$b1 = @{ sessionId = $s.sessionId; problemId = 1; code = "print('palindrome')" } | ConvertTo-Json
$r1 = Invoke-RestMethod -Method Post -Uri "$base/api/submissions" -ContentType "application/json" -Body $b1 -WebSession $sess
Write-Host "Run 1 passed:" $r1.passed "of" $r1.total

$b2 = @{ sessionId = $s.sessionId; problemId = 1; code = "w = input().strip()`nprint('palindrome' if w == w[::-1] else 'not palindrome')" } | ConvertTo-Json
$r2 = Invoke-RestMethod -Method Post -Uri "$base/api/submissions" -ContentType "application/json" -Body $b2 -WebSession $sess
Write-Host "Run 2 passed:" $r2.passed "of" $r2.total

try {
  Invoke-RestMethod -Uri "$base/api/sessions/$($s.sessionId)/history" -WebSession $sess | Out-Null
  Write-Host "FAIL - candidate reached reviewer endpoint"
} catch {
  Write-Host "Candidate blocked from history - status:" $_.Exception.Response.StatusCode.value__
}

$rsess = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$rlogin = @{ username = "reviewer"; password = "reviewer123" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType "application/json" -Body $rlogin -WebSession $rsess | Out-Null

$h = Invoke-RestMethod -Uri "$base/api/sessions/$($s.sessionId)/history" -WebSession $rsess
Write-Host "Reviewer sees run count:" $h.runCount "lines changed:" $h.diff.changed

