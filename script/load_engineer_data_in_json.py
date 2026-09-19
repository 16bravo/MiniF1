import pandas as pd
import json

# Charger le fichier Excel
file_path = './data/source/engineers_db.xlsx'
df = pd.read_excel(file_path)

STATS = {'SPD', 'FS', 'SS', 'FB'}
data_list = []

for i in range(0, len(df)):
    row = df.iloc[i]
    start = row['start']
    contract = row['contract_seasons']

    data_list.append({
        "engineer_id": int(row['engineer_id']),
        "name": str(row['name']),
        "stat": str(row['stat']),
        "value": int(row['value']),
        "rarity": str(row['rarity']),
        "retire_in": int(row['retire_in']),
        "min_confidence": int(row['min_confidence']),
        "min_prestige": int(row['min_prestige']),
        "cost": float(row['cost']),
        "country": str(row['country']),
        # Équipe de départ (nom d'équipe), ou null si l'ingénieur entre dans un paquet à son active_from
        "start": None if pd.isna(start) else str(start),
        "contract_seasons": None if pd.isna(contract) else int(contract),
        "active_from": int(row['active_from']),
    })

# Contrôles d'intégrité (avertissements, n'empêchent pas l'export)
def warn(msg):
    print("ATTENTION:", msg)

ids = [e["engineer_id"] for e in data_list]
names = [e["name"] for e in data_list]
if len(set(ids)) != len(ids):
    warn("engineer_id en double")
if len(set(names)) != len(names):
    warn("noms en double : " + ", ".join(sorted({n for n in names if names.count(n) > 1})))
for e in data_list:
    if e["stat"] not in STATS:
        warn(f"stat inconnue '{e['stat']}' pour {e['name']}")
    if e["start"] is not None and e["contract_seasons"] is None:
        warn(f"{e['name']} a une équipe de départ mais pas de contract_seasons")

teams_start = {}
for e in data_list:
    if e["start"] is not None:
        teams_start.setdefault(e["start"], []).append(e["stat"])
for team, stats in teams_start.items():
    for s in STATS:
        if stats.count(s) > 1:
            warn(f"{team} a plusieurs ingénieurs {s} au départ")
        if stats.count(s) == 0:
            warn(f"{team} n'a pas d'ingénieur {s} au départ (poste vacant)")

# Sauvegarder le JSON
output_file = './data/engineer_default.json'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(json.dumps(data_list, indent=4, ensure_ascii=False))

print(len(data_list), "ingénieurs sauvegardés dans", output_file)
