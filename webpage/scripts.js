document.addEventListener('DOMContentLoaded', () => {
    // เลือก h1 และปุ่ม
    const myH1 = document.getElementById('myH1');
    const btn = document.getElementById('btn');
    const fileInput = document.getElementById('fileInput');
    const videoPlayer = document.getElementById('videoPlayer');
    const x = 10;
    console.log(x);

    btn.addEventListener("click", function() {
        myH1.innerText = "ข้อความเปลี่ยนแล้ว!";
    });

    fileInput.addEventListener('change', async function() {
        const file = fileInput.files[0];
        console.log(file.name);
        
        const formData = new FormData();
        formData.append('file', file);
        console.log(formData);
        
        try {
            // ส่งคำขอ POST ไปยังเซิร์ฟเวอร์
            const response = await fetch("http://127.0.0.1:8000/process-video", {
                method: "POST",
                body: formData
            });
            
            // แปลงข้อมูลที่ได้รับกลับมาเป็น Blob
            const videoBlob = await response.blob();
            console.log("Received Blob:", videoBlob);

            // สร้าง URL ชั่วคราวจาก Blob
            const videoUrl = URL.createObjectURL(videoBlob);
            console.log("Created video URL:", videoUrl);

            // นำ URL ไปกำหนดให้ videoPlayer เพื่อแสดงผล
            videoPlayer.src = videoUrl;
            videoPlayer.load(); // สั่งให้เริ่มโหลดวิดีโอ
            
        } catch (error) {
            console.error("Error during video processing:", error);
            // สามารถแสดงข้อความแจ้งเตือนให้ผู้ใช้ทราบได้ที่นี่
            myH1.innerText = "เกิดข้อผิดพลาดในการประมวลผลวิดีโอ";
        }
    });
});