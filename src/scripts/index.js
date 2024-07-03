import { TestLatencyMLS} from './test.js'

const debugCanvas = true

const TEST_LAT_MLS_BTN_ID = 'testlatencymlsbtn'

const constraints = { audio: {echoCancellation:false, noiseSuppression:false, autoGainControl:false, latency: 0, channelCount: 1 }}

const main = async () => {
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints)

    const ac = new AudioContext({latencyHint:0})

    TestLatencyMLS.initialize(ac, stream, TEST_LAT_MLS_BTN_ID, debugCanvas)
}
main()