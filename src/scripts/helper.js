
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
