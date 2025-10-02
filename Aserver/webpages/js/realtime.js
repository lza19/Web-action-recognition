document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('Start');
  const stopBtn = document.getElementById('Stop');
  const toggleDetectionBtn = document.getElementById('toggleDetection');
  const downloadBtn = document.getElementById('download');
  const logAllBtn = document.getElementById('Logall');
  const logCBtn = document.getElementById('logC');
  const logNCBtn = document.getElementById('logNC');
  const videoPlayer = document.getElementById('videoPlayer');
  const logList = document.getElementById('log-list');
  const currentCameraLabel = document.getElementById('currentCamera');
  const serverStatusLabel = document.getElementById('serverStatus');

  let logs = [];
  let stream = null; // ไว้เก็บ MediaStream จากกล้อง
  let availableCameras = []; // เก็บรายการกล้องที่มีอยู่
  let currentCameraIndex = 0; // index ของกล้องปัจจุบัน
  let isDetecting = false; // สถานะการตรวจจับ
  let detectionInterval = null; // interval สำหรับการตรวจจับ
  let currentFilter = 'all'; // เก็บ filter ปัจจุบัน
  const SERVER_URL = 'http://127.0.0.1:8000'; // URL ของ server
  
  // สำหรับบันทึกภาพการโกง
  let cheatingImages = []; // เก็บภาพการโกงที่บันทึกไว้
  let captureCanvas = null; // canvas สำหรับจับภาพ
  let latestCheatingImage = null; // เก็บภาพการโกงล่าสุด

  // ✅ ฟังก์ชันอัพเดตข้อความปุ่มดาวน์โหลด
  function updateDownloadButton() {
    if (cheatingImages.length > 0) {
      downloadBtn.innerHTML = `<i class="fas fa-camera"></i> ดาวน์โหลดภาพการโกง (${cheatingImages.length})`;
      downloadBtn.title = `มีภาพการโกง ${cheatingImages.length} ภาพ - ล่าสุด: ${latestCheatingImage?.displayTime}`;
    } else {
      downloadBtn.innerHTML = '<i class="fas fa-download"></i> ดาวน์โหลด';
      downloadBtn.title = 'ยังไม่มีภาพการโกง';
    }
  }

  // สร้าง canvas สำหรับวาดกรอบ
  let overlayCanvas = null;
  let overlayCtx = null;
  let lastDrawTime = 0;  // ป้องกันการวาดซ้ำเร็วเกินไป

  // ✅ สร้าง overlay canvas สำหรับแสดงกรอบ
  function createOverlayCanvas() {
    if (!overlayCanvas) {
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.style.position = 'absolute';
      overlayCanvas.style.top = '0';
      overlayCanvas.style.left = '0';
      overlayCanvas.style.pointerEvents = 'none';
      overlayCanvas.style.zIndex = '10';
      
      // เพิ่ม canvas ไปยัง video container
      const videoSection = document.querySelector('.video-section');
      videoSection.style.position = 'relative';
      videoSection.appendChild(overlayCanvas);
      
      overlayCtx = overlayCanvas.getContext('2d');
      console.log('✅ Overlay canvas created');
    }
  }

  // ✅ อัปเดตขนาด overlay canvas ให้ตรงกับวิดีโอ
  function updateOverlayCanvas() {
    if (!overlayCanvas || !videoPlayer.videoWidth || !videoPlayer.videoHeight) return;
    
    const videoRect = videoPlayer.getBoundingClientRect();
    overlayCanvas.width = videoRect.width;
    overlayCanvas.height = videoRect.height;
    overlayCanvas.style.width = videoRect.width + 'px';
    overlayCanvas.style.height = videoRect.height + 'px';
    
    console.log('📐 Overlay canvas updated:', videoRect.width, 'x', videoRect.height);
  }

  // ✅ กรองและจำกัดการตรวจจับให้แสดงเฉพาะ cheating และ non-cheating
  function filterRelevantDetections(detections) {
    if (!detections || detections.length === 0) return detections;
    
    // กรองเฉพาะ class ที่ต้องการ
    const relevantClasses = ['cheating', 'non-cheating'];
    const filtered = detections.filter(detection => 
      relevantClasses.includes(detection.class.toLowerCase())
    );
    
    console.log(`🎯 Filtered relevant classes: ${detections.length} → ${filtered.length}`);
    
    if (filtered.length === 0) {
      console.log('ℹ️ No cheating/non-cheating detections found');
      return [];
    }
    
    // จำกัดจำนวนตามประเภท
    const maxPerType = {
      'fraud': 3,      // การโกงแสดงสูงสุด 3 กรอบ
      'suspicious': 2, // ต้องสงสัยแสดงสูงสุด 2 กรอบ
      'normal': 1      // ปกติแสดงแค่ 1 กรอบ
    };
    
    const grouped = {};
    
    // จัดกลุ่มตามประเภท action
    filtered.forEach(detection => {
      const type = detection.action_type || 'normal';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(detection);
    });
    
    // จำกัดจำนวนในแต่ละกลุ่มและเรียงตาม confidence
    const limited = [];
    Object.keys(grouped).forEach(type => {
      const sorted = grouped[type].sort((a, b) => b.confidence - a.confidence);
      const maxCount = maxPerType[type] || 1;
      limited.push(...sorted.slice(0, maxCount));
    });
    
    console.log(`📊 Final detections by type:`, 
      Object.keys(grouped).map(type => `${type}: ${grouped[type].length} → ${Math.min(grouped[type].length, maxPerType[type] || 1)}`).join(', ')
    );
    
    return limited;
  }

  // ✅ กรองกรอบที่ซ้อนกันหรือซ้ำกัน
  function filterOverlappingBoxes(detections) {
    if (!detections || detections.length <= 1) return detections;
    
    // เรียงลำดับตาม confidence (สูงสุดก่อน)
    const sorted = detections.sort((a, b) => b.confidence - a.confidence);
    const filtered = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      let isOverlapping = false;
      
      // เช็ควา overlap กับกรอบที่ผ่านการคัดเลือกแล้วหรือไม่
      for (let j = 0; j < filtered.length; j++) {
        const existing = filtered[j];
        const overlap = calculateOverlap(current.bbox, existing.bbox);
        
        // หาก overlap มากกว่า 70% ถือว่าซ้ำกัน
        if (overlap > 0.7) {
          isOverlapping = true;
          console.log(`🔍 Filtering overlapping box: ${current.thai_name} (${current.confidence}%) overlaps with ${existing.thai_name} (${overlap.toFixed(2)})`);
          break;
        }
      }
      
      if (!isOverlapping) {
        filtered.push(current);
      }
    }
    
    console.log(`📦 Filtered boxes: ${detections.length} → ${filtered.length}`);
    return filtered;
  }

  // ✅ คำนวณ overlap ระหว่างสองกรอบ
  function calculateOverlap(bbox1, bbox2) {
    if (!bbox1 || !bbox2 || bbox1.length !== 4 || bbox2.length !== 4) return 0;
    
    const [x1a, y1a, x2a, y2a] = bbox1;
    const [x1b, y1b, x2b, y2b] = bbox2;
    
    // หาพื้นที่ที่ overlap กัน
    const xOverlap = Math.max(0, Math.min(x2a, x2b) - Math.max(x1a, x1b));
    const yOverlap = Math.max(0, Math.min(y2a, y2b) - Math.max(y1a, y1b));
    const overlapArea = xOverlap * yOverlap;
    
    // หาพื้นที่ของแต่ละกรอบ
    const area1 = (x2a - x1a) * (y2a - y1a);
    const area2 = (x2b - x1b) * (y2b - y1b);
    const unionArea = area1 + area2 - overlapArea;
    
    return unionArea > 0 ? overlapArea / unionArea : 0;
  }

  // ✅ วาดกรอบบนวิดีโอ
  function drawBoundingBoxes(detections) {
    if (!overlayCanvas || !overlayCtx || !videoPlayer.videoWidth) return;
    
    // ป้องกันการวาดซ้ำเร็วเกินไป (throttle)
    const now = Date.now();
    if (now - lastDrawTime < 100) { // จำกัดไม่เกิน 10 FPS
      return;
    }
    lastDrawTime = now;
    
    // ล้าง canvas ก่อนวาดใหม่
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    if (!detections || detections.length === 0) {
      console.log('🧹 No detections to draw');
      return;
    }
    
    // กรองกรอบที่ซ้อนกัน
    const filteredDetections = filterOverlappingBoxes(detections);
    
    const videoRect = videoPlayer.getBoundingClientRect();
    const scaleX = videoRect.width / videoPlayer.videoWidth;
    const scaleY = videoRect.height / videoPlayer.videoHeight;
    
    console.log('🎨 Drawing', filteredDetections.length, 'filtered bounding boxes');
    
    filteredDetections.forEach((detection, index) => {
      if (detection.bbox && detection.bbox.length === 4) {
        const [x1, y1, x2, y2] = detection.bbox;
        
        // คำนวณขนาดกรอบต้นฉบับ
        const originalWidth = x2 - x1;
        const originalHeight = y2 - y1;
        
        // ลดขนาดกรอบ 20% (เก็บ 80% ของขนาดเดิม)
        const shrinkFactor = 0.8;
        const shrinkX = (originalWidth * (1 - shrinkFactor)) / 2;
        const shrinkY = (originalHeight * (1 - shrinkFactor)) / 2;
        
        // กรอบใหม่ที่เล็กลง
        const newX1 = x1 + shrinkX;
        const newY1 = y1 + shrinkY;
        const newX2 = x2 - shrinkX;
        const newY2 = y2 - shrinkY;
        
        // ปรับขนาดตามอัตราส่วนของวิดีโอ
        const drawX = newX1 * scaleX;
        const drawY = newY1 * scaleY;
        const drawWidth = (newX2 - newX1) * scaleX;
        const drawHeight = (newY2 - newY1) * scaleY;
        
        // เลือกสีตามประเภทและ class
        let color, bgColor, lineWidth = 3;
        
        if (detection.class.toLowerCase() === 'cheating') {
          // การโกง - สีแดงเข้ม
          color = '#dc2626';
          bgColor = 'rgba(220, 38, 38, 0.15)';
          lineWidth = 4; // เส้นหนาขึ้น
        } else if (detection.class.toLowerCase() === 'non-cheating') {
          // ไม่โกง - สีเขียว
          color = '#16a34a';
          bgColor = 'rgba(22, 163, 74, 0.1)';
        } else {
          // อื่นๆ ตามประเภท action
          switch (detection.action_type) {
            case 'fraud':
              color = '#ef4444'; // แดง
              bgColor = 'rgba(239, 68, 68, 0.1)';
              break;
            case 'suspicious':
              color = '#f59e0b'; // ส้ม
              bgColor = 'rgba(245, 158, 11, 0.1)';
              break;
            default:
              color = '#10b981'; // เขียว
              bgColor = 'rgba(16, 185, 129, 0.1)';
          }
        }
        
        // วาดเงากรอบ (shadow effect)
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        overlayCtx.fillRect(drawX + 2, drawY + 2, drawWidth, drawHeight);
        
        // วาดพื้นหลังกรอบ
        overlayCtx.fillStyle = bgColor;
        overlayCtx.fillRect(drawX, drawY, drawWidth, drawHeight);
        
        // วาดกรอบหลัก
        overlayCtx.strokeStyle = color;
        overlayCtx.lineWidth = lineWidth;
        overlayCtx.setLineDash([]); // เส้นทึบ
        overlayCtx.strokeRect(drawX, drawY, drawWidth, drawHeight);
        
        // วาดกรอบเน้น (highlight) สำหรับ cheating
        if (detection.class.toLowerCase() === 'cheating') {
          overlayCtx.strokeStyle = '#ffffff';
          overlayCtx.lineWidth = 1;
          overlayCtx.setLineDash([5, 5]); // เส้นประ
          overlayCtx.strokeRect(drawX + 2, drawY + 2, drawWidth - 4, drawHeight - 4);
          overlayCtx.setLineDash([]); // รีเซ็ตเป็นเส้นทึบ
        }
        
        // วาดข้อความ - แสดงชื่อ class และ confidence
        const displayName = detection.class.toLowerCase() === 'cheating' ? '🚨 CHEATING' : 
                           detection.class.toLowerCase() === 'non-cheating' ? '✅ NON-CHEATING' :
                           detection.thai_name;
        const label = `${displayName} ${detection.confidence.toFixed(1)}%`;
        
        overlayCtx.font = 'bold 16px Arial';
        const textWidth = overlayCtx.measureText(label).width;
        const textHeight = 24;
        const padding = 8;
        
        // คำนวณตำแหน่งข้อความให้ไม่ทับกรอบและไม่ล้นขอบจอ
        let textX = drawX;
        let textY = drawY - 8; // เว้นระยะจากกรอบ 8px
        
        // ตรวจสอบว่าข้อความล้นขอบบนหรือไม่
        if (textY - textHeight < 0) {
          // หากล้นขอบบน ให้แสดงด้านล่างกรอบ
          textY = drawY + drawHeight + textHeight + 8;
        }
        
        // ตรวจสอบว่าข้อความล้นขอบล่างหรือไม่
        if (textY > overlayCanvas.height) {
          // หากล้นขอบล่าง ให้แสดงข้างในกรอบด้านบน
          textY = drawY + textHeight + 4;
        }
        
        // ตรวจสอบขอบซ้าย
        if (textX < 4) {
          textX = 4;
        }
        
        // ตรวจสอบขอบขวา
        if (textX + textWidth + padding > overlayCanvas.width - 4) {
          textX = overlayCanvas.width - textWidth - padding - 4;
        }
        
        // จัดตำแหน่งให้อยู่กึ่งกลางเหนือกรอบถ้าเป็นไปได้
        if (textY === drawY - 8) { // อยู่ด้านบนกรอบ
          const centerX = drawX + (drawWidth / 2) - (textWidth / 2);
          if (centerX > 4 && centerX + textWidth + padding < overlayCanvas.width - 4) {
            textX = centerX;
          }
        }
        
        // วาดพื้นหลังข้อความแบบมีเงา
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        overlayCtx.fillRect(textX - 2, textY - textHeight, textWidth + padding + 4, textHeight + 4);
        
        // วาดเส้นขอบพื้นหลัง
        overlayCtx.strokeStyle = color;
        overlayCtx.lineWidth = 2;
        overlayCtx.strokeRect(textX - 2, textY - textHeight, textWidth + padding + 4, textHeight + 4);
        
        // วาดข้อความ
        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.textAlign = 'left';
        overlayCtx.textBaseline = 'bottom';
        overlayCtx.fillText(label, textX + padding/2, textY);
        
        console.log(`   📦 Box ${index + 1}: ${detection.thai_name} at (${drawX.toFixed(0)}, ${drawY.toFixed(0)})`);
      }
    });
  }

  // ✅ ล้างกรอบทั้งหมด
  function clearBoundingBoxes() {
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      console.log('🧹 Bounding boxes cleared');
    }
  }

  // ✅ ฟังก์ชันค้นหากล้องที่มีอยู่
  async function getCameraDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableCameras = devices.filter(device => device.kind === 'videoinput');
      console.log('พบกล้อง:', availableCameras);
      
      // อัปเดต label ของกล้องปัจจุบัน
      if (availableCameras.length > 0) {
        updateCameraLabel();
      } else {
        currentCameraLabel.textContent = 'กล้อง: ไม่พบกล้อง';
      }
      
      return availableCameras;
    } catch (err) {
      console.error('ไม่สามารถดึงรายการกล้องได้:', err);
      return [];
    }
  }

  // ✅ อัปเดต label แสดงกล้องปัจจุบัน
  function updateCameraLabel() {
    console.log('🏷️ Updating camera label...');
    console.log('🏷️ Available cameras:', availableCameras.length);
    console.log('🏷️ Current index:', currentCameraIndex);
    console.log('🏷️ Stream active:', !!stream);
    
    if (availableCameras.length > 0 && stream) {
      // ตรวจสอบและแก้ไขค่าที่อาจเป็น object
      const safeCurrentIndex = typeof currentCameraIndex === 'number' ? currentCameraIndex : 0;
      
      const currentCamera = availableCameras[safeCurrentIndex];
      let cameraName = currentCamera?.label || 'WebCam';
      
      // ตรวจสอบว่าเป็น Nubwo NWC-500 หรือไม่
      if (cameraName.toLowerCase().includes('nubwo') || 
          cameraName.toLowerCase().includes('nwc-500') ||
          cameraName.toLowerCase().includes('nwc500')) {
        cameraName = 'Nubwo NWC-500 Webcam';
      } else if (cameraName.toLowerCase().includes('integrated') || 
                 cameraName.toLowerCase().includes('built-in')) {
        cameraName = 'กล้องในตัวคอมพิวเตอร์';
      } else {
        // ถ้าไม่ใช่กล้องที่รู้จัก ให้ใช้ชื่อเริ่มต้น
        cameraName = 'WebCam';
      }
      
      const status = isDetecting ? ' (กำลังตรวจจับ)' : '';
      const labelText = `กล้อง: ${cameraName}${status}`;
      currentCameraLabel.textContent = labelText;
      console.log('🏷️ Camera label updated:', labelText);
    } else if (!stream) {
      currentCameraLabel.textContent = 'กล้อง: ไม่ได้เชื่อมต่อ';
      console.log('🏷️ No stream - camera disconnected');
    }
  }

  // ✅ ฟังก์ชันจับภาพจากวิดีโอ
  function captureFrame() {
    if (!videoPlayer.videoWidth || !videoPlayer.videoHeight) {
      console.log('❌ Video dimensions not available:', videoPlayer.videoWidth, 'x', videoPlayer.videoHeight);
      return null;
    }

    console.log('📷 Capturing frame:', videoPlayer.videoWidth, 'x', videoPlayer.videoHeight);
    
    const canvas = document.createElement('canvas');
    canvas.width = videoPlayer.videoWidth;
    canvas.height = videoPlayer.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoPlayer, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    console.log('✅ Frame captured, data URL length:', dataUrl.length);
    return dataUrl;
  }

  // ✅ ส่งเฟรมไปยัง server สำหรับการตรวจจับ
  async function detectCurrentFrame() {
    if (!stream || !videoPlayer.srcObject) {
      console.warn('No video stream available for detection');
      return;
    }

    // ตรวจสอบว่าวิดีโอพร้อมแล้วหรือไม่
    if (!videoPlayer.videoWidth || !videoPlayer.videoHeight) {
      console.warn('Video not ready yet - width:', videoPlayer.videoWidth, 'height:', videoPlayer.videoHeight);
      return;
    }

    console.log('🎯 Starting frame detection...');

    try {
      const frameDataUrl = captureFrame();
      if (!frameDataUrl) {
        console.warn('Failed to capture frame');
        return;
      }

      // แปลง data URL เป็น blob
      const response = await fetch(frameDataUrl);
      const blob = await response.blob();
      console.log('Frame captured, size:', blob.size, 'bytes');

      // สร้าง FormData และส่งไปยัง server
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      console.log('🚀 Sending frame to server:', `${SERVER_URL}/detect-frame`);
      console.log('📦 FormData prepared, blob size:', blob.size);
      
      // ลองไม่ใช้ AbortSignal.timeout ก่อน (อาจไม่ support ในบางเบราว์เซอร์)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const detectionResponse = await fetch(`${SERVER_URL}/detect-frame`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log('📡 Server response status:', detectionResponse.status);
      console.log('📄 Response headers:', Object.fromEntries(detectionResponse.headers.entries()));

      if (detectionResponse.ok) {
        const result = await detectionResponse.json();
        console.log('Detection result:', result);
        
        // ประมวลผลการตรวจจับ
        if (result.success) {
          const timestamp = new Date().toLocaleTimeString();
          
          // คำนวณจำนวน fraud และ normal ในเฟรมปัจจุบัน
          const currentFraudCount = result.detections ? result.detections.filter(d => d.action_type === 'fraud').length : 0;
          const currentNormalCount = result.detections ? result.detections.filter(d => d.action_type === 'normal').length : 0;
          
          // อัพเดตจำนวนการตรวจจับในเฟรมปัจจุบัน
          updateSummary(result.total_detections || 0, currentFraudCount, currentNormalCount);
          
          if (result.fraud_detected) {
            // 📸 บันทึกภาพการโกง
            captureCheatingImage(result.detections);
            console.log('📸 [FRAUD-DETECTED] Cheating image captured');
            
            // แสดงรายละเอียดการโกง
            const fraudDetails = result.detections
              .filter(d => d.action_type === 'fraud')
              .map(d => d.thai_name || d.class)
              .join(', ');
            addLog('fraud', `🚨 ตรวจพบการทุจริต: ${fraudDetails} (ความมั่นใจ: ${result.detections.filter(d => d.action_type === 'fraud')[0]?.confidence}%) 📸 บันทึกภาพแล้ว`);
          } else if (result.total_detections > 0) {
            // แสดงกิจกรรมปกติ
            const normalDetails = result.detections
              .map(d => d.thai_name || d.class)
              .join(', ');
            addLog('normal', `✅ กิจกรรมปกติ: ${normalDetails}`);
          }
          
          // แสดงข้อมูลเพิ่มเติมถ้ามีการตรวจจับ
          if (result.total_detections > 0) {
            console.log(`[${timestamp}] Detection Time: ${result.detection_time_ms}ms, Risk: ${result.overall_risk}, Score: ${result.risk_score}`);
            
            // แสดงกรอบบนวิดีโอ (กรองเฉพาะ cheating/non-cheating)
            const relevantDetections = filterRelevantDetections(result.detections);
            drawBoundingBoxes(relevantDetections);
          } else {
            // ล้างกรอบเมื่อไม่มีการตรวจจับ
            clearBoundingBoxes();
            // อัพเดตจำนวนการตรวจจับเป็น 0
            updateSummary(0, 0, 0);
          }
        } else {
          console.error('Detection failed:', result.error || 'Unknown error');
          // อัพเดตจำนวนการตรวจจับเป็น 0 เมื่อ error
          updateSummary(0, 0, 0);
        }
      }
    } catch (error) {
      console.error('💥 การตรวจจับล้มเหลว:', error);
      console.error('💥 Error type:', error.name);
      console.error('💥 Error message:', error.message);
      
      // แสดง error ใน log
      addLog('error', `การตรวจจับล้มเหลว: ${error.message}`);
      
      // หาก fetch ล้มเหลว ให้ลองทดสอบการเชื่อมต่อ
      if (error.name === 'TypeError' || error.name === 'NetworkError') {
        console.log('🔍 Testing server connection after error...');
        const connected = await testServerConnection();
        console.log('📡 Server still connected:', connected);
        if (!connected) {
          addLog('error', 'สูญเสียการเชื่อมต่อกับ server');
          stopDetection();
          toggleDetectionBtn.innerHTML = '<i class="fas fa-eye"></i> เริ่มตรวจจับ';
          toggleDetectionBtn.classList.remove('active');
        }
      }
    }
  }

  // ✅ เริ่มการตรวจจับแบบเรียลไทม์
  function startDetection() {
    if (isDetecting) return;
    
    console.log('🚀 Starting detection process...');
    console.log('Video element:', videoPlayer);
    console.log('Video dimensions:', videoPlayer.videoWidth, 'x', videoPlayer.videoHeight);
    console.log('Video ready state:', videoPlayer.readyState);
    console.log('Stream:', stream);
    
    isDetecting = true;
    updateCameraLabel();
    
    // ทดสอบเรียก detectCurrentFrame ทันที
    console.log('🧪 Testing immediate detection...');
    detectCurrentFrame();
    
    // ตรวจจับทุก 2 วินาที
    detectionInterval = setInterval(() => {
      console.log('⏰ Interval triggered - calling detectCurrentFrame...');
      detectCurrentFrame();
    }, 2000);
    
    addLog('normal', 'เริ่มการตรวจจับแบบเรียลไทม์');
    console.log('✅ Detection started with interval:', detectionInterval);
  }

  // ✅ หยุดการตรวจจับแบบเรียลไทม์
  function stopDetection() {
    if (!isDetecting) return;
    
    isDetecting = false;
    updateCameraLabel();
    
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
    
    addLog('normal', 'หยุดการตรวจจับแบบเรียลไทม์');
  }

  // ✅ ทดสอบการเชื่อมต่อ server
  async function testServerConnection() {
    try {
      console.log('🔍 Testing connection to:', `${SERVER_URL}/get-logs`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${SERVER_URL}/get-logs`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('📡 Connection test result:', response.ok, response.status);
      return response.ok;
    } catch (error) {
      console.error('💥 Server connection failed:', error);
      return false;
    }
  }

  // ✅ ทดสอบการส่ง detect-frame
  async function testDetectEndpoint() {
    try {
      console.log('🧪 Testing detect-frame endpoint...');
      
      // สร้าง test image (1x1 pixel)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 1, 1);
      
      const testBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const formData = new FormData();
      formData.append('file', testBlob, 'test.jpg');
      
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
      
      const response = await fetch(`${SERVER_URL}/detect-frame`, {
        method: 'POST',
        body: formData,
        signal: controller2.signal
      });
      
      clearTimeout(timeoutId2);
      
      console.log('🧪 Detect endpoint test:', response.ok, response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('🧪 Test response:', result);
      }
      return response.ok;
    } catch (error) {
      console.error('💥 Detect endpoint test failed:', error);
      return false;
    }
  }

  // ✅ สลับสถานะการตรวจจับ
  async function toggleDetection() {
    console.log('🔄 Toggle detection clicked, current state:', isDetecting);
    
    if (!stream) {
      console.log('❌ No stream available');
      alert('กรุณาเปิดกล้องก่อนเริ่มการตรวจจับ');
      return;
    }

    // เช็คการเชื่อมต่อ server ก่อน
    if (!isDetecting) {
      console.log('🔍 Testing server connection...');
      toggleDetectionBtn.disabled = true;
      toggleDetectionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังเช็ค...';
      
      const serverConnected = await testServerConnection();
      console.log('📡 Server connection result:', serverConnected);
      
      if (!serverConnected) {
        console.log('❌ Server connection failed');
        alert('ไม่สามารถเชื่อมต่อ AI Server ได้\nกรุณาตรวจสอบว่า server ทำงานที่ http://localhost:8000');
        toggleDetectionBtn.disabled = false;
        toggleDetectionBtn.innerHTML = '<i class="fas fa-eye"></i> เริ่มตรวจจับ';
        return;
      }
      
      console.log('✅ Server connection successful');
      toggleDetectionBtn.disabled = false;
    }

    if (isDetecting) {
      stopDetection();
      toggleDetectionBtn.innerHTML = '<i class="fas fa-eye"></i> เริ่มตรวจจับ';
      toggleDetectionBtn.classList.remove('active');
    } else {
      startDetection();
      toggleDetectionBtn.innerHTML = '<i class="fas fa-eye-slash"></i> หยุดตรวจจับ';
      toggleDetectionBtn.classList.add('active');
    }
  }

  // ✅ เพิ่ม log
  function addLog(type, message) {
    const now = new Date().toLocaleString();
    console.log('📝 Adding log:', {type, message, time: now});
    logs.push({ type, message, time: now });
    console.log('📚 Total logs after add:', logs.length);
    console.log('🔍 Current filter:', currentFilter);
    
    // ใช้ current filter แทนการบังคับให้แสดง 'all'
    renderLogs(currentFilter);
    // ไม่เรียก updateSummary() ที่นี่ เพราะเราเรียกจาก detectCurrentFrame แล้ว
  }

  // ✅ render log ตาม filter
  function renderLogs(filter) {
    console.log('🔍 Filtering logs:', filter);
    console.log('📊 Total logs:', logs.length);
    
    // อัปเดต current filter
    currentFilter = filter;
    
    logList.innerHTML = '';
    
    const filteredLogs = logs.filter(log => {
      if (filter === 'all') return true;
      return log.type === filter;
    });
    
    console.log('📋 Filtered logs count:', filteredLogs.length);
    console.log('📋 Filtered logs:', filteredLogs.map(log => ({type: log.type, message: log.message})));
    
    if (filteredLogs.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = `<span style="color: #666; font-style: italic;">ไม่มีข้อมูลประเภท "${filter === 'fraud' ? 'ทุจริต' : filter === 'normal' ? 'ปกติ' : filter}"</span>`;
      logList.appendChild(li);
      return;
    }
    
    filteredLogs.forEach(log => {
      const li = document.createElement('li');
      let tagClass, tagText;
      
      switch(log.type) {
        case 'fraud':
          tagClass = 'red';
          tagText = 'ทุจริต';
          break;
        default:
          tagClass = 'green';
          tagText = 'ปกติ';
      }
      
      li.innerHTML = `
        <span class="tag ${tagClass}">
          ${tagText}
        </span>
        <span>${log.message}</span>
        <time>${log.time}</time>
      `;
      logList.appendChild(li);
    });
  }

  // ✅ ฟังก์ชันจับภาพการโกง
  function captureCheatingImage(fraudDetections = []) {
    if (!videoPlayer || videoPlayer.videoWidth === 0) return;
    
    try {
      // สร้าง canvas สำหรับจับภาพ
      if (!captureCanvas) {
        captureCanvas = document.createElement('canvas');
      }
      
      const ctx = captureCanvas.getContext('2d');
      captureCanvas.width = videoPlayer.videoWidth;
      captureCanvas.height = videoPlayer.videoHeight;
      
      // วาดภาพจากวิดีโอ
      ctx.drawImage(videoPlayer, 0, 0);
      
      // วาดกรอบและข้อความเตือนบนภาพ
      if (fraudDetections && fraudDetections.length > 0) {
        fraudDetections.forEach(detection => {
          if (detection.action_type === 'fraud' && detection.bbox) {
            const [x1, y1, x2, y2] = detection.bbox;
            const width = x2 - x1;
            const height = y2 - y1;
            
            // วาดกรอบแดงเตือน
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.strokeRect(x1, y1, width, height);
            
            // วาดพื้นหลังข้อความ
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fillRect(x1, y1 - 30, Math.max(width, 200), 30);
            
            // วาดข้อความเตือน
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`🚨 CHEATING DETECTED ${detection.confidence.toFixed(1)}%`, x1 + 5, y1 - 8);
          }
        });
      }
      
      // เพิ่มข้อความ timestamp
      const timestamp = new Date().toLocaleString('th-TH');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, captureCanvas.height - 50, 300, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`บันทึก: ${timestamp}`, 15, captureCanvas.height - 25);
      
      // แปลงเป็น blob และเก็บไว้
      captureCanvas.toBlob((blob) => {
        const now = new Date();
        const dateTimeString = now.getFullYear() + 
          String(now.getMonth() + 1).padStart(2, '0') + 
          String(now.getDate()).padStart(2, '0') + '-' +
          String(now.getHours()).padStart(2, '0') + 
          String(now.getMinutes()).padStart(2, '0') + 
          String(now.getSeconds()).padStart(2, '0');
        
        const imageData = {
          blob: blob,
          timestamp: timestamp,
          dateTimeString: dateTimeString,
          detections: fraudDetections.filter(d => d.action_type === 'fraud').length
        };
        
        cheatingImages.push(imageData);
        latestCheatingImage = imageData;
        
        console.log(`📸 จับภาพการโกง: ${timestamp} (${fraudDetections.filter(d => d.action_type === 'fraud').length} รายการ)`);
        
        // อัพเดตปุ่มดาวน์โหลด
        updateDownloadButton();
        
        // จำกัดไม่เกิน 50 ภาพ
        if (cheatingImages.length > 50) {
          cheatingImages.shift();
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('❌ Error capturing cheating image:', error);
    }
  }


  // ✅ ฟังก์ชันดาวน์โหลดภาพการโกง
  function downloadCheatingImage(imageData) {
    try {
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `cheating-evidence-${timestamp}.png`;
      link.href = imageData.image;
      link.click();
      console.log('📥 [DOWNLOAD] Cheating image downloaded');
    } catch (error) {
      console.error('📥 [DOWNLOAD] Error downloading image:', error);
    }
  }

  // ✅ ฟังก์ชันแสดงภาพการโกงล่าสุด
  function showLatestCheatingImage() {
    if (cheatingImages.length === 0) {
      alert('ไม่มีภาพการโกงที่บันทึกไว้');
      return;
    }
    
    const latest = cheatingImages[0];
    const popup = window.open('', '_blank', 'width=800,height=600');
    popup.document.write(`
      <html>
        <head>
          <title>ภาพการโกงล่าสุด - ${latest.timestamp}</title>
          <style>
            body { margin: 0; padding: 20px; background: #f0f0f0; font-family: Arial, sans-serif; }
            .container { max-width: 100%; text-align: center; }
            .image { max-width: 100%; height: auto; border: 2px solid #ff0000; border-radius: 8px; }
            .info { margin: 20px 0; padding: 15px; background: white; border-radius: 8px; }
            .download-btn { background: #007bff; color: white; border: none; padding: 10px 20px; 
                           border-radius: 5px; cursor: pointer; font-size: 16px; }
            .download-btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🚨 ภาพการโกงที่ตรวจพบ</h2>
            <div class="info">
              <p><strong>เวลา:</strong> ${new Date(latest.timestamp).toLocaleString('th-TH')}</p>
              <p><strong>ความมั่นใจ:</strong> ${latest.confidence.toFixed(1)}%</p>
              <p><strong>จำนวนการตรวจจับ:</strong> ${latest.detections.length} รายการ</p>
            </div>
            <img src="${latest.image}" alt="Cheating Evidence" class="image">
            <br><br>
            <button class="download-btn" onclick="downloadImage()">📥 ดาวน์โหลดภาพ</button>
          </div>
          <script>
            function downloadImage() {
              const link = document.createElement('a');
              link.download = 'cheating-evidence-${latest.timestamp.replace(/[:.]/g, '-')}.png';
              link.href = '${latest.image}';
              link.click();
            }
          </script>
        </body>
      </html>
    `);
  }

  // ✅ อัปเดตสรุป - แยกระหว่างการตรวจจับปัจจุบันกับ log สะสม
  let currentDetectionCount = 0; // เก็บจำนวนการตรวจจับในเฟรมปัจจุบัน
  let currentFrameFraud = 0; // เก็บจำนวน fraud ในเฟรมปัจจุบัน
  let currentFrameNormal = 0; // เก็บจำนวน normal ในเฟรมปัจจุบัน
  
  function updateSummary(currentFrameDetections = null, fraudCount = 0, normalCount = 0) {
    // ถ้ามีข้อมูลการตรวจจับในเฟรมปัจจุบัน ให้ใช้ข้อมูลนั้น
    if (currentFrameDetections !== null && typeof currentFrameDetections === 'number') {
      currentDetectionCount = currentFrameDetections;
      currentFrameFraud = fraudCount;
      currentFrameNormal = normalCount;
    }
    
    // ใช้จำนวนการตรวจจับในเฟรมปัจจุบันเท่านั้น
    const total = currentDetectionCount;
    const fraud = logs.filter(l => l.type === 'fraud').length; // สำหรับ history
    const normal = logs.filter(l => l.type === 'normal').length;
    
    // คำนวณ risk rate จากเฟรมปัจจุบันเท่านั้น และจำกัดไม่เกิน 100%
    const riskRate = total > 0 ? Math.min(((currentFrameFraud / total) * 100), 100).toFixed(2) : 0;

    document.getElementById('totalDetections').textContent = total;
    document.getElementById('fraudEvents').textContent = fraud;
    document.getElementById('normalEvents').textContent = normal;
    document.getElementById('fraudRate').textContent = riskRate + '%';
  }

  // ✅ ฟังก์ชันเปิดกล้อง
  async function startCamera(cameraIndex = null) {
    try {
      console.log('🎬 Starting camera...');
      
      // หากไม่ได้ระบุ index ให้ใช้ currentCameraIndex
      if (cameraIndex !== null) {
        currentCameraIndex = cameraIndex;
      }

      // หาก availableCameras ยังว่างเปล่า ให้ค้นหากล้องก่อน
      if (availableCameras.length === 0) {
        console.log('🔍 No cameras found, searching...');
        await getCameraDevices();
      }
      
      console.log('📹 Available cameras:', availableCameras.length);
      console.log('📹 Current camera index:', currentCameraIndex);

      // ตั้งค่า constraints สำหรับกล้อง
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      // หากมีกล้องให้เลือก ให้ระบุ deviceId
      if (availableCameras.length > 0 && availableCameras[currentCameraIndex]) {
        const selectedCamera = availableCameras[currentCameraIndex];
        constraints.video.deviceId = { exact: selectedCamera.deviceId };
        console.log('🎯 Selected camera:', selectedCamera.label, 'DeviceId:', selectedCamera.deviceId);
      }

      console.log('📡 Requesting camera access with constraints:', constraints);
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoPlayer.srcObject = stream;
      
      console.log('✅ Camera stream obtained');
      
      // รอให้วิดีโอโหลดข้อมูล metadata
      await new Promise((resolve) => {
        videoPlayer.onloadedmetadata = () => {
          console.log('📺 Video metadata loaded, dimensions:', videoPlayer.videoWidth, 'x', videoPlayer.videoHeight);
          
          // สร้างและอัปเดต overlay canvas
          createOverlayCanvas();
          updateOverlayCanvas();
          
          resolve();
        };
        // Fallback timeout
        setTimeout(resolve, 2000);
      });
      
      updateCameraLabel();
      const safeIndex = typeof currentCameraIndex === 'number' ? currentCameraIndex : 0;
      const cameraName = availableCameras[safeIndex]?.label || 'WebCam';
      addLog('normal', `เปิดกล้อง: ${cameraName}`);
      console.log('🎯 Camera started successfully:', cameraName);
      
      // รีเซ็ตปุ่มตรวจจับ
      toggleDetectionBtn.innerHTML = '<i class="fas fa-eye"></i> เริ่มตรวจจับ';
      toggleDetectionBtn.classList.remove('active');
      
    } catch (err) {
      console.error("ไม่สามารถเข้าถึงกล้องได้ ❌", err);
      
      // หากไม่สามารถเข้าถึงกล้องที่เลือกได้ให้ลองกล้องอื่น
      if (availableCameras.length > 1 && cameraIndex !== null) {
        console.log("ลองใช้กล้องเริ่มต้น...");
        try {
          const defaultConstraints = {
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          };
          stream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
          videoPlayer.srcObject = stream;
          addLog('normal', 'เปิดกล้องเริ่มต้น');
        } catch (defaultErr) {
          alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาต");
        }
      } else {
        alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาต");
      }
    }
  }

  // ✅ ฟังก์ชันปิดกล้อง
  function stopCamera() {
    console.log('🛑 Stopping camera...');
    
    // หยุดการตรวจจับก่อน
    if (isDetecting) {
      console.log('🛑 Force stopping detection because camera is stopping...');
      stopDetection();
      
      // รีเซ็ตปุ่มตรวจจับ
      toggleDetectionBtn.innerHTML = '<i class="fas fa-eye"></i> เริ่มตรวจจับ';
      toggleDetectionBtn.classList.remove('active');
      console.log('🔄 Detection button reset');
    }
    
    // ล้างกรอบที่อาจแสดงอยู่
    clearBoundingBoxes();
    
    if (stream) {
      console.log('📹 Stopping camera stream tracks...');
      stream.getTracks().forEach(track => {
        console.log('🔌 Stopping track:', track.kind, track.label);
        track.stop();
      });
      stream = null;
      videoPlayer.srcObject = null;
      
      // อัปเดต UI
      currentCameraLabel.textContent = 'กล้อง: ไม่ได้เชื่อมต่อ';
      addLog('normal', 'ปิดกล้องและหยุดการตรวจจับแล้ว');
      console.log('✅ Camera and detection stopped successfully');
    } else {
      console.log('ℹ️ No active camera stream to stop');
      // แต่ยังคงหยุดการตรวจจับถ้ามีอยู่
      if (isDetecting) {
        stopDetection();
        toggleDetectionBtn.innerHTML = '<i class="fas fa-eye"></i> เริ่มตรวจจับ';
        toggleDetectionBtn.classList.remove('active');
      }
    }
  }



  // ปุ่ม Start
  startBtn.addEventListener('click', startCamera);

  // ปุ่ม Stop
  stopBtn.addEventListener('click', stopCamera);

  // ปุ่ม Toggle Detection
  toggleDetectionBtn.addEventListener('click', toggleDetection);

  // ปุ่ม Download - ดาวน์โหลดข้อมูล log
  downloadBtn.addEventListener('click', async () => {
    try {
      console.log('📥 Starting download...');
      
      // เช็คว่ามีภาพการโกงหรือไม่
      if (cheatingImages.length > 0) {
        console.log('� Downloading latest cheating image...');
        
        // สร้าง ZIP file ด้วย JSZip
        try {
          const zip = new JSZip();
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
          const folderName = `CheatingEvidence_${dateStr}_${timeStr}`;
          
          const folder = zip.folder(folderName);
          
          // เพิ่มไฟล์ภาพทั้งหมดลงใน ZIP
          for (let i = 0; i < cheatingImages.length; i++) {
            const imageData = cheatingImages[i];
            const fileName = `cheating_${imageData.dateTimeString}_${String(i + 1).padStart(2, '0')}.png`;
            
            const arrayBuffer = await imageData.blob.arrayBuffer();
            folder.file(fileName, arrayBuffer);
          }
          
          // สร้างไฟล์รายงาน
          const reportData = {
            title: "รายงานการตรวจจับการโกง",
            generatedDate: now.toLocaleString('th-TH'),
            totalImages: cheatingImages.length,
            images: cheatingImages.map((img, i) => ({
              id: i + 1,
              filename: `cheating_${img.dateTimeString}_${String(i + 1).padStart(2, '0')}.png`,
              capturedTime: img.timestamp,
              detectionsCount: img.detections
            }))
          };
          
          folder.file('รายงานการโกง.json', JSON.stringify(reportData, null, 2));
          
          // สร้าง ZIP และดาวน์โหลด
          const zipBlob = await zip.generateAsync({type: "blob"});
          const url = URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${folderName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log(`📦 ZIP folder created: ${folderName}.zip`);
          alert(`✅ ดาวน์โหลด ZIP โฟลเดอร์เรียบร้อย!\n📁 ชื่อโฟลเดอร์: ${folderName}\n📷 จำนวนภาพ: ${cheatingImages.length} ภาพ + รายงาน`);
          
        } catch (zipError) {
          console.log('⚠️ JSZip error, falling back to individual files...', zipError);
          
          // Fallback: ดาวน์โหลดแยกไฟล์
          for (let i = 0; i < cheatingImages.length; i++) {
            const imageData = cheatingImages[i];
            
            const url = URL.createObjectURL(imageData.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cheating_${imageData.dateTimeString}_${String(i + 1).padStart(2, '0')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          alert(`✅ ดาวน์โหลดภาพการโกงเรียบร้อย!\n📷 จำนวนภาพ: ${cheatingImages.length} ภาพ (แยกไฟล์)\n💡 ไม่สามารถสร้าง ZIP ได้`);
        }
        return;
      }
      
      // ถ้าไม่มีภาพการโกง ให้ดาวน์โหลด logs แทน
      console.log('�📊 Log entries count:', logs.length);
      console.log('📊 Log entries data:', logs);
      
      if (!logs || logs.length === 0) {
        alert('ไม่มีข้อมูลการโกงหรือ logs สำหรับดาวน์โหลด กรุณาทำการตรวจจับก่อน');
        return;
      }

      // สร้างข้อมูลสำหรับดาวน์โหลด
      console.log('📝 Creating download data...');
      const currentTime = new Date();
      const downloadData = {
        sessionInfo: {
          downloadDate: currentTime.toLocaleString('th-TH', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          totalDetections: logs.length,
          fraudCount: logs.filter(entry => entry.type === 'fraud').length,
          normalCount: logs.filter(entry => entry.type === 'normal').length,
          cameraUsed: (typeof currentCameraLabel !== 'undefined' && currentCameraLabel.textContent) ? currentCameraLabel.textContent : 'Unknown Camera'
        },
        detectionLogs: logs.map((entry, index) => {
          console.log(`Processing entry ${index}:`, entry);
          return {
            id: index + 1,
            timestamp: entry.time || currentTime.toLocaleTimeString('th-TH'),
            type: entry.type || 'unknown',
            message: entry.message || 'No message',
            confidence: entry.confidence || 'N/A'
          };
        })
      };

      console.log('📄 Download data created:', downloadData);

      // แปลงเป็น JSON
      console.log('🔄 Converting to JSON...');
      const jsonData = JSON.stringify(downloadData, null, 2);
      console.log('📄 JSON size:', jsonData.length, 'characters');
      
      // สร้างไฟล์และดาวน์โหลด
      console.log('💾 Creating blob...');
      const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
      console.log('💾 Blob created, size:', blob.size, 'bytes');
      
      const url = URL.createObjectURL(blob);
      console.log('🔗 Object URL created:', url);
      
      const downloadLink = document.createElement('a');
      const filename = `fraud-detection-log-${currentTime.getFullYear()}${String(currentTime.getMonth()+1).padStart(2,'0')}${String(currentTime.getDate()).padStart(2,'0')}-${String(currentTime.getHours()).padStart(2,'0')}${String(currentTime.getMinutes()).padStart(2,'0')}.json`;
      
      downloadLink.href = url;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      
      console.log('📁 Filename:', filename);
      
      // เพิ่มลงใน DOM และคลิก
      document.body.appendChild(downloadLink);
      console.log('👆 Clicking download link...');
      downloadLink.click();
      
      // รอสักครู่แล้วค่อยลบ
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        console.log('🗑️ Cleanup completed');
      }, 1000);
      
      addLog('normal', `ดาวน์โหลดข้อมูล ${logs.length} รายการสำเร็จ`);
      console.log('✅ Download completed successfully');
      alert(`ดาวน์โหลดสำเร็จ! ไฟล์: ${filename}`);
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      console.error('❌ Error details:', error.message, error.stack);
      alert(`เกิดข้อผิดพลาดในการดาวน์โหลด: ${error.message}`);
    }
  });

  // Filter logs
  logAllBtn.addEventListener('click', () => {
    console.log('🔘 Clicked: ทั้งหมด');
    renderLogs('all');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    logAllBtn.classList.add('active');
  });
  logCBtn.addEventListener('click', () => {
    console.log('🔘 Clicked: ทุจริต');
    renderLogs('fraud');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    logCBtn.classList.add('active');
  });

  logNCBtn.addEventListener('click', () => {
    console.log('🔘 Clicked: ปกติ');
    renderLogs('normal');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    logNCBtn.classList.add('active');
  });

  // init
  renderLogs('all');
  updateSummary();
  
  // เริ่มต้นค้นหากล้องที่มีอยู่
    getCameraDevices().then(() => {
    console.log(`พบกล้อง ${availableCameras.length} ตัว`);
    if (availableCameras.length > 1) {
      addLog('normal', `พบกล้อง ${availableCameras.length} ตัว พร้อมใช้งาน`);
    } else if (availableCameras.length === 1) {
      addLog('normal', 'พบกล้อง 1 ตัว');
    } else {
      addLog('normal', 'ไม่พบกล้อง');
    }
  });



  // เช็คสถานะ server เมื่อเริ่มต้น
  testServerConnection().then(connected => {
    if (connected) {
      serverStatusLabel.textContent = 'Server: เชื่อมต่อแล้ว ✅';
      serverStatusLabel.style.color = '#10b981';
      addLog('normal', 'เชื่อมต่อ AI Server สำเร็จ');
    } else {
      serverStatusLabel.textContent = 'Server: ไม่ได้เชื่อมต่อ ❌';
      serverStatusLabel.style.color = '#ef4444';
      addLog('normal', 'ไม่สามารถเชื่อมต่อ AI Server');
    }
  });

  // อัปเดต overlay canvas เมื่อหน้าต่างเปลี่ยนขนาด
  window.addEventListener('resize', () => {
    if (overlayCanvas && videoPlayer.videoWidth) {
      updateOverlayCanvas();
    }
  });

  // อัปเดต overlay canvas เมื่อวิดีโอเปลี่ยนขนาด
  videoPlayer.addEventListener('resize', () => {
    if (overlayCanvas) {
      updateOverlayCanvas();
    }
  });

  // อัพเดตปุ่มดาวน์โหลดเมื่อเริ่มต้น
  updateDownloadButton();
});