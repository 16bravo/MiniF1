import pandas as pd
import json

# Charger le fichier Excel
file_path = './data/source/team_default.xlsx'
df = pd.read_excel(file_path)

# Initialiser une liste pour stocker les données JSON
data_list = []

# Traiter les données du DataFrame
for i in range(0, len(df)):
    # Extraire les informations du circuit et les convertir en types natifs Python
    team_id = int(df.iloc[i]['team_id'])
    team = str(df.iloc[i]['team'])
    teamSPD = int(df.iloc[i]['VIT'])
    teamFS = int(df.iloc[i]['VR'])
    teamSS = int(df.iloc[i]['VL'])
    teamFB = int(df.iloc[i]['FIA'])
    color = str(df.iloc[i]['color'])
    image = str(df.iloc[i]['image'])

    # Ajouter les informations du circuit à la liste
    team_data = {
        "team_id": team_id,
        "team": team,
        "teamSPD": teamSPD,
        "teamFS": teamFS,
        "teamSS": teamSS,
        "teamFB": teamFB,
        "color": color,
        "image": image,
    }
    data_list.append(team_data)

# Convertir la liste en JSON
json_data = json.dumps(data_list, indent=4)

# Sauvegarder le JSON dans un fichier
output_file = './data/team_default.json'  # Nom du fichier de sortie
with open(output_file, 'w') as f:
    f.write(json_data)

print("Données JSON sauvegardées avec succès dans", output_file)
