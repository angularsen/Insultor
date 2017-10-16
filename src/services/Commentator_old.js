/**
 * Time from face detection until we stop waiting for face identification,
 * to deliver a generic comment on facial attributes instead of on the persona.
 */
const IDENTIFY_PERSON_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Minimum time between comments on an identified person.
 */
const COMMENT_COOLDOWN_PER_PERSON_MS = 30000; // 30 seconds - TODO Increase this to like 5 minutes when not actively developing and testing

/**
 * Minimum time between generic comments on an anonymous face (identification timed out).
 */
const COMMENT_COOLDOWN_ON_ANY_FACE_MS = 10000; // 10 seconds - TODO Increase this to like 1 minute when not actively developing and testing

class CommentatorStateMachine {
	constructor(initialStateName) {
		this.actions = {
			facesDetected: { name: 'FACES_DETECTED', invoke: this.onFacesDetected},
		};
		this.states = {
			notDetected: { name: 'NOT_DETECTED', actions: [this.actions.facesDetected] },
			facesDetected: 'FACES_DETECTED',
		};
		const stateNames = Object.values(this.states).map(x => x.name);
		if (!stateNames.some(x => x == initialStateName)) {
			throw new Error(`Initial state name [${initialStateName}] must match one of the defined states [${stateNames.join(', ')}]`);
		}
		this.state = initialState;
	}

	getStates() { return Object.values(this.states); }

	onAction(name, payload) {
		// const stateObj =  //this.getStates().find(x => x.name == name);
		// if (!stateObj) throw new Error('State not found: ' + name);
		const action = this.state.actions.find(x => x.name == name);
		if (!action) throw new Error('Action not found: ' + name);

		action.invoke(payload);
	}

	onFacesDetected(payload) {
		
	}

}

class Commentator {

	constructor() {
		this.faceIdToStateMap = new Map();
		this.fsm = new CommentatorStateMachine();
	}

  onFacesDetected(detectedFaces) {
		if (!detectedFaces || detectedFaces.length == 0) {
			console.error('No faces received.');
			return;
		}
		console.info(`Commentator: Detected ${detectedFaces.length} faces.`, detectedFaces);


		// TODO Support multiple faces
		const detectedFace = detectedFaces[0];
		const { faceId } = detectedFace;
		const faceState = this.faceIdToStateMap.get(faceId);

		if (faceState.identifyFaceTimeoutHandle !== undefined) {
			console.debug('Skipping face, already in the pridentifying')
			return;
		}

		const identifyFaceTimeoutHandle = setTimeout(() => {
			const faceState = this.faceIdToStateMap.get(faceId);
			if (!faceState) {
				console.error('No stored state for face: ' + faceId);
				return;
			}

			console.info('Timed out waiting for identification of face: ' + faceId);
			const newFaceState = {
				...faceState,
				state: 'face without identity'
			};
			this.faceIdToStateMap.set(faceId, newFaceState);

			this.commentOnFaceWithoutIdentity(detectedFace);
		}, IDENTIFY_PERSON_TIMEOUT_MS);

		this.faceIdToStateMap.set(faceId, {
			state: 'detected face',
			detectedOn: new Date(),
			detectedFace,
			identifyFaceTimeoutHandle
		});

  }

	/**
	 * 
	 * @param {*} faceIds Array of face IDs, each used to identify the person of the same index in the persons param.
	 * @param {*} persons Array of persons. See person_res.json for person object.
	 */
  onPersonsIdentified(faceIds, persons) {
		console.info(`Commentator: Identified ${persons.length} persons.`, persons);

		// TODO Handle multiple persons
		const faceId = faceIds[0];
		const person = persons[0];
		
		const faceState = this.faceIdToStateMap.get(faceId);
		if (!faceState) {
			console.error('No state for identified face: ' + faceId);
			return;
		}

		if (faceState.identifyFaceTimeoutHandle !== undefined) {
				console.debug('Cancel identify face timeout for face: ' + faceId);
				clearTimeout(identifyFaceTimeoutHandle);
				faceState = { ...faceState, identifyFaceTimeoutHandle: undefined };
				this.faceIdToStateMap.set(faceId, faceState);
		}

		faceState = { ...faceState, state: 'identified face' };
		this.faceIdToStateMap.set(faceId, faceState);

		if (faceState.lastCommented === undefined || (new Date() - faceState.lastCommented) > COMMENT_COOLDOWN_PER_PERSON_MS)
		this.commentOnFaceWithIdentity(faceState.detectedFace, person);
	}
	
	commentOnFaceWithoutIdentity(detectedFace) {
		console.info('Comment on face without identity.');
	}

	commentOnFaceWithIdentity(detectedFace, person) {
		console.info('Comment on face with identity.');

    const period = getTimePeriodOfDay();
		const firstName = person.name.split(' ')[0];


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
	}

}

export default Commentator;