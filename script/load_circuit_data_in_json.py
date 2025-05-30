import pandas as pd
import json

# Charger le fichier Excel
file_path = './data/source/circuit_data.xlsx'  # Remplacez par le chemin de votre fichier
df = pd.read_excel(file_path)

# Initialiser une liste pour stocker les données JSON
data_list = []

# Traiter les données du DataFrame
for i in range(0, len(df), 2):
    # Extraire les lignes X et Y pour chaque circuit
    row_x = df.iloc[i]
    row_y = df.iloc[i+1]
    
    # Assurer que les lignes X et Y appartiennent au même circuit
    assert row_x['NAT'] == row_y['NAT'], "Les lignes X et Y ne correspondent pas au même circuit"
    
    # Extraire les informations du circuit et les convertir en types natifs Python
    circuit = row_x['NAT']
    country = row_x['Country']
    gp = row_x['GP']
    length = int(row_x['LENGTH'])
    total = int(row_x['TOTAL'])
    speed = int(row_x['SPEED'])
    rain = int(row_x['PRE'])
    overtaking = int(row_x['DEP'])
    difficulty = int(row_x['DIFF'])
    fastSpeed = int(row_x['VIT'])
    fastCorners = int(row_x['VR'])
    slowCorners = int(row_x['VL'])
    
    # Extraire les coordonnées X et Y et les convertir en types natifs Python
    coor_x = [int(val) for val in row_x[16:].tolist()]
    coor_y = [int(val) for val in row_y[16:].tolist()]
    
    # Combiner les coordonnées X et Y en tuples (x, y)
    coor = list(zip(coor_x, coor_y))
    
    # Ajouter les informations du circuit à la liste
    circuit_data = {
        "circuit": circuit,
        "country": country,
        "grandPrix": gp,
        "length": length,
        "total": total,
        "speed": speed,
        "rain": rain,
        "overtaking": overtaking,
        "difficulty": difficulty,
        "fastSpeed": fastSpeed,
        "fastCorners": fastCorners,
        "slowCorners": slowCorners,
        "coor": coor
    }
    data_list.append(circuit_data)

# Convertir la liste en JSON
json_data = json.dumps(data_list, indent=4)

# Sauvegarder le JSON dans un fichier
output_file = './data/circuits.json'  # Nom du fichier de sortie
with open(output_file, 'w') as f:
    f.write(json_data)

print("Données JSON sauvegardées avec succès dans", output_file)
