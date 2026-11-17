param(
  [Parameter(Mandatory = $true)][string]$SshTarget,
  [Parameter(Mandatory = $true)][string]$KeyPath,
  [Parameter(Mandatory = $true)][string]$RemoteSource,
  [Parameter(Mandatory = $true)][string]$RemoteBackupDir,
  [Parameter(Mandatory = $true)][string]$LocalBackupDir,
  [string]$RemoteScript = '/home/ubuntu/webtoon-ops/create-webtoon-backup.sh'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($SshTarget -notmatch '^[A-Za-z0-9.@-]+$') { throw 'Invalid SSH target' }
foreach ($item in @($RemoteSource, $RemoteBackupDir, $RemoteScript)) {
  if ($item -notmatch '^/[A-Za-z0-9_./-]+$' -or $item.Contains('..')) { throw 'Invalid remote path' }
}
if (-not [IO.File]::Exists($KeyPath)) { throw 'SSH key not found' }
$destinationRoot = [IO.Path]::GetFullPath($LocalBackupDir)
if (-not [IO.Path]::IsPathRooted($LocalBackupDir)) { throw 'Absolute local backup directory required' }
[IO.Directory]::CreateDirectory($destinationRoot) | Out-Null

# 원격 서버가 읽기 전용 tar와 체크섬을 만든 뒤, 로컬 PC로 모두 가져와 다시 대조한다.
$result = @(& ssh -i $KeyPath -o BatchMode=yes -o ConnectTimeout=15 $SshTarget "bash $RemoteScript $RemoteSource $RemoteBackupDir")
if ($LASTEXITCODE -ne 0) { throw 'Remote backup creation failed' }
$archive = [string]($result | Select-Object -Last 1)
if ($archive -notmatch '^/[A-Za-z0-9_./-]+\.tar$' -or $archive.Contains('..')) { throw 'Invalid remote archive path' }
$filename = [IO.Path]::GetFileName($archive)
$localArchive = Join-Path $destinationRoot $filename
$localChecksum = "$localArchive.sha256"
if ([IO.File]::Exists($localArchive) -or [IO.File]::Exists($localChecksum)) { throw 'Backup already exists locally' }

& scp -i $KeyPath -o BatchMode=yes -o ConnectTimeout=15 "${SshTarget}:$archive" "$localArchive.partial"
if ($LASTEXITCODE -ne 0) { throw 'Archive transfer failed; partial file retained for inspection' }
& scp -i $KeyPath -o BatchMode=yes -o ConnectTimeout=15 "${SshTarget}:$archive.sha256" "$localChecksum.partial"
if ($LASTEXITCODE -ne 0) { throw 'Checksum transfer failed; partial files retained for inspection' }
$expected = ([IO.File]::ReadAllText("$localChecksum.partial") -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath "$localArchive.partial").Hash.ToLowerInvariant()
if ($expected -notmatch '^[0-9a-f]{64}$' -or $actual -ne $expected) { throw 'Backup checksum mismatch; partial files retained for inspection' }
Move-Item -LiteralPath "$localArchive.partial" -Destination $localArchive
Move-Item -LiteralPath "$localChecksum.partial" -Destination $localChecksum
Write-Output "Verified off-server backup: $localArchive"
