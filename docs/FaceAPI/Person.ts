export interface UserData {
	/** True if anonymous, false or not set if assigned an identity by a human */
	anonymous?: boolean
	/** ISO date/time string */
	created: string
	firstName: string
	lastName: string
}

/** Result of adding a face image to a person. */
export interface AddPersonFaceResponse {
	persistedFaceId: AAGUID
}

/**
 * Result of creating a person in a person group.
 */
export interface CreatePersonResponse {
	personId: AAGUID
}

export interface Person {
	personId: AAGUID
	persistedFaceIds: AAGUID[]
	name: string
	userData: UserData
}

export default Person
