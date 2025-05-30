from PIL import Image
import os

def rotate_images_180(directory):
    # Parcours tous les fichiers du répertoire
    for filename in os.listdir(directory):
        # Vérifie si le fichier est un PNG
        if filename.endswith(".png"):
            file_path = os.path.join(directory, filename)
            # Ouvre l'image
            with Image.open(file_path) as img:
                # Effectue une rotation de 180°
                rotated_img = img.rotate(180)
                # Enregistre l'image avec le même nom
                rotated_img.save(file_path)

# Remplacez 'your_directory_path' par le chemin du répertoire contenant vos images PNG
directory_path = 'img\cars\inverted'
rotate_images_180(directory_path)