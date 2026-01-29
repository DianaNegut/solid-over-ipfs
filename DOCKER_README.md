# Quick Start - PostgreSQL Container pentru Credențiale

## Pornire rapidă

```powershell
# 1. Pornește PostgreSQL (doar credențiale)
docker-compose up -d

# 2. Setează variabilele de mediu pentru Solid Server
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_USER="solid_user"
$env:POSTGRES_PASSWORD="solid_password_change_me"
$env:POSTGRES_DB="solid_identity"

# 3. Pornește IPFS local (în alt terminal)
ipfs daemon

# 4. Pornește Solid Server local
npm start
```

## Ce se întâmplă?

- **PostgreSQL** (Docker) - Stochează conturi, logins, passwords, WebIDs, tokens
- **IPFS** (Local) - Stochează podurile și fișierele utilizatorilor  
- **Solid Server** (Local) - Serverul pe http://localhost:3000

## Oprire

```powershell
docker-compose down
```

## Documentație detaliată

Vezi [DOCKER_SETUP.md](DOCKER_SETUP.md) pentru detalii complete.
