from PIL import Image

def add_watermark(base_image_path, watermark_path, output_path, position="bottom-right"):
    base = Image.open(base_image_path).convert("RGBA")
    watermark = Image.open(watermark_path).convert("RGBA")

    # Resize watermark to be a reasonable size (e.g., 20% of base image width)
    base_width, base_height = base.size
    watermark_width = int(base_width * 0.25)
    w_percent = (watermark_width / float(watermark.size[0]))
    watermark_height = int((float(watermark.size[1]) * float(w_percent)))
    
    watermark = watermark.resize((watermark_width, watermark_height), Image.Resampling.LANCZOS)

    # Position
    margin = 40
    if position == "bottom-right":
        x = base_width - watermark_width - margin
        y = base_height - watermark_height - margin
    elif position == "top-center":
        x = (base_width - watermark_width) // 2
        y = margin
    elif position == "bottom-center":
        x = (base_width - watermark_width) // 2
        y = base_height - watermark_height - margin
    elif position == "top-left":
        x = margin
        y = margin

    # Paste
    transparent = Image.new('RGBA', (base_width, base_height), (0,0,0,0))
    transparent.paste(base, (0,0))
    transparent.paste(watermark, (x, y), mask=watermark)
    
    rgb_image = transparent.convert("RGB")
    rgb_image.save(output_path, "JPEG", quality=95)
    print(f"Saved: {output_path}")

if __name__ == "__main__":
    base_path = r"C:\Users\grd_a\.gemini\antigravity\brain\6eba906c-bca0-4977-8c66-e111c0bc684a\reto_vigor_flexiones_1785566048746.jpg"
    logo_path = r"C:\Users\grd_a\.gemini\antigravity\scratch\Veta_Vigor_App\VetaVigor_Logo_PNG_Pack\01_EMBLEMA_COMPLETO_TRANSPARENTE\VV_emblema_dorado_metalico_transparente_4096.png"
    out_path = r"C:\Users\grd_a\.gemini\antigravity\brain\6eba906c-bca0-4977-8c66-e111c0bc684a\reto_vigor_flexiones_con_logo.jpg"
    
    add_watermark(base_path, logo_path, out_path, "bottom-center")
