# Direct Business — production deploy backup
# Runs on a schedule. Snapshots the currently-live index.html to a Backups folder.
# Keep the last 30. Filename carries deploy timestamp + short commit hash.

param(
  [string]$BackupDir = "$env:USERPROFILE\Direct-Business-Backups",
  [string]$LiveUrl   = 'https://direct-business.vercel.app/',
  [string]$OwnerRepo = ''   # e.g. "abdoulmagd911/direct-b2b". Leave blank to skip commit-hash lookup.
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# Pull the live page. This is what actually got served to users — the authoritative snapshot.
$stamp = (Get-Date).ToString('yyyyMMdd-HHmm')
$sha   = 'unknown'
if ($OwnerRepo -ne '') {
  try {
    $latest = Invoke-RestMethod -Uri ("https://api.github.com/repos/{0}/commits/main" -f $OwnerRepo) -Headers @{ 'User-Agent'='direct-b2b-backup' } -TimeoutSec 15
    if ($latest.sha) { $sha = $latest.sha.Substring(0, 7) }
  } catch { }
}

$dest = Join-Path $BackupDir ("index-{0}-{1}.html" -f $stamp, $sha)
Invoke-WebRequest -UseBasicParsing -Uri $LiveUrl -OutFile $dest -TimeoutSec 60

Write-Output ("Backed up live app to: " + $dest)

# Retention: keep the newest 30 snapshots
Get-ChildItem -LiteralPath $BackupDir -Filter 'index-*.html' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 30 |
  Remove-Item -Force -ErrorAction SilentlyContinue

# If Google Drive Desktop is installed and syncing a folder that contains BackupDir,
# the snapshot is uploaded automatically. Otherwise the file sits locally until Ahmed
# copies the folder into whichever cloud drive he uses.
