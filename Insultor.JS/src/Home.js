import React from 'react';
import ReactDOM from 'react-dom';

const faceApiSubscriptionKey = '93a68a5ab7d94ca0984fea54a332ad89';
const faceApiEndpoint = 'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/detect';

// Request parameters.
const params = {
  "returnFaceId": "true",
  "returnFaceLandmarks": "false",
  "returnFaceAttributes": "age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise",
};

class Component extends React.Component
{
  constructor() {
    super();

    // this.width = 320;    // We will scale the photo width to this
    // this.height = 0;     // This will be computed based on the input stream
    // this.streaming = false;
    this.video = undefined;
    this.canvas = undefined;
    this.photo = undefined;
    this.startButton = undefined;

    this.state = {
      videoSrc: undefined,
      width: 320, // We will scale the photo width to this
      height: 0, // This will be computed based on the input stream
      photoSrc: undefined // Taken photo as an URL with data embedded
      // videoWidth: undefined,
      // videoHeight: undefined
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

    return (
      <div>
        <h1>Insult my Face!</h1>
        <div className="camera">
          <video style={{border: '1px solid lightgrey'}} id="video" ref={this.initVideo} width={width} height={height}>Video stream not available.</video>
        </div>
        <div>
          <button id="startbutton" onClick={ev => this._onStartButtonClick(ev)}>Take photo</button>
        </div>
        <canvas style={{border: '1px solid lightgrey'}} id="canvas" ref={this.initCanvas} width={width} height={height}>
        </canvas>
        <div className="output">
          { /* TODO REMOVE THIS */ }
          <img id="photo" style={{display: 'none'}} src={this.state.photoSrc} alt="The screen capture will appear in this box." />
        </div>
        <p>
          {this.state.joke ? this.state.joke : ''}
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

  initVideo(video) {
    this.video = video;
    if (!video) return;

    video.addEventListener('canplay', (ev) => {
      if (!this.state.streaming) {
        // Scale height to achieve same aspect ratio for whatever our rendered width is
        const height = video.videoHeight / (video.videoWidth / this.state.width);
        this.setState({ streaming: true, height });
      }
    }, false);

    console.log('Requesting video...')
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then((stream) => {
      console.log('Requesting video...OK!')
        video.srcObject = stream;
        video.play();
    })
    .catch((err) => {
        console.error("Requesting video...FAILED!", err);
        alert('Could not access video.\n\nSee console for details.');
    });
  }

  _onStartButtonClick(ev) {
      ev.preventDefault();
      this.takepicture();
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
    this.setState({photoSrc: data});
  }

  takepicture() {
    console.log('Take photo');
    const { width, height } = this.state;
    const canvas = this.canvas;
    const context = canvas.getContext('2d');
    if (width && height) {
      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      const imageDataUrl = canvas.toDataURL('image/png');
      this.setState({ photoSrc: imageDataUrl });

      const imageData = context.getImageData(0, 0, width, height);
      this.analyzeFace(imageDataUrl);
      //  createImageBitmap(canvas, 0, 0, width, height)
      //  .then(imageBitmap => {
      //    console.log('Image bitmap created. Uploading to Face API...');
      //    this.analyzeFace(imageBitmap);
      //  })
      //  .catch(err => console.error('Failed to create image bitmap.', err));
    } else {
      console.log('No width/height yet, clearing photo.')
      this.clearphoto();
    }
  }

  // args: CanvasRenderingContext2D.getImageData()
  analyzeFace(imageDataUrl) {
    // Perform the REST API call.
    const url = `${faceApiEndpoint}?returnFaceId=${params.returnFaceId}&returnFaceAttributes=${params.returnFaceAttributes}&returnFaceLandmarks=${params.returnFaceLandmarks}`;
    const headers = new Headers();
    headers.append("Content-Type", "application/octet-stream");
    headers.append("Ocp-Apim-Subscription-Key", faceApiSubscriptionKey);

    const body = this.makeblob(imageDataUrl);

    fetch(url,
      {
        method: 'POST',
        headers,
        body
      })
      .then(res => {
        if (!res.ok) throw new Error('Request failed', res);
        return res.json();
      })
      .then(resBody => {
        console.log('Face image was successfully analyzed.', resBody);
        const faceAnalysis = resBody[0]; // Array of analyses, per person?
        const joke = this.getJoke(faceAnalysis);
        this.setState({ faceAnalysis, joke });
      })
      .catch(err => {
        // Display error message.
        this.setState({ error: err })
        console.error('Failed to analyze face image.', err);
      });
  }

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

  getJoke(faceAnalysis) {
    const { faceAttributes } = faceAnalysis;
    const { smile, gender, age, facialHair, glasses, emotion, hair } = faceAttributes;
    const { bald, invisible, hairColor } = hair;
    const moustacheJoke = facialHair && facialHair.moustache && facialHair.moustache >= 0.5 ? `Do you know the difference between a moustache and a gay moustache? The smell!` : undefined;
    const beardJoke = facialHair && facialHair.beard && facialHair.beard >= 0.5 ? `Who shaves 10 times a day and still has a beard? The barber.` : undefined;
    const hairJoke = hairColor && hairColor.length > 0 ? `Am I seeing some grey spots inside that lush, ${hairColor[0].color} noggin?` : undefined;
    const emotionJoke = emotion && emotion.neutral >= 0.9
    ? `Lookin'.. neutral bro!`
    : emotion.anger >= 0.6
      ? `Whoa.. why so angry mister?`
      : emotion.happiness >= 0.6
        ? `Happy, so happy! I'm so happy today!`
        : undefined;

    const glassesJoke = this.getGlassesJoke(glasses);

    const jokes = [moustacheJoke, beardJoke, hairJoke, emotionJoke, glassesJoke].filter(joke => joke !== undefined);
    return jokes.join('<br />');
  }

  getGlassesJoke(glasses){
    switch (glasses) {
      case 'ReadingGlasses':
        return 'I was elected to LEAD, not to READ.';

      case 'Sunglasses':
        return 'Dude, drop the sunglasses. It\'s not SUNNY inside!';

      case 'SwimmingGoggles':
        return 'Swimming goggles... really? REALLY!?';

      default:
        return undefined;
    }
  }

}
export default Component;