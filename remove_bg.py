from PIL import Image
import sys

# Fallback ke metode Pillow karena `rembg` dan `onnxruntime` memiliki isu dependensi di lingkungan Windows ini.
def remove_bg_flood(input_path, output_path, tolerance=50):
    print(f"Menghapus background dari {input_path} (menggunakan metode Flood Fill)...")
    try:
        img = Image.open(input_path).convert("RGBA")
    except Exception as e:
        print(f"Gagal membuka gambar: {e}")
        return

    pixels = img.load()
    width, height = img.size
    target_color = pixels[0, 0]
    
    def color_distance(c1, c2):
        return sum(abs(a - b) for a, b in zip(c1[:3], c2[:3]))

    visited = set()
    stack = [(0,0), (width-1, 0), (0, height-1), (width-1, height-1)]
    
    while stack:
        x, y = stack.pop()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        if x < 0 or x >= width or y < 0 or y >= height:
            continue
            
        current_color = pixels[x, y]
        if color_distance(current_color, target_color) <= tolerance:
            pixels[x, y] = (255, 255, 255, 0)
            stack.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
            
    img.save(output_path, "PNG")
    print(f"Selesai! Gambar disimpan ke {output_path}")

if __name__ == "__main__":
    remove_bg_flood("frontend/src/assets/lexa_bot.png", "frontend/src/assets/lexa_bot_transparent.png")

