let currentStream = null;
let capturedPhotos = [];
let finalStripDataUrl = '';
let selectedTemplate = {
    id: 'blue_moment',
    name: 'Blue Moment',
    bg: '#28536B',
    text: '#FFFFFF'
};

function switchScreen(screenId) {
    if (screenId !== 'screen-camera') {
        stopCamera();
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (screenId === 'screen-landing') document.getElementById('nav-home').classList.add('active');
    if (screenId === 'screen-templates' || screenId === 'screen-camera' || screenId === 'screen-result') {
        document.getElementById('nav-booth').classList.add('active');
    }
    if (screenId === 'screen-gallery') document.getElementById('nav-gallery').classList.add('active');

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

function selectTemplate(element) {
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');

    selectedTemplate = {
        id: element.dataset.id,
        name: element.dataset.name,
        bg: element.dataset.bg,
        text: element.dataset.text
    };

    const liveFrame = document.getElementById('live-frame-container');
    liveFrame.style.backgroundColor = selectedTemplate.bg;
    liveFrame.style.color = selectedTemplate.text;
}

function startCameraSession() {
    resetCameraSession();
    switchScreen('screen-camera');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Browser ini tidak mendukung akses kamera.');
        return;
    }

    navigator.mediaDevices.getUserMedia({
            video: {
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 960
                },
                facingMode: 'user'
            },
            audio: false
        })
        .then(function(stream) {
            currentStream = stream;
            const video = document.getElementById('camera-feed');
            video.srcObject = stream;
            video.play();
        })
        .catch(function(err) {
            alert('Kamera gagal diakses. Pastikan izin kamera sudah aktif. Detail: ' + err.message);
        });
}

function resetCameraSession() {
    capturedPhotos = [];
    document.getElementById('btn-take-photo').style.display = 'inline-flex';
    document.getElementById('btn-take-photo').disabled = false;
    document.getElementById('btn-retake-photo').style.display = 'none';
    document.getElementById('btn-process-result').style.display = 'none';
    document.getElementById('camera-status-text').innerText = 'Siapkan pose terbaikmu. Kamera akan mengambil 3 foto berturut-turut.';

    for (let i = 0; i < 3; i++) {
        const box = document.getElementById(`preview-box-${i}`);
        box.innerHTML = i + 1;
        box.style.borderStyle = 'dashed';
    }
}

function startPhotoCaptureSeries() {
    const btn = document.getElementById('btn-take-photo');
    btn.disabled = true;
    capturedPhotos = [];

    for (let i = 0; i < 3; i++) {
        const box = document.getElementById(`preview-box-${i}`);
        box.innerHTML = i + 1;
        box.style.borderStyle = 'dashed';
    }

    captureNextPhoto(0);
}

function triggerFlash() {
    const flash = document.getElementById('flash-effect');
    flash.style.opacity = '0.85';
    setTimeout(() => {
        flash.style.opacity = '0';
    }, 150);
}

function captureNextPhoto(index) {
    if (index >= 3) {
        document.getElementById('btn-take-photo').style.display = 'none';
        document.getElementById('btn-retake-photo').style.display = 'inline-flex';
        document.getElementById('btn-process-result').style.display = 'inline-flex';
        document.getElementById('camera-status-text').innerText = 'Semua foto selesai diambil. Klik Lihat Hasil Frame.';
        return;
    }

    document.getElementById('camera-status-text').innerText = `Bersiap untuk foto ke-${index + 1} dari 3...`;
    const overlay = document.getElementById('countdown-overlay');
    overlay.style.display = 'flex';
    let count = 3;
    overlay.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            overlay.innerText = count;
        } else {
            clearInterval(timer);
            overlay.style.display = 'none';
            triggerFlash();

            const video = document.getElementById('camera-feed');
            const canvas = document.getElementById('capture-canvas');
            const width = video.videoWidth || 640;
            const height = video.videoHeight || 480;

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, width, height);
            ctx.restore();

            const photoUrl = canvas.toDataURL('image/png');
            capturedPhotos.push(photoUrl);

            const box = document.getElementById(`preview-box-${index}`);
            box.innerHTML = `<img src="${photoUrl}" alt="Foto ${index + 1}">`;
            box.style.borderStyle = 'solid';

            setTimeout(() => {
                captureNextPhoto(index + 1);
            }, 700);
        }
    }, 900);
}

