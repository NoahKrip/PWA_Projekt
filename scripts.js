const operatingSystemDisplay = document.getElementById('operatingSystem');
const captureBtn = document.getElementById('captureBtn');
const scanBarcodeBtn = document.getElementById('scanBarcodeBtn');
const refreshLocationBtn = document.getElementById('refreshLocationBtn');
const switchButton = document.getElementById('switchButton');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const textArea = document.getElementById('textArea');
const resultElement = document.getElementById('result');
const userAgent = navigator.userAgent;
const os = getOS(userAgent);
let currentStream;
let codeReader;

operatingSystemDisplay.textContent = 'Operating System: ' + os;

// Start Video Funktion
function startVideo(stream) {
    video.srcObject = stream;
    currentStream = stream;
}

// Switch Camera Funktion
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function showButtonOnMobile(buttonId) {
    const button = document.getElementById(buttonId);
    if (isMobileDevice()) {
        button.style.display = 'block';
    } else {
        button.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showButtonOnMobile('switchButton');
    scanBarcode();
    setupEventListeners();
    initializeCamera();
});

async function initializeCamera() {
    const constraints = {
        audio: false,
        video: {
            facingMode: video.getAttribute('facing-mode') || 'environment'
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        startVideo(stream);
    } catch (err) {
        console.error('Error accessing camera:', err);
    }
}

switchButton.addEventListener('click', async () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    const facingMode = video.getAttribute('facing-mode') === 'user' ? 'environment' : 'user';
    video.setAttribute('facing-mode', facingMode);
    await initializeCamera();
});

// Setup Event Listeners Funktion
function setupEventListeners() {
    captureBtn.addEventListener('click', () => {
        playBeepAndVibrate();
        captureImageForOCR();
    });

    scanBarcodeBtn.addEventListener('click', () => {
        playBeepAndVibrate();
        scanBarcode();
    });

    refreshLocationBtn.addEventListener('click', () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(fetchAndDisplayAddress, showError);
        } else {
            document.getElementById('locationDisplay').textContent = 'Geolocation nicht unterstützt.';
        }
    });
}

function getOS(userAgent) {
    if (userAgent.match(/Android/i)) return 'Android';
    if (userAgent.match(/iPhone|iPad|iPod/i)) return 'iOS';
    if (userAgent.match(/Windows/i)) return 'Windows';
    if (userAgent.match(/Macintosh|Mac OS X/i)) return 'Mac OS';
    if (userAgent.match(/Linux/i)) return 'Linux';
    return 'Unbekannt';
}

// Texterkennung
function captureImageForOCR() {
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Rauschentfernung
    const noiseRemovedData = removeNoise(imageData);

    // Binarisierung
    const binarizedData = binarizeImage(noiseRemovedData);
    context.putImageData(binarizedData, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/png');

    if ('vibrate' in navigator) {
        navigator.vibrate([200]); // Vibration auslösen
    }
    canvas.style.backgroundColor = '#ffcc00'; // Hintergrundfarbe ändern, um Erfolg anzuzeigen

    Tesseract.recognize(
        imageDataUrl,
        'deu',
        {
            logger: m => console.log(m)
        }
    ).then(({ data: { text } }) => {
        textArea.value = text; // Erkannten Text anzeigen
        canvas.style.backgroundColor = ''; // Hintergrundfarbe zurücksetzen

        // Ändere die Hintergrundfarbe des Videos für 1 Sekunde
        video.style.backgroundColor = 'lightgreen';
        setTimeout(() => {
            video.style.backgroundColor = '';
        }, 1000);

        const beepSound = document.getElementById('beepSound');
        beepSound.play(); // Beep-Sound abspielen
    });
}

function scanBarcode() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#video'),  
            constraints: {
                facingMode: "environment" 
            },
        },
        decoder: {
            readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "codabar_reader", "upc_reader"]
        },
    }, function(err) {
        if (err) {
            console.log(err);
            return;
        }
        console.log("QuaggaJS initialisiert.");
        Quagga.start();
    });

    Quagga.onProcessed(function(result) {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
                result.boxes.filter(function(box) {
                    return box !== result.box;
                }).forEach(function(box) {
                    Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
                        color: "green",
                        lineWidth: 2
                    });
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
                    color: "#00F",
                    lineWidth: 2
                });
            }

            if (result.codeResult && result.codeResult.code) {
                resultElement.innerText = `Barcode: ${result.codeResult.code}`;
            }
        }
    });

    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        console.log(`Barcode erkannt: ${code}`);
        resultElement.innerText = `Erkannter Barcode: ${code}`;
    });
}

