$base = "http://localhost:3000"

$s = Invoke-RestMethod -Method Post -Uri "$base/api/sessions" -ContentType "application/json" -Body (@{ problemId = 1 } | ConvertTo-Json)
Write-Host "Session:" $s.sessionId

$b1 = @{ sessionId = $s.sessionId; problemId = 1; code = "print('palindrome')" } | ConvertTo-Json
$r1 = Invoke-RestMethod -Method Post -Uri "$base/api/submissions" -ContentType "application/json" -Body $b1
Write-Host "Run 1 passed:" $r1.passed "of" $r1.total

$b2 = @{ sessionId = $s.sessionId; problemId = 1; code = "w = input().strip()`nprint('palindrome' if w == w[::-1] else 'not palindrome')" } | ConvertTo-Json
$r2 = Invoke-RestMethod -Method Post -Uri "$base/api/submissions" -ContentType "application/json" -Body $b2
Write-Host "Run 2 passed:" $r2.passed "of" $r2.total

$h = Invoke-RestMethod -Uri "$base/api/sessions/$($s.sessionId)/history"
Write-Host "Run count:" $h.runCount
Write-Host "Lines changed:" $h.diff.changed
$h.timeline | Format-Table