uvicorn server.main:app --reload




.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 50px;  /* กำหนดความกว้าง 50 พิกเซล */
    height: 50px; /* กำหนดความสูง 50 พิกเซล */
    background-color: #f9f9f9; /* สีเทาอ่อน */
    border: 1px solid #ccc; /* เส้นขอบ */
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1); /* เงา */
    border-radius: 5px; /* ขอบมน */
    padding: 20px; /* เพิ่มระยะห่างภายใน */
    overflow: hidden; /* ซ่อนเนื้อหาที่เกินขอบ */
}

ใช้แค่ java ไม่ได้หรอทำไมต้องใช้ fastapi ด้วย
ChatGPT said:

อ๋อ เข้าใจแล้วครับ ✨
คุณสงสัยว่า ทำไมผมเลือก FastAPI แทนที่จะใช้ Java อย่างเดียว ใช่ไหม

🔹 1. ถ้าจะทำงานกับ PyTorch

PyTorch เขียนด้วย Python เป็นหลัก

เวลาเราจะ โหลดโมเดล + infer (ทำนาย) → ต้องใช้ Python

ถ้าใช้ Java อย่างเดียว → จะยุ่งยากมาก เพราะต้องหาวิธีเชื่อม PyTorch เข้ากับ Java (มี wrapper เช่น TorchServe + Java client หรือ ONNX + Java runtime) ซึ่งซับซ้อนกว่ามาก

🔹 2. FastAPI = ตัวกลาง

FastAPI (Python) ทำหน้าที่เป็น Backend API

JavaScript (ในเว็บ) แค่เรียก API → ส่งไฟล์/เฟรม → รับผลลัพธ์ JSON กลับมา

แบบนี้ง่ายกว่าเพราะโมเดล PyTorch อยู่ในฝั่ง Python 100%

🔹 3. ถ้าอยาก “ใช้แค่ JavaScript” จริง ๆ

ก็ทำได้ครับ โดยใช้ PyTorch.js ไม่มี แต่เรามีทางเลือก:

แปลงโมเดลไปเป็น ONNX → ใช้ ONNX Runtime Web (JavaScript)

โมเดลจะรันใน browser ได้เลย (ผ่าน WebGL / WebGPU)

ไม่ต้องมี FastAPI

แต่ต้องแปลงโมเดล + ประสิทธิภาพอาจไม่เท่า Python

ใช้ TensorFlow.js

ถ้าโมเดลคุณสามารถแปลงเป็น TensorFlow format → แปลงต่อเป็น TF.js

รันได้ใน browser 100%

🔹 สรุป

ถ้า ใช้ PyTorch เดิม ๆ → จำเป็นต้องใช้ Python + FastAPI เป็น Backend

ถ้าอยากใช้ JavaScript อย่างเดียว (ไม่มี Backend) → ต้อง แปลงโมเดล เป็น ONNX หรือ TensorFlow.js


(world) PS C:\Human action liveness\server> python .\main.py

image 1/1 C:\Human action liveness\web\cs1\image.png: 416x416 2 cheatings, 14.1ms
Speed: 1.8ms preprocess, 14.1ms inference, 75.1ms postprocess per image at shape (1, 3, 416, 416)
[ultralytics.engine.results.Results object with attributes:

boxes: ultralytics.engine.results.Boxes object
keypoints: None
masks: None
names: {0: 'cheating', 1: 'non-cheating'}
obb: None
orig_img: array([[[173, 190, 186],
        [173, 190, 186],
        [173, 190, 186],
        ...,
        [  6,   9,   7],
        [  6,   9,   7],
        [  6,   9,   7]],

       [[172, 189, 185],
        [173, 190, 186],
        [173, 190, 186],
        ...,
        [  6,   9,   7],
        [  6,   9,   7],
        [  6,   9,   7]],

       [[172, 189, 185],
        [172, 189, 185],
        [172, 189, 185],
        ...,
        [  6,   9,   7],
        [  6,   9,   7],
        [  6,   9,   7]],

       ...,

       [[ 91,  94,  72],
        [ 95,  98,  76],
        [ 96, 100,  75],
        ...,
        [217, 209, 192],
        [217, 208, 194],
        [216, 207, 193]],

       [[ 89,  92,  70],
        [ 93,  96,  74],
        [ 93,  97,  72],
        ...,
        [217, 208, 194],
        [217, 208, 194],
        [216, 207, 193]],

       [[ 88,  91,  69],
        [ 92,  95,  73],
        [ 91,  95,  70],
        ...,
        [217, 208, 194],
        [217, 208, 194],
        [216, 207, 193]]], shape=(500, 500, 3), dtype=uint8)
orig_shape: (500, 500)
path: 'C:\\Human action liveness\\web\\cs1\\image.png'
probs: None
save_dir: 'runs\\detect\\predict'
speed: {'preprocess': 1.8494999967515469, 'inference': 14.08259995514527, 'postprocess': 75.14109998010099}]
(world) PS C:\Human action liveness\server>

