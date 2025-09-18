from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
import os, cv2, tempfile, shutil
from ultralytics import YOLO

model_path = os.path.join(os.path.dirname(__file__), 'best.pt') 
model = YOLO(model_path)

log_list = []

def Videolern(input_path: str, output_path: str):
    global log_list
    log_list = []  # resetlog

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
