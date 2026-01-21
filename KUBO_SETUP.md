# Setup Kubo (IPFS) Private Network

## Instalare Kubo

### Windows
```powershell
# Download Kubo
# https://dist.ipfs.tech/#kubo
# Sau folosește chocolatey:
choco install kubo
```

### Linux/Mac
```bash
# Download și instalează Kubo
wget https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz
tar -xvzf kubo_v0.24.0_linux-amd64.tar.gz
cd kubo
sudo bash install.sh
```

## Setup Rețea Privată

### 1. Inițializează Kubo
```bash
ipfs init
```

### 2. Copiază Swarm Key
```bash
# Copiază swarm.key în repo-ul IPFS
# Windows:
copy swarm.key %USERPROFILE%\.ipfs\swarm.key

# Linux/Mac:
cp swarm.key ~/.ipfs/swarm.key
```

### 3. Șterge Bootstrap Nodes (Important!)
```bash
ipfs bootstrap rm --all
```

### 4. Configurare Adrese
```bash
# Setează adresele pentru swarm
ipfs config Addresses.Swarm --json '["/ip4/0.0.0.0/tcp/4001", "/ip6/::/tcp/4001"]'

# Setează API
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5001

# Setează Gateway
ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8080
```

### 5. Activează mDNS
```bash
ipfs config --json Discovery.MDNS.Enabled true
```

## Pornire Kubo

### Nod 1
```bash
ipfs daemon
```

### Nod 2 (pe altă mașină sau port diferit)

Dacă e pe aceeași mașină, trebuie să folosești un repo diferit:

```bash
# Setează variabila de mediu pentru repo
export IPFS_PATH=~/.ipfs2

# Inițializează
ipfs init

# Copiază swarm.key
cp swarm.key ~/.ipfs2/swarm.key

# Configurare (ports diferite!)
ipfs bootstrap rm --all
ipfs config Addresses.Swarm --json '["/ip4/0.0.0.0/tcp/4002", "/ip6/::/tcp/4002"]'
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5002
ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8081
ipfs config --json Discovery.MDNS.Enabled true

# Pornește
ipfs daemon
```

## Verificare

### Check Peer ID
```bash
ipfs id
```

### Check Peers
```bash
ipfs swarm peers
```

După 30-60 secunde, ar trebui să vezi peer-ul celălalt nod.

## Conectare Manuală

Dacă nodurile nu se descoperă automat:

```bash
# Pe nodul 1, obține multiaddr
ipfs id

# Pe nodul 2, conectează-te
ipfs swarm connect /ip4/<IP_NOD_1>/tcp/4001/p2p/<PEER_ID_NOD_1>
```

## Pornire Community Solid Server

După ce Kubo daemon rulează:

```bash
npm start -- -c config/ipfs-private.json -f .data1 -p 3001
```

Serverul va folosi configurația din `ipfs-private.json` care se conectează la `http://127.0.0.1:5001` (API-ul Kubo).

## Multiple Noduri CSS

Fiecare nod CSS poate folosi același daemon Kubo sau diferite (pe porturi diferite):

```bash
# Terminal 1 - CSS Nod 1 (folosește Kubo pe 5001)
npm start -- -c config/ipfs-private.json -f .data1 -p 3001

# Terminal 2 - CSS Nod 2 (folosește alt Kubo pe 5002)
# Modifică config să folosească http://127.0.0.1:5002
npm start -- -c config/ipfs-private.json -f .data2 -p 3002
```

## Tips

1. **Întotdeauna șterge bootstrap nodes** pentru rețea privată
2. **Folosește același swarm.key** pe toate nodurile
3. **Verifică firewall** pentru portul 4001
4. **mDNS funcționează** doar pe aceeași rețea locală
5. **Pentru internet**, trebuie conectare manuală între noduri

## Troubleshooting

### Kubo nu pornește
```bash
# Verifică dacă porturile sunt libere
netstat -an | findstr 5001
netstat -an | findstr 4001
```

### Nodurile nu se conectează
```bash
# Verifică swarm.key
cat ~/.ipfs/swarm.key
cat ~/.ipfs2/swarm.key
# Trebuie să fie identice!

# Verifică bootstrap
ipfs bootstrap list
# Trebuie să fie gol!
```

### CSS nu se conectează la Kubo
```bash
# Verifică că daemon-ul rulează
ipfs id

# Verifică că API e pe portul corect
ipfs config Addresses.API
```
