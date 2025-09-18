document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('Start');
  const stopBtn = document.getElementById('Stop');
  const downloadBtn = document.getElementById('download');
  const logAllBtn = document.getElementById('Logall');
  const logCBtn = document.getElementById('logC');
  const logNCBtn = document.getElementById('logNC');
  const videoPlayer = document.getElementById('videoPlayer');
  const logList = document.getElementById('log-list');

  let logs = [];
  let stream = null; // ไว้เก็บ MediaStream จากกล้อง

  // ✅ เพิ่ม log
  function addLog(type, message) {
    const now = new Date().toLocaleString();
    logs.push({ type, message, time: now });
    renderLogs('all');
    updateSummary();
  }

  // ✅ render log ตาม filter
  function renderLogs(filter) {
    logList.innerHTML = '';
    logs
      .filter(log => filter === 'all' || log.type === filter)
      .forEach(log => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="tag ${log.type === 'fraud' ? 'red' : 'green'}">
            ${log.type === 'fraud' ? 'ทุจริต' : 'ไม่ทุจริต'}
          </span>
          <span>${log.message}</span>
          <time>${log.time}</time>
        `;
        logList.appendChild(li);
      });
  }

  // ✅ อัปเดตสรุป
  function updateSummary() {
    const total = logs.length;
    const fraud = logs.filter(l => l.type === 'fraud').length;
    const normal = total - fraud;
    const fraudRate = total > 0 ? ((fraud / total) * 100).toFixed(2) : 0;

    document.getElementById('totalDetections').textContent = total;
    document.getElementById('fraudEvents').textContent = fraud;
    document.getElementById('normalEvents').textContent = normal;
    document.getElementById('fraudRate').textContent = fraudRate + '%';
  }

  // ✅ ฟังก์ชันเปิดกล้อง
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      videoPlayer.srcObject = stream;
      addLog('normal', 'เริ่มต้นเปิดกล้อง');
    } catch (err) {
      console.error("ไม่สามารถเข้าถึงกล้องได้ ❌", err);
      alert("กรุณาอนุญาตการใช้งานกล้อง");
    }
  }

  // ✅ ฟังก์ชันปิดกล้อง
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
      videoPlayer.srcObject = null;
      addLog('normal', 'ปิดกล้องแล้ว');
    }
  }

  // ปุ่ม Start
  startBtn.addEventListener('click', startCamera);

  // ปุ่ม Stop
  stopBtn.addEventListener('click', stopCamera);

  // ปุ่ม Download (mock)
  downloadBtn.addEventListener('click', () => {
    alert('ดาวน์โหลดวิดีโอ (mock)');
  });

  // Filter logs
  logAllBtn.addEventListener('click', () => renderLogs('all'));
  logCBtn.addEventListener('click', () => renderLogs('fraud'));
  logNCBtn.addEventListener('click', () => renderLogs('normal'));

  // init
  renderLogs('all');
  updateSummary();
});
