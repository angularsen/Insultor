import React from 'react';
import ReactDOM from 'react-dom';
import moment from 'moment';

import Speech from './services/Speech';
import FaceApi from './services/MsFaceApi';
import FaceIdentityProvider from './services/FaceIdentityProvider';
import PresenceDetector from './services/PresenceDetector';
import { STATE_PRESENT, STATE_NOT_PRESENT } from './services/PresenceDetector';
// import Commentator from './services/Commentator';
import DiffCamEngine from './services/diff-cam-engine';

const STATE_FACE_DETECTED = 'face detected';
const STATE_PERSON_IDENTIFIED = 'person identified';

const PERSONGROUPID_WEBSTEPTRD = 'insultor-webstep-trd';

const speech = new Speech();

const getTimePeriodOfDay = () => {
  const now = moment();
  if (now.hour() < 5) return 'night';
  if (now.hour() < 12) return 'morning';
  if (now.hour() < 18) return 'evening';
  return 'late evening';
};

class Component extends React.Component {
  constructor() {
    super();

    this.whenLastAbove = undefined;
    this.motionScoreBelowThresholdSince = new Date();
    this.detectionBuffer = [];
    this.presenceDetector = new PresenceDetector({ onStateChanged: (state) => this.onPresenceStateChanged(state) });
    this.faceIdentityProvider = undefined;

    this.state = {
      width: 320, // We will scale the photo width to this
      height: 0, // This will be computed based on the input stream
      isPlaying: false,
      motionScore: 0,
      detectionState: STATE_NOT_PRESENT
    };

    this._initVideo = this._initVideo.bind(this);
    this._initMotionDiffCanvas = this._initMotionDiffCanvas.bind(this);
    this._initFaceApiCanvas = this._initFaceApiCanvas.bind(this);
    this._onDiffCamFrame = this._onDiffCamFrame.bind(this);
    this._initDiffCam = this._initDiffCam.bind(this);
  }

  componentDidMount() {
    console.log('Mounted IdentifyOnPresence.');
  }

  componentWillUnmount() {
    console.log('Unmounting IdentifyOnPresence.');
    this.stopVideo();
  }

  render() {
    const self = this;
    const { width, height } = this.state;

    const startStopButtonText = this.state.isPlaying ? 'Stop' : 'Start';
    const buttonStyle = { padding: '1em', minWidth: '6em' };
    const person = this.state.persons && this.state.persons[0];

    return (
      <div>
        <h1>Identify on presence</h1>
        <h3>{person ? `Hi ${person.name}` : ''}</h3>
        <h3>State: {this.state.detectionState}</h3>
        <div className="camera">
          <video style={{ border: '1px solid lightgrey' }} id="video" ref={this._initVideo} width={width} height={height} onCanPlay={ev => this.videoOnCanPlay(ev)}>Video stream not available.</video>
        </div>
        <div>
          <canvas style={{ border: '1px solid lightgrey' }} id="motion-diff-canvas" ref={this._initMotionDiffCanvas}></canvas>
        </div>
        <div>
          <canvas style={{ border: '1px solid lightgrey' }} id="faceapi-canvas" ref={this._initFaceApiCanvas} width={width} height={height}></canvas>
        </div>
        <div>
          <button style={buttonStyle} onClick={ev => this.startStopOnClick(ev)}>{startStopButtonText}</button>
        </div>
        <p>
          {this.state.textToSpeak ? this.state.textToSpeak : ''}
        </p>
        <p>
          Detection score: {this.state.motionScore}
        </p>
        <p>
          {this.state.error ? 'Error happened: ' + this.state.error : ''}
        </p>
      </div>
    );
  }

  videoOnCanPlay(ev) {
    const video = ev.target;

    console.log('IdentifyOnPresence: Video ready to play. Calculating output height.');

    // Scale height to achieve same aspect ratio for whatever our rendered width is
    const height = video.videoHeight / (video.videoWidth / this.state.width);
    this.setState({ height })
  }

  _initVideo(video) {
    this.video = video;
    if (!video) return;

    this.setState({ width: video.width, height: video.height });
    this._initDiffCam();
  }

  _initDiffCam() {
    // This method is called for the ref callback of both video and motionDiffCanvas
    if (this.video && this.motionDiffCanvas) {
      console.log('IdentifyOnPresence: Initialize DiffCamEngine');

      DiffCamEngine.init({
        video: this.video,
        motionCanvas: this.motionDiffCanvas,
        captureIntervalTime: 200,
        captureCallback: this._onDiffCamFrame,
        initSuccessCallback: () => DiffCamEngine.start()
      });
    }
  }

