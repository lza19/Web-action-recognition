const fileInput = document.getElementById('fileInput');
const username = document.getElementById('username');
const submit = document.getElementById('submit');

submit.addEventListener('click', async () => {
    const userName = username.value.trim();
    const files = fileInput.files;

    if (!userName) {
        alert("กรุณากรอกชื่อก่อนส่งไฟล์");
        return; 
    }

    if (files.length === 0) {
        alert("กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์");
        return; 
    }

    const formData = new FormData();
    formData.append("name", userName);

    for (let i = 0; i < files.length; i++) {
        console.log('Selected file:', files[i].name);
        formData.append("images[]", files[i]); 
    }

    fetch("http://localhost:8000/uploadfile", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        alert("บันทึกข้อมูลสำเร็จ");
        console.log("Server response:", data);
    })
    .catch(error => {
        console.error("Error:", error);
        alert("ไม่สามารถเชื่อมเซิฟเวอร์ได้");
    });

});