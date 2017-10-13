const MotionThreshold = 100;  // Motion detected if frame.score value is greater than this
const InitialDetectionDurationMs = 500;
const MaxInitialDetectionGapMs = 500;
const MaxPresenceDetectionGapMs = 5000; // Once present, be lenient about person standing still for a few seconds

const defaultOpts = {
	motionScoreThreshold: 100,
	onStateChanged: undefined,
};

export const STATE_NOT_PRESENT = 'not present';
export const STATE_PRESENT = 'present';

class PresenceDetectorOpts {

  constructor(motionScoreThreshold, onStateChanged){
    this.motionScoreThreshold = motionScoreThreshold;
    this.onStateChanged = onStateChanged;
  }
}

class PresenceDetector {
  // opts: { motionScoreThreshold: number, onStateChanged: Action<'not present'|'present'> }
  /**
   *
   * @param {PresenceDetectorOpts} opts
   */
	constructor(opts) {
		this.opts = { ...defaultOpts, ...opts };
    this.detectionState = STATE_NOT_PRESENT;
	}

	// Call this method for every frame received from diff-cam-engine, or some other means to calculate motion score
	addMotionScore(motionScore, receivedOnDate) {

    const isMotionDetected = motionScore > this.opts.motionScoreThreshold;

    switch (this.detectionState){
      case STATE_NOT_PRESENT: {
        if (isMotionDetected) {
          if (this.motionStart === undefined){
            console.info('Initial detection of person.')
            this.motionStart = new Date();
          }
          this.lastMotionOn = new Date();
          const motionDuration = new Date() - this.motionStart;
          if (motionDuration > InitialDetectionDurationMs) {
            console.info('Presence detected.')
            this.setDetectionState(STATE_PRESENT);
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

      case STATE_PRESENT: {
        if (isMotionDetected) {
          // Presence is sustained
          this.lastMotionOn = new Date();
        } else {
          const detectionGapDuration = new Date() - this.lastMotionOn;
          if (detectionGapDuration > MaxPresenceDetectionGapMs) {
            // Motion no longer detected, demote to not present if person is out of camera view for some time
            console.info('Presence ended.')
            this.motionStart = undefined;
            this.lastMotionOn = undefined;
            this.setDetectionState(STATE_NOT_PRESENT);
          }
        }
        break;
      }
    }
  }

  setDetectionState(state) {
    this.detectionState = state;

    if (this.opts.onStateChanged) {
      this.opts.onStateChanged(state);
    }
  }
}

export default PresenceDetector;