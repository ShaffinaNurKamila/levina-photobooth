document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentStream = null;
    let selectedTemplate = null;
    let capturedImages = []; // Array of base64 images
    let customDroppedImages = [null, null, null]; // TUGAS Tambahan

    // Editor State
    let photoDelay = 3;
    let selectedCSSFilter = 'none';
    let brightnessValue = 100;

    // DOM Elements
    const screens = {
        landing: document.getElementById('screen-landing'),
        login: document.getElementById('screen-login'),
        templates: document.getElementById('screen-templates'),
        camera: document.getElementById('screen-camera'),
        review: document.getElementById('screen-review'),
        success: document.getElementById('screen-success'),
        gallery: document.getElementById('screen-gallery'), // TUGAS 5
        filterTool: document.getElementById('screen-filter-tool'),
        blurTool: document.getElementById('screen-blur-tool'),
        blog: document.getElementById('screen-blog')
    };

    class FormLoadingManager {
        constructor(buttonId) {
            this.button = document.getElementById(buttonId);
            this.originalText = this.button.innerHTML;
        }

        startLoading(loadingText = 'Mengirim...') {
            this.button.disabled = true;
            this.button.innerHTML = `<span class="btn-spinner"></span> ${loadingText}`;
        }

        stopLoading() {
            this.button.disabled = false;
            this.button.innerHTML = this.originalText;
        }
    }

    function showStatusMessage(type, message) {
        const container = document.querySelector('.modal-content');
        const existingMsg = container.querySelector('.status-message');
        if (existingMsg) existingMsg.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `status-message ${type}`;
        msgDiv.innerHTML = type === 'success' ? `✅ ${message}` : `❌ ${message}`;

        const firstGroup = container.querySelector('.form-group');
        if (firstGroup) {
            container.insertBefore(msgDiv, firstGroup);
        } else {
            container.appendChild(msgDiv);
        }

        if (type === 'success') {
            setTimeout(() => { if (msgDiv.parentNode) msgDiv.remove(); }, 5000);
        }
    }

    // Navigation function
    function showScreen(screenName) {
        Object.values(screens).forEach(s => {
            if (s) s.classList.remove('active');
        });
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
        }

        // Manage Stepper Visibility
        const stepper = document.getElementById('main-stepper');
        const photoboothScreens = ['templates', 'camera', 'review', 'form', 'success'];
        if (stepper) {
            if (photoboothScreens.includes(screenName)) {
                stepper.classList.remove('hidden');
            } else {
                stepper.classList.add('hidden');
            }
        }

        // Update active nav-link highlighting
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        if (screenName === 'landing') {
            const el = document.getElementById('nav-home');
            if (el) el.classList.add('active');
        } else if (screenName === 'blog') {
            const el = document.getElementById('nav-blog');
            if (el) el.classList.add('active');
        } else if (screenName === 'gallery') {
            const el = document.getElementById('nav-gallery');
            if (el) el.classList.add('active');
        } else if (screenName === 'filterTool' || screenName === 'blurTool' || screenName === 'templates' || screenName === 'camera' || screenName === 'review' || screenName === 'success') {
            const el = document.getElementById('nav-tools-toggle');
            if (el) el.classList.add('active');
        }

        // Update stepper
        let step = 0;
        if (screenName === 'templates') step = 1;
        if (screenName === 'camera') step = 2;
        if (screenName === 'review') step = 3;
        if (screenName === 'form' || screenName === 'success') step = 4;

        if (step > 0) {
            document.querySelectorAll('.step').forEach(el => {
                if (parseInt(el.dataset.step) <= step) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }
    }

    // 1. [High Priority] Login is now handled via OAuth redirect in index.php
    // The screen logic is handled by index.php assigning 'active' class directly.

    // 2. Select Template (Canva Apps SDK Simulation & New Editor)
    const templateCards = document.querySelectorAll('.template-card, .frame-card');
    const btnStartCamera = document.getElementById('btn-start-camera');
    const templateOverlay = document.getElementById('template-overlay');

    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            templateCards.forEach(c => c.classList.remove('active', 'selected'));
            card.classList.add('active', 'selected');
            selectedTemplate = card.dataset.template;
            if (btnStartCamera) btnStartCamera.disabled = false;
            if (templateOverlay) {
                templateOverlay.className = 'template-overlay ' + selectedTemplate;
            }
        });
    });

    if (btnStartCamera) {
        btnStartCamera.addEventListener('click', async () => {
            // Terapkan frame ke layer kamera (Agar user ada bayangan posisi/pose)
            templateOverlay.className = 'template-overlay ' + selectedTemplate;

            resetPreviews();
            document.getElementById('btn-capture').disabled = false;

            showScreen('camera');
            await startCamera();
        });
    }

    // 3. Camera Setup & Editor Controls
    const video = document.getElementById('camera-feed');
    const countdownEl = document.getElementById('countdown');

    // Editor Tabs
    const editorTabs = document.querySelectorAll('.editor-tab-btn');
    const editorPanelsContainer = document.querySelector('.editor-panels');
    const editorPanels = document.querySelectorAll('.editor-panel');

    editorTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const isActive = tab.classList.contains('active');

            editorTabs.forEach(t => t.classList.remove('active'));
            editorPanels.forEach(p => p.classList.remove('active'));

            if (!isActive || !editorPanelsContainer.classList.contains('open')) {
                tab.classList.add('active');
                document.getElementById(tab.dataset.target).classList.add('active');
                editorPanelsContainer.classList.add('open');
            } else {
                editorPanelsContainer.classList.remove('open');
            }
        });
    });

    // Buka panel Frame secara default saat pertama kali
    editorPanelsContainer.classList.add('open');

    // Editor Filters
    const filterCards = document.querySelectorAll('.filter-card');
    filterCards.forEach(card => {
        card.addEventListener('click', () => {
            filterCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedCSSFilter = card.dataset.filter;
            applyVideoFilter();
        });
    });

    // Editor Brightness
    const brightnessSlider = document.getElementById('brightness-slider');
    if (brightnessSlider) {
        brightnessSlider.addEventListener('input', (e) => {
            brightnessValue = e.target.value;
            applyVideoFilter();
        });
    }

    function applyVideoFilter() {
        if (!video) return;
        const brightnessPart = `brightness(${brightnessValue / 100})`;
        let cssFilter = 'none';
        if (selectedCSSFilter === 'sepia') cssFilter = 'sepia(0.6)';
        else if (selectedCSSFilter === 'grayscale') cssFilter = 'grayscale(1)';
        else if (selectedCSSFilter === 'invert') cssFilter = 'invert(1)';
        else if (selectedCSSFilter === 'vintage') cssFilter = 'sepia(0.5) contrast(1.2) brightness(0.9)';

        if (selectedCSSFilter === 'none') {
            video.style.filter = brightnessPart;
        } else {
            video.style.filter = `${cssFilter} ${brightnessPart}`;
        }
    }

    // Timer
    const timerBtns = document.querySelectorAll('.timer-btn');
    timerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timerBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            photoDelay = parseInt(btn.dataset.time);
        });
    });

    async function startCamera() {
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1920, height: 1080, facingMode: "user" },
                audio: false
            });
            video.srcObject = currentStream;
        } catch (err) {
            console.error("Camera access denied:", err);
            alert("Harap izinkan akses kamera untuk menggunakan photobooth.");
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
    }

    const TOTAL_PHOTOS = 3;

    function resetPreviews() {
        for (let i = 0; i < 3; i++) {
            const previewBox = document.getElementById(`preview-${i}`);
            if (previewBox) {
                previewBox.style.backgroundImage = 'none';
                previewBox.classList.remove('filled');
                const icon = previewBox.querySelector('.preview-icon');
                if (icon) icon.style.display = 'block';
            }
        }
    }

    // TUGAS Tambahan: Drag & Drop ke 3 Slot Preview di Kamera
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`preview-${i}`);
        if (!slot) continue;

        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.style.border = '2px solid #60a5fa';
        });
        slot.addEventListener('dragleave', (e) => {
            e.preventDefault();
            slot.style.border = '';
        });
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.style.border = '';

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const size = Math.min(img.width, img.height);
                        canvas.width = size;
                        canvas.height = size;
                        const startX = (img.width - size) / 2;
                        const startY = (img.height - size) / 2;

                        ctx.drawImage(img, startX, startY, size, size, 0, 0, size, size);
                        const dataUrl = canvas.toDataURL('image/png');

                        customDroppedImages[i] = dataUrl;
                        capturedImages[i] = dataUrl; // Tampilkan preview awal

                        slot.style.backgroundImage = `url(${dataUrl})`;
                        slot.classList.add('filled');
                        const icon = slot.querySelector('.preview-icon');
                        if (icon) icon.style.display = 'none';
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    document.getElementById('btn-capture').addEventListener('click', () => {
        // Jangan hapus gambar yang sudah di-drop
        capturedImages = [...customDroppedImages];
        resetPreviews();

        // Kembalikan UI untuk customDroppedImages
        for (let i = 0; i < 3; i++) {
            if (capturedImages[i]) {
                const previewBox = document.getElementById(`preview-${i}`);
                if (previewBox) {
                    previewBox.style.backgroundImage = `url(${capturedImages[i]})`;
                    previewBox.classList.add('filled');
                    const icon = previewBox.querySelector('.preview-icon');
                    if (icon) icon.style.display = 'none';
                }
            }
        }

        document.getElementById('capture-controls').classList.add('hidden');
        startCaptureSequence(1);
    });

    function startCaptureSequence(photoIndex) {
        if (photoIndex > TOTAL_PHOTOS) {
            document.getElementById('finish-controls').classList.remove('hidden');
            return;
        }

        // TUGAS Tambahan: Jika slot ini sudah diisi via Drag & Drop, lewati proses jepret
        if (capturedImages[photoIndex - 1]) {
            startCaptureSequence(photoIndex + 1);
            return;
        }

        let count = photoDelay;
        countdownEl.innerText = count;
        countdownEl.classList.remove('hidden');

        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                countdownEl.innerText = count;
            } else {
                clearInterval(timer);
                countdownEl.classList.add('hidden');

                takeSinglePhoto(photoIndex - 1);
                flashEffect();

                setTimeout(() => {
                    startCaptureSequence(photoIndex + 1);
                }, 1000);
            }
        }, 1000);
    }

    // Fungsi Retake Per Frame (Klik preview box)
    for (let i = 0; i < 3; i++) {
        document.getElementById(`preview-${i}`).addEventListener('click', () => {
            // Hanya bisa retake jika 3 foto sudah terambil (bisa dicek dari array length)
            // Meskipun ada elemen kosong di array, capturedImages.length akan 3 jika max index 2 sudah diset
            if (capturedImages.length === 3 && capturedImages[i]) {
                document.getElementById('finish-controls').classList.add('hidden');
                retakeSinglePhotoSequence(i);
            }
        });
    }

    function retakeSinglePhotoSequence(index) {
        customDroppedImages[index] = null; // Hapus custom image jika ada

        let count = photoDelay;
        countdownEl.innerText = count;
        countdownEl.classList.remove('hidden');

        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                countdownEl.innerText = count;
            } else {
                clearInterval(timer);
                countdownEl.classList.add('hidden');

                takeSinglePhoto(index);
                flashEffect();

                setTimeout(() => {
                    document.getElementById('finish-controls').classList.remove('hidden');
                }, 1000);
            }
        }, 1000);
    }

    document.getElementById('btn-finish-capture').addEventListener('click', () => {
        finishCaptureSequence();
    });

    function flashEffect() {
        const flash = document.createElement('div');
        flash.style.position = 'absolute';
        flash.style.top = '0'; flash.style.left = '0';
        flash.style.width = '100%'; flash.style.height = '100%';
        flash.style.backgroundColor = 'white';
        flash.style.zIndex = '100';
        flash.style.opacity = '1';
        flash.style.transition = 'opacity 0.2s ease-out';
        document.querySelector('.camera-wrapper').appendChild(flash);

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 200);
        }, 50);
    }

    // === ALGORITMA MANIPULASI PIKSEL (TUGAS 3) ===
    function applyPixelFilter(ctx, width, height, filterType, brightnessVal) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const brightnessMultiplier = brightnessVal / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // 1. Terapkan Filter Piksel
            if (filterType === 'grayscale') {
                const gray = 0.3 * r + 0.59 * g + 0.11 * b;
                r = g = b = gray;
            } else if (filterType === 'sepia') {
                const tr = 0.393 * r + 0.769 * g + 0.189 * b;
                const tg = 0.349 * r + 0.686 * g + 0.168 * b;
                const tb = 0.272 * r + 0.534 * g + 0.131 * b;
                r = Math.min(255, tr);
                g = Math.min(255, tg);
                b = Math.min(255, tb);
            } else if (filterType === 'invert') {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            } else if (filterType === 'vintage') {
                const tr = 0.393 * r + 0.769 * g + 0.189 * b;
                const tg = 0.349 * r + 0.686 * g + 0.168 * b;
                const tb = 0.272 * r + 0.534 * g + 0.131 * b;
                r = Math.min(255, r * 0.6 + tr * 0.4);
                g = Math.min(255, g * 0.6 + tg * 0.4);
                b = Math.min(255, b * 0.6 + tb * 0.4);
            }

            // 2. Penyesuaian Kecerahan (Brightness)
            data[i] = Math.min(255, r * brightnessMultiplier);     // Red
            data[i + 1] = Math.min(255, g * brightnessMultiplier); // Green
            data[i + 2] = Math.min(255, b * brightnessMultiplier); // Blue
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function takeSinglePhoto(index) {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');

        // Buat hasil foto menjadi kotak (persegi) dari tengah kamera
        const size = Math.min(video.videoWidth, video.videoHeight);
        tempCanvas.width = size;
        tempCanvas.height = size;

        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;

        ctx.translate(tempCanvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Eksekusi Manipulasi Piksel secara manual sesuai Tugas 3
        applyPixelFilter(ctx, tempCanvas.width, tempCanvas.height, selectedCSSFilter, brightnessValue);

        const imgData = tempCanvas.toDataURL('image/png');
        capturedImages[index] = imgData;

        const previewBox = document.getElementById(`preview-${index}`);
        if (previewBox) {
            previewBox.style.backgroundImage = `url(${imgData})`;
            previewBox.classList.add('filled');
            const icon = previewBox.querySelector('.preview-icon');
            if (icon) icon.style.display = 'none';
        }
    }

    async function finishCaptureSequence() {
        stopCamera();

        // Autofill Tanggal Hari Ini
        const today = new Date();
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateString = today.toLocaleDateString('id-ID', dateOptions);
        document.getElementById('input-date').value = dateString;

        // Listener untuk Live Update Teks Panggilan (jaga-jaga jika diperlukan)
        document.getElementById('input-name').removeEventListener('input', updateCanvasWithText);
        document.getElementById('input-name').addEventListener('input', updateCanvasWithText);

        // Render photobooth strip
        await updateCanvasWithText();

        showScreen('review');
    }

    function drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    async function updateCanvasWithText() {
        const canvas = document.getElementById('photo-canvas');
        const ctx = canvas.getContext('2d');
        const name = document.getElementById('input-name').value;
        const date = document.getElementById('input-date').value;

        const imgW = 400;
        const imgH = 300;

        let padding, topSpace, bottomSpace;

        if (selectedTemplate === 'blue_moment') {
            padding = 30;
            topSpace = 40;
            bottomSpace = 250;
        } else if (selectedTemplate === 'grunge_photostrip') {
            padding = 20;
            topSpace = 160;
            bottomSpace = 180;
        } else if (selectedTemplate === 'pink_cute') {
            padding = 25;
            topSpace = 180;
            bottomSpace = 220;
        } else if (selectedTemplate === 'neon_glow') {
            padding = 25;
            topSpace = 180;
            bottomSpace = 220;
        } else {
            // fallback
            padding = 20; topSpace = 20; bottomSpace = 150;
        }

        canvas.width = imgW + (padding * 2);
        canvas.height = topSpace + (imgH * 3) + (padding * 2) + bottomSpace;

        // 1. Background
        if (selectedTemplate === 'blue_moment') {
            ctx.fillStyle = '#1e54c9';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (selectedTemplate === 'grunge_photostrip') {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (selectedTemplate === 'pink_cute') {
            ctx.fillStyle = '#12255b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (selectedTemplate === 'neon_glow') {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 2. Draw Images
        for (let i = 0; i < capturedImages.length; i++) {
            const img = new Image();
            await new Promise(r => { img.onload = r; img.src = capturedImages[i]; });

            const yPos = topSpace + (i * (imgH + padding));

            ctx.save();
            if (selectedTemplate === 'blue_moment' || selectedTemplate === 'pink_cute' || selectedTemplate === 'neon_glow') {
                // Rounded corners for photo
                drawRoundedRect(ctx, padding, yPos, imgW, imgH, 20);
                ctx.clip();
                ctx.drawImage(img, padding, yPos, imgW, imgH);
            } else {
                // Sharp corners with black border
                ctx.drawImage(img, padding, yPos, imgW, imgH);
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#222';
                ctx.strokeRect(padding, yPos, imgW, imgH);
            }
            ctx.restore();
        }

        // 3. Draw Decorations & Text
        // IMPLEMENTASI COMPOSITING (TUGAS 3)
        ctx.globalCompositeOperation = 'source-over'; // Default: overlay di atas foto

        if (selectedTemplate === 'blue_moment') {
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = '900 65px "Impact", "Arial Black", sans-serif';
            let textY = topSpace + (imgH * 3) + (padding * 2) + 70;
            ctx.fillText("EVERY", canvas.width / 2, textY);
            ctx.fillText("MOMENT", canvas.width / 2, textY + 60);

            ctx.font = 'italic 40px "Brush Script MT", cursive';
            ctx.fillText("matters", canvas.width / 2, textY + 25);

            // Barcode Simulation
            let barcodeY = textY + 80;
            ctx.fillStyle = '#ffffff';
            let cursorX = padding + 40;
            for (let b = 0; b < 35; b++) {
                let bw = Math.random() * 6 + 2;
                ctx.fillRect(cursorX, barcodeY, bw, 40);
                cursorX += bw + (Math.random() * 4 + 2);
            }

            // TUGAS 3: Penggunaan globalCompositeOperation untuk efek visual overlay
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over'; // Kembalikan ke normal

            ctx.font = '900 30px "Arial Black"';
            ctx.fillText("1.0", canvas.width - padding - 30, barcodeY + 30);

        } else if (selectedTemplate === 'grunge_photostrip') {
            ctx.fillStyle = '#111111';
            ctx.textAlign = 'center';
            ctx.font = '900 70px "Impact", sans-serif';
            ctx.fillText("PHOTOSTRIP", canvas.width / 2, 100);

            ctx.font = 'bold 16px Arial';
            ctx.fillText("LET'S PHOTO!", canvas.width / 2, 130);

            // Lines
            ctx.fillRect(padding, 125, 120, 2);
            ctx.fillRect(canvas.width - padding - 120, 125, 120, 2);

            let bottomY = topSpace + (imgH * 3) + (padding * 2) + 60;
            ctx.font = '900 40px Arial';
            ctx.textAlign = 'left';
            ctx.fillText("CAMERA ARENA", padding, bottomY);

            ctx.font = '16px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(date, canvas.width - padding, bottomY - 10);

        } else if (selectedTemplate === 'pink_cute') {
            ctx.fillStyle = '#ff71a3';
            ctx.textAlign = 'center';
            ctx.font = 'bold italic 60px "Comic Sans MS", cursive';
            ctx.fillText("One Fine day", canvas.width / 2, 100);

            // Draw a cute cat face at the bottom
            let bottomY = topSpace + (imgH * 3) + (padding * 2) + 100;
            ctx.beginPath();
            ctx.arc(canvas.width / 2, bottomY, 50, 0, Math.PI * 2); // Head
            ctx.fill();

            // Ears
            ctx.moveTo(canvas.width / 2 - 40, bottomY - 30);
            ctx.lineTo(canvas.width / 2 - 60, bottomY - 80);
            ctx.lineTo(canvas.width / 2 - 10, bottomY - 45);
            ctx.fill();

            ctx.moveTo(canvas.width / 2 + 40, bottomY - 30);
            ctx.lineTo(canvas.width / 2 + 60, bottomY - 80);
            ctx.lineTo(canvas.width / 2 + 10, bottomY - 45);
            ctx.fill();

            // Eyes & mouth (dark blue)
            ctx.fillStyle = '#12255b';
            ctx.beginPath();
            ctx.arc(canvas.width / 2 - 20, bottomY - 10, 8, 0, Math.PI * 2);
            ctx.arc(canvas.width / 2 + 20, bottomY - 10, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(canvas.width / 2, bottomY + 10, 5, 0, Math.PI, false);
            ctx.stroke();

            ctx.fillStyle = '#ff71a3';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(name || "Best Friends", canvas.width / 2, bottomY + 90);

        } else if (selectedTemplate === 'neon_glow') {
            ctx.fillStyle = '#a855f7';
            ctx.textAlign = 'center';
            ctx.font = 'bold 50px "Arial", sans-serif';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 20;
            ctx.fillText("NEON VIBES", canvas.width / 2, 100);
            ctx.shadowBlur = 0; // reset

            let bottomY = topSpace + (imgH * 3) + (padding * 2) + 100;
            ctx.font = '30px "Arial", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(name || "Cyberpunk", canvas.width / 2, bottomY);
        }
    }

    // 4. Review: Retake
    document.getElementById('btn-retake').addEventListener('click', async () => {
        document.getElementById('input-name').value = '';
        resetPreviews();
        capturedImages = [];
        customDroppedImages = [null, null, null]; // Reset custom images saat ulang semua
        document.getElementById('capture-controls').classList.remove('hidden');
        document.getElementById('finish-controls').classList.add('hidden');
        showScreen('camera');
        await startCamera();
    });

    // Lanjut ke Form
    document.getElementById('btn-continue-form').addEventListener('click', () => {
        // TUGAS 5: Simpan ke Galeri Lokal (LocalStorage)
        const canvas = document.getElementById('photo-canvas');
        if (typeof saveToLocalGallery === 'function') {
            saveToLocalGallery(canvas.toDataURL('image/jpeg', 0.8));
        }

        document.getElementById('screen-form').classList.add('active');
        document.querySelectorAll('.step').forEach(el => {
            if (parseInt(el.dataset.step) <= 4) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    });

    // Kembali ke Review
    document.getElementById('btn-back-preview').addEventListener('click', () => {
        document.getElementById('screen-form').classList.remove('active');
        document.querySelectorAll('.step').forEach(el => {
            if (parseInt(el.dataset.step) <= 3) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    });

    // Fungsi Validasi Form (Mendukung Banyak Email)
    function validateForm(name, emailInput) {
        if (!name.trim()) return "Nama tidak boleh kosong!";
        if (!emailInput.trim()) return "Email tidak boleh kosong!";

        const emails = emailInput.split(',').map(e => e.trim()).filter(e => e !== '');

        if (emails.length === 0) return "Email tidak boleh kosong!";
        if (emails.length > 10) return "Maksimal hanya bisa mengirim ke 10 email sekaligus!";

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (let i = 0; i < emails.length; i++) {
            if (!emailPattern.test(emails[i])) {
                return `Format email tidak valid pada: ${emails[i]}`;
            }
        }
        return null; // Valid
    }

    // 5. Upload ke Canva / Kirim via EmailJS
    document.getElementById('btn-upload-canva').addEventListener('click', async (e) => {
        e.preventDefault(); // Cegah refresh halaman

        const inputName = document.getElementById('input-name').value;
        const inputEmail = document.getElementById('input-email').value;

        // Jalankan Validasi
        const validationError = validateForm(inputName, inputEmail);
        if (validationError) {
            showStatusMessage('error', validationError);
            return;
        }

        const loadingManager = new FormLoadingManager('btn-upload-canva');
        loadingManager.startLoading();

        try {
            const canvas = document.getElementById('photo-canvas');
            // Kualitas bisa dinaikkan ke 0.9 karena sekarang kita menggunakan ImgBB
            const finalImage = canvas.toDataURL('image/jpeg', 0.9);

            // 1. UPLOAD KE IMGBB
            // GANTI API KEY DI BAWAH INI DENGAN API KEY IMGBB MILIKMU!
            const imgBBApiKey = "a815f91dd5c3e5d32e8109e6fc2117bd";

            showStatusMessage('success', 'Mengunggah foto ke server cloud...');

            const formData = new FormData();
            // ImgBB membutuhkan base64 murni (tanpa awalan data:image/jpeg;base64,)
            formData.append('image', finalImage.split(',')[1]);

            const imgBBResponse = await fetch(`https://api.imgbb.com/1/upload?key=${imgBBApiKey}`, {
                method: 'POST',
                body: formData
            });
            const imgBBData = await imgBBResponse.json();

            if (!imgBBData.success) {
                throw new Error("Gagal mengunggah ke ImgBB. Pastikan API Key valid!");
            }

            const imageUrl = imgBBData.data.url; // Dapatkan link URL gambar

            // 2. KIRIM EMAIL DENGAN EMAILJS
            showStatusMessage('success', 'Foto terunggah! Mengirim email...');

            // Pecah email menjadi array jika ada banyak (dipisahkan koma)
            const daftarEmail = inputEmail.split(',').map(e => e.trim()).filter(e => e !== '');

            // Request asynchronous secara berurutan (Looping)
            for (let i = 0; i < daftarEmail.length; i++) {
                const params = {
                    to_name: inputName,
                    to_email: daftarEmail[i],
                    email: daftarEmail[i],
                    name: inputName,
                    photo_data: imageUrl // Mengirim Link URL, BUKAN Base64 yang berat!
                };

                // Tunggu pengiriman selesai untuk email saat ini, baru lanjut ke email berikutnya
                await emailjs.send('service_photobooth', 'template_u349pt4', params);
            }

            // Jika Sukses
            showStatusMessage('success', 'Email berhasil dikirim!');

            setTimeout(() => {
                document.getElementById('screen-form').classList.remove('active');
                showScreen('success');
                document.getElementById('uploading-state').classList.add('hidden');
                document.getElementById('success-state').classList.remove('hidden');
            }, 1500);

        } catch (err) {
            // Jika Gagal
            console.error('EmailJS Error:', err);
            const errorMessage = err.text || err.message || JSON.stringify(err);
            showStatusMessage('error', 'Gagal mengirim! Error: ' + errorMessage);
        } finally {
            // Blok Finally: selalu hentikan loading
            loadingManager.stopLoading();
        }
    });

    // Reset Flow
    document.getElementById('btn-home').addEventListener('click', () => {
        const uploadingState = document.getElementById('uploading-state');
        const successState = document.getElementById('success-state');

        uploadingState.classList.remove('hidden');
        successState.classList.add('hidden');

        selectedTemplate = null;
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        document.getElementById('btn-start-camera').disabled = true;
        document.getElementById('input-name').value = '';

        showScreen('templates'); // Langsung ke pilih template saja agar lebih cepat
    });

    // Header Logo click listener to return to home/main screen
    const logoHeader = document.getElementById('logo-header');
    if (logoHeader) {
        logoHeader.addEventListener('click', () => {
            // Stop camera if running
            stopCamera();

            // Hide modals/overlays
            const screenForm = document.getElementById('screen-form');
            if (screenForm) screenForm.classList.remove('active');
            const lightboxModal = document.getElementById('lightbox-modal');
            if (lightboxModal) lightboxModal.classList.remove('active');
            const blogDetailModal = document.getElementById('blog-detail-modal');
            if (blogDetailModal) blogDetailModal.classList.remove('active');

            // Reset upload/success states
            const uploadingState = document.getElementById('uploading-state');
            if (uploadingState) uploadingState.classList.remove('hidden');
            const successState = document.getElementById('success-state');
            if (successState) successState.classList.add('hidden');

            showScreen('landing');
        });
    }

    // ================= TUGAS 5: ADVANCED GALLERY & DRAG AND DROP =================
    const STORAGE_KEY = 'photobooth_gallery';
    let localGallery = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let currentLightboxIndex = 0;

    const btnOpenGallery = document.getElementById('btn-open-gallery');
    const btnCloseGallery = document.getElementById('btn-close-gallery');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const galleryGrid = document.getElementById('gallery-grid');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    window.saveToLocalGallery = function (dataUrl) {
        localGallery.push({ id: Date.now(), src: dataUrl });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localGallery));
        renderGallery();
    };

    if (btnOpenGallery) {
        btnOpenGallery.addEventListener('click', () => {
            renderGallery();
            showScreen('gallery');
        });
    }
    if (btnCloseGallery) {
        btnCloseGallery.addEventListener('click', () => {
            showScreen('templates');
        });
    }

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    }

    function handleFiles(files) {
        for (let file of files) {
            if (!file.type.startsWith('image/')) {
                alert('Tolong hanya unggah file gambar (JPG/PNG).');
                continue;
            }
            const reader = new FileReader();
            reader.onload = (e) => saveToLocalGallery(e.target.result);
            reader.readAsDataURL(file);
        }
    }

    function renderGallery() {
        if (!galleryGrid) return;
        galleryGrid.innerHTML = '';
        if (localGallery.length === 0) {
            galleryGrid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align:center;">Galeri masih kosong.</p>';
            return;
        }

        localGallery.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.innerHTML = `
                <img src="${item.src}" alt="Gallery photo">
                <div class="gallery-overlay">
                    <button class="gallery-btn btn-view" data-index="${index}">👁️ Lihat</button>
                    <button class="gallery-btn btn-download" data-src="${item.src}">⬇️ Unduh</button>
                    <button class="gallery-btn btn-delete" data-index="${index}">🗑️ Hapus</button>
                </div>
            `;
            galleryGrid.appendChild(div);
        });

        attachGalleryEvents();
    }

    function attachGalleryEvents() {
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => openLightbox(parseInt(e.target.dataset.index)));
        });
        document.querySelectorAll('.btn-download').forEach(btn => {
            btn.addEventListener('click', (e) => downloadImage(e.target.dataset.src));
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => deleteImage(parseInt(e.target.dataset.index)));
        });
    }

    function openLightbox(index) {
        currentLightboxIndex = index;
        updateLightboxImage();
        lightboxModal.classList.add('active');
    }
    function updateLightboxImage() {
        if (lightboxImg && localGallery[currentLightboxIndex]) {
            lightboxImg.src = localGallery[currentLightboxIndex].src;
        }
    }
    if (lightboxClose) lightboxClose.addEventListener('click', () => lightboxModal.classList.remove('active'));
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => {
            currentLightboxIndex = (currentLightboxIndex - 1 + localGallery.length) % localGallery.length;
            updateLightboxImage();
        });
    }
    if (lightboxNext) {
        lightboxNext.addEventListener('click', () => {
            currentLightboxIndex = (currentLightboxIndex + 1) % localGallery.length;
            updateLightboxImage();
        });
    }

    function downloadImage(dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `photobooth_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    function deleteImage(index) {
        if (confirm('Yakin ingin menghapus foto ini dari galeri?')) {
            localGallery.splice(index, 1);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(localGallery));
            renderGallery();
        }
    }

    // === 1. LOGIKA NAVIGATION ROUTING & EVENT HANDLERS ===
    
    // Navbar click listeners
    const navHome = document.getElementById('nav-home');
    if (navHome) {
        navHome.addEventListener('click', (e) => {
            e.preventDefault();
            stopCamera();
            showScreen('landing');
        });
    }

    const navGallery = document.getElementById('nav-gallery');
    if (navGallery) {
        navGallery.addEventListener('click', (e) => {
            e.preventDefault();
            stopCamera();
            renderGallery();
            showScreen('gallery');
        });
    }

    const navBlog = document.getElementById('nav-blog');
    if (navBlog) {
        navBlog.addEventListener('click', (e) => {
            e.preventDefault();
            stopCamera();
            showScreen('blog');
        });
    }

    // Toggle dropdown tool click logic
    const toolPhotobooth = document.getElementById('tool-photobooth');
    if (toolPhotobooth) {
        toolPhotobooth.addEventListener('click', (e) => {
            e.preventDefault();
            stopCamera();
            startPhotoboothSession();
        });
    }

    const toolFilter = document.getElementById('tool-filter');
    if (toolFilter) {
        toolFilter.addEventListener('click', (e) => {
            e.preventDefault();
            stopCamera();
            showScreen('filterTool');
        });
    }

    const toolBlur = document.getElementById('tool-blur');
    if (toolBlur) {
        toolBlur.addEventListener('click', (e) => {
            e.preventDefault();
            stopCamera();
            showScreen('blurTool');
        });
    }

    // Landing Page buttons
    const btnHeroPhotobooth = document.getElementById('btn-hero-photobooth');
    if (btnHeroPhotobooth) {
        btnHeroPhotobooth.addEventListener('click', () => {
            startPhotoboothSession();
        });
    }

    const btnHeroGallery = document.getElementById('btn-hero-gallery');
    if (btnHeroGallery) {
        btnHeroGallery.addEventListener('click', () => {
            renderGallery();
            showScreen('gallery');
        });
    }

    // Landing Page Cards
    const cardToolPhotobooth = document.getElementById('card-tool-photobooth');
    if (cardToolPhotobooth) {
        cardToolPhotobooth.addEventListener('click', () => {
            startPhotoboothSession();
        });
    }

    const cardToolFilter = document.getElementById('card-tool-filter');
    if (cardToolFilter) {
        cardToolFilter.addEventListener('click', () => {
            showScreen('filterTool');
        });
    }

    const cardToolBlur = document.getElementById('card-tool-blur');
    if (cardToolBlur) {
        cardToolBlur.addEventListener('click', () => {
            showScreen('blurTool');
        });
    }

    // Function to trigger photobooth login / templates screen
    function startPhotoboothSession() {
        const isLoggedIn = document.body.getAttribute('data-logged-in') === 'true';
        if (isLoggedIn) {
            showScreen('templates');
        } else {
            showScreen('login');
        }
    }

    // === 2. LOGIKA INTERAKTIF ALAT FILTER FOTO ===
    const filterUploadZone = document.getElementById('filter-upload-zone');
    const filterFileInput = document.getElementById('filter-file-input');
    const filterCanvas = document.getElementById('filter-canvas');
    const btnDownloadFilter = document.getElementById('btn-download-filter');
    const btnResetFilter = document.getElementById('btn-reset-filter');
    const filterBrightnessSlider = document.getElementById('filter-brightness-slider');
    const filterContrastSlider = document.getElementById('filter-contrast-slider');
    const filterPresetBtns = document.querySelectorAll('[data-filter-preset]');

    let originalFilterImage = null;
    let currentFilterPreset = 'none';

    if (filterUploadZone) {
        filterUploadZone.addEventListener('click', () => filterFileInput.click());
        filterFileInput.addEventListener('change', (e) => handleFilterFileSelect(e.target.files[0]));
        
        filterUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            filterUploadZone.style.background = 'rgba(255, 255, 255, 0.5)';
            filterUploadZone.style.borderStyle = 'solid';
        });
        filterUploadZone.addEventListener('dragleave', () => {
            filterUploadZone.style.background = '';
            filterUploadZone.style.borderStyle = '';
        });
        filterUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            filterUploadZone.style.background = '';
            filterUploadZone.style.borderStyle = '';
            if (e.dataTransfer.files[0]) {
                handleFilterFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    function handleFilterFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Silakan pilih file gambar yang valid.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalFilterImage = img;
                renderFilteredImage();
                filterUploadZone.classList.add('hidden');
                filterCanvas.classList.remove('hidden');
                btnDownloadFilter.disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function renderFilteredImage() {
        if (!originalFilterImage || !filterCanvas) return;
        const ctx = filterCanvas.getContext('2d');
        
        // Match canvas dimensions to image
        filterCanvas.width = originalFilterImage.naturalWidth;
        filterCanvas.height = originalFilterImage.naturalHeight;
        
        // Draw original image
        ctx.drawImage(originalFilterImage, 0, 0);

        // Apply Pixel Filters (Grayscale, Sepia, Invert, Vintage, Brightness, Contrast)
        const imageData = ctx.getImageData(0, 0, filterCanvas.width, filterCanvas.height);
        const data = imageData.data;
        
        const brightnessMultiplier = parseInt(filterBrightnessSlider.value) / 100;
        const contrastMultiplier = parseInt(filterContrastSlider.value) / 100;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i+1];
            let b = data[i+2];

            // Apply preset filter
            if (currentFilterPreset === 'grayscale') {
                const gray = 0.3 * r + 0.59 * g + 0.11 * b;
                r = g = b = gray;
            } else if (currentFilterPreset === 'sepia') {
                const tr = 0.393 * r + 0.769 * g + 0.189 * b;
                const tg = 0.349 * r + 0.686 * g + 0.168 * b;
                const tb = 0.272 * r + 0.534 * g + 0.131 * b;
                r = Math.min(255, tr);
                g = Math.min(255, tg);
                b = Math.min(255, tb);
            } else if (currentFilterPreset === 'invert') {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            } else if (currentFilterPreset === 'vintage') {
                const tr = 0.393 * r + 0.769 * g + 0.189 * b;
                const tg = 0.349 * r + 0.686 * g + 0.168 * b;
                const tb = 0.272 * r + 0.534 * g + 0.131 * b;
                r = Math.min(255, r * 0.6 + tr * 0.4);
                g = Math.min(255, g * 0.6 + tg * 0.4);
                b = Math.min(255, b * 0.6 + tb * 0.4);
            }

            // Adjust Contrast: (pixel_val - 128) * contrastMultiplier + 128
            r = (r - 128) * contrastMultiplier + 128;
            g = (g - 128) * contrastMultiplier + 128;
            b = (b - 128) * contrastMultiplier + 128;

            // Adjust Brightness
            r = r * brightnessMultiplier;
            g = g * brightnessMultiplier;
            b = b * brightnessMultiplier;

            // Constrain between 0 and 255
            data[i] = Math.max(0, Math.min(255, r));
            data[i+1] = Math.max(0, Math.min(255, g));
            data[i+2] = Math.max(0, Math.min(255, b));
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Trigger image re-render on adjustment changes
    if (filterBrightnessSlider) {
        filterBrightnessSlider.addEventListener('input', renderFilteredImage);
    }
    if (filterContrastSlider) {
        filterContrastSlider.addEventListener('input', renderFilteredImage);
    }

    // Click presets
    filterPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterPresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilterPreset = btn.dataset.filterPreset;
            renderFilteredImage();
        });
    });

    // Reset / change photo
    if (btnResetFilter) {
        btnResetFilter.addEventListener('click', () => {
            originalFilterImage = null;
            currentFilterPreset = 'none';
            filterPresetBtns.forEach(b => b.classList.remove('active'));
            filterPresetBtns[0].classList.add('active');
            filterBrightnessSlider.value = 100;
            filterContrastSlider.value = 100;
            filterFileInput.value = '';
            filterCanvas.classList.add('hidden');
            filterUploadZone.classList.remove('hidden');
            btnDownloadFilter.disabled = true;
        });
    }

    // Download photo
    if (btnDownloadFilter) {
        btnDownloadFilter.addEventListener('click', () => {
            if (filterCanvas && originalFilterImage) {
                downloadImage(filterCanvas.toDataURL('image/jpeg', 0.9));
            }
        });
    }

    // === 3. LOGIKA INTERAKTIF ALAT BLUR LATAR BELAKANG ===
    const blurUploadZone = document.getElementById('blur-upload-zone');
    const blurFileInput = document.getElementById('blur-file-input');
    const blurCanvas = document.getElementById('blur-canvas');
    const btnDownloadBlur = document.getElementById('btn-download-blur');
    const btnResetBlur = document.getElementById('btn-reset-blur');
    const blurSlider = document.getElementById('blur-slider');

    let originalBlurImage = null;

    if (blurUploadZone) {
        blurUploadZone.addEventListener('click', () => blurFileInput.click());
        blurFileInput.addEventListener('change', (e) => handleBlurFileSelect(e.target.files[0]));
        
        blurUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            blurUploadZone.style.background = 'rgba(255, 255, 255, 0.5)';
            blurUploadZone.style.borderStyle = 'solid';
        });
        blurUploadZone.addEventListener('dragleave', () => {
            blurUploadZone.style.background = '';
            blurUploadZone.style.borderStyle = '';
        });
        blurUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            blurUploadZone.style.background = '';
            blurUploadZone.style.borderStyle = '';
            if (e.dataTransfer.files[0]) {
                handleBlurFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    function handleBlurFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Silakan pilih file gambar yang valid.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                originalBlurImage = img;
                renderBlurredImage();
                blurUploadZone.classList.add('hidden');
                blurCanvas.classList.remove('hidden');
                btnDownloadBlur.disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function renderBlurredImage() {
        if (!originalBlurImage || !blurCanvas) return;
        const ctx = blurCanvas.getContext('2d');
        
        blurCanvas.width = originalBlurImage.naturalWidth;
        blurCanvas.height = originalBlurImage.naturalHeight;
        
        const blurRadius = blurSlider.value;
        
        ctx.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
        
        // Draw the image with a native canvas blur filter
        if (blurRadius > 0) {
            ctx.filter = `blur(${blurRadius}px)`;
        } else {
            ctx.filter = 'none';
        }
        
        ctx.drawImage(originalBlurImage, 0, 0);
        ctx.filter = 'none'; // reset filter
    }

    if (blurSlider) {
        blurSlider.addEventListener('input', renderBlurredImage);
    }

    if (btnResetBlur) {
        btnResetBlur.addEventListener('click', () => {
            originalBlurImage = null;
            blurSlider.value = 0;
            blurFileInput.value = '';
            blurCanvas.classList.add('hidden');
            blurUploadZone.classList.remove('hidden');
            btnDownloadBlur.disabled = true;
        });
    }

    if (btnDownloadBlur) {
        btnDownloadBlur.addEventListener('click', () => {
            if (blurCanvas && originalBlurImage) {
                downloadImage(blurCanvas.toDataURL('image/jpeg', 0.9));
            }
        });
    }

    // === 4. LOGIKA INTERAKTIF BLOG & MODAL DETAIL ===
    const blogCards = document.querySelectorAll('.blog-card');
    const blogDetailModal = document.getElementById('blog-detail-modal');
    const blogDetailClose = document.getElementById('blog-detail-close');
    const blogDetailContent = document.getElementById('blog-detail-content');

    const articlesData = {
        "1": {
            title: "5 Tips Pose Foto Menarik di Sesi Photobooth",
            author: "Admin Fotografi",
            date: "25 Mei 2026",
            tag: "Tips Foto",
            image: "assets/images/blog_tips.png",
            content: `
                <p>Mengambil foto di bilik photobooth (photostrip) seringkali membuat kita bingung untuk bergaya secara spontan karena keterbatasan waktu antar hitungan mundur. Agar foto photostrip kamu bersama teman-teman tidak kaku dan terlihat menarik, berikut adalah 5 tips pose foto kreatif yang bisa kamu coba:</p>
                <br>
                <h4>1. Pose Estafet Cerita (Sequential Pose)</h4>
                <p>Karena photostrip memuat 3-4 foto secara vertikal, buatlah foto kamu memiliki urutan cerita. Misalnya, foto pertama bertingkah heran, foto kedua kaget, dan foto ketiga tertawa bersama. Pose berurutan seperti ini memberikan efek komik strip yang seru.</p>
                <br>
                <h4>2. Efek Kedekatan Ekstrem (Extreme Close-Up)</h4>
                <p>Jangan takut untuk maju mendekati lensa kamera! Mintalah teman-temanmu untuk berhimpitan dan memperlihatkan ekspresi mata yang jenaka atau senyuman lebar. Pose ini menonjolkan kedekatan emosional dan terlihat sangat alami.</p>
                <br>
                <h4>3. Pose Saling Berinteraksi (Candid Interaction)</h4>
                <p>Daripada semua orang menatap lurus ke kamera, cobalah untuk saling berinteraksi. Saling mencubit pipi secara halus, berbisik jenaka, atau menatap satu sama lain dengan tertawa lepas akan menghasilkan tangkapan candid yang manis.</p>
                <br>
                <h4>4. Gunakan Aksesori secara Maksimal</h4>
                <p>Gunakan kacamata unik, bando lucu, atau properti lain yang disediakan. Jangan hanya mengenakannya secara formal, tetapi jadikan itu bagian dari pose Anda—misalnya, sedikit menurunkan kacamata dan menatap jahil ke kamera.</p>
                <br>
                <h4>5. Klasik "Hear No Evil, See No Evil, Speak No Evil"</h4>
                <p>Gaya klasik bertiga ini tidak pernah gagal. Mintalah orang pertama menutup telinga, orang kedua menutup mata, dan orang ketiga menutup mulut. Pose retro ini sangat cocok untuk format photostrip 3 frame.</p>
            `
        },
        "2": {
            title: "Seni Menggunakan Filter Warna pada Foto Vintage",
            author: "Rifqi Rahman (Creative Editor)",
            date: "24 Mei 2026",
            tag: "Edit Foto",
            image: "assets/images/blog_filter.png",
            content: `
                <p>Warna memiliki kekuatan luar biasa untuk menentukan suasana hati (mood) dan emosi dari sebuah gambar. Dalam dunia edit foto modern, efek vintage tetap menjadi salah satu filter yang paling dicari karena mampu memberikan kesan nostalgia, klasik, dan hangat. Mari kita pelajari bagaimana filter warna klasik bekerja:</p>
                <br>
                <h4>Mengapa Vintage Terasa Begitu Spesial?</h4>
                <p>Secara psikologis, nuansa vintage membawa ingatan kita kembali ke era analog—waktu di mana setiap cetakan foto dihargai karena prosesnya yang lambat. Filter vintage biasanya menurunkan saturasi warna-warna modern yang terlalu mencolok dan menggantinya dengan temperatur warna yang hangat.</p>
                <br>
                <h4>Mengenal Filter Sepia</h4>
                <p>Filter Sepia memberikan tone kecokelatan yang hangat pada foto. Tone ini berasal dari zat kimia melanin siput (sepia) yang digunakan pada fotografi abad ke-19 untuk membuat cetakan foto lebih awet. Menggunakan filter sepia hari ini sangat cocok untuk foto arsitektur lama, potret wajah bertekstur, atau objek kayu.</p>
                <br>
                <h4>Kekuatan Hitam & Putih (Grayscale)</h4>
                <p>Dengan menghilangkan warna sepenuhnya, grayscale memaksa mata kita untuk fokus pada komposisi, bentuk, kontras pencahayaan, dan ekspresi subjek. Grayscale sangat ideal untuk foto dramatis, ekspresi wajah mendalam, dan seni jalanan (street photography).</p>
                <br>
                <h4>Menggabungkan Kontras dan Kecerahan</h4>
                <p>Untuk mendapatkan efek vintage yang sempurna, menurunkan kontras sedikit dan meningkatkan kecerahan di area bayangan (shadow) akan memberikan efek "faded" atau pudar layaknya kertas foto tua. Gunakan editor Filter Foto Online kami untuk bereksperimen langsung dengan gambar favorit Anda!</p>
            `
        },
        "3": {
            title: "Mengenal Photobooth Modern & Integrasinya dengan Canva",
            author: "Tim Developer",
            date: "20 Mei 2026",
            tag: "Tren",
            image: "assets/images/blog_photobooth.png",
            content: `
                <p>Photobooth pertama kali diperkenalkan di New York pada tahun 1925 oleh Anatol Josepho. Bilik foto otomatis ini langsung menjadi sensasi global karena orang-orang bisa mendapatkan potret diri secara privat hanya dalam beberapa menit. Hari ini, teknologi photobooth telah berevolusi jauh melampaui bilik kayu tradisional.</p>
                <br>
                <h4>Era Photobooth Digital</h4>
                <p>Dengan kehadiran kamera resolusi tinggi dan komputer mini, photobooth kini bisa ditempatkan di mana saja dengan bentuk ringkas. Namun, inovasi terbesar saat ini terletak pada integrasi perangkat lunak dan komputasi awan (cloud).</p>
                <br>
                <h4>Integrasi Canggih dengan Canva</h4>
                <p>Salah satu hambatan utama photobooth tradisional adalah terbatasnya pilihan template frame yang membosankan. Melalui integrasi API Canva, mesin photobooth modern kini dapat langsung memuat desain frame kustom buatan kreator secara real-time. Pengguna bahkan dapat merancang frame mereka sendiri di Canva dan langsung menerapkannya pada sesi foto.</p>
                <br>
                <h4>Kemudahan Pengiriman Instan</h4>
                <p>Tidak hanya dicetak secara fisik, cetakan digital photostrip kini dapat langsung dikirim ke email pengguna menggunakan integrasi API pengirim pesan cepat (seperti EmailJS). Hal ini memudahkan pengguna untuk membagikan momen bahagia mereka langsung ke media sosial dalam kualitas HD.</p>
            `
        }
    };

    blogCards.forEach(card => {
        card.addEventListener('click', () => {
            const articleId = card.dataset.article;
            const article = articlesData[articleId];
            if (article) {
                blogDetailContent.innerHTML = `
                    <div style="text-align: left;">
                        <span class="blog-tag">${article.tag}</span>
                        <h1 style="font-size: 2.2rem; font-weight: 800; margin: 10px 0 15px 0; line-height:1.25;">${article.title}</h1>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 25px; display:flex; gap:15px;">
                            <span>✍️ Oleh: <strong>${article.author}</strong></span>
                            <span>📅 ${article.date}</span>
                        </div>
                        <div style="width:100%; border-radius:16px; overflow:hidden; margin-bottom:30px; box-shadow: var(--glass-shadow); border: 1px solid var(--panel-border);">
                            <img src="${article.image}" alt="${article.title}" style="width:100%; display:block;">
                        </div>
                        <div class="blog-article-body-text" style="line-height: 1.8; font-size: 1rem; color: var(--text-main);">
                            ${article.content}
                        </div>
                    </div>
                `;
                blogDetailModal.classList.add('active');
            }
        });
    });

    if (blogDetailClose) {
        blogDetailClose.addEventListener('click', () => {
            blogDetailModal.classList.remove('active');
        });
    }

    // Auto-routing if user just logged in from Canva OAuth
    const isLoggedInInit = document.body.getAttribute('data-logged-in') === 'true';
    const cameFromCallback = document.referrer.indexOf('callback.php') !== -1 || window.location.search.indexOf('code=') !== -1;
    if (isLoggedInInit && cameFromCallback) {
        showScreen('templates');
    }
});
