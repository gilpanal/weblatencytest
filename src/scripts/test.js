import { drawResults, findPeak, clearCanvas, calculateCrossCorrelation } from './helper.js'
import { generateMLS } from './mls.js'


export class TestLatencyMLS {

    currentlatency = null

    noiseBuffer = null

    static setCurrentLatency(latvalue) {
        localStorage.setItem('latency', latvalue)
        TestLatencyMLS.currentlatency = latvalue
    }
    static getCurrentLatency() {
        return TestLatencyMLS.currentlatency
    }

    static async initialize() {        
       
        const currentlatency = localStorage.getItem('latency')
        TestLatencyMLS.currentlatency = currentlatency ? parseInt(currentlatency) : null
        TestLatencyMLS.audioContext = TestLatencyMLS.audioNode = null
        TestLatencyMLS.content = document.getElementById('newtestlatency')
        
        /* OPTION 2: fails in iOS */
        TestLatencyMLS.start()
        
        /* OPTION 1*/
        //TestLatencyMLS.displayStart()
     
    }

    static onAudioPermissionGranted(inputStream) {
        let AudioContext = window.AudioContext || window.webkitAudioContext || false
        TestLatencyMLS.audioContext = new AudioContext({ latencyHint: 0 })
        const noisemls = generateMLS(16, 2)
        TestLatencyMLS.noiseBuffer = TestLatencyMLS.generateAudio(noisemls, TestLatencyMLS.audioContext.sampleRate);
        TestLatencyMLS.inputStream = inputStream
        
        /* OPTION 2: fails in iOS */
        TestLatencyMLS.displayStart()
        
        /* OPTION 1*/             
        //TestLatencyMLS.onAudioSetupFinished()
    }

    static start() {
       
        //$('#testlatency').popover('hide')                   
        const constraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency:0  } }
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then(TestLatencyMLS.onAudioPermissionGranted).catch(TestLatencyMLS.onAudioInputPermissionDenied)
        }
        else {
            TestLatencyMLS.onAudioInputPermissionDenied(`Can't access getUserMedia.`)
        }
    }

    static displayStart() {
       
        TestLatencyMLS.content.innerHTML = ''
        TestLatencyMLS.startbutton = document.createElement('a')
        TestLatencyMLS.startbutton.innerText = 'TEST LATENCY'
        TestLatencyMLS.startbutton.classList.add('btn-outline-success')
        
        /* OPTION 1*/
        //TestLatencyMLS.startbutton.onclick = TestLatencyMLS.start

        /* OPTION 2: fails in iOS */
        TestLatencyMLS.startbutton.onclick = TestLatencyMLS.onAudioSetupFinished 

        TestLatencyMLS.content.appendChild(TestLatencyMLS.startbutton)
        // $('#testlatency').popover('hide')
        // $('#testlatency').popover({
        //     trigger: 'focus'
        // })
        clearCanvas()
    }

    static onAudioInputPermissionDenied(error) {
        console.log(error)
    }

    static async onAudioSetupFinished() {        
        // workaround for Safari in case alert is displayed for detleting a track
        if(TestLatencyMLS.audioContext.state === 'suspended'){
            await TestLatencyMLS.audioContext.resume()
        }
        TestLatencyMLS.startbutton.innerText = 'STOP'
        TestLatencyMLS.startbutton.classList.remove('btn-outline-success')
        TestLatencyMLS.startbutton.classList.add('btn-outline-danger')
        TestLatencyMLS.startbutton.onclick = TestLatencyMLS.displayStart
        
        TestLatencyMLS.prepareAudioToPlayAndrecord()       
        
    }

    static prepareAudioToPlayAndrecord() {
    
        const noiseSource = TestLatencyMLS.audioContext.createBufferSource();
       
        noiseSource.buffer = TestLatencyMLS.noiseBuffer;
       
        noiseSource.connect(TestLatencyMLS.audioContext.destination);

        TestLatencyMLS.audioContext.createMediaStreamSource(TestLatencyMLS.inputStream)

        let chunks = []
      
        const mediaRecorder = new MediaRecorder(TestLatencyMLS.inputStream)

        mediaRecorder.ondataavailable = async (event) => {
            console.log(event.data)
            chunks.push(event.data)
        }
        mediaRecorder.onstop = async () => {
            TestLatencyMLS.displayAudioTagElem(chunks, mediaRecorder.mimeType)
        }
        //mediaRecorder.start(300)
        mediaRecorder.start()
  
        noiseSource.start()
        noiseSource.onended = function () {
            mediaRecorder.stop()
            TestLatencyMLS.finishTest()
        }
    }

    static finishTest() {
        TestLatencyMLS.startbutton.innerText = 'PROCESSING... '
        TestLatencyMLS.startbutton.classList.remove('btn-outline-danger')
        TestLatencyMLS.startbutton.classList.add('btn-outline-primary')
        TestLatencyMLS.startbutton.onclick = TestLatencyMLS.displayStart
        //$('#testlatency').popover('hide')
    }   
    static async blobToAudioBuffer(audioContext, blob) {
        const arrayBuffer = await blob.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
      }
    static async displayAudioTagElem(chunks, mimeType) {
        
        const recordedAudio = new Blob(chunks, { type: mimeType })
        const recordedAudioURL = URL.createObjectURL(recordedAudio)
        //const signalrecorded = await fetchAudioContext(recordedAudioURL, TestLatencyMLS.audioContext)
        const signalrecorded = await TestLatencyMLS.blobToAudioBuffer(TestLatencyMLS.audioContext, recordedAudio)
        let mlssignal =  TestLatencyMLS.noiseBuffer

        console.log('signalrecorded', signalrecorded)
        console.log('mlssignal', mlssignal)        
        const maxDelayExpected = 0.300
        const maxLag = maxDelayExpected * TestLatencyMLS.audioContext.sampleRate        
        const correlation = calculateCrossCorrelation(signalrecorded, mlssignal, maxLag)
        
        const peak = findPeak(correlation)
        //console.log('Peak Value:', peak.peakValue, 'at Index:', peak.peakIndex)
        const roundtriplatency = peak.peakIndex / mlssignal.sampleRate * 1000
        console.log('Latency = ', roundtriplatency + ' ms')
        TestLatencyMLS.setCurrentLatency(roundtriplatency)
        TestLatencyMLS.startbutton.innerText = 'TEST AGAIN '
        TestLatencyMLS.startbutton.innerHTML += `<span class='badge badge-info'>lat: ${roundtriplatency} ms.</span>`
        TestLatencyMLS.startbutton.classList.remove('btn-outline-danger')
        drawResults(signalrecorded, recordedAudioURL, correlation)
    }

    /* White Noise Mozilla: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode*/
    static generateAudio(mlsSequence, frequency = 44100) {
        
        // IMPORTANT: Check the frequency of the system if different from 44100
        
        const audioBuffer = TestLatencyMLS.audioContext.createBuffer(1, mlsSequence.length, frequency);

        let bufferData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < mlsSequence.length; i++) {
            // Convert binary sequence to audio signal
            bufferData[i] = mlsSequence[i] === 1 ? 1.0 : -1.0;  // Map 1 to 1.0 and 0 to -1.0
        }

        return audioBuffer
    }
}
