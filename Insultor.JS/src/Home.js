import React from 'react';
import ReactDOM from 'react-dom';

import Speech from './services/Speech';
import JokeProvider from './services/JokeProvider';

const speech = new Speech();
const faceApiSubscriptionKey = '93a68a5ab7d94ca0984fea54a332ad89';
const faceApiEndpoint = 'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/detect';

// Request parameters.
const params = {
  "returnFaceId": "true",
  "returnFaceLandmarks": "false",
  "returnFaceAttributes": "age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise",
};

// Free API supports 20 requests / minute => minimum 3 second periods
const FACE_API_THROTTLE_MS = 4000;

class Component extends React.Component {
  constructor() {
    super();

    this.videoStream = undefined;
    this.video = undefined;
    this.canvas = undefined;

    this.state = {
      videoSrc: undefined,
      width: 320, // We will scale the photo width to this
      height: 0, // This will be computed based on the input stream
      photoSrc: undefined // Taken photo as an URL with data embedded
    };

    this.initVideo = this.initVideo.bind(this);
    this.initCanvas = this.initCanvas.bind(this);
  }

  componentDidMount() {
  }

  render() {
    const self = this;
    const { width, height } = this.state;
    // if (!width && !height)
    console.log('Render');

    const takePhotoButtonDisabled = !this.state.isPlaying;
    const startStopButtonText = this.state.isPlaying ? 'Stop' : 'Start';
    const buttonStyle = { padding: '1em', minWidth: '6em' };

    return (
      <div>
        <h1>Insult my Face!</h1>
        <div className="camera">
          <video style={{ border: '1px solid lightgrey' }} id="video" ref={this.initVideo} width={width} height={height} onCanPlay={ev => this.videoOnCanPlay(ev)}>Video stream not available.</video>
        </div>
        <div>
          <button style={buttonStyle} onClick={ev => this.takePhotoOnClick(ev)} disabled={takePhotoButtonDisabled}>Take photo</button>
          <button style={buttonStyle} onClick={ev => this.startStopOnClick(ev)}>{startStopButtonText}</button>
          <button style={buttonStyle} onClick={ev => this.speakRandomJoke(ev)}>Insult me now!</button>
          <button style={buttonStyle} onClick={ev => this.didWifeyAppearAndItIsMorning(ev)}>Wifey appears in the morning</button>
          <button style={buttonStyle} onClick={ev => this.onBigChiefAppearAnItIsdMorning(ev)}>The big chief appears in the morning</button>
        </div>
        <canvas style={{ border: '1px solid lightgrey' }} id="canvas" ref={this.initCanvas} width={width} height={height}>
        </canvas>
        <div className="output">
          { /* TODO REMOVE THIS */}
          <img id="photo" style={{ display: 'none' }} src={this.state.photoSrc} alt="The screen capture will appear in this box." />
        </div>
        <p>
          {this.state.textToSpeak ? this.state.textToSpeak : ''}
        </p>
        <p>
          {this.state.faceAnalysis ? JSON.stringify(this.state.faceAnalysis) : ''}
        </p>
        <p>
          {this.state.error ? 'Error happened: ' + this.state.error : ''}
        </p>
      </div>
    );
  }

  videoOnCanPlay(ev) {
    const video = ev.target;

    console.log('Video ready to play. Calculating output height.');

    // Scale height to achieve same aspect ratio for whatever our rendered width is
    const height = video.videoHeight / (video.videoWidth / this.state.width);
    this.setState({ height })
  }

  initVideo(video) {
    this.video = video;
    if (!video) return;

    // console.log('Starting video on load.')
    // this.startVideo(video);
  }