function generateFinalStrip() {
    if (capturedPhotos.length < 3) return;

    const stripCanvas = document.getElementById('strip-canvas');
    const ctx = stripCanvas.getContext('2d');

    const photoW = 480;
    const photoH = 360;
    const padding = 32;
    const gap = 22;
    const footerH = 95;

    const totalW = photoW + (padding * 2);
    const totalH = (photoH * 3) + (gap * 2) + padding + footerH;

    stripCanvas.width = totalW;
    stripCanvas.height = totalH;

    ctx.fillStyle = selectedTemplate.bg;
    ctx.fillRect(0, 0, totalW, totalH);

    if (selectedTemplate.id === 'cream_minimal') {
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, totalW - 4, totalH - 4);
    }

    let loadedCount = 0;
    capturedPhotos.forEach((src, idx) => {
        const img = new Image();
        img.onload = function() {
            const yPos = padding + idx * (photoH + gap);
            const imgRatio = img.width / img.height;
            const targetRatio = photoW / photoH;
            let sx = 0,
                sy = 0,
                sWidth = img.width,
                sHeight = img.height;

            if (imgRatio > targetRatio) {
                sWidth = img.height * targetRatio;
                sx = (img.width - sWidth) / 2;
            } else {
                sHeight = img.width / targetRatio;
                sy = (img.height - sHeight) / 2;
            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, padding, yPos, photoW, photoH);

            loadedCount++;
            if (loadedCount === 3) {
                ctx.fillStyle = selectedTemplate.text;
                ctx.textAlign = 'center';
                ctx.font = '700 22px Outfit, sans-serif';
                ctx.fillText('LEVINA PHOTOBOOTH', totalW / 2, totalH - 50);

                const todayStr = new Date().toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
                ctx.font = '400 15px Outfit, sans-serif';
                ctx.fillText(todayStr, totalW / 2, totalH - 25);

                finalStripDataUrl = stripCanvas.toDataURL('image/png');
                document.getElementById('final-strip-img').src = finalStripDataUrl;

                const saveBtn = document.getElementById('btn-save-gallery');
                saveBtn.disabled = false;
                saveBtn.innerText = 'Simpan ke Galeri Lokal';

                switchScreen('screen-result');
            }
        };
        img.src = src;
    });
}

function downloadCurrentStrip() {
    if (!finalStripDataUrl) return;
    const link = document.createElement('a');
    link.download = `levina-photostrip-${Date.now()}.png`;
    link.href = finalStripDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function saveCurrentToGallery() {
    if (!finalStripDataUrl) return;

    const sessionData = {
        id: Date.now(),
        date: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        template: selectedTemplate.name,
        stripImage: finalStripDataUrl
    };

    try {
        let localGallery = JSON.parse(localStorage.getItem('levina_gallery') || '[]');
        localGallery.unshift(sessionData);
        if (localGallery.length > 15) {
            localGallery = localGallery.slice(0, 15);
        }
        localStorage.setItem('levina_gallery', JSON.stringify(localGallery));

        const saveBtn = document.getElementById('btn-save-gallery');
        saveBtn.disabled = true;
        saveBtn.innerText = 'Tersimpan di Galeri';
    } catch (e) {
        alert('Penyimpanan lokal penuh. Hapus beberapa foto lama.');
    }
}

function retakeFromResult() {
    startCameraSession();
}

function openGallery() {
    loadLocalGallery();
    switchScreen('screen-gallery');
}

function loadLocalGallery() {
    const container = document.getElementById('gallery-container');
    const localGallery = JSON.parse(localStorage.getItem('levina_gallery') || '[]');

    if (localGallery.length === 0) {
        container.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-muted); padding: 30px 0;">Belum ada foto yang disimpan di galeri lokal.</p>';
        return;
    }

    container.innerHTML = localGallery.map(item => `
        <div class="gallery-card">
            <img src="${item.stripImage}" alt="${item.template}">
            <div class="gallery-meta">${item.template} &bull; ${item.date}</div>
            <div class="gallery-actions">
                <button class="btn primary-btn" onclick="downloadSavedItem(${item.id})">Unduh</button>
                <button class="btn outline-btn" onclick="deleteSavedItem(${item.id})">Hapus</button>
            </div>
        </div>
    `).join('');
}

function downloadSavedItem(id) {
    const localGallery = JSON.parse(localStorage.getItem('levina_gallery') || '[]');
    const item = localGallery.find(x => x.id === id);
    if (!item) return;

    const link = document.createElement('a');
    link.download = `levina-photostrip-${item.id}.png`;
    link.href = item.stripImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function deleteSavedItem(id) {
    let localGallery = JSON.parse(localStorage.getItem('levina_gallery') || '[]');
    localGallery = localGallery.filter(x => x.id !== id);
    localStorage.setItem('levina_gallery', JSON.stringify(localGallery));
    loadLocalGallery();
}
