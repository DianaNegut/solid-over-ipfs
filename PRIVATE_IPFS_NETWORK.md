# Rețea Privată IPFS pentru Community Solid Server

Acest ghid te ajută să configurezi o rețea privată IPFS pentru serverul tău Community Solid Server.

## Ce este o rețea privată IPFS?

O rețea privată IPFS este o rețea izolată în care doar nodurile cu aceeași cheie de swarm (swarm key) pot comunica între ele. Acest lucru oferă:

- 🔐 **Confidențialitate**: Doar nodurile autorizate pot accesa rețeaua
- 🛡️ **Securitate**: Datele nu sunt partajate cu rețeaua IPFS publică
- 🎯 **Control complet**: Tu controlezi toate nodurile din rețea
- 🚀 **Performanță**: Comunicare mai rapidă între noduri cunoscute

## Arhitectura Implementării

### Componente Modificate

1. **IpfsHelper** (`src/storage/ipfs/IpfsHelper.ts`)
   - Suport pentru swarm keys
   - Auto-generare de chei dacă nu există
   - Configurare automată pentru rețea privată

2. **Configurații noi**:
   - `config/ipfs-private.json` - Configurație principală
   - `config/storage/backend/ipfs-private.json` - Backend privat
   - `config/storage/backend/data-accessors/ipfs-private.json` - Configurare IpfsHelper

## Instalare și Configurare

### Pasul 1: Pregătire Proiect

```bash
# Asigură-te că dependențele sunt instalate
npm install

# Compilează proiectul
npm run build
```

### Pasul 2: Generare Swarm Key

Generează o cheie de swarm pentru rețeaua ta privată:

```bash
node generate-swarm-key.js
```

Aceasta va crea un fișier `swarm.key` în directorul rădăcină. Această cheie trebuie păstrată în siguranță și distribuită doar nodurilor din rețeaua ta.

**Format swarm.key:**
```
/key/swarm/psk/1.0.0/
/base16/
<64 caractere hexazecimale>
```

### Pasul 3: Verificare Setup

Rulează scriptul de test pentru a verifica configurarea:

```bash
node test-private-network.js
```

### Pasul 4: Pornire Primul Nod

```bash
npm start -- -c config/ipfs-private.json -f .data1 -p 3001
```

Parametri:
- `-c config/ipfs-private.json`: Folosește configurația pentru rețea privată
- `-f .data1`: Directorul pentru datele nodului
- `-p 3001`: Portul pentru serverul web

### Pasul 5: Pornire Nod Suplimentar

Pentru al doilea nod (pe aceeași mașină sau alta):

```bash
# Copiază swarm.key în locația nodului 2
cp swarm.key /path/to/node2/

# Pornește nodul 2
npm start -- -c config/ipfs-private.json -f .data2 -p 3002
```

### Pasul 6: Conectare Noduri

Nodurile vor încerca să se descopere automat prin mDNS. Pentru conectare manuală:

1. Obține ID-ul peer-ului din loguri (căută "Private IPFS Node ID")
2. Obține adresele multiaddr din loguri
3. Conectează nodurile (opțional, dacă auto-discovery nu funcționează)

## Configurare Detaliată

### Parametri IpfsHelper

În `config/storage/backend/data-accessors/ipfs-private.json`:

```json
{
  "IpfsHelper:_options_repo": "./.ipfs-private",
  "IpfsHelper:_options_privateNetwork": true,
  "IpfsHelper:_options_swarmKey": "./swarm.key"
}
```

Parametri:
- **repo**: Directorul pentru repository-ul IPFS
- **privateNetwork**: Activează modul rețea privată
- **swarmKey**: Calea către fișierul swarm.key (opțional - se generează automat dacă lipsește)

### Comportament Automat

Când `privateNetwork: true`:
1. Verifică dacă există `swarm.key` în locația specificată
2. Dacă nu există și nu e specificată o cale, generează automat o cheie nouă
3. Copiază cheia în directorul repo IPFS
4. Configurează nodul IPFS cu:
   - Bootstrap: gol (nu se conectează la rețeaua publică)
   - Swarm ports: 4001 (TCP/IPv4 și IPv6)
   - mDNS: activat pentru descoperirea automată a peer-ilor locali

