import json
import pandas as pd

# Historique d'une écurie = celui de toute sa "famille" (ex. Alpine = Toleman, Benetton,
# Renault, Lotus, Alpine), défini dans l'onglet Teams_Family de stats.xlsx.
# Les stats historiques sont regroupées par NOM d'écurie et un nom peut couvrir plusieurs
# époques (Lotus 1958-2015, Renault 1977-2020...). Pour ne compter que les années de la famille :
#   - titres : exacts (années de la famille où l'écurie a fini 1re, d'après l'historique annuel) ;
#   - victoires et GPs : proratisés sur la part des années du nom comprises dans les années
#     de la famille (il n'existe pas de détail par année pour ces deux totaux).
# Les stats s'arrêtent à 2025 : les saisons jouées dans le jeu s'ajoutent ensuite.

stats_path = './data/source/stats.xlsx'
hist_path = './data/historical_stats.json'
output_file = './data/team_families.json'
LAST_REAL_YEAR = 2025

teams_hist = json.load(open(hist_path, encoding='utf-8'))['teams']
df = pd.read_excel(stats_path, sheet_name='Teams_Family')

families = {}
for _, row in df.iterrows():
    family = str(row['Teams'])
    name = str(row['History'])
    start = int(row['Start_date'])
    end = int(row['End_date']) if pd.notna(row['End_date']) else LAST_REAL_YEAR
    fam = families.setdefault(family, {})
    fam.setdefault(name, set()).update(range(start, end + 1))


def raced_years(name):
    return {int(y) for y, v in teams_hist[name]['history'].items() if v not in ('-', None)}


out = {}
for family, members in families.items():
    titles = 0
    wins = 0.0
    gps = 0.0
    for name, years in members.items():
        if name not in teams_hist:
            print("ATTENTION: '%s' (famille %s) absent de historical_stats.json" % (name, family))
            continue
        data = teams_hist[name]
        raced = raced_years(name)
        if not raced:
            continue
        inside = raced & years
        share = len(inside) / len(raced)
        wins += data['wins'] * share
        gps += data['gps'] * share
        titles += sum(1 for y in inside if data['history'][str(y)] == 1)
    out[family] = {
        "members": list(members.keys()),
        "titles": titles,
        "wins": round(wins),
        "gps": round(gps),
    }

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(json.dumps(out, indent=4, ensure_ascii=False))

for family, v in out.items():
    print("%-13s titres %2d  victoires %4d  GPs %5d" % (family, v['titles'], v['wins'], v['gps']))
print("Familles sauvegardées dans", output_file)
