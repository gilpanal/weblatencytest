import { drawResults, clearCanvas } from './helper'
import { generateMLS } from './mls'

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

const CANVAS = `<div class='container' id='audio-area'>
                    <canvas id='leftChannelCanvas' width='800' height='100' style='border:1px solid #000000;'></canvas>
                    <canvas id='rightChannelCanvas' width='800' height='100' style='border:1px solid #000000;' hidden></canvas>
                    <canvas id='autocorrelationCanvas1' style='border:1px solid #000000;'></canvas>
                    <canvas id='autocorrelationCanvas2' style='border:1px solid #000000;' hidden></canvas>
                </div>`

export class TestLatencyMLS {

    noiseBuffer = null

    silenceBuffer = null

    debugCanvas = false
    
    audioContext = null

    worker = null

    signalrecorded = null
    
    btnId = null

    inputStream = null

    recordGainNode = null

    static getCorrectStreamForSafari(stream){
        const safariVersionIndex = navigator.userAgent.indexOf('Version/')
        const versionString =  navigator.userAgent.substring(safariVersionIndex + 8)
        const safariVersion = parseFloat(versionString)        
        if(isSafari && safariVersion > 16){
            const micsource = TestLatencyMLS.audioContext.createMediaStreamSource(stream)
            TestLatencyMLS.recordGainNode = TestLatencyMLS.audioContext.createGain()
            micsource.connect(TestLatencyMLS.recordGainNode)
            // If echocancellation is set to false in constraints the input gain from mic is very low, 
            // that's why we need to increase it to 50
            const defaultGain = 50
            TestLatencyMLS.recordGainNode.gain.value = defaultGain
            const dest = TestLatencyMLS.audioContext.createMediaStreamDestination()
            // If echocancellation is set to false in constraints the input when using wired earpods (with mic) 
            // is stereo but one single channel (left) so we need to force channelCount to be 1
            dest.channelCount = 1
            TestLatencyMLS.recordGainNode.connect(dest)
            return dest.stream
        } else {
            return stream
        }
    }

    static async initialize(ac, stream, btnId, debugCanvas) {

        TestLatencyMLS.btnId = btnId

        TestLatencyMLS.worker = new Worker(
            new URL('worker.js', import.meta.url),
            {type: 'module'}
        )
        TestLatencyMLS.worker.addEventListener('message', (message) => {
            TestLatencyMLS.workerMessageHanlder(message)
        })
                 
        if(debugCanvas){
            console.log('AudioContext', ac)
            TestLatencyMLS.debugCanvas = debugCanvas
            document.getElementById('page-header').insertAdjacentHTML('afterend', CANVAS)
        }        
            
        TestLatencyMLS.audioContext = ac
        TestLatencyMLS.onAudioPermissionGranted(stream)
    }

    static onAudioPermissionGranted(inputStream) {
        
        const noisemls = generateMLS(15)
        TestLatencyMLS.noiseBuffer = TestLatencyMLS.generateAudio(noisemls, TestLatencyMLS.audioContext.sampleRate)
        TestLatencyMLS.silenceBuffer = TestLatencyMLS.generateSilence(noisemls, TestLatencyMLS.audioContext.sampleRate)
        const userMediaStream =  TestLatencyMLS.getCorrectStreamForSafari(inputStream)
        
        TestLatencyMLS.inputStream = userMediaStream
        if(TestLatencyMLS.debugCanvas){
            userMediaStream.getAudioTracks().forEach(async function(track) {
                console.log('Test Latency Track Settings', track)
                console.log('Test Latency Track Settings', track.getSettings())
            })
        }
        TestLatencyMLS.displayStart()
    }


    static displayStart() {

        TestLatencyMLS.content = document.getElementById(TestLatencyMLS.btnId)
        TestLatencyMLS.content.innerHTML = ''        
        TestLatencyMLS.startbutton = document.createElement('a')
        TestLatencyMLS.startbutton.innerText = 'TEST LATENCY'
        TestLatencyMLS.startbutton.onclick = TestLatencyMLS.onAudioSetupFinished
        TestLatencyMLS.content.appendChild(TestLatencyMLS.startbutton)
    
        if(TestLatencyMLS.debugCanvas){
            clearCanvas()
        }
    }

    static async onAudioSetupFinished() {
        TestLatencyMLS.startbutton.innerText = 'STOP'       
        TestLatencyMLS.startbutton.onclick = TestLatencyMLS.displayStart
        TestLatencyMLS.prepareAudioToPlayAndrecord()
    }

    static prepareAudioToPlayAndrecord() {

        TestLatencyMLS.signalrecorded = null

        const silenceSource = TestLatencyMLS.audioContext.createBufferSource()

        silenceSource.buffer = TestLatencyMLS.silenceBuffer

        silenceSource.connect(TestLatencyMLS.audioContext.destination)
       
        const doTheTest = () => {

            const noiseSource = TestLatencyMLS.audioContext.createBufferSource()
            noiseSource.buffer = TestLatencyMLS.noiseBuffer

            noiseSource.connect(TestLatencyMLS.audioContext.destination)

            let chunks = []

            const mediaRecorder = new MediaRecorder(TestLatencyMLS.inputStream)

            mediaRecorder.ondataavailable = async (event) => {
                chunks.push(event.data)
            }
            mediaRecorder.onstop = async () => {
                noiseSource.disconnect(TestLatencyMLS.audioContext.destination)
                TestLatencyMLS.displayAudioTagElem(chunks, mediaRecorder.mimeType)
            }

            mediaRecorder.start()

            noiseSource.start()
            noiseSource.onended = function () {
                mediaRecorder.stop()
                TestLatencyMLS.finishTest()
            }
        }
        silenceSource.start()
        silenceSource.onended = function () {
            silenceSource.disconnect(TestLatencyMLS.audioContext.destination)
            doTheTest()
        }
    }

