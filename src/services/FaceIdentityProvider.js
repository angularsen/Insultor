// On free plan (~3 seconds between requests)
// const REQUESTS_PER_MINUTE_MAX = 20;
const REPEAT_MS_DEFAULT = 3200; // Slightly above throttle limit
const REPEAT_MS_MIN = 1000;

class FaceIdentityProvider {
	/**
	 * Create a photo-based identiy provider using Microsoft Face API.
	 * @param {Canvas} canvas
	 * @param {number} repeatMs
   * @param {Action} onFacesDetected Detected one or more faces, including facial attributes.
   * @param {Action} onFacesIdentified Identified one or more faces in the given person group of stored faces.
	 */
	constructor(
    canvas,
    faceApi,
    personGroupId,
    repeatMs = REPEAT_MS_DEFAULT,
    onFacesDetected = undefined,
    onFacesIdentified = undefined,
  ) {
		if (!canvas) {
			throw new Error('Canvas must be set.');
		}
		if (repeatMs < REPEAT_MS_MIN) {
			throw new Error('Face API does not accept more than 20 transactions per minute on free plan, so cap this at minimum 1 second although that can only run for 20 seconds before hitting the limit. The idea is to run this in bursts until identity is confirmed then back and only occasionally re-identify to see if any new persons have shown up.');
    }
    if (!faceApi) {
			throw new Error('Face API must be set.');
    }
    if (!personGroupId) {
			throw new Error('Person group ID must be set.');
    }

		this.canvas = canvas;
    this.repeatMs = repeatMs;
    this.onFacesDetected = onFacesDetected;
    this.onPersonsIdentified = onFacesIdentified;
    this.faceApi = faceApi;
    this.personGroupId = personGroupId;
  }

  /**
   * Start analyzing face identity every few seconds in the background
   * using images from the <video> element passed into the constructor.
   */
  start() {
    console.info(`FaceIdentityProvider: Start analyzing face identities every ${this.repeatMs} ms.`)
    this.isRunning = true;
    this.periodicallyAnalyzeFaceWhileRunning();
  }

  /**
   * Stop analyzing face identities.
   * */
  stop() {
    console.info(`FaceIdentityProvider: Stop analyzing faces.`);
    this.isRunning = false;
  }

  async periodicallyAnalyzeFaceWhileRunning() {
    if (!this.isRunning) {
      console.info('FaceIdentityProvider: Stopped analyzing.');
      return;
    }

    const analyzeStart = new Date();
    await this.identifyFacesInVideoAsync();
    const analyzeDurationMs = new Date() - analyzeStart;

    // Subtract time spent waiting for results from Face API
    const waitDurationMs = Math.max(0, this.repeatMs - analyzeDurationMs);
    console.debug(`FaceIdentityProvider: Waiting ${waitDurationMs} ms before retrying...`)
    setTimeout(() => this.periodicallyAnalyzeFaceWhileRunning(), waitDurationMs);
  }

  async identifyFacesInVideoAsync() {
    try {
      console.log('FaceIdentityProvider: Identify faces in video...');
      const canvas = this.canvas;
      const context = canvas.getContext('2d');

      // Draw current content of <video> element to canvas
      context.drawImage(video, 0, 0, video.width, video.height);

      const imageDataUrl = canvas.toDataURL('image/png');

      // Send image to Face API for analysis
      const detectedFaces = await this.faceApi.detectFacesAsync(imageDataUrl);
      if (detectedFaces.length === 0) {
        console.debug('No faces detected.');
        return;
      }

      if (this.onFacesDetected) this.onFacesDetected(detectedFaces);

      const detectedFaceIds = detectedFaces.map(face => face.faceId);
      const identifiedFaces = await this.faceApi.identifyFacesAsync(detectedFaceIds, this.personGroupId);
      if (identifiedFaces.length === 0) {
        console.debug('Failed to identify any faces.');
        return;
      }

      const identifiedPersons = await Promise.all(identifiedFaces
        .filter(face => face.candidates.length > 0)
        .map(face => this.faceApi.getPersonAsync(this.personGroupId, face.candidates[0].personId)));

      if (this.onPersonsIdentified) this.onPersonsIdentified(identifiedPersons);

      console.log('FaceIdentityProvider: Identify faces in video...OK.');
    } catch (err) {
      console.error('FaceIdentityProvider: Failed to identify faces.', err);
    }
  }


}

export default FaceIdentityProvider;