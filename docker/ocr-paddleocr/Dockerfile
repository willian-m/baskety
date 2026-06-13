FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 wget && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
    "paddlepaddle==2.6.2" \
    "paddleocr==2.7.3" \
    "fastapi==0.115.0" \
    "uvicorn[standard]==0.30.6" \
    "python-multipart==0.0.9" \
    "Pillow==10.4.0"
COPY server.py .
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
