import { TestLatencyMLS} from './test.js'

const debugCanvas = true

const urlParams = new URLSearchParams(window.location.search)
const numberOfTests = parseInt(urlParams.get('numberOfTests')) || 1
console.log('Number of Tests in a row: ', numberOfTests)

const TEST_LAT_MLS_BTN_ID = 'testlatencymlsbtn'

const constraints = { audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false, latency: 0, channelCount: 1 }}

const main = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        console.log('stream')
        const ac = new AudioContext({latencyHint:0})
        TestLatencyMLS.initialize(ac, stream, TEST_LAT_MLS_BTN_ID, debugCanvas, numberOfTests)
    } catch (error) {
        document.getElementById('log-message').innerText = error
    }
}
main()