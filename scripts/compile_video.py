import os
import glob
from PIL import Image

def main():
    frames_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "demo_frames")
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs")
    
    frame_files = sorted(glob.glob(os.path.join(frames_dir, "frame_*.png")))
    if not frame_files:
        print("No frames found in:", frames_dir)
        return

    print(f"Loading {len(frame_files)} frames for animated demo video...")
    
    # Target resolution: 1200 width maintaining aspect ratio
    images = []
    for f in frame_files:
        img = Image.open(f)
        w, h = img.size
        target_w = 1200
        target_h = int(h * (target_w / w))
        img_resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        images.append(img_resized.convert("RGB"))

    # 1. Save as animated WebP (high quality, small size)
    webp_path = os.path.join(out_dir, "demo_recording.webp")
    print(f"Saving animated WebP to {webp_path}...")
    images[0].save(
        webp_path,
        format="WEBP",
        save_all=True,
        append_images=images[1:],
        duration=1200, # 1.2s per frame
        loop=0,
        quality=85
    )
    print(f"Animated WebP saved! Size: {os.path.getsize(webp_path) / 1024:.1f} KB")

    # 2. Save as animated GIF (standard for GitHub/docs)
    gif_path = os.path.join(out_dir, "demo_recording.gif")
    print(f"Saving animated GIF to {gif_path}...")
    # Quantize images for compact GIF
    gif_images = [im.convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for im in images]
    gif_images[0].save(
        gif_path,
        format="GIF",
        save_all=True,
        append_images=gif_images[1:],
        duration=1200,
        loop=0,
        optimize=True
    )
    print(f"Animated GIF saved! Size: {os.path.getsize(gif_path) / 1024:.1f} KB")

if __name__ == "__main__":
    main()

