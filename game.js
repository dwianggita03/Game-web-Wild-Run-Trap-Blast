const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Tempat kode gambar latar, karakter, musuh, dan objek nanti
    ctx.fillStyle = "#333333";
    ctx.font = "24px sans-serif";
    ctx.fillText("Wild Run: Trap & Blast - Kerangka Siap!", 240, 270);

    requestAnimationFrame(gameLoop);
}

gameLoop();
