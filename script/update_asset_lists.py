import json
import os
import re
import sys

# Met a jour, dans js/team_assets.js, les listes des images proposees dans les editeurs :
#   TEAM_IMAGE_LIST : toutes les voitures de img/cars/*.png (ordre alphabetique)
#   FLAG_LIST       : tous les drapeaux de img/flags/*.png. Les pays qui ont deja couru en F1
#                     (FIRST_FLAGS ci-dessous) viennent en premier, les autres suivent par ordre
#                     alphabetique. Un nouveau drapeau tombe donc dans la 2e partie ; pour le
#                     mettre dans la 1re, l'ajouter a FIRST_FLAGS.
# Signale aussi les images citees par les donnees (equipes, pilotes, ingenieurs) qui n'existent pas.
# A lancer depuis la racine du projet (script/update_all.py s'en charge).

CARS_DIR = './img/cars'
FLAGS_DIR = './img/flags'
TARGET = './js/team_assets.js'

FIRST_FLAGS = ["argentina", "australia", "austria", "belgium", "brazil", "canada", "chile", "china",
               "colombia", "czechia", "denmark", "finland", "france", "germany", "hungary", "india",
               "indonesia", "ireland", "italy", "japan", "liechtenstein", "malaysia", "mexico", "monaco",
               "netherlands", "new_zealand", "poland", "portugal", "russia", "south_africa", "spain",
               "sweden", "switzerland", "thailand", "uk", "uruguay", "usa", "venezuela"]


def png_names(directory):
    return sorted(os.path.splitext(f)[0] for f in os.listdir(directory) if f.lower().endswith('.png'))


def js_array(names):
    return '[' + ','.join(json.dumps(n) for n in names) + ']'


def replace_list(source, const_name, names):
    pattern = re.compile(r'(const ' + const_name + r' = )\[[^\]]*\](;)')
    if not pattern.search(source):
        sys.exit('Liste introuvable dans ' + TARGET + ' : ' + const_name)
    return pattern.sub(lambda m: m.group(1) + js_array(names) + m.group(2), source, count=1)


cars = png_names(CARS_DIR)
on_disk = set(png_names(FLAGS_DIR))
flags = [f for f in FIRST_FLAGS if f in on_disk] + sorted(on_disk - set(FIRST_FLAGS))
for f in FIRST_FLAGS:
    if f not in on_disk:
        print('ATTENTION : drapeau de FIRST_FLAGS absent de', FLAGS_DIR, ':', f)

with open(TARGET, encoding='utf-8', newline='') as fh:
    source = fh.read()
updated = replace_list(replace_list(source, 'TEAM_IMAGE_LIST', cars), 'FLAG_LIST', flags)
if updated != source:
    with open(TARGET, 'w', encoding='utf-8', newline='') as fh:
        fh.write(updated)
print('%s : %d voitures, %d drapeaux %s' % (TARGET, len(cars), len(flags), '(mis a jour)' if updated != source else '(deja a jour)'))

# Images citees par les donnees mais absentes du disque (les valeurs sont soit un chemin
# 'img/flags/uk.png', soit un nom seul, avec ou sans extension : 'uk.png', 'MCL26').
def resolve(value, folder):
    if '/' in value:
        return value
    return folder + '/' + (value if value.lower().endswith('.png') else value + '.png')


def check(path):
    if not os.path.exists(path):
        return
    with open(path, encoding='utf-8') as fh:
        rows = json.load(fh)
    for row in rows:
        for field, folder in (('image', CARS_DIR), ('flag', FLAGS_DIR), ('teamFlag', FLAGS_DIR)):
            value = row.get(field)
            if value and not os.path.exists(resolve(value, folder)):
                print('ATTENTION :', os.path.basename(path), '-', value, 'introuvable')


check('./data/team_default.json')
check('./data/driver_default.json')
