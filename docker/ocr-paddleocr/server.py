import os
import io
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()

lang = os.environ.get("OCR_LANG", "en")
ocr = PaddleOCR(use_angle_cls=True, lang=lang, use_gpu=False, show_log=False)

MAX_IMAGE_BYTES = 20 * 1024 * 1024  # 20 MB

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ocr")
async def extract_text(image: UploadFile = File(...)):
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 20 MB)")
    try:
        img = np.array(Image.open(io.BytesIO(data)).convert("RGB"))
        results = ocr.ocr(img, cls=True)
        lines = []
        if results:
            for block in results:
                if block:
                    for line in block:
                        if line and len(line) > 1:
                            lines.append(line[1][0])
        return JSONResponse({"text": "\n".join(lines)})
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"OCR failed: {exc}") from exc