    static finishTest() {
        TestLatencyMLS.startbutton.innerText = 'PROCESSING... '
        TestLatencyMLS.startbutton.onclick = TestLatencyMLS.displayStart        
    }

    static async blobToAudioBuffer(audioContext, blob) {
        const arrayBuffer = await blob.arrayBuffer()
        return await audioContext.decodeAudioData(arrayBuffer)
    }

    static workerMessageHanlder(message){
        if(message.data.correlation){
            TestLatencyMLS.correlation = message.data.correlation
            TestLatencyMLS.worker.postMessage({
                command: 'findpeak',
                array: TestLatencyMLS.correlation,
                channel: message.data.channel
            })
        }
        if(message.data.peakValuePow){                 
            TestLatencyMLS.displayresults(message.data, TestLatencyMLS.signalrecorded, TestLatencyMLS.noiseBuffer, TestLatencyMLS.correlation)
        }
    }
    static async displayAudioTagElem(chunks, mimeType) {
        
        const recordedAudio = new Blob(chunks, { type: mimeType })
        
        TestLatencyMLS.signalrecorded = await TestLatencyMLS.blobToAudioBuffer(TestLatencyMLS.audioContext, recordedAudio)
        
        if(TestLatencyMLS.debugCanvas){
            console.log('signalrecorded', TestLatencyMLS.signalrecorded)
            console.log('mlssignal', TestLatencyMLS.noiseBuffer)
        }
        
        TestLatencyMLS.correlation = null
        TestLatencyMLS.worker.postMessage({
            command: 'correlation',
            data1: TestLatencyMLS.signalrecorded.getChannelData(0), 
            data2: TestLatencyMLS.noiseBuffer.getChannelData(0), 
            maxLag: (0.600 * TestLatencyMLS.audioContext.sampleRate),
            channel: 0
        })
        URL.revokeObjectURL(recordedAudio)
    }

    static generateAudio(mlsSequence, frequency) {        

        const audioBuffer = TestLatencyMLS.audioContext.createBuffer(1, mlsSequence.length, frequency)
        let bufferData = audioBuffer.getChannelData(0)
        for (let i = 0; i < mlsSequence.length; i++) {
            // Convert binary sequence to audio signal
            bufferData[i] = mlsSequence[i] === 1 ? 1.0 : -1.0  // Map 1 to 1.0 and 0 to -1.0
        }
        return audioBuffer
    }

    static generateSilence(mlsSequence, frequency) {  

        const audioBuffer = TestLatencyMLS.audioContext.createBuffer(1, mlsSequence.length, frequency)
        let bufferData = audioBuffer.getChannelData(0)        
        const silenght = Math.trunc(mlsSequence.length/8)
        for (let i = 0; i < silenght ; i++) {
            bufferData[i] = 0
        }
        return audioBuffer
    }

    static displayresults(peak, signalrecorded, mlssignal, correlation) {
       
        if(peak.channel === 0){
            const roundtriplatency = Number(peak.peakIndex / mlssignal.sampleRate * 1000).toFixed(2)
            const ratioIs = Math.log10(peak.peakValuePow / peak.mean)
            console.log('Corr Ratio', ratioIs)
            if(ratioIs <= 1.8){
                console.error('The Latency Test did not go well, there could be an issue with the audio settings')
            }
            //console.log('Corr ABS(Ratio)', Math.abs(ratioIs))
            TestLatencyMLS.startbutton.innerText = 'TEST AGAIN '
            TestLatencyMLS.startbutton.innerHTML += `<span class='badge badge-info'>lat: ${roundtriplatency} ms.</span><br>`
            TestLatencyMLS.startbutton.innerHTML += `<span class='badge badge-light'>ratio: ${ratioIs.toFixed(2)}</span>`
            if(TestLatencyMLS.debugCanvas) {
                console.log('Channel', peak.channel )
                console.log('Latency = ', roundtriplatency + ' ms')
                drawResults(signalrecorded.getChannelData(0), 'leftChannelCanvas', 'autocorrelationCanvas1', correlation)
                console.log('signalrecorded.numberOfChannels', signalrecorded.numberOfChannels)
                if(signalrecorded.numberOfChannels>1){
                    document.getElementById('rightChannelCanvas').hidden = false
                    document.getElementById('autocorrelationCanvas2').hidden = false
                    TestLatencyMLS.correlation = null
                    TestLatencyMLS.worker.postMessage({
                        command: 'correlation',
                        data1: TestLatencyMLS.signalrecorded.getChannelData(1), 
                        data2: TestLatencyMLS.noiseBuffer.getChannelData(0), 
                        maxLag: (0.600 * TestLatencyMLS.audioContext.sampleRate),
                        channel: 1
                    })
                }
            }
        } else{
            console.log('Channel', peak.channel )
            const roundtriplatency = peak.peakIndex / mlssignal.sampleRate * 1000
            console.log('Latency = ', roundtriplatency + ' ms')
            const ratioIs = Math.log10(peak.peakValuePow / peak.mean)
            console.log('Corr Ratio', ratioIs)
            drawResults(signalrecorded.getChannelData(1),  'rightChannelCanvas', 'autocorrelationCanvas2', TestLatencyMLS.correlation)
        }      
    }
}