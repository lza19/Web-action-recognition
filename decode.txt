from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
import cv2
import os
from ultralytics import YOLO

#model = YOLO('best.pt')

#__file__ คือ 'C:\my_project\servers\main.py' และ os.path.dirname(__file__) จะได้ 'C:\my_project\servers' รวมกับ 'best.pt' จะได้ 'C:\my_project\servers\best.pt'
model_path = os.path.join(os.path.dirname(__file__), 'best.pt') 
model = YOLO(model_path)

def Videolern():
    return "Hello"

app = FastAPI()



app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],
    allow_methods=["*"],
)

@app.get("/{x}")
def read_root(x):
    print(x)
    return {x}

@app.get("/items/{x}/{y}")
def read_root(x: int, y: int):
    z = x + y
    return {z}

@app.get("/users/me")
async def read_user_me():
    return {"user_id": "the current user"}

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    print("File received:", file.filename)
    print("Content type:", file.content_type)
    return {"filename": file.filename, "content_type": file.content_type}

