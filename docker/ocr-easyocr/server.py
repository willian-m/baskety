import os
import io
import easyocr
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

app = FastAPI()

languages = os.environ.get("OCR_LANGUAGES", "en").split(",")
reader = easyocr.Reader(languages, gpu=False)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ocr")
async def extract_text(image: UploadFile = File(...)):
    data = await image.read()
    results = reader.readtext(data, detail=0)
    return JSONResponse({"text": "\n".join(results)})
