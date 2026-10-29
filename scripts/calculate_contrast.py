def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(rgb):
    r, g, b = [srgb_to_linear(v) for v in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast_ratio(rgb1, rgb2):
    l1 = luminance(rgb1)
    l2 = luminance(rgb2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def blend(fg_rgb, bg_rgb, alpha):
    return [
        round(alpha * fg_rgb[i] + (1 - alpha) * bg_rgb[i])
        for i in range(3)
    ]

themes = {
    "paper": {
        "name": "Paper",
        "bg": [250, 247, 242],     # #FAF7F2
        "text": [31, 30, 29],       # #1F1E1D
    },
    "sepia": {
        "name": "Sepia",
        "bg": [244, 235, 217],     # #F4EBD9
        "text": [56, 44, 30],       # #382C1E
    },
    "dark": {
        "name": "Dark",
        "bg": [24, 24, 22],         # #181816
        "text": [236, 231, 222],    # #ECE7DE
    }
}

# Overlays for Paper & Sepia (light backgrounds, dark text)
# and Dark (dark background, light text)
palette = {
    "protein": {
        "name": "Белки (красный)",
        "light": {"rgb": [239, 68, 68], "alpha": 0.32},     # Red-500
        "dark":  {"rgb": [248, 113, 113], "alpha": 0.32},    # Red-400
    },
    "carbohydrate": {
        "name": "Углеводы (оранжевый)",
        "light": {"rgb": [234, 88, 12], "alpha": 0.30},     # Orange-600 (distinct deep orange)
        "dark":  {"rgb": [251, 146, 60], "alpha": 0.32},    # Orange-400 (warm orange)
    },
    "fat": {
        "name": "Жиры (жёлтый)",
        "light": {"rgb": [234, 179, 8], "alpha": 0.35},     # Yellow-500 (distinct golden yellow)
        "dark":  {"rgb": [254, 240, 138], "alpha": 0.28},   # Yellow-200 / 300 (pale luminous yellow)
    },
    "vitamin": {
        "name": "Витамины (зелёный)",
        "light": {"rgb": [16, 185, 129], "alpha": 0.28},    # Emerald-500
        "dark":  {"rgb": [52, 211, 153], "alpha": 0.30},    # Emerald-400
    },
    "fiber": {
        "name": "Клетчатка (синий)",
        "light": {"rgb": [14, 165, 233], "alpha": 0.28},    # Sky-500
        "dark":  {"rgb": [56, 189, 248], "alpha": 0.30},    # Sky-400
    },
    "none": {
        "name": "Без категории (серый)",
        "light": {"rgb": [120, 113, 108], "alpha": 0.22},   # Stone-500
        "dark":  {"rgb": [168, 162, 158], "alpha": 0.28},   # Stone-400
    }
}

print(f"{'Категория':<26} | {'Тема':<8} | {'Заливка (rgba)':<28} | {'Цвет под текстом':<18} | {'Контраст':<10} | {'WCAG AA'}")
print("-" * 110)

for cat_key, cat_data in palette.items():
    for theme_key in ["paper", "sepia", "dark"]:
        theme = themes[theme_key]
        setting = cat_data["dark"] if theme_key == "dark" else cat_data["light"]
        blended = blend(setting["rgb"], theme["bg"], setting["alpha"])
        ratio = contrast_ratio(theme["text"], blended)
        rgba_str = f"rgba({setting['rgb'][0]}, {setting['rgb'][1]}, {setting['rgb'][2]}, {setting['alpha']})"
        blended_hex = f"#{blended[0]:02x}{blended[1]:02x}{blended[2]:02x}"
        status = "PASS (>=4.5)" if ratio >= 4.5 else "FAIL (<4.5)"
        print(f"{cat_data['name']:<26} | {theme['name']:<8} | {rgba_str:<28} | {blended_hex} ({blended[0]},{blended[1]},{blended[2]}) | {ratio:.2f}:1     | {status}")