(world) PS C:\Human action liveness\bug> python .\model.py
DetectionModel(
  (model): Sequential(
    (0): Conv(
      (conv): Conv2d(3, 32, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)
      (bn): BatchNorm2d(32, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)        
      (act): SiLU(inplace=True)
    )
    (1): Conv(
      (conv): Conv2d(32, 64, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)
      (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)        
      (act): SiLU(inplace=True)
    )
    (2): C2f(
      (cv1): Conv(
        (conv): Conv2d(64, 64, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)      
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(96, 64, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)      
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0): Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(32, 32, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(32, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(32, 32, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(32, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (3): Conv(
      (conv): Conv2d(64, 128, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)        
      (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)       
      (act): SiLU(inplace=True)
    )
    (4): C2f(
      (cv1): Conv(
        (conv): Conv2d(128, 128, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(256, 128, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0-1): 2 x Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(64, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(64, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (5): Conv(
      (conv): Conv2d(128, 256, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)       
      (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)       
      (act): SiLU(inplace=True)
    )
    (6): C2f(
      (cv1): Conv(
        (conv): Conv2d(256, 256, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(512, 256, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0-1): 2 x Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (7): Conv(
      (conv): Conv2d(256, 512, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)       
      (bn): BatchNorm2d(512, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)       
      (act): SiLU(inplace=True)
    )
    (8): C2f(
      (cv1): Conv(
        (conv): Conv2d(512, 512, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(512, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(768, 512, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(512, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0): Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(256, 256, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(256, 256, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (9): SPPF(
      (cv1): Conv(
        (conv): Conv2d(512, 256, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(1024, 512, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(512, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): MaxPool2d(kernel_size=5, stride=1, padding=2, dilation=1, ceil_mode=False)
    )
    (10): Upsample(scale_factor=2.0, mode='nearest')
    (11): Concat()
    (12): C2f(
      (cv1): Conv(
        (conv): Conv2d(768, 256, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(384, 256, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0): Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (13): Upsample(scale_factor=2.0, mode='nearest')
    (14): Concat()
    (15): C2f(
      (cv1): Conv(
        (conv): Conv2d(384, 128, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(192, 128, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0): Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(64, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(64, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (16): Conv(
      (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)       
      (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)       
      (act): SiLU(inplace=True)
    )
    (17): Concat()
    (18): C2f(
      (cv1): Conv(
        (conv): Conv2d(384, 256, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(384, 256, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0): Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (19): Conv(
      (conv): Conv2d(256, 256, kernel_size=(3, 3), stride=(2, 2), padding=(1, 1), bias=False)       
      (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)       
      (act): SiLU(inplace=True)
    )
    (20): Concat()
    (21): C2f(
      (cv1): Conv(
        (conv): Conv2d(768, 512, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(512, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (cv2): Conv(
        (conv): Conv2d(768, 512, kernel_size=(1, 1), stride=(1, 1), bias=False)
        (bn): BatchNorm2d(512, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)     
        (act): SiLU(inplace=True)
      )
      (m): ModuleList(
        (0): Bottleneck(
          (cv1): Conv(
            (conv): Conv2d(256, 256, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (cv2): Conv(
            (conv): Conv2d(256, 256, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(256, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
        )
      )
    )
    (22): Detect(
      (cv2): ModuleList(
        (0): Sequential(
          (0): Conv(
            (conv): Conv2d(128, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)  
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (1): Conv(
            (conv): Conv2d(64, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (2): Conv2d(64, 64, kernel_size=(1, 1), stride=(1, 1))
        )
        (1): Sequential(
          (0): Conv(
            (conv): Conv2d(256, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)  
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (1): Conv(
            (conv): Conv2d(64, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (2): Conv2d(64, 64, kernel_size=(1, 1), stride=(1, 1))
        )
        (2): Sequential(
          (0): Conv(
            (conv): Conv2d(512, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)  
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (1): Conv(
            (conv): Conv2d(64, 64, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False)   
            (bn): BatchNorm2d(64, eps=0.001, momentum=0.03, affine=True, track_running_stats=True)  
            (act): SiLU(inplace=True)
          )
          (2): Conv2d(64, 64, kernel_size=(1, 1), stride=(1, 1))
        )
      )
      (cv3): ModuleList(
        (0): Sequential(
          (0): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (1): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (2): Conv2d(128, 2, kernel_size=(1, 1), stride=(1, 1))
        )
        (1): Sequential(
          (0): Conv(
            (conv): Conv2d(256, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (1): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (2): Conv2d(128, 2, kernel_size=(1, 1), stride=(1, 1))
        )
        (2): Sequential(
          (0): Conv(
            (conv): Conv2d(512, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (1): Conv(
            (conv): Conv2d(128, 128, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1), bias=False) 
            (bn): BatchNorm2d(128, eps=0.001, momentum=0.03, affine=True, track_running_stats=True) 
            (act): SiLU(inplace=True)
          )
          (2): Conv2d(128, 2, kernel_size=(1, 1), stride=(1, 1))
        )
      )
      (dfl): DFL(
        (conv): Conv2d(16, 1, kernel_size=(1, 1), stride=(1, 1), bias=False)
      )
    )
  )
)
.container {
    display: flex;
    flex-direction: column;
    width: 900px;
    height: 700px;
    background-color: rgba(0, 191, 255, 0.8);
    border-radius: 10px;
}

btn.addEventListener("click", function() {
        myH1.innerText = "ข้อความเปลี่ยนแล้ว!";
    });



    console.log(file.name);  // ชื่อไฟล์
    console.log(file.type);  // ชนิดไฟล์ เช่น "video/mp4"
    console.log(file.size);  // ขนาดไฟล์เป็น bytes


    from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# เปิด CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],  # อนุญาตทุกเว็บ (สำหรับ dev) หรือใส่ ["http://127.0.0.1:5500"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],
    allow_methods=["*"],
)

// ส่งไฟล์ไปยัง FastAPI และ กลับผลลัพธ์
        try {
            // ส่งไปยัง FastAPI endpoint
            const response = await fetch("http://127.0.0.1:8000/upload/", {
                method: "POST",
                body: formData
            });

            const result = await response.json(); // ผลbackend
            console.log("ผลลัพธ์จาก server:", result);
            alert(`อัปโหลดสำเร็จ: ${result.filename} (${result.size} bytes)`);

        } catch (err) {
            console.error("เกิดข้อผิดพลาด:", err);
            alert("อัปโหลดล้มเหลว");
        }


for result in results:
    # result.orig_img คือ numpy array ของ frame
    img = result.orig_img.copy()
    
    # วาด bounding boxes บน frame
    img = result.plot()  # จะได้ภาพที่วาดกล่องแล้ว
    
    # แสดงภาพ
    cv2.imshow("YOLO Result", img)
    if cv2.waitKey(0) & 0xFF == ord('q'):
        break

cv2.destroyAllWindows()


แสดง log


    
    const detections = [
    { frame_index: 0, detections: [{ class: "cheating", confidence: 0.51 }] },
    { frame_index: 1, detections: [{ class: "cheating", confidence: 0.46 }] },
    { frame_index: 2, detections: [{ class: "non-cheating", confidence: 0.62 }] },
    { frame_index: 3, detections: [{ class: "cheating", confidence: 0.42 }, { class: "non-cheating", confidence: 0.28 }] }
    ];

    const fps = 25; // สมมติว่า video 25 fps
    const logOutput = document.getElementById("logOutput");

    // ฟังก์ชันแสดง log ตามประเภท
    function showLogs(filterType) {
    logOutput.innerHTML = ""; // ล้างของเก่า

    detections.forEach(frame => {
        frame.detections.forEach(det => {
        if (filterType === "all" || det.class === filterType) {
            const timeSec = (frame.frame_index / fps).toFixed(2);
            const p = document.createElement("p");
            p.textContent = `เวลา ${timeSec}s - class: ${det.class} (${det.confidence.toFixed(2)})`;
            logOutput.appendChild(p);
        }
        });
    });
    }

    // ผูกปุ่มกับฟังก์ชัน
    document.getElementById("Logall").addEventListener("click", () => showLogs("all"));
    document.getElementById("logC").addEventListener("click", () => showLogs("cheating"));
    document.getElementById("logNC").addEventListener("click", () => showLogs("non-cheating"));

import cv2
from ultralytics import YOLO

def process_video(video_path: str, output_path: str, model):
    """
    - video_path: path ของวิดีโอ input
    - output_path: path ของวิดีโอ output
    - model: โมเดล YOLO
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # สำหรับบันทึกวิดีโอ output
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    logs = []
    frame_index = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame)

        # วาด bounding box และเก็บ log
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                # overlay ลงบน frame
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, f"{model.names[cls_id]} {conf:.2f}",
                            (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)

                # เก็บ log
                logs.append({
                    "frame": frame_index,
                    "time": round(frame_index / fps, 2),
                    "class": model.names[cls_id],
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2]
                })

        out.write(frame)  # เขียน frame ลง video
        frame_index += 1

    cap.release()
    out.release()
    return {"fps": fps, "detections": logs}
