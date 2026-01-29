# Start Solid Server with PostgreSQL backend
Write-Host "🚀 Starting Solid Server with PostgreSQL..." -ForegroundColor Cyan

# Set PostgreSQL environment variables
$env:POSTGRES_HOST = "localhost"
$env:POSTGRES_PORT = "5432"
$env:POSTGRES_DB = "solid_identity"
$env:POSTGRES_USER = "solid_user"
$env:POSTGRES_PASSWORD = "solid_password_change_me"

Write-Host "✅ Environment variables set" -ForegroundColor Green
Write-Host "   POSTGRES_HOST: $env:POSTGRES_HOST" -ForegroundColor Yellow
Write-Host "   POSTGRES_DB: $env:POSTGRES_DB" -ForegroundColor Yellow

# Start the server
Write-Host "`n🔷 Starting Community Solid Server..." -ForegroundColor Cyan
npm start -- -c config/ipfs-with-postgres.json -f .data1 -p 3000
