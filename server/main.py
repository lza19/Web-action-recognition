from fastapi import FastAPI, File, UploadFile,WebSocket,Request
from fastapi.middleware.cors import CORSMiddleware
import torch
import cv2
import os
from ultralytics import YOLO
import tempfile
import shutil
from pathlib import Path
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
#model = YOLO('best.pt')

#__file__ คือ 'C:\my_project\servers\main.py' และ os.path.dirname(__file__) จะได้ 'C:\my_project\servers' รวมกับ 'best.pt' จะได้ 'C:\my_project\servers\best.pt'
model_path = os.path.join(os.path.dirname(__file__), 'best.pt') 
model = YOLO(model_path)

# ฟังก์ชันสำหรับประมวลผลวิดีโอไฟล์
def Videolern(input_path: str, output_path: str):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print("Error: Could not open video.")
        return False, "Could not open video."

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        results = model(frame)
        
        if results and len(results) > 0:
            processed_frame = results[0].plot()
        else:
            processed_frame = frame

        out.write(processed_frame)
    
    cap.release()
    out.release()
    cv2.destroyAllWindows()
    return True, "Processing successful."

# ฟังก์ชันสำหรับลบไฟล์ชั่วคราว (ไม่ใช่ async)
def cleanup_file(*paths: str):
    for path in paths:
        if os.path.exists(path):
            os.unlink(path)
 
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins="http://127.0.0.1:5500",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello" : "World"}

@app.get("/items/{x}/{y}")
def read_root(x: int, y: int):
    z = x + y
    return {z}

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):

    print("File received:", file.filename)
    print("Content type:", file.content_type)
    return {"status": "success"}

@app.post("/process-video")
async def process_video_endpoint(file: UploadFile = File(...)):

    input_path = None
    output_path = None
    
    try:
        # ใช้ NamedTemporaryFile โดยไม่ให้ลบทันที
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_input:
            shutil.copyfileobj(file.file, temp_input)
            input_path = temp_input.name
        
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_output:
            output_path = temp_output.name
        
        # Call the processing function
        success, message = Videolern(input_path, output_path)

        if not success:
            return {"error": message}

        # สร้าง BackgroundTask เพื่อสั่งลบไฟล์เมื่อ Response ถูกส่งไปแล้ว
        # ส่งฟังก์ชัน cleanup_file ที่เป็นฟังก์ชันธรรมดา
        background_task = BackgroundTask(cleanup_file, input_path, output_path)
        
        return FileResponse(
            path=output_path,
            media_type="video/mp4",
            filename=f"processed_{file.filename}",
            background=background_task
        )

    except Exception as e:
        # หากเกิดข้อผิดพลาด ให้ลบไฟล์ที่สร้างขึ้นแล้ว
        if input_path and os.path.exists(input_path):
            os.unlink(input_path)
        if output_path and os.path.exists(output_path):
            os.unlink(output_path)
        return {"error": f"An error occurred: {e}"}