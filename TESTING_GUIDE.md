# 🧪 Ghid Testare Rețea Privată IPFS

## Pasul 1: Verificare Înainte de Pornire

```bash
# Verifică că totul este configurat corect
node verify-private-network.js
```

**Ar trebui să vezi:**
- ✅ swarm.key is valid
- Instrucțiuni detaliate despre ce să cauți în loguri

## Pasul 2: Pornește Primul Nod

```bash
npm start -- -c config/ipfs-private.json -f .data1 -p 3001
```

### Ce Să Cauți în Loguri:

#### ✅ BINE - Rețea Privată Configurată Corect

```
Initializing embedded IPFS node with repo: ./.data1/.ipfs-private (PRIVATE NETWORK)
                                                                    ^^^^^^^^^^^^^^^^
                                                                    IMPORTANT!
```

#### ✅ BINE - ID Nod și Adrese

```
🔐 Private IPFS Node ID: QmABC123DEF456...
📡 Addresses:
   /ip4/127.0.0.1/tcp/4001/p2p/QmABC123DEF456...
   /ip4/192.168.1.100/tcp/4001/p2p/QmABC123DEF456...
```

**NOTEAZĂ Peer ID-ul:** `QmABC123DEF456...`

#### ✅ BINE - Swarm Key Setup

```
Using existing swarm key
```
sau
```
✅ Swarm key copied successfully
```

#### ❌ RĂU - Mesaje de Eroare

```
❌ Failed to create IPFS node
❌ swarm key not found
❌ Error: ENOENT
```

## Pasul 3: Verifică Serverul Funcționează

Deschide browser la: **http://localhost:3001**

Ar trebui să vezi interfața Community Solid Server.

## Pasul 4: Pornește Al Doilea Nod (Terminal Nou)

```bash
npm start -- -c config/ipfs-private.json -f .data2 -p 3002
```

### Ce Să Verifici:

1. **Același mesaj "PRIVATE NETWORK"**
2. **Peer ID diferit** (QmXYZ789...)
3. **Aceleași mesaje despre swarm key**

## Pasul 5: Verifică Conectivitatea Între Noduri

### Metoda 1: Verificare Manuală în Loguri

După 30-60 secunde, caută în logurile AMBELOR noduri:

**Semne bune de conectivitate:**
- Ambele noduri rulează fără erori
- Nu apar mesaje "connection refused"
- Nodurile au pornit corect

### Metoda 2: Creare Pod pe Nod 1

1. **Accesează** http://localhost:3001
2. **Creează un cont** 
3. **Creează un pod**
4. **Adaugă fișiere** în pod

### Metoda 3: Verifică Izolarea

**Test izolare de rețeaua publică:**

Nodurile tale NU ar trebui să:
- Se conecteze la noduri IPFS publice
- Apară în DHT-ul public IPFS
- Fie accesibile fără swarm.key

## Pasul 6: Test cu Swarm Key Diferit

Pentru a verifica că swarm key-ul chiar izolează rețeaua:

### Terminal 3 (Nod Izolat):

```bash
# Redenumește swarm key-ul actual
mv swarm.key swarm.key.backup

# Generează unul nou
node generate-swarm-key.js swarm.key.new

# Pornește nod cu cheia nouă
npm start -- -c config/ipfs-private.json -f .data3 -p 3003
```

**Rezultat așteptat:**
- Nodul 3 pornește cu succes
- Nodul 3 NU se conectează la Nodurile 1 și 2
- Nodul 3 are propriul său Peer ID
- Nodurile 1, 2 și 3 sunt în rețele separate

```bash
# Restaurează cheia originală
mv swarm.key.backup swarm.key
rm swarm.key.new
```

## 📊 Checklist Testare Completă

### Setup Inițial
- [ ] swarm.key generat și valid
- [ ] Configurații create (ipfs-private.json)
- [ ] Proiect compilat (npm run build)
- [ ] Firewall configurat (port 4001)

