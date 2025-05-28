class GenderDetector {
    constructor() {
        this.video = document.getElementById('input_video');
        this.canvas = document.getElementById('output_canvas');
        this.ctx = this.canvas.getContext('2d');
        this.loading = document.getElementById('loading');
        
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        
        this.detectionInfo = document.getElementById('detection-info');
        
        this.isRunning = false;
        this.detectedFaces = 0;
        
        this.initializeEventListeners();
        this.loadModels();
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
    }
    
    async loadModels() {
        try {
            this.showLoading(true);
            this.updateStatus('Loading AI models...');
            
            // Load face-api.js models from CDN
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/';
            
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
            ]);
            
            this.showLoading(false);
            this.updateStatus('Models loaded successfully! Click "Start Camera" to begin.');
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.updateStatus('Error loading AI models. Please refresh and try again.');
            this.showLoading(false);
        }
    }
    
    showLoading(show) {
        this.loading.classList.toggle('show', show);
    }
    
    async startCamera() {
        try {
            this.showLoading(true);
            this.updateStatus('Starting camera...');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });
            
            this.video.srcObject = stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            // Set canvas dimensions to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.showLoading(false);
            this.updateStatus('Camera started! Looking for faces...');
            
            // Start face detection loop
            this.detectFaces();
            
        } catch (error) {
            console.error('Error starting camera:', error);
            this.updateStatus('Error accessing camera. Please allow camera permissions and try again.');
            this.showLoading(false);
        }
    }
    
    stopCamera() {
        this.isRunning = false;
        
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.updateStatus('Camera stopped. Click "Start Camera" to begin again.');
    }
    
    async detectFaces() {
        if (!this.isRunning) return;
        
        try {
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw video frame (mirrored)
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Detect faces with age and gender
            const detections = await faceapi
                .detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withAgeAndGender();
            
            if (detections.length > 0) {
                this.detectedFaces = detections.length;
                this.processFaceDetections(detections);
            } else {
                this.detectedFaces = 0;
                this.updateDetectionInfo('No faces detected');
            }
            
        } catch (error) {
            console.error('Detection error:', error);
        }
        
        // Continue detection loop
        requestAnimationFrame(() => this.detectFaces());
    }
    
    processFaceDetections(detections) {
        let detectionResults = [];
        
        detections.forEach((detection) => {
            const { x, y, width, height } = detection.detection.box;
            
            // Adjust coordinates for the horizontally flipped canvas
            // Since the canvas is flipped with transform: scaleX(-1)
            const flippedX = this.canvas.width - x - width;
            
            // Draw filled background for bounding box (semi-transparent)
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            this.ctx.fillRect(flippedX, y, width, height);
            
            // Draw bounding box border
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(flippedX, y, width, height);
            
            // Get gender result
            const gender = detection.gender;
            const genderConfidence = detection.genderProbability;
            
            detectionResults.push({
                gender: gender,
                confidence: genderConfidence
            });
        });
        
        this.updateDetectionInfo(detectionResults);
    }
    
    updateDetectionInfo(results) {
        if (typeof results === 'string') {
            this.detectionInfo.innerHTML = `<p class="status">${results}</p>`;
            return;
        }
        
        let html = '';
        results.forEach((result, index) => {
            const genderClass = result.gender === 'male' ? 'male' : 'female';
            html += `
                <div class="detection-result ${genderClass}">
                    ${result.gender.toUpperCase()}
                </div>
            `;
        });
        
        this.detectionInfo.innerHTML = html;
    }
    
    updateStatus(message) {
        this.detectionInfo.innerHTML = `<p class="status">${message}</p>`;
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
    }
    
    // Initialize the gender detector
    const detector = new GenderDetector();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden - consider pausing detection');
    } else {
        console.log('Page visible - resuming detection');
    }
});

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
}); 