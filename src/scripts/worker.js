// Listen for messages from the main thread
addEventListener('message', (message) => {
    if (message.data.command === 'correlation') {
      calculateCrossCorrelation(message.data.data1, message.data.data2, message.data.maxLag, message.data.channel)
    }
  
    if (message.data.command === 'findpeak') {
      findPeakAndMean(message.data.array, message.data.channel)
    }
  })
  
  
  function calculateCrossCorrelation(data1, data2, maxLag, channel) {
    const n1 = data1.length, n2 = data2.length
    let crossCorrelations = new Array(maxLag + 1).fill(0)
  
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0
      for (let i = lag; i < n1 && (i - lag) < n2; i++) {
        sum += (data1[i]) * (data2[i - lag])
      }
      crossCorrelations[lag] = sum / (n1 - lag)
    }
  
    postMessage({ correlation: crossCorrelations, channel: channel })
  }
  
  function findPeakAndMean(array, channel) {
    let peakIndex = 0
    let energy = 0
    let peakValuePow = Math.pow(array[0], 2)
  
    for (let i = 1; i < array.length; i++) {
        const samplePow = Math.pow(array[i], 2)
        if (samplePow > peakValuePow) {
            peakValuePow = samplePow
            peakIndex = i
        }
        energy += samplePow
    }
    const mean = energy / array.length
    postMessage({ peakValuePow, peakIndex, mean, channel })
  }