  startVideo(video) {
    console.log('Starting video...');
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        console.log('Requesting video...OK!')
        this.videoStream = stream;
        video.srcObject = stream;
        video.play();

        this.setState({ isPlaying: true })
        console.log('Starting video...OK.');
        this.periodicallyAnalyzeFaceAsync(FACE_API_THROTTLE_MS);
      })
      .catch((err) => {
        console.error("Starting video...FAILED!", err);
        alert('Could not access video.\n\nSee console for details.');
      });
  }

  stopVideo(video) {
    console.log('Stopping video...');
    this.videoStream.getVideoTracks()[0].stop();
    video.pause();
    video.src = "";
    this.setState({ isPlaying: false })
    console.log('Stopping video...OK.');
  }

  takePhotoOnClick(ev) {
    ev.preventDefault();
    this.analyzeFaceInCurrentVideoStreamAsync();
  }

  startStopOnClick(ev) {
    ev.preventDefault();

    if (this.state.isPlaying) {
      this.stopVideo(this.video);
    } else {
      this.startVideo(this.video);
    }
  }

  initCanvas(canvas) {
    this.canvas = canvas;
    if (!canvas) return;
    this.clearphoto();
  }

  clearphoto() {
    console.log('Clear photo');

    const canvas = this.canvas;
    const context = canvas.getContext('2d');
    context.fillStyle = "#AAA";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const data = canvas.toDataURL('image/png');
    this.setState({ photoSrc: data });
  }

  async periodicallyAnalyzeFaceAsync(periodMs) {
    console.debug('periodicallyAnalyzeFaceAsync()')
    if (this.state.isPlaying) {
      // Only analyze if actually streaming video
      await this.analyzeFaceInCurrentVideoStreamAsync();
    }
    setTimeout(() => this.periodicallyAnalyzeFaceAsync(periodMs), periodMs);
  }

  async analyzeFaceInCurrentVideoStreamAsync() {
    try {
      console.log('Analyzing face...');
      const { width, height } = this.state;
      const canvas = this.canvas;
      const context = canvas.getContext('2d');

      if (!width || !height) {
        console.log('Width or height not set, clearing photo.')
        this.clearphoto();
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      const imageDataUrl = canvas.toDataURL('image/png');
      this.setState({ photoSrc: imageDataUrl });

      const imageData = context.getImageData(0, 0, width, height);
      await this.analyzeFaceAsync(imageDataUrl);

      console.log('Analyzing face...OK.');
    } catch (err) {
      console.error('Failed to analyze face.');
    }
  }

  // Promise
  analyzeFaceAsync(imageDataUrl) {
    console.log('analyzeFaceAsync');
    // Perform the REST API call.
    const url = `${faceApiEndpoint}?returnFaceId=${params.returnFaceId}&returnFaceAttributes=${params.returnFaceAttributes}&returnFaceLandmarks=${params.returnFaceLandmarks}`;
    const headers = new Headers();
    headers.append("Content-Type", "application/octet-stream");
    headers.append("Ocp-Apim-Subscription-Key", faceApiSubscriptionKey);

    const body = this.makeblob(imageDataUrl);

    return fetch(url,
      {
        method: 'POST',
        headers,
        body
      })
      .then(async res => {
        if (!res.ok) {
          switch (res.status) {
            case 429: {
              const err = new Error('Rate limit exceeded.');
              err.response = res;
              err.responseBody = await res.json();
              throw err;
            }
            default: {
              const err = new Error(`Request failed with status ${res.status} ${res.statusText}`);
              err.response = res;
              err.responseBody = await res.json();
              throw err;
            }
          }
        }
        return res.json();
      })
      .then(resBody => {
        console.log('Face image was successfully analyzed.', resBody);
        const faceAnalysis = resBody[0]; // Array of analyses, per person?
        const joke = this.getJoke(faceAnalysis);
        this.setState({ faceAnalysis, textToSpeak: joke });
      })
      .catch(err => {
        // Display error message.
        this.setState({ error: err })
        console.error('Failed to analyze face image.', err);
      });
  }

  // Convert a data URL to a file blob for POST request
  makeblob(dataURL) {
    var BASE64_MARKER = ';base64,';
    if (dataURL.indexOf(BASE64_MARKER) == -1) {
      var parts = dataURL.split(',');
      var contentType = parts[0].split(':')[1];
      var raw = decodeURIComponent(parts[1]);
      return new Blob([raw], { type: contentType });
    }
    var parts = dataURL.split(BASE64_MARKER);
    var contentType = parts[0].split(':')[1];
    var raw = window.atob(parts[1]);
    var rawLength = raw.length;

    var uInt8Array = new Uint8Array(rawLength);

    for (var i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
  }

  speakRandomJoke() {
    const joke = new JokeProvider().randomJoke();
    this.speak(joke);
  }

  speak(msg, opts) {
    this.setState({ textToSpeak: msg, speakOpts: opts });
    speech.speak(msg);
  }

  didWifeyAppearAndItIsMorning(buttonClickEvent) {
    console.info('Wifey appeared and it is morning.')
    const text = new JokeProvider().randomWifeyMorningCompliment();
    this.speak(text, { theme: 'romantic' })
  }

  onBigChiefAppearAnItIsdMorning(buttonClickEvent) {
    console.info('The big chief appeared and it is morning.')
    const text = new JokeProvider().randomWifeyMorningCompliment();
    this.speak(text, { theme: 'heroic' })
  }

}
export default Component;