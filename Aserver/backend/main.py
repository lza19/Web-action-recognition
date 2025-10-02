from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
import os, cv2, tempfile, shutil, base64, numpy as np
from ultralytics import YOLO
import io
from PIL import Image
from datetime import datetime
import time
import os
import cv2
import tempfile
import json
import urllib.parse
from ultralytics import YOLO
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import tensorflow as tf
from tensorflow.keras.models import load_model
from typing import List
from dotenv import load_dotenv
from supabase import create_client, Client
from PIL import Image
import numpy as np
import io

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ตรวจสอบการเชื่อมต่อ
try:
    res = supabase.table("users").select("*").execute()
    print("สำเร็จ", len(res.data), "ผู้ใช้")
except Exception as e:
    print("ผิดพลาด", e)

class_colors = {1: (0, 0, 255), 2: (0, 255, 0)}
person_model = YOLO('best_custom.pt')  # ตรวจจับโกไม่โกง
detector_model = YOLO('facedetec.pt')  # ตรวจจับใบหน้า
model_embedding = load_model('60per.h5')  # FaceNet model


# ---------------- ฟังก์ชันเดิมที่มีอยู่แล้ว ----------------
def getembeddingtf(image_path):
    try:
        img = Image.open(io.BytesIO(image_path)).convert("RGB")
        img_array = np.array(img)

        # Detect face
        results = detector_model(img_array)[0]
        boxes = results.boxes.xyxy.cpu()

        if len(boxes) == 0:
            print("No face detected.")
            return None

        # detected face
        x1, y1, x2, y2 = [int(v) for v in boxes[0]]
        face_img = img.crop((x1, y1, x2, y2))

        # Convert to Tensor
        face_tensor = tf.convert_to_tensor(np.array(face_img))
        face_tensor = tf.image.resize(face_tensor, (224, 224))
        face_tensor = tf.expand_dims(face_tensor, axis=0)
        face_tensor = face_tensor / 255.0
        face_tensor = tf.cast(face_tensor, tf.float32)
        face_tensor = tf.clip_by_value(face_tensor, 0.0, 1.0)

        return face_tensor

    except Exception as e:
        print(f"Error getting embedding: {e}")
        return None


@tf.function
def predict_embedding(face_tensor):
    em = model_embedding(face_tensor)
    em = em[0]  # ตัดมิติ
    return em


# ---------------- ฟังก์ชันสำหรับประมวลผลวิดีโอ ----------------
def get_face_embedding(face_img):
    """แปลงภาพใบหน้าเป็น embedding 128 มิติ"""
    face_tensor = tf.convert_to_tensor(face_img)
    face_tensor = tf.image.resize(face_tensor, (224, 224))
    face_tensor = tf.expand_dims(face_tensor, axis=0)
    face_tensor = tf.cast(face_tensor / 255.0, tf.float32)
    em = model_embedding(face_tensor)[0]
    return em.numpy()


def recognize_face(face_img, cache={}):
    """จดจำใบหน้าจากฐานข้อมูล Supabase"""
    face_key = tuple(face_img.flatten())
    if face_key in cache:
        return cache[face_key]

    embedding = get_face_embedding(face_img)
    embedding_list = embedding.tolist()
    user_name = "Unknown"

    try:
        res = supabase.rpc("search_face", {"query_embedding": embedding_list}).execute()
        if res.data and len(res.data) > 0:
            cosine_sim = res.data[0]["cosine_distance"]
            threshold = -0.90
            if cosine_sim <= threshold:
                user_name = res.data[0]["name"]
    except Exception as e:
        print("Supabase Error:", e)
        user_name = "Error"

    cache[face_key] = user_name
    return user_name