## Rulare Multiplă pe Aceeași Mașină

Pentru a rula multiple noduri pe aceeași mașină:

```bash
# Terminal 1 - Nodul 1
npm start -- -c config/ipfs-private.json -f .data-node1 -p 3001

# Terminal 2 - Nodul 2  
npm start -- -c config/ipfs-private.json -f .data-node2 -p 3002

# Terminal 3 - Nodul 3
npm start -- -c config/ipfs-private.json -f .data-node3 -p 3003
```

**Important**: Fiecare nod trebuie să aibă:
- Directory de date diferit (`-f`)
- Port diferit (`-p`)
- Același fișier `swarm.key`

## Rulare pe Mașini Diferite

### Setup Rețea Locală

1. **Asigură-te că toate mașinile sunt pe aceeași rețea**
2. **Distribuie swarm.key pe toate mașinile**:
   ```bash
   # Pe mașina 1 (cea care a generat cheia)
   scp swarm.key user@machine2:/path/to/solid-server/
   scp swarm.key user@machine3:/path/to/solid-server/
   ```

3. **Configurează firewall-ul pentru portul 4001**:
   ```bash
   # Linux (ufw)
   sudo ufw allow 4001/tcp
   
   # Windows PowerShell (ca Administrator)
   New-NetFirewallRule -DisplayName "IPFS Swarm" -Direction Inbound -LocalPort 4001 -Protocol TCP -Action Allow
   ```

4. **Pornește nodurile pe fiecare mașină**:
   ```bash
   npm start -- -c config/ipfs-private.json -f .data -p 3000
   ```

### Conectare Manuală Noduri

Dacă nodurile nu se descoperă automat:

```bash
# Pe nodul 2, conectează-te la nodul 1
# Găsește multiaddr-ul nodului 1 din loguri, de exemplu:
# /ip4/192.168.1.100/tcp/4001/p2p/QmNodeID1

# Apoi folosește IPFS API sau CLI pentru conectare
# (necesită acces la API-ul IPFS - în implementare)
```

## Verificare și Debugging

### Verificare Noduri Conectate

Caută în loguri pentru:
```
🔐 Private IPFS Node ID: QmXXXXXXXXXXXXXXX
📡 Addresses:
   /ip4/127.0.0.1/tcp/4001/p2p/QmXXXXXXXXXXXXXXX
   /ip4/192.168.1.100/tcp/4001/p2p/QmXXXXXXXXXXXXXXX
```

### Probleme Comune

#### 1. Nodurile nu se conectează

**Cauze posibile:**
- Swarm keys diferite
- Firewall blochează portul 4001
- Nodurile nu sunt pe aceeași rețea

**Soluții:**
```bash
# Verifică swarm.key este identic pe toate nodurile
md5sum swarm.key  # Linux/Mac
Get-FileHash swarm.key  # Windows

# Verifică portul 4001
netstat -an | grep 4001  # Linux/Mac
netstat -an | findstr 4001  # Windows

# Testează conectivitatea
ping <ip-nod-remote>
telnet <ip-nod-remote> 4001
```

#### 2. Eroare "swarm key not found"

**Soluție:**
```bash
# Generează o cheie nouă
node generate-swarm-key.js

# Sau specifică calea corectă în config
```

#### 3. Port 4001 deja în uz

**Soluție:** Modifică portul în configurare sau oprește procesul care folosește portul.

## Securitate

### Best Practices

1. **🔒 Păstrează swarm.key în siguranță**
   - Nu o urca pe GitHub sau alte servicii publice
   - Folosește .gitignore pentru a o exclude
   - Distribuie-o doar prin canale sigure (SSH, encrypted storage)

2. **🛡️ Firewall Configuration**
   - Permite doar IP-uri cunoscute pe portul 4001
   - Folosește VPN pentru comunicare între noduri pe internet

3. **📝 Backup**
   - Fă backup la swarm.key
   - Fă backup la directoarele de date (.data, .ipfs-private)

4. **🔄 Rotație Chei**
   - În caz de compromitere, generează o cheie nouă
   - Distribuie noua cheie pe toate nodurile
   - Repornește toate nodurile

