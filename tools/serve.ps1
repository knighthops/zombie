# Local dev server for Zombie (Node isn't installed on this machine).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1
# Serves zombie-v1.1/dist at http://127.0.0.1:4173
# POST /__capture?name=<a-z0-9-> with a PNG data URL body saves docs/guide/img/<name>.png
# (lets an agent save the battlefield canvas: fetch('/__capture?name=x',{method:'POST',body:canvas.toDataURL()}))
$repo = Split-Path -Parent $PSScriptRoot
$root = Join-Path $repo 'zombie-v1.1\dist'
$img = Join-Path $repo 'docs\guide\img'
$types = @{ '.html'='text/html'; '.css'='text/css'; '.js'='text/javascript'; '.svg'='image/svg+xml'; '.png'='image/png'; '.webmanifest'='application/manifest+json'; '.json'='application/json' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://127.0.0.1:4173/')
$l.Start()
Write-Output 'Local: http://127.0.0.1:4173'
while ($l.IsListening) {
  $c = $l.GetContext()
  $req = $c.Request
  try {
    if ($req.HttpMethod -eq 'POST' -and $req.Url.AbsolutePath -eq '/__capture') {
      $name = $req.QueryString['name']
      if ($name -notmatch '^[a-z0-9-]{1,40}$') { throw 'bad name' }
      $body = (New-Object System.IO.StreamReader($req.InputStream)).ReadToEnd()
      $b64 = $body -replace '^data:image/png;base64,', ''
      New-Item -ItemType Directory -Force $img | Out-Null
      [System.IO.File]::WriteAllBytes((Join-Path $img "$name.png"), [Convert]::FromBase64String($b64))
      $c.Response.StatusCode = 204
    } else {
      $p = $req.Url.AbsolutePath.TrimStart('/')
      if ($p -eq '') { $p = 'index.html' }
      $f = [System.IO.Path]::GetFullPath((Join-Path $root $p))
      if (-not $f.StartsWith($root)) { throw 'outside root' }
      $b = [System.IO.File]::ReadAllBytes($f)
      $t = $types[[System.IO.Path]::GetExtension($f)]
      if ($t) { $c.Response.ContentType = $t }
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    }
  } catch { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