### Test Un Nod
- [ ] Nodul pornește fără erori
- [ ] Mesaj "PRIVATE NETWORK" apare în loguri
- [ ] Peer ID afișat în loguri
- [ ] Adrese listate în loguri
- [ ] Server accesibil pe http://localhost:3001
- [ ] Poți crea un cont și pod

### Test Două Noduri
- [ ] Ambele noduri pornesc fără erori
- [ ] Fiecare are Peer ID unic
- [ ] Ambele folosesc același swarm.key
- [ ] Nu apar erori de conexiune
- [ ] Poduri pot fi create pe ambele noduri

### Test Izolare
- [ ] Nod cu swarm.key diferit nu se conectează
- [ ] Nodurile nu apar în DHT public
- [ ] Doar noduri cu același swarm.key comunică

## 🔍 Troubleshooting

### Nodul nu pornește

**Verifică:**
```bash
# Swarm key există?
Test-Path swarm.key

# Configurația este corectă?
node test-private-network.js

# Portul este liber?
netstat -an | findstr 3001
netstat -an | findstr 4001
```

### "Failed to create IPFS node"

**Soluții:**
1. Șterge repo-ul IPFS și încearcă din nou:
   ```bash
   rm -rf .data1/.ipfs-private
   npm start -- -c config/ipfs-private.json -f .data1 -p 3001
   ```

2. Verifică că modulul IPFS este instalat:
   ```bash
   npm install
   ```

### Nodurile nu se conectează

**Verificări:**

1. **Același swarm.key?**
   ```bash
   Get-FileHash .data1/.ipfs-private/swarm.key
   Get-FileHash .data2/.ipfs-private/swarm.key
   # Hash-urile trebuie să fie identice!
   ```

2. **Port 4001 deschis?**
   ```bash
   # Testează local
   Test-NetConnection -ComputerName localhost -Port 4001
   ```

3. **Firewall blochează?**
   ```powershell
   # Adaugă regulă firewall (PowerShell ca Administrator)
   New-NetFirewallRule -DisplayName "IPFS Private" -Direction Inbound -LocalPort 4001 -Protocol TCP -Action Allow
   ```

### Peer ID nu apare în loguri

**Cauze posibile:**
- Nodul IPFS nu a pornit complet
- Erori în configurație
- Modul IPFS nu este instalat

**Soluție:**
```bash
# Verifică versiunea Node.js
node --version  # Trebuie >= 18.0

# Reinstalează dependențele
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## 📈 Testare Avansată

### Test Performanță

```bash
# Terminal 1 - Server
npm start -- -c config/ipfs-private.json -f .data1 -p 3001

# Terminal 2 - Client test
# Creează multiple fișiere și măsoară timpul
```

### Test Scalabilitate

Pornește 5 noduri simultan:

```bash
# Script automat (creează acest fișier)
for i in {1..5}; do
  npm start -- -c config/ipfs-private.json -f .data$i -p 300$i &
done
```

Toate nodurile ar trebui să:
- Pornească fără erori
- Aibă Peer ID-uri unice
- Se descopere reciproc

### Test Sincronizare Date

1. Creează pod pe Nodul 1
2. Adaugă fișier mare (ex: 10MB)
3. Verifică că este accesibil de pe Nodul 2
4. Măsoară timpul de sincronizare

## 💡 Tips pentru Testare

1. **Folosește terminale separate** pentru fiecare nod - ușor de monitorizat
2. **Păstrează un log** cu Peer ID-urile - util pentru debugging
3. **Testează periodic** după modificări de cod
4. **Monitorizează resursele** - CPU, RAM, Network
5. **Backup la swarm.key** înainte de teste extinse

## 📚 Resurse Suplimentare

- [PRIVATE_IPFS_NETWORK.md](PRIVATE_IPFS_NETWORK.md) - Documentație completă
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Detalii implementare
- [IPFS_BACKEND.md](IPFS_BACKEND.md) - Info despre backend IPFS

---

**Succes cu testarea! 🚀**
