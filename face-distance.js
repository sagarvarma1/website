class FaceDistanceDetector {
    constructor() {
        this.video = document.getElementById('input_video');
        this.canvas = document.getElementById('output_canvas');
        this.ctx = this.canvas.getContext('2d');
        this.loading = document.getElementById('loading');
        
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        
        this.distanceInfo = document.getElementById('distance-info');
        this.distanceValue = document.querySelector('.distance-value');
        this.faceWidth = document.getElementById('face-width');
        this.eyeDistance = document.getElementById('eye-distance');
        this.detectionConfidence = document.getElementById('detection-confidence');
        
        this.isRunning = false;
        this.faceMesh = null;
        this.camera = null;
        
        // Enhanced anthropometric data with demographic variations
        this.baseFacialMeasurements = {
            interOcularDistance: { base: 6.3, range: [5.8, 6.8] },
            eyeWidth: { base: 2.4, range: [2.1, 2.7] },
            noseWidth: { base: 3.7, range: [3.2, 4.2] },
            mouthWidth: { base: 5.0, range: [4.5, 5.5] },
            faceWidth: { base: 13.8, range: [12.5, 15.1] },
            faceHeight: { base: 11.5, range: [10.8, 12.2] },
            nasalHeight: { base: 5.1, range: [4.6, 5.6] },
            philtrum: { base: 1.5, range: [1.2, 1.8] }
        };
        
        // Adaptive measurements (will be adjusted based on face analysis)
        this.adaptiveMeasurements = { ...this.baseFacialMeasurements };
        
        // Camera parameter estimation with multiple methods
        this.cameraSpecs = {
            commonFOV: 70,
            estimatedFocalLength: null,
            intrinsicMatrix: null,
            distortionCoeffs: [0, 0, 0, 0], // Assume minimal distortion
            sensorWidth: 0.36,
            sensorHeight: 0.27,
            adaptiveFOV: null // Will be estimated from face measurements
        };
        
        // Advanced filtering and temporal tracking
        this.distanceHistory = [];
        this.landmarkHistory = [];
        this.qualityHistory = [];
        this.maxHistoryLength = 20;
        this.minFramesForStability = 5;
        
        // Stability and smoothing improvements
        this.currentStableDistance = null;
        this.stabilityCounter = 0;
        this.stabilityThreshold = 8; // Much higher - require lots of evidence for changes
        this.hysteresisRange = 1.0; // Back to 1cm - only update for significant movement
        this.lastDisplayedDistance = null;
        this.noiseThreshold = 0.5; // Much higher - filter out more fluctuations
        this.stabilityZone = 1.0; // Much bigger dead zone - stay stable
        
        // Multi-frame fusion parameters
        this.frameBuffer = [];
        this.maxFrameBuffer = 8;
        this.fusionWeights = [0.3, 0.25, 0.2, 0.15, 0.05, 0.03, 0.01, 0.01];
        
        // Perspective and pose correction
        this.faceRotation = { pitch: 0, yaw: 0, roll: 0 };
        this.perspectiveCorrection = true;
        
        // Quality assessment thresholds (made more permissive)
        this.qualityThresholds = {
            minLandmarkConfidence: 0.6,     // Reduced from 0.7
            maxRotationAngle: 35,           // Increased from 25 degrees
            minFaceSize: 80,                // Reduced from 100 pixels
            maxAspectRatioDeviation: 0.4    // Increased from 0.3
        };
        
        // Calibration (optional for maximum accuracy)
        this.calibrationDistance = 60;
        this.calibrationEyeDistance = null;
        this.focalLength = null;
        this.isCalibrated = false;
        this.adaptationComplete = false;
        
        // Performance tracking
        this.frameCount = 0;
        this.lastAccuracyUpdate = 0;
        
        this.initializeEventListeners();
        this.initializeMediaPipe();
        this.estimateCameraParameters();
    }
    
    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
    }
    
    estimateCameraParameters() {
        // Multi-method camera parameter estimation
        const assumedResolutionWidth = 1280;
        const fovRadians = (this.cameraSpecs.commonFOV * Math.PI) / 180;
        
        // Primary focal length estimate
        this.cameraSpecs.estimatedFocalLength = assumedResolutionWidth / (2 * Math.tan(fovRadians / 2));
        
        // Initialize intrinsic matrix (simplified)
        this.cameraSpecs.intrinsicMatrix = [
            [this.cameraSpecs.estimatedFocalLength, 0, assumedResolutionWidth / 2],
            [0, this.cameraSpecs.estimatedFocalLength, 720 / 2],
            [0, 0, 1]
        ];
    }
    
    async initializeMediaPipe() {
        try {
            this.showLoading(true);
            this.updateStatus('Loading advanced AI models...');
            
            // Initialize MediaPipe Face Mesh with enhanced settings
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });
            
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.8,  // Higher threshold for quality
                minTrackingConfidence: 0.8
            });
            
            this.faceMesh.onResults((results) => this.onResults(results));
            
            this.showLoading(false);
            this.updateStatus('Advanced models loaded! Click "Start Camera" for high-precision detection.');
            
        } catch (error) {
            console.error('Error initializing MediaPipe:', error);
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
            this.updateStatus('Starting high-resolution camera...');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1920, min: 1280 }, // Prefer higher resolution
                    height: { ideal: 1080, min: 720 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                }
            });
            
            this.video.srcObject = stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Update camera parameters with actual resolution
            this.updateAdvancedCameraParameters();
            
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.isRunning) {
                        await this.faceMesh.send({ image: this.video });
                    }
                },
                width: this.video.videoWidth,
                height: this.video.videoHeight
            });
            
            this.isRunning = true;
            this.frameCount = 0;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.showLoading(false);
            this.updateStatus('High-precision detection active...');
            
            this.camera.start();
            
        } catch (error) {
            console.error('Error starting camera:', error);
            this.updateStatus('Error accessing camera. Please allow camera permissions and try again.');
            this.showLoading(false);
        }
    }
    
    updateAdvancedCameraParameters() {
        // Update focal length estimate based on actual resolution
        const fovRadians = (this.cameraSpecs.commonFOV * Math.PI) / 180;
        this.cameraSpecs.estimatedFocalLength = this.canvas.width / (2 * Math.tan(fovRadians / 2));
        
        // Update intrinsic matrix
        this.cameraSpecs.intrinsicMatrix = [
            [this.cameraSpecs.estimatedFocalLength, 0, this.canvas.width / 2],
            [0, this.cameraSpecs.estimatedFocalLength, this.canvas.height / 2],
            [0, 0, 1]
        ];
        
        console.log(`Camera parameters updated: ${this.canvas.width}x${this.canvas.height}, f=${this.cameraSpecs.estimatedFocalLength.toFixed(1)}`);
    }
    
    stopCamera() {
        this.isRunning = false;
        
        if (this.camera) {
            this.camera.stop();
        }
        
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.showLoading(false);
        this.updateStatus('Camera stopped. Click "Start Camera" to begin again.');
        this.resetDisplay();
        
        // Reset tracking data
        this.frameBuffer = [];
        this.landmarkHistory = [];
        this.qualityHistory = [];
        
        // Reset stability variables
        this.currentStableDistance = null;
        this.stabilityCounter = 0;
        this.lastDisplayedDistance = null;
        this.distanceHistory = [];
    }
    
    onResults(results) {
        if (!this.isRunning) return;
        
        this.frameCount++;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            
            // Quality assessment
            const frameQuality = this.assessFrameQuality(landmarks);
            
            if (frameQuality.isGoodQuality) {
                this.processHighQualityFrame(landmarks, frameQuality);
                this.drawAdvancedVisualization(landmarks);
                
                // Add visual feedback
                this.canvas.classList.add('face-detected');
                setTimeout(() => this.canvas.classList.remove('face-detected'), 100);
            } else {
                // Process lower quality frames with simplified calculations
                this.processLowerQualityFrame(landmarks, frameQuality);
                this.drawBasicVisualization(landmarks);
            }
        } else {
            this.updateNoFaceDetected();
        }
    }
    
    processLowerQualityFrame(landmarks, quality) {
        // Simplified processing for lower quality frames
        const eyeDistance = this.calculateDistance(landmarks[33], landmarks[263]);
        const faceWidth = this.calculateDistance(landmarks[234], landmarks[454]);
        
        // Basic distance calculation using most reliable measurement
        const focalLength = this.isCalibrated ? this.focalLength : this.cameraSpecs.estimatedFocalLength;
        const basicDistance = (this.adaptiveMeasurements.interOcularDistance.base * focalLength) / eyeDistance;
        
        // Simple smoothing
        const smoothedDistance = this.basicSmoothing(basicDistance);
        
        // Basic position
        const centerX = (landmarks[33].x + landmarks[263].x) / 2;
        const centerY = (landmarks[33].y + landmarks[263].y) / 2;
        const pixelX = centerX * this.canvas.width;
        const pixelY = centerY * this.canvas.height;
        
        this.updateDisplay({
            distance: smoothedDistance,
            eyeDistance: eyeDistance,
            faceWidth: faceWidth,
            positionX: pixelX - (this.canvas.width / 2),
            positionY: pixelY - (this.canvas.height / 2),
            positionZ: smoothedDistance,
            confidence: quality.score * 0.6 // Lower confidence for basic processing
        });
    }
    
    basicSmoothing(newDistance) {
        // Enhanced smoothing for basic mode
        if (this.distanceHistory.length === 0) {
            this.distanceHistory.push(newDistance);
            if (this.lastDisplayedDistance === null) {
                this.lastDisplayedDistance = newDistance; // Keep original precision instead of rounding
            }
            return this.lastDisplayedDistance;
        }
        
        // Add to history
        this.distanceHistory.push(newDistance);
        if (this.distanceHistory.length > this.maxHistoryLength) {
            this.distanceHistory.shift();
        }
        
        // Use the same stability filter as advanced mode
        const recent = this.distanceHistory.slice(-5);
        const mean = recent.reduce((a, b) => a + b) / recent.length;
        
        return this.applyStabilityFilter(mean);
    }
    
    drawBasicVisualization(landmarks) {
        // Simple visualization for lower quality frames
        this.ctx.fillStyle = '#ffaa00'; // Orange for lower quality
        this.drawLandmark(landmarks[33], 3);  // Left eye
        this.drawLandmark(landmarks[263], 3); // Right eye
        this.drawLandmark(landmarks[1], 3);   // Nose tip
        
        // Simple eye distance line
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        this.drawLine(landmarks[33], landmarks[263]);
        this.ctx.setLineDash([]);
    }
    
    assessFrameQuality(landmarks) {
        const quality = {
            isGoodQuality: true,
            score: 1.0,
            issues: []
        };
        
        // Check face size
        const faceSize = this.calculateFaceSize(landmarks);
        if (faceSize < this.qualityThresholds.minFaceSize) {
            quality.isGoodQuality = false;
            quality.issues.push('face too small');
            quality.score *= 0.6; // Less harsh penalty
        }
        
        // Check face rotation
        const rotation = this.estimateFaceRotation(landmarks);
        const maxRotation = Math.max(Math.abs(rotation.pitch), Math.abs(rotation.yaw), Math.abs(rotation.roll));
        if (maxRotation > this.qualityThresholds.maxRotationAngle) {
            quality.isGoodQuality = false;
            quality.issues.push('face rotated');
            quality.score *= 0.8; // Less harsh penalty
        }
        
        // Check landmark stability (more lenient)
        if (this.landmarkHistory.length > 0) {
            const stability = this.calculateLandmarkStability(landmarks);
            if (stability < 0.6) { // Reduced threshold from 0.8 to 0.6
                quality.isGoodQuality = false;
                quality.issues.push('motion detected');
                quality.score *= 0.8; // Less harsh penalty
            }
        }
        
        // Check aspect ratio consistency
        const aspectRatio = this.calculateFaceAspectRatio(landmarks);
        const expectedRatio = 1.3; // Typical face height/width ratio
        if (Math.abs(aspectRatio - expectedRatio) > this.qualityThresholds.maxAspectRatioDeviation) {
            quality.isGoodQuality = false;
            quality.issues.push('perspective distortion');
            quality.score *= 0.9; // Less harsh penalty
        }
        
        // Override quality check if we haven't had a good frame in a while
        if (!quality.isGoodQuality && this.frameCount % 10 === 0) {
            quality.isGoodQuality = true; // Force processing every 10th frame
            quality.score = Math.max(quality.score, 0.3); // Minimum usable score
        }
        
        return quality;
    }
    
    calculateFaceSize(landmarks) {
        const faceWidth = this.calculateDistance(landmarks[234], landmarks[454]);
        const faceHeight = this.calculateDistance(landmarks[10], landmarks[175]);
        return Math.sqrt(faceWidth * faceHeight);
    }
    
    estimateFaceRotation(landmarks) {
        // Estimate face rotation using key landmarks
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const noseTip = landmarks[1];
        const chin = landmarks[175];
        const forehead = landmarks[10];
        
        // Calculate roll (head tilt)
        const eyeVector = { 
            x: rightEye.x - leftEye.x, 
            y: rightEye.y - leftEye.y 
        };
        const roll = Math.atan2(eyeVector.y, eyeVector.x) * 180 / Math.PI;
        
        // Calculate pitch (head up/down)
        const faceCenter = { 
            x: (leftEye.x + rightEye.x) / 2, 
            y: (leftEye.y + rightEye.y) / 2 
        };
        const noseOffset = noseTip.y - faceCenter.y;
        const chinOffset = chin.y - faceCenter.y;
        const pitch = Math.atan2(noseOffset - chinOffset * 0.5, chinOffset) * 180 / Math.PI;
        
        // Calculate yaw (head left/right)
        const leftEyeToNose = this.calculateDistance(leftEye, noseTip);
        const rightEyeToNose = this.calculateDistance(rightEye, noseTip);
        const yaw = Math.atan2(rightEyeToNose - leftEyeToNose, (leftEyeToNose + rightEyeToNose) / 2) * 180 / Math.PI;
        
        return { pitch, yaw, roll };
    }
    
    calculateLandmarkStability(currentLandmarks) {
        if (this.landmarkHistory.length === 0) return 1.0;
        
        const prevLandmarks = this.landmarkHistory[this.landmarkHistory.length - 1];
        let totalMovement = 0;
        const keyPoints = [33, 263, 1, 234, 454]; // Eyes, nose, face sides
        
        keyPoints.forEach(index => {
            const movement = this.calculateDistance(currentLandmarks[index], prevLandmarks[index]);
            totalMovement += movement;
        });
        
        const avgMovement = totalMovement / keyPoints.length;
        // Made less sensitive - allow more movement before considering it unstable
        return Math.max(0, 1 - avgMovement * 5); // Reduced from 10 to 5
    }
    
    calculateFaceAspectRatio(landmarks) {
        const faceWidth = this.calculateDistance(landmarks[234], landmarks[454]);
        const faceHeight = this.calculateDistance(landmarks[10], landmarks[175]);
        return faceHeight / faceWidth;
    }
    
    processHighQualityFrame(landmarks, quality) {
        // Store landmarks for temporal tracking
        this.landmarkHistory.push(landmarks);
        if (this.landmarkHistory.length > this.maxHistoryLength) {
            this.landmarkHistory.shift();
        }
        
        // Store quality for trend analysis
        this.qualityHistory.push(quality.score);
        if (this.qualityHistory.length > this.maxHistoryLength) {
            this.qualityHistory.shift();
        }
        
        // Extract measurements with perspective correction
        const measurements = this.extractAdvancedMeasurements(landmarks);
        
        // Adapt anthropometric data if enough samples
        if (!this.adaptationComplete && this.frameCount > 30) {
            this.adaptAnthropometricData(measurements);
        }
        
        // Calculate distance estimates with multiple methods
        const distanceEstimates = this.calculateAdvancedDistanceEstimates(measurements);
        
        // Multi-frame fusion
        this.frameBuffer.push({
            estimates: distanceEstimates,
            quality: quality.score,
            timestamp: Date.now()
        });
        
        if (this.frameBuffer.length > this.maxFrameBuffer) {
            this.frameBuffer.shift();
        }
        
        // Fuse measurements across frames
        const fusedDistance = this.fuseMultiFrameEstimates();
        
        // Apply final smoothing
        const smoothedDistance = this.advancedSmoothing(fusedDistance);
        
        // Calculate position with perspective correction
        const position = this.calculateCorrectedPosition(landmarks);
        
        // Calculate enhanced confidence
        const confidence = this.calculateEnhancedConfidence(measurements, distanceEstimates, quality);
        
        this.updateDisplay({
            distance: smoothedDistance,
            eyeDistance: measurements.interOcularDistance.pixels,
            faceWidth: measurements.faceWidth.pixels,
            positionX: position.x,
            positionY: position.y,
            positionZ: smoothedDistance,
            confidence: confidence
        });
    }
    
    extractAdvancedMeasurements(landmarks) {
        // Apply perspective correction to measurements
        const rotation = this.estimateFaceRotation(landmarks);
        this.faceRotation = rotation;
        
        const measurements = {
            interOcularDistance: {
                pixels: this.calculateCorrectedDistance(landmarks[33], landmarks[263], rotation),
                realSize: this.adaptiveMeasurements.interOcularDistance.base
            },
            faceWidth: {
                pixels: this.calculateCorrectedDistance(landmarks[234], landmarks[454], rotation),
                realSize: this.adaptiveMeasurements.faceWidth.base
            },
            noseWidth: {
                pixels: this.calculateCorrectedDistance(landmarks[129], landmarks[358], rotation),
                realSize: this.adaptiveMeasurements.noseWidth.base
            },
            leftEyeWidth: {
                pixels: this.calculateCorrectedDistance(landmarks[33], landmarks[133], rotation),
                realSize: this.adaptiveMeasurements.eyeWidth.base
            },
            rightEyeWidth: {
                pixels: this.calculateCorrectedDistance(landmarks[362], landmarks[263], rotation),
                realSize: this.adaptiveMeasurements.eyeWidth.base
            },
            mouthWidth: {
                pixels: this.calculateCorrectedDistance(landmarks[61], landmarks[291], rotation),
                realSize: this.adaptiveMeasurements.mouthWidth.base
            },
            noseHeight: {
                pixels: this.calculateCorrectedDistance(landmarks[6], landmarks[4], rotation),
                realSize: this.adaptiveMeasurements.nasalHeight.base
            },
            faceHeight: {
                pixels: this.calculateCorrectedDistance(landmarks[10], landmarks[175], rotation),
                realSize: this.adaptiveMeasurements.faceHeight.base
            }
        };
        
        return measurements;
    }
    
    calculateCorrectedDistance(point1, point2, rotation) {
        // Apply perspective correction based on face rotation
        const rawDistance = this.calculateDistance(point1, point2);
        
        // Correction factors for rotation
        const pitchFactor = Math.cos(rotation.pitch * Math.PI / 180);
        const yawFactor = Math.cos(rotation.yaw * Math.PI / 180);
        const rollFactor = 1.0; // Roll doesn't affect distance measurements significantly
        
        return rawDistance / (pitchFactor * yawFactor * rollFactor);
    }
    
    adaptAnthropometricData(measurements) {
        // Analyze facial proportions to adapt measurements to individual
        const ratios = {
            eyeToFaceWidth: measurements.interOcularDistance.pixels / measurements.faceWidth.pixels,
            noseToFaceWidth: measurements.noseWidth.pixels / measurements.faceWidth.pixels,
            eyeWidthRatio: (measurements.leftEyeWidth.pixels + measurements.rightEyeWidth.pixels) / 2 / measurements.interOcularDistance.pixels
        };
        
        // Expected ratios from anthropometric studies
        const expectedRatios = {
            eyeToFaceWidth: 0.456,  // IOD/Face width
            noseToFaceWidth: 0.268, // Nose width/Face width
            eyeWidthRatio: 0.381    // Eye width/IOD
        };
        
        // Adapt measurements based on individual facial structure
        Object.keys(this.adaptiveMeasurements).forEach(key => {
            if (measurements[key]) {
                const measurement = this.adaptiveMeasurements[key];
                const range = measurement.range;
                const adjustment = this.calculateIndividualAdjustment(key, ratios, expectedRatios);
                
                // Apply bounded adjustment
                const newValue = measurement.base * (1 + adjustment);
                this.adaptiveMeasurements[key].base = Math.max(range[0], Math.min(range[1], newValue));
            }
        });
        
        if (this.frameCount > 50) {
            this.adaptationComplete = true;
            console.log('Individual anthropometric adaptation complete');
        }
    }
    
    calculateIndividualAdjustment(measurementType, actualRatios, expectedRatios) {
        // Calculate adjustment factor based on facial proportion analysis
        let adjustment = 0;
        
        switch (measurementType) {
            case 'interOcularDistance':
                adjustment = (actualRatios.eyeToFaceWidth / expectedRatios.eyeToFaceWidth - 1) * 0.1;
                break;
            case 'noseWidth':
                adjustment = (actualRatios.noseToFaceWidth / expectedRatios.noseToFaceWidth - 1) * 0.1;
                break;
            case 'eyeWidth':
                adjustment = (actualRatios.eyeWidthRatio / expectedRatios.eyeWidthRatio - 1) * 0.1;
                break;
            default:
                adjustment = 0;
        }
        
        return Math.max(-0.15, Math.min(0.15, adjustment)); // Limit adjustment to ±15%
    }
    
    calculateAdvancedDistanceEstimates(measurements) {
        const focalLength = this.isCalibrated ? this.focalLength : this.cameraSpecs.estimatedFocalLength;
        const estimates = [];
        
        Object.keys(measurements).forEach(key => {
            const measurement = measurements[key];
            if (measurement.pixels > 0) {
                const distance = (measurement.realSize * focalLength) / measurement.pixels;
                const reliability = this.getAdvancedReliabilityScore(key, measurement.pixels, this.faceRotation);
                
                estimates.push({
                    name: key,
                    distance: distance,
                    reliability: reliability,
                    pixels: measurement.pixels
                });
            }
        });
        
        return estimates;
    }
    
    getAdvancedReliabilityScore(measurementType, pixelValue, rotation) {
        // Enhanced reliability scoring with rotation and quality factors
        const baseReliability = {
            interOcularDistance: 0.95,
            faceWidth: 0.85,
            faceHeight: 0.80,
            leftEyeWidth: 0.75,
            rightEyeWidth: 0.75,
            mouthWidth: 0.60,
            noseWidth: 0.85,
            noseHeight: 0.55
        }[measurementType] || 0.5;
        
        // Size bonus (larger measurements are more accurate)
        const sizeBonus = Math.min(pixelValue / 150, 1) * 0.1;
        
        // Rotation penalty
        const maxRotation = Math.max(Math.abs(rotation.pitch), Math.abs(rotation.yaw), Math.abs(rotation.roll));
        const rotationPenalty = Math.min(maxRotation / 30, 1) * 0.2;
        
        // Frame quality bonus
        const avgQuality = this.qualityHistory.length > 0 ? 
            this.qualityHistory.reduce((a, b) => a + b) / this.qualityHistory.length : 0.5;
        const qualityBonus = (avgQuality - 0.5) * 0.1;
        
        return Math.min(baseReliability + sizeBonus - rotationPenalty + qualityBonus, 1.0);
    }
    
    fuseMultiFrameEstimates() {
        if (this.frameBuffer.length === 0) return 50;
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        this.frameBuffer.forEach((frame, index) => {
            const timeWeight = this.fusionWeights[index] || 0.01;
            const qualityWeight = frame.quality;
            
            // Add stability weight - favor measurements closer to current stable distance
            let stabilityWeight = 1.0;
            if (this.currentStableDistance !== null) {
                const frameDistance = this.weightedDistanceEstimate(frame.estimates);
                const distanceFromStable = Math.abs(frameDistance - this.currentStableDistance);
                stabilityWeight = Math.max(0.7, 1.0 - (distanceFromStable / 30)); // Less aggressive, wider tolerance
            }
            
            const combinedWeight = timeWeight * qualityWeight * stabilityWeight;
            
            // Get weighted average of frame estimates
            const frameDistance = this.weightedDistanceEstimate(frame.estimates);
            
            weightedSum += frameDistance * combinedWeight;
            totalWeight += combinedWeight;
        });
        
        return totalWeight > 0 ? weightedSum / totalWeight : 50;
    }
    
    advancedSmoothing(newDistance) {
        this.distanceHistory.push(newDistance);
        
        if (this.distanceHistory.length > this.maxHistoryLength) {
            this.distanceHistory.shift();
        }
        
        // Require more history for stability
        if (this.distanceHistory.length < 5) return newDistance; // Increased back to 5
        
        // Use more measurements for better stability
        const recent = this.distanceHistory.slice(-8); // Increased from 3 to 8
        
        // Calculate simple moving average first
        const simpleAverage = recent.reduce((a, b) => a + b) / recent.length;
        
        // Apply exponential smoothing for stability
        let weightedSum = 0;
        let totalWeight = 0;
        const alpha = 0.7; // Smoothing factor
        
        for (let i = 0; i < recent.length; i++) {
            const weight = Math.pow(alpha, recent.length - 1 - i);
            weightedSum += recent[i] * weight;
            totalWeight += weight;
        }
        
        const smoothedDistance = weightedSum / totalWeight;
        
        // Blend simple average with exponential smoothing for stability
        const finalDistance = (simpleAverage * 0.3) + (smoothedDistance * 0.7);
        
        // Apply stability filtering
        return this.applyStabilityFilter(finalDistance);
    }
    
    applyStabilityFilter(newDistance) {
        const preciseNew = Math.round(newDistance * 10) / 10; // Round to 1 decimal place
        
        // If this is the first measurement
        if (this.lastDisplayedDistance === null) {
            this.lastDisplayedDistance = preciseNew;
            this.currentStableDistance = preciseNew;
            this.stabilityCounter = 0;
            return this.lastDisplayedDistance;
        }
        
        const exactDifference = Math.abs(newDistance - this.lastDisplayedDistance);
        const preciseDifference = Math.abs(preciseNew - this.lastDisplayedDistance);
        
        // Large stability zone - stay completely still for small fluctuations
        if (exactDifference <= this.stabilityZone) {
            this.stabilityCounter = 0; // Reset counter when in stable zone
            return this.lastDisplayedDistance; // Always stay with current value
        }
        
        // Filter out all noise - only allow significant changes
        if (exactDifference <= this.noiseThreshold || preciseDifference < this.hysteresisRange) {
            this.stabilityCounter = 0; // Reset counter for noise
            return this.lastDisplayedDistance; // Stay put
        }
        
        // Only update for very clear, sustained movement
        this.stabilityCounter++;
        
        // Require many frames of consistent movement before updating
        if (this.stabilityCounter >= this.stabilityThreshold) {
            this.lastDisplayedDistance = preciseNew;
            this.currentStableDistance = preciseNew;
            this.stabilityCounter = 0;
            return this.lastDisplayedDistance;
        }
        
        // Stay with current value until we have enough evidence
        return this.lastDisplayedDistance;
    }
    
    calculateCorrectedPosition(landmarks) {
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const centerX = (leftEye.x + rightEye.x) / 2;
        const centerY = (leftEye.y + rightEye.y) / 2;
        
        // Apply perspective correction
        const correctedX = centerX - (this.faceRotation.yaw * 0.01); // Adjust for head rotation
        const correctedY = centerY - (this.faceRotation.pitch * 0.01);
        
        const pixelX = correctedX * this.canvas.width;
        const pixelY = correctedY * this.canvas.height;
        
        return {
            x: pixelX - (this.canvas.width / 2),
            y: pixelY - (this.canvas.height / 2)
        };
    }
    
    calculateEnhancedConfidence(measurements, estimates, quality) {
        if (estimates.length === 0) return 0.1;
        
        // Multi-factor confidence calculation
        const measurementConfidence = estimates.length / Object.keys(measurements).length;
        const avgReliability = estimates.reduce((sum, e) => sum + e.reliability, 0) / estimates.length;
        
        // Consistency across estimates
        const distances = estimates.map(e => e.distance);
        const mean = distances.reduce((a, b) => a + b) / distances.length;
        const variance = distances.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / distances.length;
        const consistencyScore = Math.max(0, 1 - Math.sqrt(variance) / mean);
        
        // Temporal stability
        const temporalStability = this.qualityHistory.length > 0 ? 
            this.qualityHistory.reduce((a, b) => a + b) / this.qualityHistory.length : 0.5;
        
        // Frame quality
        const frameQuality = quality.score;
        
        // Adaptation status bonus
        const adaptationBonus = this.adaptationComplete ? 0.1 : 0;
        
        const finalConfidence = measurementConfidence * avgReliability * consistencyScore * 
                               temporalStability * frameQuality + adaptationBonus;
        
        return Math.min(finalConfidence, 0.99);
    }
    
    calculateDistance(point1, point2) {
        const dx = (point1.x - point2.x) * this.canvas.width;
        const dy = (point1.y - point2.y) * this.canvas.height;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    weightedDistanceEstimate(estimates) {
        if (estimates.length === 0) return 50;
        
        const cleanedEstimates = this.removeOutliers(estimates);
        if (cleanedEstimates.length === 0) return estimates[0].distance;
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        cleanedEstimates.forEach(estimate => {
            const weight = estimate.reliability;
            weightedSum += estimate.distance * weight;
            totalWeight += weight;
        });
        
        return totalWeight > 0 ? weightedSum / totalWeight : 50;
    }
    
    removeOutliers(estimates) {
        if (estimates.length < 3) return estimates;
        
        const distances = estimates.map(e => e.distance);
        const median = distances.sort((a, b) => a - b)[Math.floor(distances.length / 2)];
        
        // More aggressive outlier removal for better accuracy
        return estimates.filter(estimate => 
            Math.abs(estimate.distance - median) <= median * 0.25
        );
    }
    
    calibrateDistance() {
        if (!this.isRunning) {
            alert('Please start the camera first!');
            return;
        }
        
        const currentEyeDistance = this.getCurrentEyeDistance();
        if (currentEyeDistance) {
            this.calibrationEyeDistance = currentEyeDistance;
            this.focalLength = (currentEyeDistance * this.calibrationDistance) / this.adaptiveMeasurements.interOcularDistance.base;
            this.isCalibrated = true;
            
            alert(`Enhanced calibration successful!\nAdaptive eye distance: ${currentDistance.toFixed(1)}px\nPrecision focal length: ${this.focalLength.toFixed(1)}\n\nMaximum accuracy mode activated!`);
            
            // Reset for fresh high-precision measurements
            this.distanceHistory = [];
            this.frameBuffer = [];
        } else {
            alert('No face detected! Please ensure your face is visible and try again.');
        }
    }
    
    getCurrentEyeDistance() {
        return this.lastEyeDistance || null;
    }
    
    drawAdvancedVisualization(landmarks) {
        // Enhanced visualization with quality indicators
        
        // Dynamic colors based on measurement quality
        const avgQuality = this.qualityHistory.length > 0 ? 
            this.qualityHistory.reduce((a, b) => a + b) / this.qualityHistory.length : 0.5;
        
        const qualityColor = this.getQualityColor(avgQuality);
        
        // Eyes with quality-based coloring
        this.ctx.fillStyle = qualityColor;
        this.drawLandmark(landmarks[33], 4);  // Larger landmarks for better visibility
        this.drawLandmark(landmarks[263], 4);
        
        // Nose (red with transparency based on rotation)
        const maxRotation = Math.max(Math.abs(this.faceRotation.pitch), Math.abs(this.faceRotation.yaw));
        const rotationAlpha = Math.max(0.3, 1 - maxRotation / 30);
        this.ctx.fillStyle = `rgba(255, 0, 0, ${rotationAlpha})`;
        this.drawLandmark(landmarks[1], 3);
        this.drawLandmark(landmarks[6], 3);
        
        // Face outline (blue)
        this.ctx.fillStyle = '#0066ff';
        this.drawLandmark(landmarks[234], 3);
        this.drawLandmark(landmarks[454], 3);
        
        // Mouth (purple)
        this.ctx.fillStyle = '#ff00ff';
        this.drawLandmark(landmarks[61], 3);
        this.drawLandmark(landmarks[291], 3);
        
        // Draw enhanced measurement lines
        this.drawAdvancedMeasurementLines(landmarks, qualityColor);
        
        // Draw rotation indicators
        this.drawRotationIndicators();
    }
    
    getQualityColor(quality) {
        // Color gradient from red (poor) to green (excellent)
        const red = Math.round(255 * (1 - quality));
        const green = Math.round(255 * quality);
        return `rgb(${red}, ${green}, 0)`;
    }
    
    drawAdvancedMeasurementLines(landmarks, qualityColor) {
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.8;
        
        // Primary measurements (solid lines)
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = qualityColor;
        this.drawLine(landmarks[33], landmarks[263]); // Eye distance
        
        // Secondary measurements (dashed lines)
        this.ctx.setLineDash([3, 3]);
        this.ctx.strokeStyle = '#00ffff';
        this.drawLine(landmarks[234], landmarks[454]); // Face width
        
        this.ctx.strokeStyle = '#ffa500';
        this.drawLine(landmarks[129], landmarks[358]); // Nose width
        
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
    }
    
    drawRotationIndicators() {
        // Draw small rotation indicators in corner
        const x = this.canvas.width - 100;
        const y = 30;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(x - 5, y - 5, 90, 60);
        
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`P: ${this.faceRotation.pitch.toFixed(1)}°`, x, y + 10);
        this.ctx.fillText(`Y: ${this.faceRotation.yaw.toFixed(1)}°`, x, y + 25);
        this.ctx.fillText(`R: ${this.faceRotation.roll.toFixed(1)}°`, x, y + 40);
    }
    
    drawLine(point1, point2) {
        this.ctx.beginPath();
        this.ctx.moveTo(point1.x * this.canvas.width, point1.y * this.canvas.height);
        this.ctx.lineTo(point2.x * this.canvas.width, point2.y * this.canvas.height);
        this.ctx.stroke();
    }
    
    drawLandmark(landmark, size = 3) {
        const x = landmark.x * this.canvas.width;
        const y = landmark.y * this.canvas.height;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, 2 * Math.PI);
        this.ctx.fill();
    }
    
    updateDisplay(data) {
        this.lastEyeDistance = data.eyeDistance;
        
        const roundedDistance = Math.round(data.distance); // Back to whole numbers instead of decimals
        this.distanceValue.textContent = roundedDistance;
        
        // Enhanced color coding with more precision
        this.distanceValue.className = 'distance-value';
        const numericDistance = roundedDistance; // Use rounded value directly
        if (numericDistance < 35) {
            this.distanceValue.classList.add('distance-close');
        } else if (numericDistance >= 35 && numericDistance <= 85) {
            this.distanceValue.classList.add('distance-optimal');
        } else {
            this.distanceValue.classList.add('distance-far');
        }
        
        this.faceWidth.textContent = `${Math.round(data.faceWidth)} px`;
        this.eyeDistance.textContent = `${Math.round(data.eyeDistance)} px`;
        this.detectionConfidence.textContent = `${Math.round(data.confidence * 100)}%`;
        
        // Enhanced status with adaptation info
        let statusText;
        if (this.isCalibrated) {
            statusText = `Maximum precision mode (calibrated + adaptive)`;
        } else if (this.adaptationComplete) {
            statusText = `High precision mode (adaptive estimation)`;
        } else {
            statusText = `Learning facial structure... (${Math.round(this.frameCount/50*100)}%)`;
        }
        
        this.distanceInfo.querySelector('.status').textContent = statusText;
    }
    
    updateNoFaceDetected() {
        this.updateStatus('No face detected - move closer or improve lighting');
        this.resetDisplay();
    }
    
    resetDisplay() {
        this.distanceValue.textContent = '--';
        this.distanceValue.className = 'distance-value';
        this.faceWidth.textContent = '-- px';
        this.eyeDistance.textContent = '-- px';
        this.detectionConfidence.textContent = '--%';
        // this.posX.textContent = '-- px'; // Removed element
        // this.posY.textContent = '-- px'; // Removed element
        // this.posZ.textContent = '-- cm'; // Removed element
    }
    
    updateStatus(message) {
        const statusElement = this.distanceInfo.querySelector('.status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.');
        return;
    }
    
    if (typeof FaceMesh === 'undefined') {
        console.error('MediaPipe Face Mesh not loaded');
        alert('Required AI libraries not loaded. Please check your internet connection and try again.');
        return;
    }
    
    const detector = new FaceDistanceDetector();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden - detection continues in background');
    } else {
        console.log('Page visible - detection active');
    }
});

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
}); 