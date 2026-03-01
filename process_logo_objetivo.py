from PIL import Image
import numpy as np

img = Image.open('logo objetivo.png').convert("RGBA")
data = np.array(img)

r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

# Detect non-white pixels (the actual logo content)
luminance = (0.299 * r + 0.587 * g + 0.114 * b)

# Create clean alpha: anything darker than near-white gets full opacity
# Use a smooth threshold to preserve anti-aliased edges
alpha = np.clip((255 - luminance) * 3, 0, 255).astype(np.uint8)

# All visible pixels become pure white
new_data = np.zeros_like(data)
new_data[:,:,0] = 255
new_data[:,:,1] = 255
new_data[:,:,2] = 255
new_data[:,:,3] = alpha

result = Image.fromarray(new_data, 'RGBA')

# Upscale 2x for sharpness
w, h = result.size
result_2x = result.resize((w * 2, h * 2), Image.LANCZOS)
result_2x.save('public/logo-objetivo.png', 'PNG')

print(f"Saved: {w*2}x{h*2}px, fully white logo")
