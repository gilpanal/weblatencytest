import { TestLatencyMLS} from './test.js'

const debugCanvas = true

const TEST_LAT_MLS_BTN_ID = 'testlatencymlsbtn'

const constraints = { audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false, latency: 0, channelCount: 1 }}

const main = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        console.log('stream')
        const ac = new AudioContext({latencyHint:0})
        TestLatencyMLS.initialize(ac, stream, TEST_LAT_MLS_BTN_ID, debugCanvas)
    } catch (error) {
        document.getElementById('log-message').innerText = error
    }
}
main()