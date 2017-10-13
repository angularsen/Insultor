const SUBSCRIPTIONKEY_DEFAULT = '93a68a5ab7d94ca0984fea54a332ad89';
const ENDPOINT_DEFAULT = 'https://westcentralus.api.cognitive.microsoft.com/face/v1.0/';

const FACE_ATTRIBUTES = "age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise";

class MsFaceApi {
	constructor(
    subscriptionKey = SUBSCRIPTIONKEY_DEFAULT,
		endpoint = ENDPOINT_DEFAULT,
	) {
		this.subscriptionKey = subscriptionKey;
		this.endpointDetectFace = endpoint + 'detect';
		this.endpointIdentifyFace = endpoint + 'identify';
		this.endpoint = endpoint;
	}

  /**
   * Detect face and analyze facial attributes of photo with Microsoft Face API.
   * @param {string} imageDataUrl URL encoded representation of image, obtained by canvas.toDataUrl()
	 * @returns Promise that on success returns an array of face entries ranked by face rectangle size in descending order, otherwise returns the error.
	 * An empty response indicates no faces detected.
	 * Face entry shape: { faceId: string, faceRectangle: Object, faceLandmarks: Object, faceAttributes: Object }
	 * @see https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395236
   */
  detectFacesAsync(imageDataUrl) {
    console.log('MsFaceApi: Detect face and analyze facial attributes with Microsoft Face API.');

		const method = 'POST';
    const url = `${this.endpointDetectFace}?returnFaceId=true&returnFaceAttributes=${FACE_ATTRIBUTES}&returnFaceLandmarks=false`;
    const headers = new Headers();
    headers.append("Content-Type", "application/octet-stream");
    headers.append("Ocp-Apim-Subscription-Key", this.subscriptionKey);

    const body = this.makeblob(imageDataUrl);

    return fetch(url, { method, headers, body })
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
      .then(detectedFaces => {
				if (detectedFaces.length > 0) {
					console.log(`MsFaceApi: No faces detected.`);
				}
				else {
					console.log(`MsFaceApi: Detected ${detectedFaces.length} faces.`, detectedFaces);
				}
				return detectedFaces;
      })
      .catch(err => {
				console.error('MsFaceApi: Failed to analyze face image.', err);
				throw err;
      });
  }

  /**
   * Identify up to 10 faces given a list of face IDs from a prior call to detectFaces().
   * @param {Array} Array of query faces faceIds, created by the detectFace(). Each of the faces are identified independently. The valid number of faceIds is between [1, 10].
	 * @returns Promise that on success returns the identified candidate person(s) for each query face. Otherwise returns the error.
	 * @see https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395239
   */
  identifyFacesAsync(faceIds, personGroupId = PERSONGROUPID_WEBSTEPTRONDHEIM) {
		if (faceIds.length < 1) throw new Error('Expected between 1 and 10 face IDs, got ' + faceIds.length);

		console.log(`MsFaceApi: Identify ${faceIds.length} faces with Microsoft Face API.`);

		const method = 'POST';
		const url = this.endpointIdentifyFace;
		const headers = new Headers();
		headers.append("Accept", "application/json");
		headers.append("Content-Type", "application/json");
		headers.append("Ocp-Apim-Subscription-Key", this.subscriptionKey);

		const body = JSON.stringify({
			faceIds,
			personGroupId,
			// maxNumOfCandidatesReturned = 1..5 (1),
			// confidenceThreshold = 0..1 (default depends)
		});

		return fetch(url, { method, headers, body })
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
			.then(identifiedFaces => {
				if (identifiedFaces.length > 0) {
					console.log(`MsFaceApi: No faces were identified.`);
				}
				else {
					console.info(`MsFaceApi: Detected ${identifiedFaces.length} faces.`, identifiedFaces);
				}
				return identifiedFaces;
			})
			.catch(err => {
				console.error('MsFaceApi: Failed to identify faces.', err);
				throw err;
			});
  }

	getPersonAsync(personGroupId, personId) {

		console.log(`MsFaceApi: Get person ${personId}.`);

				const method = 'GET';
				const url = `${this.endpoint}persongroups/${personGroupId}/persons/${personId}`;
				const headers = new Headers();
				headers.append("Accept", "application/json");
				headers.append("Ocp-Apim-Subscription-Key", this.subscriptionKey);

				return fetch(url, { method, headers })
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
					.catch(err => {
						console.error('MsFaceApi: Failed to get person.', err);
						throw err;
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

}

export default MsFaceApi;