// Funktion zum Abspielen von Ton und Vibration
function playBeepAndVibrate() {
    const beepSound = document.getElementById('beepSound');
    beepSound.play();

    if ('vibrate' in navigator) {
        navigator.vibrate([200]);
    }
}

// Geolocation
function fetchAndDisplayAddress(position) {
    const { latitude, longitude } = position.coords;
    const apiKey = 'b526254236ad47a1aebff6e137ad1790';
    const apiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`;
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const address = data.results.length > 0 ? data.results[0].formatted : 'Keine Adresse gefunden.';
            document.getElementById('locationDisplay').textContent = 'Adresse: ' + address;
        })
        .catch(() => {
            document.getElementById('locationDisplay').textContent = 'Adressabruf fehlgeschlagen.';
        });
}

function showError(error) {
    document.getElementById('locationDisplay').textContent = 'Fehler: ' + error.message;
}

navigator.mediaDevices.getUserMedia({ video: true })
    .then(startVideo)
    .catch(err => console.error("Failed to get video stream:", err));

// Funktion zur Berechnung der DPI eines Bildes
function calculateDPI(width, height) {
    const screenWidthInches = window.screen.width / window.devicePixelRatio;
    const screenHeightInches = window.screen.height / window.devicePixelRatio;
    const diagonalInches = Math.sqrt(Math.pow(screenWidthInches, 2) + Math.pow(screenHeightInches, 2));
    return Math.max(width, height) / diagonalInches;
}

// Funktion zum Skalieren eines Bildes auf 300 DPI
function scaleImageTo300DPI(width, height) {
    const scaledWidth = (width / calculateDPI(width, height)) * 300;
    const scaledHeight = (height / calculateDPI(width, height)) * 300;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    tempCanvas.getContext('2d').drawImage(video, 0, 0, scaledWidth, scaledHeight);
    return tempCanvas;
}

// Funktion zur Binarisierung eines Bildes
function binarizeImage(imageData) {
    const threshold = 127; // Schwellenwert für die Binarisierung
    const binaryData = new Uint8ClampedArray(imageData.data.length);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const grayValue = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
        const binaryValue = grayValue > threshold ? 255 : 0;
        binaryData[i] = binaryData[i + 1] = binaryData[i + 2] = binaryValue;
        binaryData[i + 3] = 255; // Alpha-Wert beibehalten
    }
    return new ImageData(binaryData, imageData.width, imageData.height);
}

// Funktion zur Rauschentfernung eines Bildes (Median-Filter)
function removeNoise(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;
    const output = new Uint8ClampedArray(pixels.length);

    function getPixel(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return [255, 255, 255]; 
        }
        const index = (y * width + x) * 4;
        return [pixels[index], pixels[index + 1], pixels[index + 2]];
    }

    function median(values) {
        values.sort((a, b) => a - b);
        const middle = Math.floor(values.length / 2);
        return values.length % 2 !== 0 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const neighbors = [];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    neighbors.push(getPixel(x + dx, y + dy));
                }
            }
            const reds = neighbors.map(p => p[0]);
            const greens = neighbors.map(p => p[1]);
            const blues = neighbors.map(p => p[2]);

            const index = (y * width + x) * 4;
            output[index] = median(reds);
            output[index + 1] = median(greens);
            output[index + 2] = median(blues);
            output[index + 3] = pixels[index + 3]; 
        }
    }

    return new ImageData(output, width, height);
}

// Zoom-Funktionalität
let zoomLevel = 1;

function setZoom(level) {
    if (currentStream) {
        const track = currentStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.zoom) {
            zoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max);
            track.applyConstraints({ advanced: [{ zoom: zoomLevel }] });
        } else {
            console.log('Zoom wird von dieser Kamera nicht unterstützt.');
        }
    }
}

// Setup Event Listeners für die Zoom-Buttons
document.getElementById('zoomInBtn').addEventListener('click', () => {
    setZoom(zoomLevel + 0.2);
});

document.getElementById('zoomOutBtn').addEventListener('click', () => {
    setZoom(zoomLevel - 0.2);
});
