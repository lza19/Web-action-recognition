const fileInput = document.getElementById("fileInput");
const videoPlayer = document.getElementById("videoPlayer");
const logContainer = document.getElementById("logOutput");
const loadingOverlay = document.getElementById('loadingOverlay');
console.log(logContainer)
console.log(videoPlayer)
let logs = [];

fileInput.addEventListener('change', async function () {
    const file = fileInput.files[0];
    console.log(file.name)
    if (!file) return;
    loadingOverlay.style.display = 'flex';
    const formData = new FormData();
    formData.append('file', file);

    try {
        // โหลดวิดีโอที่ประมวลผลแล้ว
        const response = await fetch("http://127.0.0.1:8000/process-video", {
            method: "POST",
            body: formData
        });

        const videoBlob = await response.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        videoPlayer.src = videoUrl;
        videoPlayer.load();

        //log
        const logRes = await fetch("http://127.0.0.1:8000/get-logs");
        const logData = await logRes.json();
        logs = logData.results || [];
        displayLogs("all");

    } catch (error) {
        console.error("Error during video processing:", error);
    }finally {
            // ซ่อนหน้าโหลดเมื่อเสร็จสิ้น
            loadingOverlay.style.display = 'none';
        }
});

document.getElementById("Logall").addEventListener("click", () => displayLogs("all"));
document.getElementById("logC").addEventListener("click", () => displayLogs("cheating"));
document.getElementById("logNC").addEventListener("click", () => displayLogs("non-cheating"));


function displayLogs(filterClass) {
    logContainer.innerHTML = "";

    if (logs.length === 0) {
        logContainer.innerHTML = "<p>ไม่มีข้อมูล</p>";
        return;
    }

    logs.forEach(log => {
        if (filterClass === "all" || log.class === filterClass) {
            const p = document.createElement("p");
            p.textContent = `[${log.time}s] → ${log.class}: ${log.percent}%`;
            logContainer.appendChild(p);
        }
    });
}


