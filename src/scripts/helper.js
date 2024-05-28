
export function drawBuffer(width, height, context, data) {
    const step = Math.ceil(data.length / width)
    const amp = height / 2
    for (let i = 0; i < width; i++) {
        let min = 1.0
        let max = -1.0
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j]
            if (datum < min)
                min = datum
            if (datum > max)
                max = datum
        }
        context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp))
    }
}

export function drawAutocorrelation(autocorrelation, idcanvas) {
    const canvas = document.getElementById(idcanvas)
    canvas.width = window.innerWidth / 2
    canvas.height = window.innerHeight / 2
    const ctx = canvas.getContext('2d')

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Constants for drawing
    const width = canvas.width
    const height = canvas.height
    const maxAutocorrValue = Math.max(...autocorrelation)
    const padding = 40 // Padding for labels

    // Draw each point in the autocorrelation array
    autocorrelation.forEach((value, index) => {
        const x = (index / autocorrelation.length) * (width - padding) + padding / 2
        const y = (1 - (value / maxAutocorrValue)) * (height - padding) + padding / 2

        // Draw a line from the middle to the value point
        ctx.beginPath()
        ctx.moveTo(x, height - padding / 2) // Start at the bottom of the plot area
        ctx.lineTo(x, y) // Draw to the computed y
        ctx.strokeStyle = '#FF0000' // Red color for the line
        ctx.stroke()
    })

    // Draw labels on the X axis
    ctx.fillStyle = '#000000' // Black color for text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const xLabelIncrement = Math.ceil(autocorrelation.length / 10) // Label every 10th index or so
    for (let i = 0; i <= autocorrelation.length; i += xLabelIncrement) {
        const x = (i / autocorrelation.length) * (width - padding) + padding / 2
        ctx.fillText(i, x, height - padding / 4)
    }

    // Draw labels on the Y axis
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const yLabelIncrement = maxAutocorrValue / 5 // Five labels on the y-axis
    for (let i = 0; i <= 5; i++) {
        const value = (yLabelIncrement * i).toFixed(2)
        const y = (1 - (i / 5)) * (height - padding) + padding / 2
        ctx.fillText(value, padding / 2 - 10, y)
    }

    // Add a mouse click event listener to the canvas
    canvas.addEventListener('click', function (event) {
        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top

        // Check if the click is near the bottom (where the X axis is)
        if (y >= height - padding) {
            const index = Math.floor((x - padding / 2) / ((width - padding) / autocorrelation.length))
            if (index >= 0 && index < autocorrelation.length) {
                alert(`X value: ${index}`)
            }
        }
    })
}


export function findPeak(autocorrelation) {
    let peakValue = autocorrelation[0] // Initialize peakValue to the first element
    let peakIndex = 0 // Initialize peakIndex at 0

    for (let i = 1; i < autocorrelation.length; i++) {
        if (autocorrelation[i] > peakValue) {
            peakValue = autocorrelation[i]
            peakIndex = i
        }
    }

    return { peakValue, peakIndex }
}

export const clearCanvas = () => {
    const canvas2 = document.getElementById('autocorrelationCanvas2')
    canvas2.width = window.innerWidth / 2
    canvas2.height = window.innerHeight / 2
    const ctx2 = canvas2.getContext('2d')
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height)

    const canvasLeft = document.getElementById('leftChannelCanvas')
    const ctxLeft = canvasLeft.getContext('2d')
    ctxLeft.clearRect(0, 0, canvasLeft.width, canvasLeft.height)

    // const canvasRight = document.getElementById('rightChannelCanvas')
    // const ctxRight = canvasRight.getContext('2d')
    // ctxRight.clearRect(0, 0, canvasRight.width, canvasRight.height)
}

export async function fetchAudioContext(url, audioContext) {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    //const audioContext = new AudioContext()
    const decodeAudioData = await audioContext.decodeAudioData(arrayBuffer)
    return decodeAudioData
}

export function calculateCrossCorrelation(inputDataBuffer1, inputDataBuffer2, maxLag) {
    //let data1 = inputDataBuffer1.getChannelData(1)
    let data1 = inputDataBuffer1.getChannelData(0)
    let data2 = inputDataBuffer2.getChannelData(0)
    const n1 = data1.length, n2 = data2.length

    let crossCorrelations = new Array(maxLag + 1).fill(0)

    for (let lag = 0; lag <= maxLag; lag++) {
        let sum = 0
        for (let i = lag; i < n1 && (i - lag) < n2; i++) {
            sum += (data1[i]) * (data2[i - lag])
        }
        crossCorrelations[lag] = sum / (n1 - lag)
    }

    return crossCorrelations
}

// Example usage
export async function main() {
    const signal1 = await fetchAudioContext(recorded_noise)
    const signal2 = await fetchAudioContext(mlsaudio)
    console.log(signal1)
    console.log(signal2)
    // Assuming mono signals
    const correlation = calculateCrossCorrelation(signal1, signal2, 22050)
    //const correlation = crossCorrelate(signal1.getChannelData(0), signal2.getChannelData(0))
    //console.log(correlation)
    const peak = findPeak(correlation)
    console.log('Peak Value:', peak.peakValue, 'at Index:', peak.peakIndex)
    console.log('Latency = ', peak.peakIndex / signal1.sampleRate * 1000 + ' ms')
    drawAutocorrelation(correlation, 'autocorrelationCanvas2')
}


export const drawResults = (signalrecorded, recordedAudioURL, correlation) => {
    const canvasLeft = document.getElementById('leftChannelCanvas')
    drawBuffer(canvasLeft.width, canvasLeft.height, canvasLeft.getContext('2d'), signalrecorded.getChannelData(0))
    // const canvasRight = document.getElementById('rightChannelCanvas')
    // if (signalrecorded.numberOfChannels > 1) {
    //     drawBuffer(canvasRight.width, canvasRight.height, canvasRight.getContext('2d'), signalrecorded.getChannelData(1))
    // }
    drawAutocorrelation(correlation, 'autocorrelationCanvas2')

    document.getElementById('recordedaudio').src = recordedAudioURL
    document.getElementById('downloadableaudio').href = recordedAudioURL
    document.getElementById('downloadableaudio').disabled = false
}

/* White Noise Mozilla: https://mdn.github.io/webaudio-examples/audio-buffer/ */
export function generateMLS(length) {
    let register = Array(length).fill(0);
    register[length - 1] = 1; // Initial state with last bit set
    let sequence = [];
    let taps = [length - 1, length - 2]; // Example for a length of 31

    for (let i = 0; i < (1 << length) - 1; i++) {
        const newBit = taps.reduce((acc, tap) => acc ^ register[tap], 0);
        sequence.push(register.pop());
        register.unshift(newBit);
    }

    return sequence.map(bit => bit * 2 - 1); // Convert 0,1 to -1,1
}

// Step 3: Create an Audio Buffer and fill it with the MLS signal
export function createMLSBuffer(sequence, audioCtx) {
    const buffer = audioCtx.createBuffer(1, sequence.length, audioCtx.sampleRate);
    const channelData = buffer.getChannelData(0);
    sequence.forEach((value, index) => channelData[index] = value);
    return buffer;
}

// Step 4: Play the MLS signal
export function playMLS(buffer, audioCtx, callback) {
    
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
    source.onended = function() {
        console.log('Playback finished');
        callback()
        // Additional code to execute after playback finishes
    };
}

