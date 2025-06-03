## About

The following repository is a Proof Of Concept to measure the latency in modern web browsers by using a MLS signal (a type of noise). 
The app will play and record the MLS noise using the Web Audio API and will compute the cross correlation to estimate the delay. 
A graph is also displayed showing the resulting peak of the cross correlation and the wave form of audio data recorded.

As a mechanism to validate if the test went well or not, the ratio operation is introduced to calculate the relation between the peak and the rest of the signal in terms of energy. After running some tests a threshold of 1.8 aprox has been set, which means all ratios above that value are linked to a nice latency estimation and below are probably wrong.

![screenshot](doc/latency_test_result.png)

## How to run it locally:

Requirement: Node.js v14

1. `git clone https://github.com/gilpanal/weblatencytest.git`
2. `cd weblatencytest`
3. `npm i`
4. `npm run dev`
5. Navigate to `localhost:1234`
6. To perform several tests in a row use athe following query param like this: `http://localhost:1234/?numberOfTests=5`
