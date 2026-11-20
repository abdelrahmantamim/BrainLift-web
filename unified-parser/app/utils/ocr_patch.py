"""
Compatibility patch for EasyOCR with Pillow 10+
"""
import cv2
from PIL import Image

# Monkey patch cv2 interpolation constants if using PIL constants
def patch_easyocr_utils():
    """Apply compatibility patches for EasyOCR"""
    try:
        import easyocr.utils as utils
        
        # Replace the problematic function
        original_compute_ratio_and_resize = utils.compute_ratio_and_resize
        
        def compute_ratio_and_resize(img, width, height, model_height):
            """Patched version using cv2.INTER_LANCZOS4 instead of Image.ANTIALIAS"""
            ratio = width / height
            if ratio < 1.0:
                ratio = 1.0 / ratio
            resize_h = int(model_height * ratio)
            if resize_h > 10000:
                resize_h = 10000
            img = cv2.resize(img, (resize_h, model_height), interpolation=cv2.INTER_LANCZOS4)
            return img, ratio
        
        utils.compute_ratio_and_resize = compute_ratio_and_resize
        print("✓ Applied EasyOCR compatibility patch")
        return True
    except Exception as e:
        print(f"✗ Failed to apply patch: {e}")
        return False

# Apply patch on import
patch_easyocr_utils()
