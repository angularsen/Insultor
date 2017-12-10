import { DetectedFaceWithImageData } from '../PeriodicFaceDetector'
import { checkDefined } from '../utils';

import { IdentifiedPerson, PersonToCreate, PersonToCommentOn } from './types';

/** Holds data gathered during a detect - identify - create persons - comment cycle. */
class DetectIdentifyCommentCycleData {
	constructor(
		public facesToIdentify: ReadonlyArray<DetectedFaceWithImageData> = [],
		public facesDetectedDuringCycle: ReadonlyArray<DetectedFaceWithImageData> = [],
		public identifiedPersons: ReadonlyArray<IdentifiedPerson> = [],
		private personsToCommentOn: ReadonlyArray<PersonToCommentOn> = [],
		private personsToCreate: ReadonlyArray<PersonToCreate> = [],
	) { }

	public addPersonsToCommentOn(persons: ReadonlyArray<PersonToCommentOn>): any {
		this.personsToCommentOn = this.personsToCommentOn.concat(persons)
	}

	public getRemainingPersonsToCreate(): any {
		return this.personsToCreate.filter(p => p.state === 'scheduled')
	}
	public getNextPersonToCreate(): PersonToCreate | undefined {
		return this.personsToCreate.filter(p => p.state === 'scheduled')[0]
	}

	public getNextPersonToCommentOn(): PersonToCommentOn | undefined {
		return this.personsToCommentOn.filter(p => p.state === 'scheduled')[0]
	}

	public addFacesToIdentify(detectedFaces: ReadonlyArray<DetectedFaceWithImageData>): any {
		this.facesToIdentify = this.facesToIdentify.concat(detectedFaces)
	}

	public didIdentifyPersons(persons: IdentifiedPerson[]) {
		this.identifiedPersons = this.identifiedPersons.concat(persons)

		const unrecognizedFaces = this.facesToIdentify
			.filter(f => this.identifiedPersons
				.map(p => p.detectedFace.faceId)
				.includes(f.faceId) === false)

		this.personsToCreate = this.personsToCreate.concat(
			unrecognizedFaces.map((face): PersonToCreate => ({
				face,
				state: 'scheduled',
			})))
	}

	public didDetectFacesDuringCycle(faces: ReadonlyArray<DetectedFaceWithImageData>) {
		this.facesDetectedDuringCycle = this.facesDetectedDuringCycle.concat(faces)
	}

	public didCreatePerson(createdPerson: IdentifiedPerson) {
		const personToCreate = this._getNextPersonToCreate()
		personToCreate.createdPerson = createdPerson
		personToCreate.state = 'created'
	}

	public didDeclineToCreatePerson() {
		const personToCreate = this._getNextPersonToCreate()
		personToCreate.state = 'declined'
	}

	public didTimeoutOnCreatePerson() {
		const personToCreate = this._getNextPersonToCreate()
		personToCreate.state = 'timeout'
	}

	public didCommentOnPerson() {
		const person = this._getNextPersonToCommentOn()
		person.state = 'delivered'
	}

	public didSkipCommentForPerson() {
		const person = this._getNextPersonToCommentOn()
		person.state = 'skipped'
	}

	private _getNextPersonToCreate() {
		return checkDefined(this.getNextPersonToCreate(), 'No next person to create.')
	}

	private _getNextPersonToCommentOn() {
		return checkDefined(this.getNextPersonToCommentOn(), 'No next person to comment on.')
	}
}

export default DetectIdentifyCommentCycleData
