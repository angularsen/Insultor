import React from 'react';
import ReactDOM from 'react-dom';

import Speech from './services/Speech';
import DiffCamEngine from './services/diff-cam-engine.js';

const MotionThreshold = 100;  // Motion detected if frame.score value is greater than this
const InitialDetectionDurationMs = 500;
const MaxInitialDetectionGapMs = 500;
const MaxPresenceDetectionGapMs = 5000; // Once present, be lenient about person standing still for a few seconds

const speech = new Speech();

class Component extends React.Component {
  constructor() {
    super();

    this.whenLastAbove = undefined;
    this.motionScoreBelowThresholdSince = new Date();
    this.detectionState = 'not present';
    this.detectionBuffer = [];

    this.state = {
      width: 320, // We will scale the photo width to this
      height: 0, // This will be computed based on the input stream
      isPlaying: false,
      motionScore: 0,
      detectionState: 'not present'
    };

    this._initVideo = this._initVideo.bind(this);
    this._initCanvas = this._initCanvas.bind(this);
    this._onDiffCamFrame = this._onDiffCamFrame.bind(this);
    this._initDiffCam = this._initDiffCam.bind(this);
  }

  componentDidMount() {
  }

  render() {
    const self = this;
    const { width, height } = this.state;

    const startStopButtonText = this.state.isPlaying ? 'Stop' : 'Start';
    const buttonStyle = { padding: '1em', minWidth: '6em' };

    return (
      <div>
        <h1>DiffCam</h1>
        <div className="camera">
          <video style={{ border: '1px solid lightgrey' }} id="video" ref={this._initVideo} width={width} height={height} onCanPlay={ev => this.videoOnCanPlay(ev)}>Video stream not available.</video>
        </div>
        <div>
          <button style={buttonStyle} onClick={ev => this.startStopOnClick(ev)}>{startStopButtonText}</button>
        </div>
        <canvas style={{ border: '1px solid lightgrey' }} id="canvas" ref={this._initCanvas} width={width} height={height}>
        </canvas>
        <div className="output">
          { /* TODO REMOVE THIS */}
          <img id="photo" style={{ display: 'none' }} src={this.state.photoSrc} alt="The screen capture will appear in this box." />
        </div>
        <p>
          {this.state.textToSpeak ? this.state.textToSpeak : ''}
        </p>
        <p>
          Detection score: {this.state.motionScore} ({this.state.detectionState})
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

  _initVideo(video) {
    this.video = video;
    if (!video) return;

    this._initDiffCam();
  }

  _initDiffCam() {
    // This method is called for the ref callback of both video and canvas
    if (this.video && this.canvas) {
      console.log('Initialize DiffCamEngine');
      DiffCamEngine.init({
        video: this.video,
        motionCanvas: this.canvas,
        captureIntervalTime: 200,
        captureCallback: this._onDiffCamFrame,
        initSuccessCallback: () => DiffCamEngine.start()
      });
    }
  }

  
  _onDiffCamFrame(frame) {
    const isMotionDetected = frame.score > MotionThreshold;

    switch (this.state.detectionState){
      case 'not present': {
        if (isMotionDetected) {
          if (this.motionStart === undefined){
            console.info('Initial detection of person.')
            this.motionStart = new Date();
          }
          this.lastMotionOn = new Date();
          const motionDuration = new Date() - this.motionStart;
          if (motionDuration > InitialDetectionDurationMs) {
            console.info('Presence detected.')
            this.speak('Well hello there, handsome!');
            this.setState({ detectionState: 'present' });
          }
        } else {
          const detectionGapDuration = new Date() - this.lastMotionOn;
          if (detectionGapDuration > MaxInitialDetectionGapMs) {
            // Reset initial detection timers if detection gap is too long
            console.info('Timed out on gap in initial detection.')
            this.motionStart = undefined;
            this.lastMotionOn = undefined;
          }
        }
        break;
      }

      case 'present': {
        if (isMotionDetected) {
          // Presence is sustained
          this.lastMotionOn = new Date();
        } else {
          const detectionGapDuration = new Date() - this.lastMotionOn;
          if (detectionGapDuration > MaxPresenceDetectionGapMs) {
            // Motion no longer detected, demote to not present if person is out of camera view for some time
            console.info('Presence ended.')
            this.speak('See you later!');
            this.motionStart = undefined;
            this.lastMotionOn = undefined;
            this.setState({ detectionState: 'not present' });
          }
        }
        break;
      }
    }

    this.setState({ motionScore: frame.score });
  }

  startVideo(video) {
    // console.log('Starting video...');
  }

  stopVideo(video) {
    // console.log('Stopping video...');
    // console.log('Stopping video...OK.');
  }

  startStopOnClick(ev) {
    ev.preventDefault();

    if (this.state.isPlaying) {
      this.stopVideo(this.video);
    } else {
      this.startVideo(this.video);
    }
  }

  _initCanvas(canvas) {
    this.canvas = canvas;
    if (!canvas) return;
    this.clearphoto();

    this._initDiffCam();
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

  speak(msg, opts) {
    this.setState({ textToSpeak: msg, speakOpts: opts });
    speech.speak(msg);
  }

}
export default Component;