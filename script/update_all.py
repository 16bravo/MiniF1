import os
import subprocess
import sys
import time

# Relance tous les scripts qui regenerent les donnees du jeu (data/*.json, listes d'images).
# Usage : python script/update_all.py   (depuis n'importe quel dossier)
#
# L'ordre compte : team_families lit historical_stats.json, produit par load_stats.
# rotate_images.py n'en fait volontairement pas partie : il retourne les images de facon
# destructive (a lancer a la main, une seule fois par image).

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = [
    'load_circuit_data_in_json.py',     # circuits.json
    'load_driver_data_in_json.py',      # driver_default.json
    'load_team_data_in_json.py',        # team_default.json
    'load_engineer_data_in_json.py',    # engineer_default.json
    'load_stats_data_in_json.py',       # historical_stats.json
    'load_team_families_in_json.py',    # team_families.json (apres load_stats)
    'update_asset_lists.py',            # listes voitures / drapeaux de js/team_assets.js
]

failed = []
for name in SCRIPTS:
    print('\n=== %s' % name)
    start = time.time()
    # Les scripts utilisent des chemins relatifs a la racine du projet.
    result = subprocess.run([sys.executable, os.path.join('script', name)], cwd=ROOT)
    print('--- %s (%.1f s)' % ('OK' if result.returncode == 0 else 'ECHEC (code %d)' % result.returncode, time.time() - start))
    if result.returncode != 0:
        failed.append(name)

print('\n' + ('Tout est a jour.' if not failed else 'Scripts en echec : ' + ', '.join(failed)))
sys.exit(1 if failed else 0)
