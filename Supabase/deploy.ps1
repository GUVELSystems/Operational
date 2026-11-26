<#
  deploy.ps1 — sube esta carpeta a tu proyecto Supabase (migraciones, secretos y Edge Functions) sin instalar nada global.
  Usa el CLI vía npx. El CLI exige una carpeta "supabase/" en minúsculas, así que se arma una copia temporal.
  Uso (PowerShell, desde esta carpeta):
     .\deploy.ps1 -ProjectRef abcdefghijklmnop            # todo: link + migraciones + secretos + funciones
     .\deploy.ps1 -ProjectRef abcdefghijklmnop -Step db   # solo migraciones   (db | secrets | functions | all)
  La contraseña de la base de datos te la pide el CLI en pantalla; no se guarda en ningún archivo.
#>
param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [ValidateSet('db', 'secrets', 'functions', 'all')][string]$Step = 'all'
)
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$work = Join-Path $env:TEMP 'guvel-deploy'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force (Join-Path $work 'supabase') | Out-Null
# Copia (sin node_modules, sin .env real, sin el ejecutor de pruebas locales)
Get-ChildItem $src -Force | Where-Object { $_.Name -notin 'node_modules', '.env', 'deploy.ps1', 'tests' } | ForEach-Object { Copy-Item $_.FullName (Join-Path $work 'supabase') -Recurse -Force }
Copy-Item (Join-Path $src 'tests') (Join-Path $work 'supabase\tests') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $work 'supabase\tests\node_modules') -Recurse -Force -ErrorAction SilentlyContinue

# Nota: los argumentos se pasan como arreglo explícito (con @args el CLI v3 recibía mal las banderas y solo mostraba su ayuda).
function Sb { param([string[]]$Cmd) $a = @('--yes', 'supabase@latest', '--workdir', $work) + $Cmd; & npx @a; if ($LASTEXITCODE -ne 0) { throw "supabase $($Cmd -join ' ') terminó con error $LASTEXITCODE" } }
if (-not $env:SUPABASE_DB_PASSWORD) {   # entrada oculta; solo vive en este proceso, no se escribe en ningún archivo
  $sec = Read-Host 'Contraseña de la base de datos de Supabase (no se ve al escribir)' -AsSecureString
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}

Write-Host "`n== Enlazando con el proyecto $ProjectRef " -ForegroundColor Cyan
Sb @('link', '--project-ref', $ProjectRef)

if ($Step -in 'db', 'all') {
  Write-Host "`n== Aplicando migraciones (0001 → 0004)" -ForegroundColor Cyan
  Sb @('db', 'push', '--remote')
}
if ($Step -in 'secrets', 'all') {
  $envFile = Join-Path $src '.env'
  if (Test-Path $envFile) { Write-Host "`n== Cargando secretos de las funciones" -ForegroundColor Cyan; Sb @('secrets', 'set', '--env-file', $envFile, '--project-ref', $ProjectRef) }
  else { Write-Host "`n(Sin .env: copia .env.example a .env y rellénalo para cargar secretos; se omite este paso)" -ForegroundColor Yellow }
}
if ($Step -in 'functions', 'all') {
  Write-Host "`n== Desplegando Edge Functions" -ForegroundColor Cyan
  Sb @('functions', 'deploy', 'create-company', '--project-ref', $ProjectRef)
  Sb @('functions', 'deploy', 'invite-user', '--project-ref', $ProjectRef)
  Sb @('functions', 'deploy', 'accept-invite', '--project-ref', $ProjectRef, '--no-verify-jwt')
}
Write-Host "`nListo. Siguiente: crear la empresa madre (ver INICIO.md, paso 4)." -ForegroundColor Green
