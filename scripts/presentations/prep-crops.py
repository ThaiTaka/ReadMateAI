"""Cắt các vùng cần dùng từ ảnh chụp trong assets/ (chạy sau capture*.mjs, trước build-deck.mjs). Cần Pillow."""
from PIL import Image

A = "assets/"
home = Image.open(A + "home.jpg")
home.crop((752, 296, 1266, 726)).save(A + "crop-hero.jpg", quality=90)
learn = Image.open(A + "learn-full.jpg")
learn.crop((168, 865, 1272, 1535)).save(A + "crop-worldmap.jpg", quality=85)
learn.crop((168, 2990, 1272, 3170)).save(A + "crop-milestones.jpg", quality=88)
Image.open(A + "learn.jpg").crop((800, 296, 1252, 476)).save(A + "crop-points.jpg", quality=90)
Image.open(A + "maze-wide.jpg").crop((288, 256, 832, 800)).save(A + "crop-board.jpg", quality=88)
