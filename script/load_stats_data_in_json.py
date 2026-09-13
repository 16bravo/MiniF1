import pandas as pd
import json

# Charger toutes les feuilles du classeur historique
file_path = './data/source/stats.xlsx'
sheets = pd.read_excel(file_path, sheet_name=None)

# Chaque feuille "Driver_X"/"Team_X" alimente un champ de stat, en prenant la
# colonne Number_25 (total reel a fin 2025, cf. Number - colonne 2026 en cours).
SHEET_FIELDS = {
    'Driver_Champions': 'titles', 'Team_Champions': 'titles',
    'Driver_Wins': 'wins', 'Team_Wins': 'wins',
    'Driver_Poles': 'poles', 'Team_Poles': 'poles',
    'Driver_Laps': 'fastestLaps', 'Team_Laps': 'fastestLaps',
    'Driver_Points': 'points', 'Team_Points': 'points',
    'Driver_Podiums': 'podiums', 'Team_Podiums': 'podiums',
    'Driver_GPs': 'gps', 'Team_GPs': 'gps',
    'Driver_Hattricks': 'hattricks',
}

ALL_FIELDS = ['titles', 'wins', 'poles', 'fastestLaps', 'points', 'podiums', 'gps', 'hattricks']

drivers = {}
teams = {}

for sheet_name, field in SHEET_FIELDS.items():
    df = sheets[sheet_name]
    key_col = df.columns[0]  # 'Driver' ou 'Team'
    store = drivers if key_col == 'Driver' else teams

    for _, row in df.iterrows():
        name = str(row[key_col])
        entry = store.setdefault(name, {'flag': str(row['flag'])})
        for f in ALL_FIELDS:
            entry.setdefault(f, 0)
        entry[field] = row['Number_25']

        # Driver_GPs a en plus les meilleurs resultats jamais obtenus (des records,
        # pas des compteurs a additionner).
        if 'Best Qualif' in df.columns:
            entry['bestQualif'] = int(row['Best Qualif']) if pd.notna(row['Best Qualif']) else None
        if 'Best Race' in df.columns:
            entry['bestRace'] = int(row['Best Race']) if pd.notna(row['Best Race']) else None

# Driver_History / Team_History : une colonne par annee reelle, valeur = classement
# final cette annee-la ('-' = n'a pas couru, gardee hors de la map ; 'DSQ'/'NC'
# gardes tels quels pour un affichage distinct d'un rang numerique).
HISTORY_SHEETS = {'Driver_History': drivers, 'Team_History': teams}

for sheet_name, store in HISTORY_SHEETS.items():
    df = sheets[sheet_name]
    key_col = df.columns[0]
    year_cols = [c for c in df.columns if isinstance(c, int)]

    for _, row in df.iterrows():
        name = str(row[key_col])
        entry = store.setdefault(name, {'flag': str(row['flag'])})
        for f in ALL_FIELDS:
            entry.setdefault(f, 0)
        history = {}
        for year in year_cols:
            val = row[year]
            if val == '-' or pd.isna(val):
                continue
            if isinstance(val, (int, float)):
                val = int(val)
            history[str(year)] = val
        entry['history'] = history

# Normaliser les nombres (int quand c'est un compte entier, float pour les points)
def clean_number(v):
    if pd.isna(v):
        return 0
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v

for store in (drivers, teams):
    for entry in store.values():
        for f in ALL_FIELDS:
            entry[f] = clean_number(entry[f])

data = {'drivers': drivers, 'teams': teams}

output_file = './data/historical_stats.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)

print('Donnees JSON sauvegardees avec succes dans', output_file)
print(len(drivers), 'pilotes,', len(teams), 'ecuries')