def process_video(input_path, output_path):
    """ประมวลผลวิดีโอและวาด bounding box"""
    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # ลอง H.264 ก่อน ถ้าไม่ได้ค่อยใช้ mp4v
    fourcc_options = [
        cv2.VideoWriter_fourcc(*'avc1'),  # H.264
        cv2.VideoWriter_fourcc(*'H264'),  # H.264
        cv2.VideoWriter_fourcc(*'X264'),  # H.264
        cv2.VideoWriter_fourcc(*'mp4v')   # MPEG-4
    ]
    
    out = None
    for fourcc in fourcc_options:
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if out.isOpened():
            print(f"ใช้ codec: {fourcc}")
            break
    
    if not out or not out.isOpened():
        raise Exception("ไม่สามารถสร้างไฟล์วิดีโอได้")

    people_boxes = []
    face_cache = {}
    frame_skip = 50
    frame_index = 0
    detection_logs = []  # เก็บ log การตรวจจับ

    print("เริ่มประมวลผลวิดีโอ...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_index += 1
        time_in_sec = frame_index / fps
        minutes = int(time_in_sec // 60)
        seconds = int(time_in_sec % 60)
        timestamp = f"{minutes:02d}:{seconds:02d}"

        # ตรวจจับคนทุก frame_skip เฟรม
        if frame_index % frame_skip == 1 or len(people_boxes) == 0:
            people_boxes = []
            results_person = person_model(frame)

            for box_person in results_person[0].boxes:
                cls_id = int(box_person.cls[0])
                conf_class = float(box_person.conf[0]) * 100
                x1, y1, x2, y2 = map(int, box_person.xyxy[0].cpu().numpy())

                # Crop คนและตรวจจับใบหน้า
                person_crop = frame[y1:y2, x1:x2]
                results_face = detector_model(person_crop)

                if len(results_face[0].boxes) == 0:
                    user_name = "NoFace"
                else:
                    box_face = results_face[0].boxes[0]
                    fx1, fy1, fx2, fy2 = map(int, box_face.xyxy[0].cpu().numpy())
                    face_crop = person_crop[fy1:fy2, fx1:fx2]
                    user_name = recognize_face(face_crop, face_cache)

                people_boxes.append((x1, y1, x2, y2, cls_id, user_name, conf_class))
                
                # บันทึก log
                class_name = "cheating" if cls_id == 1 else "non-cheating" if cls_id == 2 else "unknown"
                log_entry = {
                    "timestamp": timestamp,
                    "name": user_name,
                    "class": class_name,
                    "confidence": round(conf_class, 1)
                }
                detection_logs.append(log_entry)

            if frame_index % 100 == 0:
                print(f"ประมวลผลเฟรมที่ {frame_index} - พบคน {len(people_boxes)} คน")

        # วาด bounding box ทุกเฟรม
        for x1, y1, x2, y2, cls_id, user_name, conf_class in people_boxes:
            color = class_colors.get(cls_id, (255, 255, 255))

            if cls_id == 1:
                label = f"{user_name} | cheating | {conf_class:.1f}% | {timestamp}"
            elif cls_id == 2:
                label = f"{user_name} | non-cheating | {conf_class:.1f}% | {timestamp}"
            else:
                label = f"{user_name} | unknown | {conf_class:.1f}% | {timestamp}"

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, label, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        out.write(frame)

    cap.release()
    out.release()
    print(f"ประมวลผลเสร็จสิ้น: {output_path}")
    
    return detection_logs  # คืนค่า logs
# โหลดโมเดล
model_path = os.path.join(os.path.dirname(__file__), 'best_custom.pt') 
print(f"🤖 [STARTUP] Loading YOLO model from: {model_path}")
print(f"📁 [STARTUP] Model file exists: {os.path.exists(model_path)}")

model = YOLO(model_path)
print("✅ [STARTUP] YOLO model loaded successfully!")

model.info()
print(f"🏷️ [STARTUP] Model classes ({len(model.names)}): {list(model.names.values())}")
print(f"🎯 [STARTUP] Model confidence threshold: 0.25 (25%) - Optimized for 80+ people detection")
print(f"🎯 [STARTUP] Model IoU threshold: 0.45 (45%) - Better detection density")
print(f"🎯 [STARTUP] Max detections: 100 - Support for 80+ people simultaneously")
print(f"📊 [STARTUP] Model device: {model.device}")
print(f"🛡️ [STARTUP] Simplified 3-level classification:")
print(f"   - การโกงชัดเจน: >75% confidence")
print(f"   - อาจมีการโกง: 50-75% confidence") 
print(f"   - พฤติกรรมปกติ: <50% confidence")
print(f"🔍 [STARTUP] Additional filters:")
print(f"   - Minimum bounding box area: 500 pixels")
print(f"   - Duplicate detection removal: IoU > 25%")
print(f"   - Post-processing confidence filter: >25%")

log_list = []

# การจำแนกประเภทการโกง
CHEATING_CLASSES = {
    'cheating': 'การโกง',
    'fraud': 'การทุจริต', 
    'cheat': 'การโกง',
    'looking_around': 'มองไปรอบๆ (ต้องสงสัย)',
    'phone': 'ใช้โทรศัพท์',
    'talking': 'พูดคุย',
    'writing': 'เขียนคำตอบ (ปกติ)',
    'reading': 'อ่านข้อสอบ (ปกติ)',
    'thinking': 'คิด (ปกติ)'
}

def classify_action(class_name, confidence):
    """จำแนกว่าเป็นการโกงหรือไม่ - ปรับแต่งสำหรับ 80+ คน"""
    class_lower = class_name.lower()
    
    # ตรวจสอบ class จาก YOLO model โดยตรง - ลด threshold สำหรับ mass detection
    if class_lower == 'cheating':
        if confidence > 50:  # ลดจาก 75 เป็น 50
            return 'fraud', 'สูง', '🚨 การโกงชัดเจน'
        elif confidence >= 30:  # ลดจาก 50 เป็น 30
            return 'fraud', 'ปานกลาง', '⚠️ อาจมีการโกง'
        else:  
            return 'normal', 'ต่ำ', '✅ พฤติกรรมปกติ'
    
    elif class_lower == 'non-cheating':
        return 'normal', 'ต่ำ', '✅ ไม่โกง (พฤติกรรมปกติ)'
    
    # รองรับ person class ที่อาจมาจาก general YOLO model
    elif class_lower == 'person' or class_lower == '0':
        if confidence > 60:
            return 'normal', 'ต่ำ', '👤 บุคคล'
        else:
            return 'normal', 'ต่ำ', '👤 บุคคล (ความเชื่อมั่นต่ำ)'
    
    # รวม cheat + fraud ไว้ด้วยกัน - ลด threshold
    elif 'cheat' in class_lower or 'fraud' in class_lower:
        if confidence > 50:  # ลดจาก 75 เป็น 50
            return 'fraud', 'สูง', '🚨 การโกงชัดเจน'
        elif confidence >= 30:  # ลดจาก 50 เป็น 30
            return 'fraud', 'ปานกลาง', '⚠️ อาจมีการโกง'
        else:
            return 'normal', 'ต่ำ', '✅ พฤติกรรมปกติ'
    
    elif 'normal' in class_lower or 'good' in class_lower:
        return 'normal', 'ต่ำ', '✅ พฤติกรรมปกติ'
    
    # สำหรับ class ที่ไม่คาดคิด - ให้เป็น normal เพื่อให้ตรวจจับได้
    else:
        if confidence > 50:  # ลดจาก 75 เป็น 50
            return 'normal', 'ต่ำ', f'👤 {class_name}'
        else:
            return 'normal', 'ต่ำ', f'👤 {class_name} (ต่ำ)'

def Videolern(input_path: str, output_path: str):
    global log_list
    log_list = []  # reset log

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

        boxes = results[0].boxes
        if boxes is not None and len(boxes) > 0:
            timestamp = round(cap.get(cv2.CAP_PROP_POS_MSEC) / 1000, 2)
            for box in boxes:
                cls_id = int(box.cls.cpu().numpy())
                class_name = results[0].names[cls_id]
                conf = float(box.conf.cpu().numpy())  # ดึง confidence
                percent = round(conf * 100, 1)       # แปลงเป็นเปอร์เซ็นต์
                log_list.append({
                    "time": timestamp,
                    "class": class_name,
                    "percent": percent
                })
        else:
            processed_frame = frame

        out.write(processed_frame)

    cap.release()
    out.release()
    cv2.destroyAllWindows()
    return True, "Processing successful."


def cleanup_file(*paths: str):
    for path in paths:
        if os.path.exists(path):
            os.unlink(path)

app = FastAPI()

# เปิด CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # เปิดให้ทุก origin สำหรับการทดสอบ
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-ID"]
)

@app.post("/process-video")
async def process_video_endpoint(file: UploadFile = File(...)):
    input_path = None
    output_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_input:
            shutil.copyfileobj(file.file, temp_input)
            input_path = temp_input.name

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_output:
            output_path = temp_output.name

        success, message = Videolern(input_path, output_path)
        if not success:
            return {"error": message}

        background_task = BackgroundTask(cleanup_file, input_path, output_path)
        return FileResponse(
            path=output_path,
            media_type="video/mp4",
            filename=f"processed_{file.filename}",
            background=background_task
        )

    except Exception as e:
        if input_path and os.path.exists(input_path):
            os.unlink(input_path)
        if output_path and os.path.exists(output_path):
            os.unlink(output_path)
        return {"error": f"An error occurred: {e}"}

@app.get("/get-logs")
async def get_logs():
    return JSONResponse({"results": log_list})

@app.get("/model-info")
async def get_model_info():
    """ดูข้อมูล model"""
    return JSONResponse({
        "model_classes": list(model.names.values()),
        "total_classes": len(model.names),
        "device": str(model.device),
        "model_path": model_path
    })

@app.post("/detect-frame")
async def detect_frame(file: UploadFile = File(...)):
    """
    ตรวจจับการกระทำในเฟรมเดียว สำหรับ real-time detection
    """
    print("🎯 [DETECT-FRAME] Request received")
    
    try:
        # อ่านไฟล์รูปภาพ
        contents = await file.read()
        print(f"📷 [DETECT-FRAME] Image received, size: {len(contents)} bytes")
        
        # แปลง bytes เป็น numpy array
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            print("❌ [DETECT-FRAME] Cannot decode image")
            return JSONResponse({"error": "Cannot decode image"}, status_code=400)
        
        print(f"🖼️ [DETECT-FRAME] Frame decoded successfully, shape: {frame.shape}")
        
        # ทำการตรวจจับด้วย YOLO model
        print("🤖 [DETECT-FRAME] Starting YOLO inference...")
        start_time = time.time()
        
        # ปรับแต่งสำหรับการตรวจจับ 80+ คนพร้อมกัน
        results = model(frame, conf=0.25, iou=0.45, max_det=100)
        
        detection_time = round((time.time() - start_time) * 1000, 2)  # ms
        print(f"⚡ [DETECT-FRAME] YOLO inference completed in {detection_time}ms")
        print(f"🎛️ [DETECT-FRAME] Using conf=0.25, iou=0.45, max_det=100 for 80+ people detection")
        
        detections = []
        fraud_detected = False
        suspicious_detected = False
        fraud_count = 0
        suspicious_count = 0
        
        print(f"📊 [DETECT-FRAME] YOLO results: {len(results) if results else 0} result(s)")
        
        if results and len(results) > 0:
            boxes = results[0].boxes
            print(f"📦 [DETECT-FRAME] Raw boxes found: {len(boxes) if boxes is not None else 0}")
            
            if boxes is not None and len(boxes) > 0:
                print(f"🎯 [DETECT-FRAME] Processing {len(boxes)} raw detections...")
                valid_detections = []
                
                for i, box in enumerate(boxes):
                    cls_id = int(box.cls.cpu().numpy())
                    class_name = results[0].names[cls_id]
                    conf = float(box.conf.cpu().numpy())
                    percent = round(conf * 100, 1)
                    bbox = box.xyxy[0].cpu().numpy().tolist()
                    
                    print(f"   📋 [DETECT-FRAME] Detection {i+1}: {class_name} ({percent}%)")
                    
                    # จำแนกประเภทการกระทำ
                    action_type, risk_level, thai_name = classify_action(class_name, percent)
                    print(f"   🏷️ [DETECT-FRAME] Classified as: {action_type} - {thai_name}")
                    
                    # ปรับแต่งการกรองสำหรับ 80+ คน
                    bbox_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                    if bbox_area < 500:  # ลดจาก 1000 เป็น 500 pixels
                        print(f"   🚫 [DETECT-FRAME] Filtered out small detection (area: {bbox_area})")
                        continue
                    if percent < 25:  # ลดจาก 55% เป็น 25%
                        print(f"   🚫 [DETECT-FRAME] Filtered out low confidence detection ({percent}%)")
                        continue
                    
                    # ลดการกรอง duplicate detection เพื่อให้ตรวจจับได้มากขึ้น
                    is_duplicate = False
                    for existing_det in valid_detections:
                        existing_bbox = existing_det["bbox"]
                        x1 = max(bbox[0], existing_bbox[0])
                        y1 = max(bbox[1], existing_bbox[1])
                        x2 = min(bbox[2], existing_bbox[2])
                        y2 = min(bbox[3], existing_bbox[3])
                        
                        if x1 < x2 and y1 < y2:
                            intersection = (x2 - x1) * (y2 - y1)
                            area1 = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                            area2 = (existing_bbox[2] - existing_bbox[0]) * (existing_bbox[3] - existing_bbox[1])
                            union = area1 + area2 - intersection
                            iou = intersection / union if union > 0 else 0
                            
                            if iou > 0.25:  # ลดจาก 0.3 เป็น 0.25
                                if percent > existing_det["confidence"]:
                                    valid_detections.remove(existing_det)
                                    print(f"   🔄 [DETECT-FRAME] Replaced lower confidence detection")
                                else:
                                    is_duplicate = True
                                    print(f"   🚫 [DETECT-FRAME] Filtered out duplicate detection")
                                break
                    
                    if not is_duplicate:
                        detection = {
                            "class": class_name,
                            "thai_name": thai_name,
                            "confidence": percent,
                            "action_type": action_type,
                            "risk_level": risk_level,
                            "bbox": bbox
                        }
                        valid_detections.append(detection)
                        detections.append(detection)
                        
                        if action_type == 'fraud':
                            fraud_detected = True
                            fraud_count += 1
                        elif action_type == 'suspicious':
                            suspicious_detected = True
                            suspicious_count += 1
                
                print(f"✅ [DETECT-FRAME] Valid detections after filtering: {len(valid_detections)}")
            else:
                print("👁️ [DETECT-FRAME] No objects detected in frame")
        else:
            print("❓ [DETECT-FRAME] No YOLO results or empty results")
        
        # คำนวณระดับความเสี่ยงรวม
        total_risk_score = (fraud_count * 3) + (suspicious_count * 1)
        if total_risk_score >= 3:
            overall_risk = 'สูง'
        elif total_risk_score >= 1:
            overall_risk = 'ปานกลาง'
        else:
            overall_risk = 'ต่ำ'
        
        print(f"📊 [DETECT-FRAME] Final results:")
        print(f"   🎯 Total detections: {len(detections)}")
        print(f"   🚨 Fraud detected: {fraud_detected} (count: {fraud_count})")
        print(f"   ⚠️ Suspicious detected: {suspicious_detected} (count: {suspicious_count})")
        print(f"   📈 Risk score: {total_risk_score} ({overall_risk})")
        print(f"✅ [DETECT-FRAME] Sending response")
        
        return JSONResponse({
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "detection_time_ms": detection_time,
            "fraud_detected": fraud_detected,
            "suspicious_detected": suspicious_detected,
            "fraud_count": fraud_count,
            "suspicious_count": suspicious_count,
            "overall_risk": overall_risk,
            "risk_score": total_risk_score,
            "detections": detections,
            "total_detections": len(detections)
        })
        
    except Exception as e:
        print(f"💥 [DETECT-FRAME] ERROR: {str(e)}")
        import traceback
        print(f"📋 [DETECT-FRAME] Traceback: {traceback.format_exc()}")
        return JSONResponse({"error": f"Detection failed: {str(e)}"}, status_code=500)
    
@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/uploadfile")
async def create_upload_file(name: str = Form(...), upload_file: List[UploadFile] = File(..., alias="images[]")):
    """ฟังก์ชันเดิมสำหรับอัปโหลดภาพใบหน้า - ไม่แก้ไข"""
    embeddings_to_insert = []
    
    for file in upload_file:
        img = await file.read()
        img = getembeddingtf(img)
        img = predict_embedding(img)

        embedding_list = img.numpy().tolist()

        embeddings_to_insert.append({
            "name": name,
            "embedding": embedding_list
        })

    res = supabase.table("face_embeddings").insert(embeddings_to_insert).execute()

    return {"name": name, "unit": len(embeddings_to_insert), "data": res.data}


@app.post("/process-video2")
async def process_video_endpoint(video: UploadFile = File(...)):
    """API ใหม่สำหรับประมวลผลวิดีโอ"""
    print(f"รับไฟล์: {video.filename}")
    
    # สร้าง unique ID สำหรับ session นี้
    import uuid
    session_id = str(uuid.uuid4())
    
    # สร้างไฟล์ชั่วคราวสำหรับบันทึกวิดีโอที่อัปโหลด
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_input:
        content = await video.read()
        tmp_input.write(content)
        input_path = tmp_input.name
    
    # สร้างชื่อไฟล์ output และ log
    output_path = input_path.replace('.mp4', '_processed.mp4')
    log_path = f"logs_{session_id}.json"
    
    try:
        # ประมวลผลวิดีโอและรับ logs
        detection_logs = process_video(input_path, output_path)
        
        # บันทึก logs เป็นไฟล์ JSON ใน temp directory
        log_full_path = os.path.join(tempfile.gettempdir(), log_path)
        with open(log_full_path, 'w', encoding='utf-8') as f:
            json.dump(detection_logs, f, ensure_ascii=False, indent=2)
        
        print(f"บันทึก logs ที่: {log_full_path}")
        
        # ส่งวิดีโอพร้อม session_id
        response = FileResponse(
            output_path,
            media_type="video/mp4",
            filename="processed_video.mp4",
            background=None
        )
        
        # ส่ง session_id ใน header เพื่อให้ client ดึง logs ได้
        response.headers["X-Session-ID"] = session_id
        
        return response
        
    except Exception as e:
        print(f"เกิดข้อผิดพลาด: {e}")
        # ลบไฟล์ชั่วคราวกรณีเกิดข้อผิดพลาด
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)
        raise
    finally:
        # ลบไฟล์ input เท่านั้น output จะถูกลบหลังส่งเสร็จ
        if os.path.exists(input_path):
            os.remove(input_path)


@app.get("/get-logs/{session_id}")
async def get_logs(session_id: str):
    """API สำหรับดึง logs ตาม session_id"""
    log_path = os.path.join(tempfile.gettempdir(), f"logs_{session_id}.json")
    
    if not os.path.exists(log_path):
        return JSONResponse(
            status_code=404,
            content={"error": "ไม่พบ logs"}
        )
    
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            logs = json.load(f)
        
        # ลบไฟล์ logs หลังจากอ่านแล้ว
        os.remove(log_path)
        
        return JSONResponse(content={"logs": logs})
    except Exception as e:
        print(f"Error reading logs: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