### Adăugare .gitignore

```bash
# Adaugă în .gitignore
echo "swarm.key" >> .gitignore
echo ".ipfs-private/" >> .gitignore
echo ".data*/" >> .gitignore
```

## Monitorizare și Logging

### Loguri importante

Caută în output pentru:
- `Initializing embedded IPFS node with repo: X (PRIVATE NETWORK)` - confirmă modul privat
- `Private IPFS Node ID: QmXXX` - ID-ul nodului
- `Addresses: /ip4/...` - adresele pe care ascultă nodul
- `Swarm key generated/copied successfully` - swarm key configurat

### Nivel de Logging

Pentru mai multe detalii:
```bash
export LOG_LEVEL=debug
npm start -- -c config/ipfs-private.json -f .data -p 3000
```

## Testare Rețea

### Test Script

```bash
# Rulează testul complet
node test-private-network.js
```

### Test Manual

1. **Start nod 1:**
   ```bash
   npm start -- -c config/ipfs-private.json -f .data1 -p 3001
   ```

2. **Creează un pod pe nod 1:**
   ```bash
   # Accesează http://localhost:3001
   # Creează un cont și pod
   ```

3. **Start nod 2 cu același swarm.key:**
   ```bash
   npm start -- -c config/ipfs-private.json -f .data2 -p 3002
   ```

4. **Verifică că datele sunt partajate** (în dezvoltare - depinde de sincronizare IPFS)

## Diferențe față de Rețeaua Publică IPFS

| Caracteristică | Rețea Publică | Rețea Privată |
|---|---|---|
| Accesibilitate | Oricine poate accesa | Doar noduri autorizate |
| Bootstrap nodes | Noduri publice IPFS | Propriile tale noduri |
| Swarm key | Nu este necesară | **Obligatorie** |
| Securitate | Date publice | Date private în rețea |
| Performanță | Variabilă | Mai consistentă |
| Discovery | DHT global | mDNS local sau manual |

## Scripts Disponibile

| Script | Comandă | Descriere |
|---|---|---|
| Generare swarm key | `node generate-swarm-key.js` | Generează o cheie nouă |
| Test setup | `node test-private-network.js` | Verifică configurarea |
| Start privat | `npm start -- -c config/ipfs-private.json` | Pornește cu rețea privată |
| Start public | `npm start -- -c config/ipfs.json` | Pornește cu IPFS public |

## Întrebări Frecvente (FAQ)

### Pot avea noduri și în rețeaua privată și publică simultan?

Nu. Un nod IPFS poate fi parte dintr-o singură rețea la un moment dat. Pentru ambele, trebuie să rulezi noduri separate.

### Câte noduri pot fi într-o rețea privată?

Practic nelimitat. Limita depinde de resursele hardware și de lățimea de bandă disponibilă.

### Ce se întâmplă dacă pierd swarm.key?

Nodurile nu vor mai putea comunica între ele. Trebuie să generezi o cheie nouă și să o distribui pe toate nodurile, ceea ce înseamnă că efectiv creezi o rețea nouă.

### Pot schimba swarm.key pentru o rețea existentă?

Da, dar toate nodurile trebuie să fie oprite, cheia actualizată pe toate, și apoi repornite sincron. Datele existente rămân în repository-urile locale.

### Cum scal o rețea privată IPFS?

- Adaugă mai multe noduri cu același swarm.key
- Folosește noduri dedicate ca "bootstrap" pentru discovery
- Configurează load balancing pentru accesul utilizatorilor

## Resurse Suplimentare

- [IPFS Private Networks Documentation](https://github.com/ipfs/go-ipfs/blob/master/docs/experimental-features.md#private-networks)
- [Community Solid Server Documentation](https://github.com/CommunitySolidServer/CommunitySolidServer)
- [Solid Protocol Specification](https://solidproject.org/TR/protocol)

## Suport

Pentru probleme sau întrebări:
1. Verifică logurile pentru erori
2. Rulează `node test-private-network.js`
3. Verifică că swarm.key este identic pe toate nodurile
4. Asigură-te că firewall-ul permite portul 4001

---

**Versiune:** 1.0  
**Ultima actualizare:** ianuarie 2026
