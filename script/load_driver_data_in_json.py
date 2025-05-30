import pandas as pd
import json

# Charger le fichier Excel
file_path = './data/source/driver_default.xlsx'
df = pd.read_excel(file_path)

# Initialiser une liste pour stocker les données JSON
data_list = []

# Traiter les données du DataFrame
for i in range(0, len(df)):
    # Extraire les informations du pilotes et les convertir en types natifs Python
    name = str(df.iloc[i]['name'])
    code = str(df.iloc[i]['code'])
    driverLevel = int(df.iloc[i]['driverLevel'])
    team_id = int(df.iloc[i]['team_id'])

    # Ajouter les informations du pilote à la liste
    driver_data = {
        "name": name,
        "code": code,
        "team_id": team_id,
        "driverLevel": driverLevel,
    }
    data_list.append(driver_data)

# Convertir la liste en JSON
json_data = json.dumps(data_list, indent=4)

# Sauvegarder le JSON dans un fichier
output_file = './data/driver_default.json'  # Nom du fichier de sortie
with open(output_file, 'w') as f:
    f.write(json_data)

print("Données JSON sauvegardées avec succès dans", output_file)
