import torch
import os
from ultralytics import YOLO
print(torch.__version__)

model_path = os.path.join(os.path.dirname(__file__), 'best.pt') 
model = YOLO(model_path)

model.info()