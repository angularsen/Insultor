const defaultOpts = {
	motionScoreThreshold: 100,
	onStateChanged: undefined,
};

class PresenceDetector {
	// opts: { motionScoreThreshold: number, onStateChanged: Action<'not present'|'present'> }
	constructor(opts) {
		this.opts = { ...defaultOpts, opts };
		this.detectionState = 'not present';
	}

	// Call this method for every frame received from diff-cam-engine, or some other means to calculate motion score
	addMotionScore(motionScore, when) {

    const isMotionDetected = frame.score > this.opts.motionScoreThreshold;

    switch (this.detectionState){
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

}

export default PresenceDetector;