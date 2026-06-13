import os
import easyocr
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI()

languages = os.environ.get("OCR_LANGUAGES", "en").split(",")
reader = easyocr.Reader(languages, gpu=False)

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
        results = reader.readtext(data, detail=0)
        return JSONResponse({"text": "\n".join(results)})
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"OCR failed: {exc}") from exc
