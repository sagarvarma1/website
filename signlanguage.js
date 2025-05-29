class SignLanguageDetector {
    constructor() {
        this.video = document.getElementById('input_video');
        this.canvas = document.getElementById('output_canvas');
        this.ctx = this.canvas.getContext('2d');
        this.loading = document.getElementById('loading');
        
        // Create a hidden canvas for MediaPipe processing (unflipped)
        this.processingCanvas = document.createElement('canvas');
        this.processingCtx = this.processingCanvas.getContext('2d');
        
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        
        this.handCountInfo = document.getElementById('hand-count');
        this.gestureInfo = document.getElementById('gesture-info');
        this.landmarkInfo = document.getElementById('landmark-info');
        
        this.isRunning = false;
        this.hands = null;
        this.camera = null;
        this.detectedHands = [];
        this.currentGestures = [];
        this.animationId = null;
        
        // Advanced tracking for accuracy
        this.gestureHistory = []; // Track last N gestures for temporal smoothing
        this.handHistory = []; // Track hand positions over time
        this.confidenceThreshold = 0.7; // Minimum confidence for gesture recognition
        this.stabilityFrames = 5; // Frames required for stable gesture
        this.maxHistoryLength = 10; // Maximum frames to keep in history
        this.lastStableGesture = null;
        this.stableGestureCount = 0;
        this.frameCount = 0;
        this.startTime = Date.now(); // Track start time for FPS calculation
        this.handMetrics = new Map(); // Track hand size and distance metrics
        
        this.initializeEventListeners();
        this.initializeMediaPipe();
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
    }
    
    // Simple video drawing loop without MediaPipe initially
    drawVideoLoop() {
        if (!this.isRunning) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw video frame (flipped)
        if (this.video.readyState >= 2) {
            this.ctx.save();
            this.ctx.scale(-1, 1);
            this.ctx.translate(-this.canvas.width, 0);
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
        
        // Continue the loop
        this.animationId = requestAnimationFrame(() => this.drawVideoLoop());
    }
    
    async initializeMediaPipe() {
        try {
            this.showLoading(true);
            this.updateHandCount('Loading AI models...');
            
            // Wait for MediaPipe libraries to load
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                if (typeof checkMediaPipeLoaded !== 'undefined' && checkMediaPipeLoaded()) {
                    console.log('All MediaPipe components loaded successfully');
                    break;
                } else if (typeof Hands !== 'undefined') {
                    console.log('Basic MediaPipe Hands loaded');
                    break;
                }
                
                console.log(`Waiting for MediaPipe... attempt ${attempts + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }
            
            // Check if MediaPipe Hands is available
            if (typeof Hands === 'undefined') {
                console.warn('MediaPipe Hands library not loaded after waiting, running in basic mode');
                this.showLoading(false);
                this.updateHandCount('Basic mode - Click "Start Camera" to begin (MediaPipe not available)');
                return;
            }
            
            console.log('Initializing MediaPipe Hands...');
            
            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });
            
            // Wait a moment for initialization
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            this.hands.onResults((results) => this.onResults(results));
            
            this.showLoading(false);
            this.updateHandCount('AI models loaded! Click "Start Camera" to begin ASL detection.');
            console.log('MediaPipe Hands initialized successfully with ASL recognition');
            
        } catch (error) {
            console.error('Error loading models:', error);
            this.updateHandCount('Running in basic mode - Click "Start Camera" to begin');
            this.showLoading(false);
            this.hands = null;
        }
    }
    
    showLoading(show) {
        this.loading.classList.toggle('show', show);
    }
    
    async startCamera() {
        try {
            this.showLoading(true);
            this.updateHandCount('Starting camera...');
            
            // Get user media directly
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });
            
            // Set video source
            this.video.srcObject = stream;
            
            // Wait for video to load
            await new Promise((resolve) => {
                this.video.addEventListener('loadedmetadata', resolve, { once: true });
            });
            
            // Set canvas dimensions to match video
            this.canvas.width = this.video.videoWidth || 1280;
            this.canvas.height = this.video.videoHeight || 720;
            
            // Set processing canvas dimensions (for MediaPipe)
            this.processingCanvas.width = this.video.videoWidth || 1280;
            this.processingCanvas.height = this.video.videoHeight || 720;
            
            console.log('Canvas dimensions set to:', this.canvas.width, 'x', this.canvas.height);
            console.log('Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
            
            // Start video processing
            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.showLoading(false);
            
            if (this.hands) {
                // Use MediaPipe if available
                this.camera = new Camera(this.video, {
                    onFrame: async () => {
                        if (this.isRunning && this.video.readyState >= 2 && this.hands) {
                            try {
                                // Draw unflipped video to processing canvas for MediaPipe
                                this.processingCtx.clearRect(0, 0, this.processingCanvas.width, this.processingCanvas.height);
                                this.processingCtx.drawImage(this.video, 0, 0, this.processingCanvas.width, this.processingCanvas.height);
                                
                                // Send the unflipped image to MediaPipe
                                await this.hands.send({ image: this.processingCanvas });
                            } catch (error) {
                                console.error('Error sending frame to MediaPipe:', error);
                            }
                        }
                    },
                    width: this.video.videoWidth || 1280,
                    height: this.video.videoHeight || 720
                });
                
                await this.camera.start();
                this.updateHandCount('Camera started with AI detection! Show your hands to the camera...');
            } else {
                // Fallback to basic video display
                this.drawVideoLoop();
                this.updateHandCount('Camera started in basic mode! Video should be visible now.');
            }
            
        } catch (error) {
            console.error('Error starting camera:', error);
            this.updateHandCount('Error accessing camera. Please allow camera permissions and try again.');
            this.showLoading(false);
        }
    }
    
    stopCamera() {
        this.isRunning = false;
        
        // Stop animation frame if running
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        
        // Stop video stream tracks
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.updateHandCount('Camera stopped. Click "Start Camera" to begin again.');
        this.updateGestureInfo('No gestures detected');
        this.updateLandmarkInfo('No hands detected');
    }
    
    onResults(results) {
        if (!this.isRunning) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Debug: Check if video and results.image are available
        console.log('Video ready state:', this.video.readyState);
        console.log('Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
        console.log('Results image available:', !!results.image);
        
        // Draw the video frame (flipped for natural mirror view)
        this.ctx.save();
        this.ctx.scale(-1, 1);
        this.ctx.translate(-this.canvas.width, 0);
        
        try {
            if (results.image) {
                this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
            } else if (this.video.readyState >= 2) {
                // Fallback to using video element directly
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            }
        } catch (error) {
            console.error('Error drawing video frame:', error);
            // Try drawing the video element directly as a fallback
            try {
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            } catch (fallbackError) {
                console.error('Fallback video drawing also failed:', fallbackError);
            }
        }
        
        this.ctx.restore();
        
        this.detectedHands = results.multiHandLandmarks || [];
        
        if (this.detectedHands.length > 0) {
            this.processHandDetections(results);
        } else {
            this.updateHandCount('No hands detected');
            this.updateGestureInfo('No gestures detected');
            this.updateLandmarkInfo('No hands detected');
        }
    }
    
    processHandDetections(results) {
        const handedness = results.multiHandedness || [];
        this.frameCount++;
        
        // Update hand count
        this.updateHandCount(`${this.detectedHands.length} hand(s) detected`);
        
        // Process each detected hand with advanced analysis
        const currentFrameGestures = [];
        
        this.detectedHands.forEach((landmarks, index) => {
            // Fix handedness for mirror view
            let handLabel = 'Unknown';
            if (handedness[index]) {
                const originalLabel = handedness[index].label;
                handLabel = originalLabel === 'Left' ? 'Right' : 'Left';
            }
            
            // Calculate hand metrics for adaptive thresholds
            const handMetrics = this.calculateHandMetrics(landmarks);
            this.handMetrics.set(index, handMetrics);
            
            // Draw hand landmarks and connections
            this.drawHandLandmarks(landmarks, handLabel);
            
            // Advanced gesture recognition with multiple validation layers
            const gestureResult = this.advancedGestureRecognition(landmarks, handMetrics, handLabel);
            
            if (gestureResult && gestureResult.confidence >= this.confidenceThreshold) {
                currentFrameGestures.push({
                    hand: handLabel,
                    gesture: gestureResult.gesture,
                    confidence: gestureResult.confidence,
                    timestamp: Date.now(),
                    landmarks: landmarks
                });
            }
        });
        
        // Update gesture history
        this.gestureHistory.push({
            frame: this.frameCount,
            gestures: currentFrameGestures,
            timestamp: Date.now()
        });
        
        // Maintain history size
        if (this.gestureHistory.length > this.maxHistoryLength) {
            this.gestureHistory.shift();
        }
        
        // Apply temporal smoothing and stability analysis
        const stableGestures = this.analyzeGestureStability();
        
        // Update display with stable gestures
        if (stableGestures.length > 0) {
            const gestureStrings = stableGestures.map(g => 
                `${g.hand}: ${g.gesture} (${(g.confidence * 100).toFixed(1)}%)`
            );
            this.updateGestureInfo(gestureStrings.join('<br>'));
        } else {
            this.updateGestureInfo('No stable gestures detected');
        }
        
        // Update landmark info with enhanced details
        this.updateAdvancedLandmarkInfo(this.detectedHands);
    }
    
    drawHandLandmarks(landmarks, handLabel) {
        // Draw connections between landmarks
        const connections = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle finger
            [0, 9], [9, 10], [10, 11], [11, 12],
            // Ring finger
            [0, 13], [13, 14], [14, 15], [15, 16],
            // Pinky
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm connections
            [5, 9], [9, 13], [13, 17]
        ];
        
        // Draw connections
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            this.ctx.beginPath();
            // Flip x-coordinates for display (since we're showing mirrored view)
            this.ctx.moveTo(
                (1 - startPoint.x) * this.canvas.width,
                startPoint.y * this.canvas.height
            );
            this.ctx.lineTo(
                (1 - endPoint.x) * this.canvas.width,
                endPoint.y * this.canvas.height
            );
            this.ctx.stroke();
        });
        
        // Draw landmarks
        landmarks.forEach((landmark, index) => {
            // Flip x-coordinate for display
            const x = (1 - landmark.x) * this.canvas.width;
            const y = landmark.y * this.canvas.height;
            
            // Different colors for different parts of the hand
            let color = '#ff0000';
            if (index >= 1 && index <= 4) color = '#ff8800'; // Thumb
            else if (index >= 5 && index <= 8) color = '#ffff00'; // Index
            else if (index >= 9 && index <= 12) color = '#00ff00'; // Middle
            else if (index >= 13 && index <= 16) color = '#0088ff'; // Ring
            else if (index >= 17 && index <= 20) color = '#8800ff'; // Pinky
            
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, index === 0 ? 8 : 5, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Draw landmark numbers for key points
            if (index % 4 === 0 || index === 0) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = '12px Arial';
                this.ctx.fillText(index.toString(), x + 10, y - 10);
            }
        });
        
        // Draw hand label
        const wrist = landmarks[0];
        // Flip x-coordinate for display
        const labelX = (1 - wrist.x) * this.canvas.width;
        const labelY = wrist.y * this.canvas.height - 30;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(labelX - 30, labelY - 20, 60, 25);
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(handLabel, labelX, labelY - 5);
        this.ctx.textAlign = 'start';
    }
    
    recognizeGesture(landmarks) {
        // ASL gesture recognition based on finger positions and hand shape
        const fingerTips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky tips
        const fingerPIPs = [3, 6, 10, 14, 18]; // Proximal interphalangeal joints
        const fingerMCPs = [2, 5, 9, 13, 17]; // Metacarpophalangeal joints
        
        // Calculate which fingers are extended
        const extendedFingers = this.getExtendedFingers(landmarks);
        const fingerPositions = this.getFingerPositions(landmarks);
        
        // ASL Letter Recognition
        const aslGesture = this.recognizeASLLetter(landmarks, extendedFingers, fingerPositions);
        if (aslGesture) return aslGesture;
        
        // Basic gesture recognition (fallback)
        return this.recognizeBasicGesture(extendedFingers);
    }
    
    getExtendedFingers(landmarks) {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerPIPs = [3, 6, 10, 14, 18];
        const extendedFingers = [];
        
        // Thumb (special case - check x-axis distance from palm)
        const thumbTip = landmarks[4];
        const thumbMCP = landmarks[2];
        const wrist = landmarks[0];
        const thumbDistance = Math.abs(thumbTip.x - wrist.x);
        if (thumbDistance > 0.08) {
            extendedFingers.push(0);
        }
        
        // Other fingers (check if tip is above PIP joint)
        for (let i = 1; i < 5; i++) {
            const tip = landmarks[fingerTips[i]];
            const pip = landmarks[fingerPIPs[i]];
            if (tip.y < pip.y - 0.03) {
                extendedFingers.push(i);
            }
        }
        
        return extendedFingers;
    }
    
    getFingerPositions(landmarks) {
        return {
            thumb: landmarks[4],
            index: landmarks[8],
            middle: landmarks[12],
            ring: landmarks[16],
            pinky: landmarks[20],
            wrist: landmarks[0],
            palm: landmarks[9] // Middle finger MCP as palm center
        };
    }
    
    recognizeASLLetter(landmarks, extendedFingers, pos) {
        const numExtended = extendedFingers.length;
        
        // Letter A: Closed fist with thumb on side
        if (numExtended === 0 || (numExtended === 1 && extendedFingers.includes(0))) {
            const thumbPos = pos.thumb;
            const indexMCP = landmarks[5];
            if (Math.abs(thumbPos.y - indexMCP.y) < 0.05) {
                return 'ASL: A';
            }
        }
        
        // Letter B: All fingers extended straight up, thumb folded
        if (numExtended === 4 && !extendedFingers.includes(0)) {
            const fingersAligned = this.areFingersAligned(landmarks, [8, 12, 16, 20]);
            if (fingersAligned) {
                return 'ASL: B';
            }
        }
        
        // Letter C: Curved hand like holding a cup
        if (numExtended === 0) {
            const curvature = this.getHandCurvature(landmarks);
            if (curvature > 0.3) {
                return 'ASL: C';
            }
        }
        
        // Letter D: Index finger up, thumb and index form circle, other fingers down
        if (numExtended === 1 && extendedFingers.includes(1)) {
            const thumbToIndex = this.getDistance(pos.thumb, pos.index);
            if (thumbToIndex < 0.05) {
                return 'ASL: D';
            }
        }
        
        // Letter E: All fingertips touching thumb (closed fist variation)
        if (numExtended === 0) {
            const fingertipsToThumb = this.getFingertipsToThumbDistance(landmarks);
            if (fingertipsToThumb < 0.06) {
                return 'ASL: E';
            }
        }
        
        // Letter F: Index and thumb form circle, other fingers extended
        if (numExtended === 3 && extendedFingers.includes(2) && extendedFingers.includes(3) && extendedFingers.includes(4)) {
            const thumbToIndex = this.getDistance(pos.thumb, pos.index);
            if (thumbToIndex < 0.05) {
                return 'ASL: F';
            }
        }
        
        // Letter G: Index finger extended horizontally
        if (numExtended === 1 && extendedFingers.includes(1)) {
            const indexAngle = this.getFingerAngle(landmarks, 1);
            if (Math.abs(indexAngle) < 0.3) { // Nearly horizontal
                return 'ASL: G';
            }
        }
        
        // Letter H: Index and middle fingers extended horizontally
        if (numExtended === 2 && extendedFingers.includes(1) && extendedFingers.includes(2)) {
            const indexAngle = this.getFingerAngle(landmarks, 1);
            const middleAngle = this.getFingerAngle(landmarks, 2);
            if (Math.abs(indexAngle) < 0.3 && Math.abs(middleAngle) < 0.3) {
                return 'ASL: H';
            }
        }
        
        // Letter I: Pinky finger extended
        if (numExtended === 1 && extendedFingers.includes(4)) {
            return 'ASL: I';
        }
        
        // Letter J: Pinky extended with motion (we'll detect the static position)
        if (numExtended === 1 && extendedFingers.includes(4)) {
            // This could be I or J, need motion detection for J
            return 'ASL: I/J';
        }
        
        // Letter K: Index and middle up, thumb between them
        if (numExtended === 2 && extendedFingers.includes(1) && extendedFingers.includes(2)) {
            const thumbBetween = this.isThumbBetweenFingers(landmarks, 8, 12);
            if (thumbBetween) {
                return 'ASL: K';
            }
        }
        
        // Letter L: Thumb and index extended, forming L shape
        if (numExtended === 2 && extendedFingers.includes(0) && extendedFingers.includes(1)) {
            const angle = this.getAngleBetweenFingers(landmarks, 4, 8);
            if (angle > 1.2 && angle < 2.0) { // Approximately 90 degrees
                return 'ASL: L';
            }
        }
        
        // Letter M: Thumb under first three fingers
        if (numExtended === 0) {
            const thumbUnderFingers = this.isThumbUnderFingers(landmarks);
            if (thumbUnderFingers) {
                return 'ASL: M';
            }
        }
        
        // Letter N: Thumb under first two fingers
        if (numExtended === 0) {
            const thumbUnderTwo = this.isThumbUnderTwoFingers(landmarks);
            if (thumbUnderTwo) {
                return 'ASL: N';
            }
        }
        
        // Letter O: All fingertips touch thumb forming circle
        if (numExtended === 0) {
            const circleShape = this.isCircleShape(landmarks);
            if (circleShape) {
                return 'ASL: O';
            }
        }
        
        // Letter P: Index and middle down, others extended
        if (numExtended === 3 && extendedFingers.includes(0) && extendedFingers.includes(3) && extendedFingers.includes(4)) {
            return 'ASL: P';
        }
        
        // Letter Q: Thumb and index pointing down
        if (numExtended === 2 && extendedFingers.includes(0) && extendedFingers.includes(1)) {
            const pointingDown = pos.thumb.y > pos.palm.y && pos.index.y > pos.palm.y;
            if (pointingDown) {
                return 'ASL: Q';
            }
        }
        
        // Letter R: Index and middle crossed
        if (numExtended === 2 && extendedFingers.includes(1) && extendedFingers.includes(2)) {
            const fingersCrossed = this.areFingersCrossed(landmarks, 8, 12);
            if (fingersCrossed) {
                return 'ASL: R';
            }
        }
        
        // Letter S: Closed fist with thumb in front
        if (numExtended === 0) {
            const thumbInFront = pos.thumb.z < pos.palm.z - 0.02;
            if (thumbInFront) {
                return 'ASL: S';
            }
        }
        
        // Letter T: Thumb between index and middle
        if (numExtended === 0) {
            const thumbBetween = this.isThumbBetweenFingers(landmarks, 8, 12);
            if (thumbBetween) {
                return 'ASL: T';
            }
        }
        
        // Letter U: Index and middle up together
        if (numExtended === 2 && extendedFingers.includes(1) && extendedFingers.includes(2)) {
            const fingersTogether = Math.abs(pos.index.x - pos.middle.x) < 0.03;
            if (fingersTogether) {
                return 'ASL: U';
            }
        }
        
        // Letter V: Index and middle spread apart
        if (numExtended === 2 && extendedFingers.includes(1) && extendedFingers.includes(2)) {
            const fingersSpread = Math.abs(pos.index.x - pos.middle.x) > 0.05;
            if (fingersSpread) {
                return 'ASL: V';
            }
        }
        
        // Letter W: Index, middle, and ring up
        if (numExtended === 3 && extendedFingers.includes(1) && extendedFingers.includes(2) && extendedFingers.includes(3)) {
            return 'ASL: W';
        }
        
        // Letter X: Index finger bent like hook
        if (numExtended === 1 && extendedFingers.includes(1)) {
            const fingerBent = this.isFingerBent(landmarks, 1);
            if (fingerBent) {
                return 'ASL: X';
            }
        }
        
        // Letter Y: Thumb and pinky extended
        if (numExtended === 2 && extendedFingers.includes(0) && extendedFingers.includes(4)) {
            return 'ASL: Y';
        }
        
        // Letter Z: Index finger making Z motion (static position)
        if (numExtended === 1 && extendedFingers.includes(1)) {
            return 'ASL: Z (motion needed)';
        }
        
        return null;
    }
    
    // Helper functions for gesture analysis
    areFingersAligned(landmarks, fingerIndices) {
        const yPositions = fingerIndices.map(i => landmarks[i].y);
        const avgY = yPositions.reduce((a, b) => a + b) / yPositions.length;
        return yPositions.every(y => Math.abs(y - avgY) < 0.02);
    }
    
    getHandCurvature(landmarks) {
        // Measure curvature by looking at finger bend
        const curvatures = [];
        for (let finger = 1; finger <= 4; finger++) {
            const tip = landmarks[finger * 4];
            const pip = landmarks[finger * 4 - 2];
            const mcp = landmarks[finger * 4 - 3];
            const curve = Math.abs(tip.y - pip.y) / Math.abs(mcp.y - pip.y);
            curvatures.push(curve);
        }
        return curvatures.reduce((a, b) => a + b) / curvatures.length;
    }
    
    getDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point1.x - point2.x, 2) + 
            Math.pow(point1.y - point2.y, 2) + 
            Math.pow((point1.z || 0) - (point2.z || 0), 2)
        );
    }
    
    getFingertipsToThumbDistance(landmarks) {
        const thumb = landmarks[4];
        const fingertips = [8, 12, 16, 20];
        const distances = fingertips.map(i => this.getDistance(thumb, landmarks[i]));
        return distances.reduce((a, b) => a + b) / distances.length;
    }
    
    getFingerAngle(landmarks, fingerIndex) {
        const fingerMap = { 1: 8, 2: 12, 3: 16, 4: 20 };
        const tip = landmarks[fingerMap[fingerIndex]];
        const mcp = landmarks[fingerMap[fingerIndex] - 3];
        return Math.atan2(tip.y - mcp.y, tip.x - mcp.x);
    }
    
    isThumbBetweenFingers(landmarks, finger1Index, finger2Index) {
        const thumb = landmarks[4];
        const finger1 = landmarks[finger1Index];
        const finger2 = landmarks[finger2Index];
        return (thumb.x > Math.min(finger1.x, finger2.x) && 
                thumb.x < Math.max(finger1.x, finger2.x));
    }
    
    getAngleBetweenFingers(landmarks, finger1Index, finger2Index) {
        const finger1 = landmarks[finger1Index];
        const finger2 = landmarks[finger2Index];
        const palm = landmarks[9];
        
        const vector1 = { x: finger1.x - palm.x, y: finger1.y - palm.y };
        const vector2 = { x: finger2.x - palm.x, y: finger2.y - palm.y };
        
        const dot = vector1.x * vector2.x + vector1.y * vector2.y;
        const mag1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
        const mag2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
        
        return Math.acos(dot / (mag1 * mag2));
    }
    
    isThumbUnderFingers(landmarks) {
        const thumb = landmarks[4];
        const fingerTips = [8, 12, 16];
        return fingerTips.every(i => thumb.y > landmarks[i].y);
    }
    
    isThumbUnderTwoFingers(landmarks) {
        const thumb = landmarks[4];
        const fingerTips = [8, 12];
        return fingerTips.every(i => thumb.y > landmarks[i].y);
    }
    
    isCircleShape(landmarks) {
        const thumb = landmarks[4];
        const fingertips = [8, 12, 16, 20];
        const center = { x: thumb.x, y: thumb.y };
        
        const distances = fingertips.map(i => this.getDistance(center, landmarks[i]));
        const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
        const variance = distances.reduce((acc, d) => acc + Math.pow(d - avgDistance, 2), 0) / distances.length;
        
        return variance < 0.001 && avgDistance < 0.06; // Small, consistent circle
    }
    
    areFingersCrossed(landmarks, finger1Index, finger2Index) {
        const finger1 = landmarks[finger1Index];
        const finger2 = landmarks[finger2Index];
        return Math.abs(finger1.x - finger2.x) < 0.02;
    }
    
    isFingerBent(landmarks, fingerIndex) {
        const fingerMap = { 1: [5, 6, 7, 8], 2: [9, 10, 11, 12], 3: [13, 14, 15, 16], 4: [17, 18, 19, 20] };
        const joints = fingerMap[fingerIndex];
        const mcp = landmarks[joints[0]];
        const pip = landmarks[joints[1]];
        const tip = landmarks[joints[3]];
        
        const bendAngle = this.getAngleBetweenPoints(mcp, pip, tip);
        return bendAngle < 2.5; // Significantly bent
    }
    
    getAngleBetweenPoints(p1, p2, p3) {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        return Math.acos(dot / (mag1 * mag2));
    }
    
    recognizeBasicGesture(extendedFingers) {
        const numExtended = extendedFingers.length;
        
        if (numExtended === 0) {
            return 'Fist';
        } else if (numExtended === 5) {
            return 'Open Hand';
        } else if (numExtended === 1 && extendedFingers.includes(1)) {
            return 'Pointing';
        } else if (numExtended === 2 && extendedFingers.includes(1) && extendedFingers.includes(2)) {
            return 'Peace Sign';
        } else if (numExtended === 1 && extendedFingers.includes(0)) {
            return 'Thumbs Up';
        } else if (numExtended === 3 && extendedFingers.includes(0) && extendedFingers.includes(1) && extendedFingers.includes(2)) {
            return 'OK Sign';
        }
        
        return `${numExtended} Finger(s) Extended`;
    }
    
    updateHandCount(message) {
        const handCountValue = document.getElementById('hand-count-value');
        const detectionMode = document.getElementById('detection-mode');
        const frameRate = document.getElementById('frame-rate');
        
        if (typeof message === 'string') {
            // Parse different types of messages
            if (message.includes('hand(s) detected')) {
                const count = message.match(/(\d+) hand/);
                handCountValue.textContent = count ? count[1] : '0';
            } else if (message.includes('Camera started')) {
                detectionMode.textContent = this.hands ? 'AI Enhanced' : 'Basic Mode';
                handCountValue.textContent = '0';
            } else if (message.includes('Models loaded')) {
                detectionMode.textContent = 'AI Ready';
            } else if (message.includes('Loading')) {
                detectionMode.textContent = 'Loading...';
            } else if (message.includes('stopped')) {
                detectionMode.textContent = 'Stopped';
                handCountValue.textContent = '0';
            } else {
                detectionMode.textContent = 'Ready';
            }
        }
        
        // Update frame rate
        if (this.frameCount > 0) {
            const fps = Math.round(this.frameCount / ((Date.now() - this.startTime) / 1000));
            frameRate.textContent = fps + ' fps';
        }
    }
    
    updateGestureInfo(gestures) {
        const gestureDisplay = document.querySelector('.gesture-display');
        const gestureText = document.querySelector('.gesture-text');
        const confidenceBadge = document.querySelector('.confidence-badge');
        const statusElement = document.querySelector('#gesture-info .status');
        
        if (typeof gestures === 'string') {
            if (gestures.includes('No stable') || gestures.includes('No gestures') || gestures.includes('No specific')) {
                gestureText.textContent = 'No gesture detected';
                confidenceBadge.textContent = '0%';
                confidenceBadge.className = 'confidence-badge confidence-low';
                gestureDisplay.className = 'gesture-display';
                statusElement.style.display = 'block';
                statusElement.textContent = gestures;
            } else {
                // Parse gesture string for display
                const parts = gestures.split('(');
                const gestureName = parts[0].trim();
                const confidence = parts[1] ? parts[1].replace(')', '').trim() : '0%';
                
                gestureText.textContent = gestureName;
                confidenceBadge.textContent = confidence;
                
                // Set confidence styling
                const confValue = parseFloat(confidence);
                if (confValue >= 80) {
                    confidenceBadge.className = 'confidence-badge confidence-high';
                } else if (confValue >= 60) {
                    confidenceBadge.className = 'confidence-badge confidence-medium';
                } else {
                    confidenceBadge.className = 'confidence-badge confidence-low';
                }
                
                // Special styling for ASL letters
                if (gestureName.includes('ASL:')) {
                    gestureDisplay.className = 'gesture-display gesture-recognized asl-detected';
                } else {
                    gestureDisplay.className = 'gesture-display gesture-recognized';
                }
                
                statusElement.style.display = 'none';
            }
        }
    }
    
    updateLandmarkInfo(hands) {
        if (typeof hands === 'string') {
            this.landmarkInfo.innerHTML = `<p class="status">${hands}</p>`;
            return;
        }
        
        if (!hands || hands.length === 0) {
            this.landmarkInfo.innerHTML = `<p class="status">No hands detected</p>`;
            return;
        }
        
        let html = '<div class="landmark-info">';
        hands.forEach((landmarks, handIndex) => {
            html += `<div style="margin-bottom: 15px;"><strong>Hand ${handIndex + 1}:</strong><br>`;
            
            // Show key landmarks
            const keyPoints = [
                { index: 0, name: 'Wrist' },
                { index: 4, name: 'Thumb Tip' },
                { index: 8, name: 'Index Tip' },
                { index: 12, name: 'Middle Tip' },
                { index: 16, name: 'Ring Tip' },
                { index: 20, name: 'Pinky Tip' }
            ];
            
            keyPoints.forEach(point => {
                const landmark = landmarks[point.index];
                html += `<div class="landmark-point">
                    ${point.name}: (${(landmark.x * 100).toFixed(1)}%, ${(landmark.y * 100).toFixed(1)}%)
                </div>`;
            });
            
            html += '</div>';
        });
        html += '</div>';
        
        this.landmarkInfo.innerHTML = html;
    }
    
    // Advanced hand metrics calculation for adaptive thresholds
    calculateHandMetrics(landmarks) {
        const wrist = landmarks[0];
        const middleFingerMCP = landmarks[9];
        const pinkyMCP = landmarks[17];
        const indexMCP = landmarks[5];
        
        // Calculate hand size (palm width and length)
        const palmWidth = this.getDistance(indexMCP, pinkyMCP);
        const palmLength = this.getDistance(wrist, middleFingerMCP);
        
        // Calculate hand distance from camera (using z-coordinate if available)
        const avgDepth = landmarks.reduce((sum, point) => sum + (point.z || 0), 0) / landmarks.length;
        
        // Calculate hand orientation (palm facing direction)
        const palmNormal = this.calculatePalmNormal(landmarks);
        
        // Calculate finger spread (how spread out the fingers are)
        const fingerSpread = this.calculateFingerSpread(landmarks);
        
        return {
            palmWidth,
            palmLength,
            avgDepth,
            palmNormal,
            fingerSpread,
            handSize: palmWidth * palmLength,
            aspectRatio: palmLength / palmWidth
        };
    }
    
    calculatePalmNormal(landmarks) {
        // Calculate palm normal vector using three palm points
        const wrist = landmarks[0];
        const indexMCP = landmarks[5];
        const pinkyMCP = landmarks[17];
        
        // Create two vectors from wrist
        const v1 = {
            x: indexMCP.x - wrist.x,
            y: indexMCP.y - wrist.y,
            z: (indexMCP.z || 0) - (wrist.z || 0)
        };
        
        const v2 = {
            x: pinkyMCP.x - wrist.x,
            y: pinkyMCP.y - wrist.y,
            z: (pinkyMCP.z || 0) - (wrist.z || 0)
        };
        
        // Cross product to get normal
        const normal = {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
        };
        
        // Normalize
        const magnitude = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        return {
            x: normal.x / magnitude,
            y: normal.y / magnitude,
            z: normal.z / magnitude
        };
    }
    
    calculateFingerSpread(landmarks) {
        const fingerTips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
        const distances = [];
        
        for (let i = 0; i < fingerTips.length - 1; i++) {
            const dist = this.getDistance(landmarks[fingerTips[i]], landmarks[fingerTips[i + 1]]);
            distances.push(dist);
        }
        
        return distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
    }
    
    // Advanced gesture recognition with confidence scoring
    advancedGestureRecognition(landmarks, handMetrics, handLabel) {
        // Normalize landmarks relative to hand size and position
        const normalizedLandmarks = this.normalizeLandmarks(landmarks, handMetrics);
        
        // Multiple recognition strategies
        const aslResult = this.recognizeASLWithConfidence(normalizedLandmarks, handMetrics);
        const basicResult = this.recognizeBasicGestureWithConfidence(normalizedLandmarks, handMetrics);
        const shapeResult = this.recognizeHandShape(normalizedLandmarks, handMetrics);
        
        // Choose the result with highest confidence
        const results = [aslResult, basicResult, shapeResult].filter(r => r !== null);
        
        if (results.length === 0) return null;
        
        // Return the most confident result
        return results.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
        );
    }
    
    normalizeLandmarks(landmarks, handMetrics) {
        // Normalize landmarks to be scale and position invariant
        const wrist = landmarks[0];
        const palmCenter = landmarks[9]; // Middle finger MCP
        
        return landmarks.map(point => ({
            x: (point.x - wrist.x) / handMetrics.palmWidth,
            y: (point.y - wrist.y) / handMetrics.palmLength,
            z: ((point.z || 0) - (wrist.z || 0)) / handMetrics.handSize,
            original: point
        }));
    }
    
    recognizeASLWithConfidence(normalizedLandmarks, handMetrics) {
        const extendedFingers = this.getExtendedFingersAdvanced(normalizedLandmarks, handMetrics);
        const fingerPositions = this.getFingerPositionsNormalized(normalizedLandmarks);
        
        // Enhanced ASL recognition with confidence calculation
        const candidates = [];
        
        // Check for each ASL letter with confidence scoring
        candidates.push(this.checkASL_A(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_B(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_C(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_D(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_E(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_F(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_L(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_V(normalizedLandmarks, extendedFingers, fingerPositions));
        candidates.push(this.checkASL_Y(normalizedLandmarks, extendedFingers, fingerPositions));
        
        // Filter and return best candidate
        const validCandidates = candidates.filter(c => c && c.confidence > 0.3);
        
        if (validCandidates.length === 0) return null;
        
        return validCandidates.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
        );
    }
    
    getExtendedFingersAdvanced(normalizedLandmarks, handMetrics) {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerPIPs = [3, 6, 10, 14, 18];
        const extendedFingers = [];
        
        // Adaptive thresholds based on hand metrics
        const baseThreshold = 0.05;
        const sizeAdjustment = Math.min(handMetrics.handSize * 10, 0.03);
        const threshold = baseThreshold + sizeAdjustment;
        
        // Thumb (special case)
        const thumbExtension = Math.abs(normalizedLandmarks[4].x - normalizedLandmarks[2].x);
        if (thumbExtension > threshold * 1.5) {
            extendedFingers.push({ finger: 0, confidence: Math.min(thumbExtension / (threshold * 2), 1.0) });
        }
        
        // Other fingers
        for (let i = 1; i < 5; i++) {
            const tip = normalizedLandmarks[fingerTips[i]];
            const pip = normalizedLandmarks[fingerPIPs[i]];
            const extension = pip.y - tip.y; // Positive means extended
            
            if (extension > threshold) {
                const confidence = Math.min(extension / (threshold * 2), 1.0);
                extendedFingers.push({ finger: i, confidence });
            }
        }
        
        return extendedFingers;
    }
    
    getFingerPositionsNormalized(normalizedLandmarks) {
        return {
            thumb: normalizedLandmarks[4],
            index: normalizedLandmarks[8],
            middle: normalizedLandmarks[12],
            ring: normalizedLandmarks[16],
            pinky: normalizedLandmarks[20],
            wrist: normalizedLandmarks[0],
            palm: normalizedLandmarks[9]
        };
    }
    
    // Enhanced ASL letter detection with confidence
    checkASL_A(landmarks, extendedFingers, pos) {
        const extendedCount = extendedFingers.length;
        
        if (extendedCount <= 1) {
            const thumbPos = pos.thumb;
            const indexMCP = landmarks[5];
            const thumbAlignment = 1 - Math.abs(thumbPos.y - indexMCP.y);
            
            if (thumbAlignment > 0.85) {
                return { gesture: 'ASL: A', confidence: thumbAlignment * 0.9 };
            }
        }
        return null;
    }
    
    checkASL_B(landmarks, extendedFingers, pos) {
        const extendedCount = extendedFingers.length;
        const thumbExtended = extendedFingers.some(f => f.finger === 0);
        
        if (extendedCount === 4 && !thumbExtended) {
            const alignment = this.calculateFingerAlignment(landmarks, [8, 12, 16, 20]);
            const confidence = alignment * 0.95;
            
            if (confidence > 0.7) {
                return { gesture: 'ASL: B', confidence };
            }
        }
        return null;
    }
    
    checkASL_L(landmarks, extendedFingers, pos) {
        const thumbExtended = extendedFingers.some(f => f.finger === 0);
        const indexExtended = extendedFingers.some(f => f.finger === 1);
        
        if (thumbExtended && indexExtended && extendedFingers.length === 2) {
            const angle = this.getAngleBetweenFingers(landmarks, 4, 8);
            const angleScore = Math.abs(angle - Math.PI/2) < 0.5 ? 1 - Math.abs(angle - Math.PI/2) : 0;
            
            if (angleScore > 0.5) {
                return { gesture: 'ASL: L', confidence: angleScore * 0.9 };
            }
        }
        return null;
    }
    
    checkASL_V(landmarks, extendedFingers, pos) {
        const indexExtended = extendedFingers.some(f => f.finger === 1);
        const middleExtended = extendedFingers.some(f => f.finger === 2);
        
        if (indexExtended && middleExtended && extendedFingers.length === 2) {
            const separation = Math.abs(pos.index.x - pos.middle.x);
            const separationScore = Math.min(separation * 10, 1.0);
            
            if (separationScore > 0.4) {
                return { gesture: 'ASL: V', confidence: separationScore * 0.9 };
            }
        }
        return null;
    }
    
    checkASL_Y(landmarks, extendedFingers, pos) {
        const thumbExtended = extendedFingers.some(f => f.finger === 0);
        const pinkyExtended = extendedFingers.some(f => f.finger === 4);
        
        if (thumbExtended && pinkyExtended && extendedFingers.length === 2) {
            const separation = this.getDistance(pos.thumb, pos.pinky);
            const separationScore = Math.min(separation * 5, 1.0);
            
            if (separationScore > 0.5) {
                return { gesture: 'ASL: Y', confidence: separationScore * 0.85 };
            }
        }
        return null;
    }
    
    // Add more ASL letter checks...
    checkASL_C(landmarks, extendedFingers, pos) {
        if (extendedFingers.length === 0) {
            const curvature = this.calculateHandCurvatureAdvanced(landmarks);
            if (curvature > 0.4) {
                return { gesture: 'ASL: C', confidence: curvature * 0.8 };
            }
        }
        return null;
    }
    
    checkASL_D(landmarks, extendedFingers, pos) {
        const indexExtended = extendedFingers.some(f => f.finger === 1);
        if (indexExtended && extendedFingers.length === 1) {
            const thumbToIndex = this.getDistance(pos.thumb, pos.index);
            if (thumbToIndex < 0.3) {
                return { gesture: 'ASL: D', confidence: 0.8 };
            }
        }
        return null;
    }
    
    checkASL_E(landmarks, extendedFingers, pos) {
        if (extendedFingers.length === 0) {
            const compactness = this.calculateHandCompactness(landmarks);
            if (compactness > 0.7) {
                return { gesture: 'ASL: E', confidence: compactness * 0.75 };
            }
        }
        return null;
    }
    
    checkASL_F(landmarks, extendedFingers, pos) {
        const middleExtended = extendedFingers.some(f => f.finger === 2);
        const ringExtended = extendedFingers.some(f => f.finger === 3);
        const pinkyExtended = extendedFingers.some(f => f.finger === 4);
        
        if (middleExtended && ringExtended && pinkyExtended && extendedFingers.length === 3) {
            const thumbToIndex = this.getDistance(pos.thumb, pos.index);
            if (thumbToIndex < 0.3) {
                return { gesture: 'ASL: F', confidence: 0.85 };
            }
        }
        return null;
    }
    
    // Helper methods for advanced analysis
    calculateFingerAlignment(landmarks, fingerIndices) {
        const yPositions = fingerIndices.map(i => landmarks[i].y);
        const avgY = yPositions.reduce((a, b) => a + b) / yPositions.length;
        const variance = yPositions.reduce((acc, y) => acc + Math.pow(y - avgY, 2), 0) / yPositions.length;
        return Math.max(0, 1 - variance * 100); // Convert to alignment score
    }
    
    calculateHandCurvatureAdvanced(landmarks) {
        // More sophisticated curvature calculation
        const curvatures = [];
        for (let finger = 1; finger <= 4; finger++) {
            const mcp = landmarks[finger * 4 - 3];
            const pip = landmarks[finger * 4 - 2];
            const tip = landmarks[finger * 4];
            
            const angle1 = Math.atan2(pip.y - mcp.y, pip.x - mcp.x);
            const angle2 = Math.atan2(tip.y - pip.y, tip.x - pip.x);
            const curvature = Math.abs(angle2 - angle1);
            curvatures.push(curvature);
        }
        return curvatures.reduce((a, b) => a + b) / curvatures.length;
    }
    
    calculateHandCompactness(landmarks) {
        const fingerTips = [8, 12, 16, 20];
        const thumb = landmarks[4];
        const distances = fingerTips.map(i => this.getDistance(thumb, landmarks[i]));
        const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
        return Math.max(0, 1 - avgDistance * 10); // Closer = more compact
    }
    
    recognizeBasicGestureWithConfidence(landmarks, handMetrics) {
        const extendedFingers = this.getExtendedFingersAdvanced(landmarks, handMetrics);
        const numExtended = extendedFingers.length;
        
        if (numExtended === 0) {
            return { gesture: 'Fist', confidence: 0.9 };
        } else if (numExtended >= 4) {
            return { gesture: 'Open Hand', confidence: 0.85 };
        } else if (numExtended === 1) {
            const extendedFinger = extendedFingers[0].finger;
            if (extendedFinger === 1) {
                return { gesture: 'Pointing', confidence: extendedFingers[0].confidence };
            } else if (extendedFinger === 0) {
                return { gesture: 'Thumbs Up', confidence: extendedFingers[0].confidence };
            }
        }
        
        return { gesture: `${numExtended} Finger(s)`, confidence: 0.6 };
    }
    
    recognizeHandShape(landmarks, handMetrics) {
        // Additional shape-based recognition
        const openness = this.calculateHandOpenness(landmarks);
        const symmetry = this.calculateHandSymmetry(landmarks);
        
        if (openness > 0.8 && symmetry > 0.7) {
            return { gesture: 'Flat Hand', confidence: 0.7 };
        }
        
        return null;
    }
    
    calculateHandOpenness(landmarks) {
        const fingerTips = [4, 8, 12, 16, 20];
        const palm = landmarks[9];
        const distances = fingerTips.map(i => this.getDistance(palm, landmarks[i]));
        const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
        return Math.min(avgDistance * 8, 1.0);
    }
    
    calculateHandSymmetry(landmarks) {
        const leftSide = [4, 3, 2]; // Thumb side
        const rightSide = [20, 19, 18]; // Pinky side
        const center = landmarks[9];
        
        const leftDistances = leftSide.map(i => this.getDistance(center, landmarks[i]));
        const rightDistances = rightSide.map(i => this.getDistance(center, landmarks[i]));
        
        const leftAvg = leftDistances.reduce((a, b) => a + b) / leftDistances.length;
        const rightAvg = rightDistances.reduce((a, b) => a + b) / rightDistances.length;
        
        return 1 - Math.abs(leftAvg - rightAvg);
    }
    
    // Temporal smoothing and stability analysis
    analyzeGestureStability() {
        if (this.gestureHistory.length < this.stabilityFrames) {
            return [];
        }
        
        // Get recent frames
        const recentFrames = this.gestureHistory.slice(-this.stabilityFrames);
        
        // Group gestures by hand
        const handGestures = new Map();
        
        recentFrames.forEach(frame => {
            frame.gestures.forEach(gesture => {
                if (!handGestures.has(gesture.hand)) {
                    handGestures.set(gesture.hand, []);
                }
                handGestures.get(gesture.hand).push(gesture);
            });
        });
        
        // Analyze stability for each hand
        const stableGestures = [];
        
        handGestures.forEach((gestures, hand) => {
            const stableGesture = this.findStableGesture(gestures);
            if (stableGesture) {
                stableGestures.push(stableGesture);
            }
        });
        
        return stableGestures;
    }
    
    findStableGesture(gestures) {
        if (gestures.length < this.stabilityFrames * 0.6) {
            return null; // Not enough data
        }
        
        // Count occurrences of each gesture
        const gestureCounts = new Map();
        let totalConfidence = 0;
        
        gestures.forEach(g => {
            if (!gestureCounts.has(g.gesture)) {
                gestureCounts.set(g.gesture, { count: 0, totalConfidence: 0 });
            }
            const data = gestureCounts.get(g.gesture);
            data.count++;
            data.totalConfidence += g.confidence;
            totalConfidence += g.confidence;
        });
        
        // Find most frequent gesture with high confidence
        let bestGesture = null;
        let bestScore = 0;
        
        gestureCounts.forEach((data, gesture) => {
            const frequency = data.count / gestures.length;
            const avgConfidence = data.totalConfidence / data.count;
            const score = frequency * avgConfidence;
            
            if (score > bestScore && frequency >= 0.6) {
                bestScore = score;
                bestGesture = {
                    hand: gestures[0].hand,
                    gesture: gesture,
                    confidence: avgConfidence,
                    stability: frequency
                };
            }
        });
        
        return bestGesture;
    }
    
    updateAdvancedLandmarkInfo(hands) {
        const handSize = document.getElementById('hand-size');
        const handDistance = document.getElementById('hand-distance');
        const fingerSpread = document.getElementById('finger-spread');
        
        if (!hands || hands.length === 0) {
            handSize.textContent = '-- px²';
            handDistance.textContent = '-- cm';
            fingerSpread.textContent = '--%';
            return;
        }
        
        // Use metrics from the first detected hand
        const metrics = this.handMetrics.get(0);
        if (metrics) {
            handSize.textContent = (metrics.handSize * 1000).toFixed(0) + ' px²';
            handDistance.textContent = Math.abs(metrics.avgDepth * 100).toFixed(1) + ' cm';
            fingerSpread.textContent = (metrics.fingerSpread * 100).toFixed(0) + '%';
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
    }
    
    // Check for MediaPipe support
    if (typeof Hands === 'undefined') {
        alert('MediaPipe library failed to load. Please check your internet connection and refresh the page.');
        return;
    }
    
    // Initialize the sign language detector
    const detector = new SignLanguageDetector();
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