$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path '.venv/Scripts/python.exe')) { python -m venv .venv }
& .venv/Scripts/python.exe -m pip install -r requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Python install failed' }
Push-Location apps/web
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
Pop-Location
& .venv/Scripts/python.exe -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
& .venv/Scripts/python.exe -m apps.api.seed
if ($LASTEXITCODE -ne 0) { throw 'Seed failed' }
& .venv/Scripts/python.exe -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
