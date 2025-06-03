
function drawBuffer(width, height, context, data) {
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
    canvas.width = window.innerWidth * 0.75
    canvas.height = window.innerHeight * 0.75
    const ctx = canvas.getContext('2d')

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Constants for drawing
    const width = canvas.width
    const height = canvas.height
    const maxAutocorrValue = Math.max(...autocorrelation)
    const padding = 180 // Padding for labels

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
}

export const clearCanvas = () => {
    const canvas1 = document.getElementById('autocorrelationCanvas1')
    canvas1.width = window.innerWidth / 2
    canvas1.height = window.innerHeight / 2
    const ctx1 = canvas1.getContext('2d')
    ctx1.clearRect(0, 0, canvas1.width, canvas1.height)

    const canvas2 = document.getElementById('autocorrelationCanvas2')
    canvas2.width = window.innerWidth / 2
    canvas2.height = window.innerHeight / 2
    const ctx2 = canvas2.getContext('2d')
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height)

    const canvasLeft = document.getElementById('leftChannelCanvas')
    const ctxLeft = canvasLeft.getContext('2d')
    ctxLeft.clearRect(0, 0, canvasLeft.width, canvasLeft.height)

    const canvasRight = document.getElementById('rightChannelCanvas')
    const ctxRight = canvasRight.getContext('2d')
    ctxRight.clearRect(0, 0, canvasRight.width, canvasRight.height)
}

export const drawResults = (signalrecorded, audioCanvasId, corrCanvasId, correlation) => {
    const canvasSide = document.getElementById(audioCanvasId)
    drawBuffer(canvasSide.width, canvasSide.height, canvasSide.getContext('2d'), signalrecorded)
    drawAutocorrelation(correlation, corrCanvasId)
}

export const drawLatencyHistogram = (data, canvasId) => {
    const topMargin = 30; // space for count labels above bars
    const bottomMargin = 30;
    const leftMargin = 40;   
    
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Count frequency of each latency
    const freqMap = {};
    data.forEach(item => {
        const latency = item.latency.toFixed(2);
        freqMap[latency] = (freqMap[latency] || 0) + 1;
    });

    const labels = Object.keys(freqMap).sort((a, b) => parseFloat(a) - parseFloat(b));
    const values = labels.map(label => freqMap[label]);

    const slotWidth = (canvas.width - leftMargin) / labels.length;
    const barWidth = slotWidth * 0.2; // use 60% of the slot for the bar
    const barSpacing = slotWidth * 0.4; // space between bars
    const maxVal = Math.max(...values);
    const scaleY = (canvas.height - bottomMargin - topMargin) / maxVal;

    // Draw axis
    ctx.beginPath();
    ctx.moveTo(leftMargin, topMargin);  // top of Y axis
    ctx.lineTo(leftMargin, canvas.height - bottomMargin);  // bottom Y axis
    ctx.lineTo(canvas.width, canvas.height - bottomMargin); // X axis
    ctx.stroke();

    // Draw bars
   labels.forEach((label, i) => {
        const count = values[i];
        const barHeight = count * scaleY;
        const x = leftMargin + i * slotWidth;
        const y = canvas.height - bottomMargin - barHeight;

        // Draw bar
        ctx.fillStyle = '#4285F4';
        ctx.fillRect(x + barSpacing / 2, y, barWidth, barHeight);

        // Draw latency label
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + slotWidth / 2, canvas.height - 10);
        ctx.fillText(count, x + slotWidth / 2, y - 5);
    });


    // Draw Y-axis labels
    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.fillText('', 5, 20);
    ctx.fillText('', canvas.width / 2, canvas.height - 5);
}