# Docker Setup - PostgreSQL pentru Credențiale Solid

## Arhitectura

Acest setup folosește **DOAR 1 container Docker**:

1. **PostgreSQL** - Container Docker pentru credențiale (accounts, logins, passwords, WebIDs, tokens)

**IPFS și Solid Server rulează LOCAL** (nu în Docker):

## Separarea Storage-ului

### PostgreSQL (Persistent Identity Storage)
- ✅ Email/password logins
- ✅ Registered WebIDs  
- ✅ Credential tokens
- ✅ OIDC clients și sesiuni
- ✅ Cookies
- ✅ Account metadata

### IPFS (Distributed Pod Storage)
- ✅ Poduri utilizatori
- ✅ Fișiere și resurse
- ✅ Metadate RDF
- ✅ ACL (Access Control Lists)

## Pornirea sistemului

### 1. Pornește PostgreSQL (doar credențiale)

```powershell
# Din directorul CommunitySolidServer
docker-compose up -d
```

### 2. Pornește IPFS (local)

```powershell
# În terminal separat
ipfs daemon
```

### 3. Pornește Solid Server (local)

```powershell
# În terminal separat
npm start
```

### 4. Verifică status

```powershell
# PostgreSQL
docker-compose ps
docker-compose logs -f postgres

# Solid Server și IPFS - vezi terminalele respective
```

### 5. Oprește totul

```powershell
# PostgreSQL
docker-compose down

# IPFS și Solid Server - Ctrl+C în terminalele respective
```

## Configurare Variabile de Mediu

Pentru Solid Server local, setează în PowerShell:

```powershell
# PostgreSQL Connection (rulează local pe localhost:5432)
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_PORT="5432"
$env:POSTGRES_DB="solid_identity"
$env:POSTGRES_USER="solid_user"
$env:POSTGRES_PASSWORD="solid_password_change_me"

# IPFS local (deja rulează)
$env:IPFS_API_URL="http://127.0.0.1:5001"

# Pornește Solid Server
npm start
```

## Porturi

- **3000** - Community Solid Server (LOCAL)
- **5432** - PostgreSQL (Docker Container)
- **5001** - IPFS API (LOCAL)
- **8080** - IPFS Gateway (LOCAL)

## Backup și Restore

### Backup PostgreSQL

```powershell
docker exec solid-postgres pg_dump -U solid_user solid_identity > backup.sql
```

### Restore PostgreSQL

```powershell
cat backup.sql | docker exec -i solid-postgres psql -U solid_user solid_identity
```

### Backup IPFS

```powershell
docker exec solid-ipfs ipfs repo gc
docker cp solid-ipfs:/data/ipfs ./ipfs-backup
```

## Troubleshooting

### PostgreSQL nu se conectează

```powershell
# Verifică dacă PostgreSQL rulează
docker exec solid-postgres pg_isready -U solid_user

# Vezi logs
docker-compose logs postgres
```

### IPFS nu se conectează

```powershell
# Verifică dacă IPFS daemon rulează
ipfs id

# Repornește IPFS
# Ctrl+C în terminalul IPFS, apoi:
ipfs daemon
```

### Solid Server erori

```powershell
# Vezi dacă PostgreSQL e pornit
docker-compose ps

# Verifică conexiunea
docker exec solid-postgres psql -U solid_user -d solid_identity -c "SELECT 1;"
```

## Monitorizare

### PostgreSQL Database Size

```powershell
docker exec solid-postgres psql -U solid_user -d solid_identity -c "SELECT pg_size_pretty(pg_database_size('solid_identity'));"
```

### IPFS Repo Stats

```powershell
docker exec solid-ipfs ipfs repo stat
```

### Număr de conturi în PostgreSQL

```powershell
docker exec solid-postgres psql -U solid_user -d solid_identity -c "SELECT COUNT(*) FROM accounts;"
```

## Development vs Production

### Development (config actuală)

```yaml
POSTGRES_PASSWORD: solid_password_change_me  # ❌ SCHIMBĂ ÎN PRODUCȚIE!
```

### Production Recommendations

1. **Schimbă toate parolele** în `docker-compose.yml`
2. **Folosește Docker secrets** pentru credențiale
3. **Activează SSL** pentru PostgreSQL
4. **Limitează expunerea porturilor** (elimină `-p 5432:5432`)
5. **Setează backup automat** pentru PostgreSQL
6. **Folosește volume-uri managed** pentru date critice

## Curățare Automată

PostgreSQL rulează o funcție de cleanup pentru date expirate:

```sql
-- Rulează manual
SELECT cleanup_expired_data();
```

Sau setează un cron job în container pentru rulare zilnică.

## Stack Complet

```
┌──────────────┐
│   Frontend   │ (Port 3001) - LOCAL
└──────┬───────┘
       │
       ↓
┌──────────────────┐
│ Solid Server     │ (Port 3000) - LOCAL
└────┬──────┬──────┘
     │      │
     ↓      ↓
┌────────────┐  ┌──────────┐
│ PostgreSQL │  │   IPFS   │
│  (Docker)  │  │  (LOCAL) │
│   5432     │  │   5001   │
│            │  │          │
│ Credențiale│  │  Poduri  │
└────────────┘  └──────────┘
```
