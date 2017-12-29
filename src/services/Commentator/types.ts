import { DetectedFaceWithImageData } from '../PeriodicFaceDetector'
import { PersonSettings } from '../Settings'

export interface IdentifiedPerson {
	personId: string
	detectedFace: DetectedFaceWithImageData
	settings: PersonSettings
}

export interface PersonToCommentOn {
	/** The identified person we are commenting on. */
	readonly person: IdentifiedPerson
	/** The speech data for the comment being delivered */
	readonly comment: string
	/** When comment was delivered, in order to throttle and avoid spam of certain persons. */
	spokenOn?: Date
	/** Current state of comment, to keep track of what to comment on. */
	state: 'scheduled' | 'skipped' | 'delivered'
}

export interface PersonToCreate {
	readonly face: DetectedFaceWithImageData
	state: 'scheduled' | 'created' | 'declined' | 'timeout'
	createdPerson?: IdentifiedPerson
}