  onPresenceStateChanged(state) {
    this.setState({ detectionState: state });

    switch (state) {
      case STATE_PRESENT: {

        // this.speak('Hello');
        this.faceIdentityProvider.start();
        break;
      }

      case STATE_NOT_PRESENT: {
        console.info('Presence ended.')
        // this.speak('Bye');
        this.faceIdentityProvider.stop();
        break;
      }
    }
  }

  _onDiffCamFrame(frame) {
    this.presenceDetector.addMotionScore(frame.score);
    this.setState({ motionScore: frame.score });
  }

  startVideo(video) {
    // console.log('IdentifyOnPresence: Starting video...');
    _initVideo(this.video);
  }

  stopVideo(video) {
    // console.log('IdentifyOnPresence: Stopping video...');
    // console.log('IdentifyOnPresence: Stopping video...OK.');
    DiffCamEngine.stop();
  }

  startStopOnClick(ev) {
    ev.preventDefault();

    if (this.state.isPlaying) {
      this.stopVideo(this.video);
    } else {
      this.startVideo(this.video);
    }
  }

  _initMotionDiffCanvas(motionDiffCanvas) {
    this.motionDiffCanvas = motionDiffCanvas;
    if (!motionDiffCanvas) return;

    this._initDiffCam();
  }

  _initFaceApiCanvas(faceApiCanvas) {
    if (!faceApiCanvas) return;

    this.faceIdentityProvider = new FaceIdentityProvider(
      faceApiCanvas,
      new FaceApi(),
      PERSONGROUPID_WEBSTEPTRD,
      3200,
      x => this.onFacesDetected(x),
      x => this.onPersonsIdentified(x));
  }

  onFacesDetected(faces) {
    console.info(`IdentifyOnPresence: Detected ${faces.length} faces.`, faces);
    const detectionState = `${STATE_FACE_DETECTED}: ${faces.map(face => face.faceId).join(' ')}`;
    this.setState({detectionState})
  }

  onPersonsIdentified(persons) {
    console.info(`IdentifyOnPresence: Identified ${persons.length} persons.`, persons);
    const person = persons[0];
    const firstName = person.name.split(' ')[0];
    const detectionState = `${STATE_PERSON_IDENTIFIED}: ${persons.map(person => person.name).join(', ')}`;
    this.setState({detectionState})

    const period = getTimePeriodOfDay();
    switch (firstName) {
      case 'Andreas': {
        switch (period) {
          case 'morning':
            this.speak(`God morgen sjef! På tide å ta over verden!`);
            break;
          case 'evening':
            this.speak(`Hei igjen sjef, jeg håper du har hatt en flott dag i dag!`);
            break;
          case 'late evening':
            this.speak(`Det begynner å bli seint sjef, på tide å legge seg!`);
            break;
          case 'night':
            this.speak(`Oi.. Hva gjør du oppe nå, sjef?`);
            break;
          default:
            console.error('Unknown time period', period);
        }
        break;
      }
      case 'Marthe':{
        switch (period) {
          case 'morning':
            this.speak(`God morgen kjære! Ha en fantastisk dag i dag!`);
            break;
          case 'evening':
            this.speak(`Hei pus, hvordan går det? Jeg håper du har hatt en flott dag i dag!`);
            break;
          case 'late evening':
            this.speak(`Nå er det på tide å bysse lalle, ta med deg sjefen og finn senga så du er klar for morgendagen!`);
            break;
          case 'night':
            this.speak(`Oi.. Hva gjør du oppe midt på natta? Du må se å komme deg i seng pus.`);
            break;
          default:
            console.error('Unknown time period', period);
        }
        break;
      }
      case 'Wenche':{
        this.speak(`Hei ${firstName}, du ser flott i dag mor!`);
        break;
      }
      case 'Maria':{
        this.speak(`Hei ${firstName}, så fint å ha deg på besøk!`);
        break;
      }
      case 'Svein':{
        this.speak(`Hei ${firstName}, høvdingen selv er på besøk!`);
        break;
      }
      default: {
        this.speak(`Hei ${firstName}!`);
      }

    }
    this.setState({ persons });

    // We got our person, now let's wait until he leaves before we start detecting again
    this.faceIdentityProvider.stop();
  }

  speak(msg, opts) {
    this.setState({ textToSpeak: msg, speakOpts: opts });
    speech.speak(msg);
  }

}
export default Component;