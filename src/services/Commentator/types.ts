import { DetectedFaceWithImageData } from '../PeriodicFaceDetector'
import { PersonSettings } from '../Settings'

export interface IdentifiedPerson {
	personId: string
	detectedFace: DetectedFaceWithImageData
	settings: PersonSettings
}

export interface PersonToCommentOn {
		readonly identifiedPerson: IdentifiedPerson,
		readonly comment: string,
		state: 'scheduled' | 'skipped' | 'delivered'
}

export interface PersonToCreate {
	readonly face: DetectedFaceWithImageData
	state: 'scheduled' | 'created' | 'declined' | 'timeout'
	createdPerson?: IdentifiedPerson
}
