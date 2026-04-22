import { TestLatencyMLS} from './test.js'

const TEST_LAT_MLS_BTN_ID = 'testlatencymlsbtn'

const constraints = { audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false, latency: 0, channelCount: 1 }}

const main = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        const ac = new AudioContext({latencyHint:0})
        TestLatencyMLS.initialize(ac, stream, TEST_LAT_MLS_BTN_ID)
    } catch (error) {
        console.error('Error accessing audio stream:', error)
    }
}
main()