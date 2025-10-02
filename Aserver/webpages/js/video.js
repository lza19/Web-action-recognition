const fileInput = document.getElementById('fileInput');
const videoPlayer = document.getElementById('videoPlayer');
const loadingOverlay = document.getElementById('loadingOverlay');
const logOutput = document.getElementById('logOutput');
const backBtn = document.getElementById('backBtn');

// แสดงวิดีโอที่เลือก
fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    
    if (!file) {
        alert('กรุณาเลือกไฟล์วิดีโอ');
        return;
    }

    // ตรวจสอบประเภทไฟล์
    if (!file.type.startsWith('video/')) {
        alert('กรุณาเลือกไฟล์วิดีโอเท่านั้น');
        return;
    }

    // แสดง loading
    loadingOverlay.style.display = 'flex';
    logOutput.innerHTML = '<p>กำลังอัปโหลดวิดีโอ...</p>';

    try {
        // สร้าง FormData สำหรับส่งวิดีโอ
        const formData = new FormData();
        formData.append('video', file);

        // ส่งวิดีโอไปยัง server
        const response = await fetch('http://127.0.0.1:8000/process-video2', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('การประมวลผลล้มเหลว');
        }

        // รับวิดีโอที่ประมวลผลแล้วกลับมา
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);

        // แสดงวิดีโอ
        videoPlayer.src = videoUrl;
        videoPlayer.style.display = 'block';
        videoPlayer.load();

        // แสดงข้อความสำเร็จ
        logOutput.innerHTML = '<p style="color: green; font-weight: bold;">✓ ประมวลผลวิดีโอสำเร็จ กำลังโหลด logs...</p>';
        
        // รับ session_id จาก response headers
        const sessionId = response.headers.get('X-Session-ID');
        console.log('Session ID:', sessionId);
        console.log('All headers:', [...response.headers.entries()]);
        
        if (!sessionId) {
            logOutput.innerHTML += '<p style="color: red;">✗ ไม่พบ Session ID</p>';
            console.error('Headers available:', response.headers);
            return;
        }
        
        try {
            // ดึง logs จาก API แยก
            console.log('Fetching logs from:', `http://127.0.0.1:8000/get-logs/${sessionId}`);
            const logsResponse = await fetch(`http://127.0.0.1:8000/get-logs/${sessionId}`);
            
            console.log('Logs response status:', logsResponse.status);
            
            if (!logsResponse.ok) {
                throw new Error(`HTTP ${logsResponse.status}: ${await logsResponse.text()}`);
            }
            
            const logsData = await logsResponse.json();
            console.log('Logs data:', logsData);
            
            const logs = logsData.logs;
            
            if (!logs || logs.length === 0) {
                logOutput.innerHTML += '<p style="color: orange;">⚠ ไม่พบข้อมูลการตรวจจับ</p>';
                return;
            }
            
            console.log('จำนวน logs:', logs.length);
            
            // สร้างตาราง logs
            let logHtml = '<h3 style="margin-top: 15px; color: #667eea;">รายการตรวจจับ</h3>';
            logHtml += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
            logHtml += '<thead><tr style="background: #667eea; color: white;">';
            logHtml += '<th style="padding: 8px; border: 1px solid #ddd;">เวลา</th>';
            logHtml += '<th style="padding: 8px; border: 1px solid #ddd;">ชื่อ</th>';
            logHtml += '<th style="padding: 8px; border: 1px solid #ddd;">สถานะ</th>';
            logHtml += '<th style="padding: 8px; border: 1px solid #ddd;">ความมั่นใจ</th>';
            logHtml += '</tr></thead><tbody>';
            
            logs.forEach((log, index) => {
                console.log(`Log ${index}:`, log);
                const statusColor = log.class === 'cheating' ? '#ff4444' : '#44ff44';
                const statusText = log.class === 'cheating' ? 'โกง' : 'ไม่โกง';
                
                logHtml += '<tr>';
                logHtml += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${log.timestamp}</td>`;
                logHtml += `<td style="padding: 8px; border: 1px solid #ddd;">${log.name}</td>`;
                logHtml += `<td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold; text-align: center;">${statusText}</td>`;
                logHtml += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${log.confidence}%</td>`;
                logHtml += '</tr>';
            });
            
            logHtml += '</tbody></table>';
            logHtml += `<p style="margin-top: 10px; color: #666;">รวม ${logs.length} รายการ</p>`;
            logOutput.innerHTML += logHtml;
            
            console.log('✓ แสดง logs สำเร็จ');
            
            // สร้างกราฟสถิติ
            createStatisticsChart(logs);
            
        } catch (error) {
            console.error('Error fetching logs:', error);
            logOutput.innerHTML += `<p style="color: red;">✗ ไม่สามารถโหลด logs ได้: ${error.message}</p>`;
        }

    } catch (error) {
        console.error('Error:', error);
        logOutput.innerHTML = `<p style="color: red;">✗ เกิดข้อผิดพลาด: ${error.message}</p>`;
        alert('เกิดข้อผิดพลาดในการประมวลผลวิดีโอ');
    } finally {
        loadingOverlay.style.display = 'none';
    }
});

// ปุ่มย้อนกลับ
backBtn.addEventListener('click', () => {
    videoPlayer.style.display = 'none';
    videoPlayer.src = '';
    fileInput.value = '';
    logOutput.innerHTML = '';
    
    // ซ่อนส่วนสถิติ
    document.getElementById('statisticsSection').style.display = 'none';
    document.getElementById('barChart').innerHTML = '';
    document.getElementById('summaryStats').innerHTML = '';
});

// ฟังก์ชันสร้างกราฟสถิติ
function createStatisticsChart(logs) {
    // นับจำนวนครั้งที่แต่ละคนถูกตรวจจับว่าโกง
    const cheatingStats = {};
    const totalDetections = {};
    
    logs.forEach(log => {
        const name = log.name;
        
        // นับจำนวนการตรวจจับทั้งหมด
        if (!totalDetections[name]) {
            totalDetections[name] = 0;
        }
        totalDetections[name]++;
        
        // นับเฉพาะการโกง
        if (log.class === 'cheating') {
            if (!cheatingStats[name]) {
                cheatingStats[name] = 0;
            }
            cheatingStats[name]++;
        }
    });
    
    // แสดงส่วนสถิติ
    document.getElementById('statisticsSection').style.display = 'block';
    
    const chartDiv = document.getElementById('barChart');
    chartDiv.innerHTML = ''; // ล้างข้อมูลเก่า
    
    // หาค่าสูงสุดเพื่อ scale
    const maxCount = Math.max(...Object.values(cheatingStats), 1);
    
    // สร้างแท่งกราฟสำหรับแต่ละคน
    Object.keys(totalDetections).forEach(name => {
        const cheatingCount = cheatingStats[name] || 0;
        const totalCount = totalDetections[name];
        const percentage = maxCount > 0 ? (cheatingCount / maxCount) * 100 : 0;
        
        const barContainer = document.createElement('div');
        barContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; flex: 1; max-width: 120px;';
        
        // จำนวนครั้งที่โกง
        const countLabel = document.createElement('div');
        countLabel.textContent = cheatingCount;
        countLabel.style.cssText = 'font-weight: bold; color: #ff4444; margin-bottom: 5px; font-size: 18px;';
        barContainer.appendChild(countLabel);
        
        // แท่งกราฟ
        const bar = document.createElement('div');
        bar.style.cssText = `
            width: 60px;
            height: ${percentage}%;
            background: linear-gradient(to top, #ff4444, #ff8888);
            border-radius: 5px 5px 0 0;
            transition: all 0.3s;
            cursor: pointer;
            position: relative;
            min-height: 20px;
        `;
        
        // เพิ่ม hover effect
        bar.onmouseover = () => {
            bar.style.transform = 'scale(1.05)';
            bar.style.boxShadow = '0 0 15px rgba(255, 68, 68, 0.5)';
        };
        bar.onmouseout = () => {
            bar.style.transform = 'scale(1)';
            bar.style.boxShadow = 'none';
        };
        
        barContainer.appendChild(bar);
        
        // ชื่อคน
        const nameLabel = document.createElement('div');
        nameLabel.textContent = name;
        nameLabel.style.cssText = 'margin-top: 10px; font-size: 14px; font-weight: bold; text-align: center; color: #333; word-break: break-word;';
        barContainer.appendChild(nameLabel);
        
        // จำนวนครั้งทั้งหมด
        const totalLabel = document.createElement('div');
        totalLabel.textContent = `(${totalCount} ครั้ง)`;
        totalLabel.style.cssText = 'font-size: 12px; color: #666; margin-top: 5px;';
        barContainer.appendChild(totalLabel);
        
        chartDiv.appendChild(barContainer);
    });
    
    // สรุปสถิติ
    const summary = document.getElementById('summaryStats');
    const totalPeople = Object.keys(totalDetections).length;
    const totalCheatingEvents = Object.values(cheatingStats).reduce((a, b) => a + b, 0);
    const totalEvents = Object.values(totalDetections).reduce((a, b) => a + b, 0);
    
    summary.innerHTML = `
        <h3 style="color: #000000ff; margin-bottom: 15px;">สรุปภาพรวม</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div style="padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #000000ff;">
                <div style="font-size: 14px; color: #666;">จำนวนคนทั้งหมด</div>
                <div style="font-size: 28px; font-weight: bold; color: #00ff6aff;">${totalPeople} คน</div>
            </div>
            <div style="padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #000000ff;">
                <div style="font-size: 14px; color: #666;">การตรวจจับทั้งหมด</div>
                <div style="font-size: 28px; font-weight: bold; color: rgba(255, 0, 0, 1)ff;">${totalEvents} ครั้ง</div>
            </div>
            <div style="padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #000000ff;">
                <div style="font-size: 14px; color: #666;">ตรวจพบการโกง</div>
                <div style="font-size: 28px; font-weight: bold; color: #ff0000ff;">${totalCheatingEvents} ครั้ง</div>
            </div>
            <div style="padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #030303ff;">
                <div style="font-size: 14px; color: #666;">อัตราการโกง</div>
                <div style="font-size: 28px; font-weight: bold; color: rgba(255, 0, 0, 1)ff;">${totalEvents > 0 ? ((totalCheatingEvents / totalEvents) * 100).toFixed(1) : 0}%</div>
            </div>
        </div>
    `;
}